import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

import { config } from '../config/env.js';

const DEFAULT_IMAGE = 'gosom/google-maps-scraper:latest';
const TERMINAL_REMOTE_STATUSES = new Set(['completed', 'failed']);

export class MapsScraperAdapterError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'MapsScraperAdapterError';
    this.code = options.code || 'maps_scraper_error';
    this.statusCode = options.statusCode || 502;
    this.metadata = options.metadata || {};
  }
}

function toDurationString(input) {
  const value = String(input || '').trim();
  if (!value) {
    return '3m';
  }

  if (/[a-z]/i.test(value)) {
    return value;
  }

  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '3m';
  }

  return `${numeric}ms`;
}

function parseJsonPayload(payload) {
  if (!payload || !payload.trim()) {
    return [];
  }

  const trimmed = payload.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && Array.isArray(parsed.results)) {
      return parsed.results;
    }

    return parsed ? [parsed] : [];
  } catch {
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}

function buildCliArgs(request, resultsPath, inputPath) {
  const args = [
    '-input',
    inputPath,
    '-results',
    resultsPath,
    '-json',
    '-lang',
    request.language,
    '-depth',
    String(request.depth),
    '-c',
    String(request.concurrency),
    '-exit-on-inactivity',
    toDurationString(request.exitOnInactivity)
  ];

  if (request.includeEmails) {
    args.push('-email');
  }

  if (request.fastMode) {
    args.push('-fast-mode');
  }

  return args;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timeoutId = null;

    const handleFailure = (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      reject(error);
    };

    if (options.timeoutMs) {
      timeoutId = setTimeout(() => {
        child.kill('SIGKILL');
        handleFailure(new MapsScraperAdapterError('Maps scraper timed out.', {
          code: 'maps_scraper_timeout',
          statusCode: 504,
          metadata: { command, args }
        }));
      }, options.timeoutMs);
    }

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      handleFailure(new MapsScraperAdapterError('Failed to start maps scraper process.', {
        code: 'maps_scraper_launch_failed',
        statusCode: 503,
        metadata: {
          command,
          args,
          stderr,
          cause: error.message
        }
      }));
    });

    child.on('close', (code) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (code !== 0) {
        return handleFailure(new MapsScraperAdapterError('Maps scraper exited with a non-zero status.', {
          code: 'maps_scraper_failed',
          statusCode: 502,
          metadata: {
            command,
            args,
            exitCode: code,
            stdout,
            stderr
          }
        }));
      }

      resolve({ stdout, stderr });
    });
  });
}

async function runDockerProvider(request) {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'maps-scraper-'));
  const queriesPath = path.join(workspace, 'queries.txt');
  const resultsPath = path.join(workspace, 'results.json');
  const image = config.mapsScraper.dockerImage || DEFAULT_IMAGE;

  await fs.writeFile(queriesPath, `${request.query}\n`, 'utf8');

  const containerInputPath = '/work/queries.txt';
  const containerResultsPath = '/work/results.json';
  const args = [
    'run',
    '--rm',
    '-v',
    `${workspace}:/work`,
    image,
    ...buildCliArgs(request, containerResultsPath, containerInputPath)
  ];

  try {
    const { stderr } = await runCommand('docker', args, {
      timeoutMs: request.timeoutMs
    });
    const fileContents = await fs.readFile(resultsPath, 'utf8');

    return {
      provider: 'local-docker',
      version: image,
      results: parseJsonPayload(fileContents),
      diagnostics: {
        stderr
      }
    };
  } finally {
    await fs.rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}

async function runBinaryProvider(request) {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'maps-scraper-'));
  const queriesPath = path.join(workspace, 'queries.txt');
  const resultsPath = path.join(workspace, 'results.json');
  const binaryPath = config.mapsScraper.binaryPath || 'google-maps-scraper';

  await fs.writeFile(queriesPath, `${request.query}\n`, 'utf8');

  try {
    const { stderr } = await runCommand(binaryPath, buildCliArgs(request, resultsPath, queriesPath), {
      timeoutMs: request.timeoutMs
    });
    const fileContents = await fs.readFile(resultsPath, 'utf8');

    return {
      provider: 'local-binary',
      version: binaryPath,
      results: parseJsonPayload(fileContents),
      diagnostics: {
        stderr
      }
    };
  } finally {
    await fs.rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    throw new MapsScraperAdapterError(body.message || `Remote scraper request failed (${response.status}).`, {
      code: 'maps_scraper_remote_failed',
      statusCode: response.status,
      metadata: {
        url,
        body
      }
    });
  }

  return body;
}

async function runRemoteProvider(request) {
  const baseUrl = String(config.mapsScraper.baseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) {
    throw new MapsScraperAdapterError('MAPS_SCRAPER_BASE_URL is required for the remote provider.', {
      code: 'maps_scraper_remote_config_missing',
      statusCode: 503
    });
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (config.mapsScraper.apiKey) {
    headers.Authorization = `Bearer ${config.mapsScraper.apiKey}`;
  }

  const createResponse = await fetchJson(`${baseUrl}/api/v1/jobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: request.query,
      keywords: [request.query],
      lang: request.language,
      depth: request.depth,
      email: request.includeEmails,
      fast_mode: request.fastMode,
      max_time: Math.max(30, Math.ceil(request.timeoutMs / 1000))
    })
  });

  const remoteJobId = createResponse.job_id || createResponse.id;
  if (!remoteJobId) {
    throw new MapsScraperAdapterError('Remote scraper did not return a job identifier.', {
      code: 'maps_scraper_remote_job_missing',
      statusCode: 502,
      metadata: {
        createResponse
      }
    });
  }

  const startedAt = Date.now();
  const pollIntervalMs = config.mapsScraper.remotePollMs;

  while (Date.now() - startedAt < request.timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const statusResponse = await fetchJson(`${baseUrl}/api/v1/jobs/${remoteJobId}`, {
      headers
    });

    const status = String(statusResponse.status || '').toLowerCase();
    if (!TERMINAL_REMOTE_STATUSES.has(status)) {
      continue;
    }

    if (status === 'failed') {
      throw new MapsScraperAdapterError(statusResponse.error || 'Remote scraper job failed.', {
        code: 'maps_scraper_remote_job_failed',
        statusCode: 502,
        metadata: {
          remoteJobId,
          statusResponse
        }
      });
    }

    return {
      provider: 'external-rest',
      version: baseUrl,
      providerJobId: remoteJobId,
      results: Array.isArray(statusResponse.results) ? statusResponse.results : [],
      diagnostics: {
        statusResponse
      }
    };
  }

  throw new MapsScraperAdapterError('Remote scraper timed out before the job completed.', {
    code: 'maps_scraper_remote_timeout',
    statusCode: 504,
    metadata: {
      remoteJobId
    }
  });
}

export async function runMapsScraper(request) {
  const provider = config.mapsScraper.provider;
  const normalizedRequest = {
    query: String(request.query || '').trim(),
    language: request.language || config.mapsScraper.language,
    depth: request.depth || config.mapsScraper.depth,
    concurrency: request.concurrency || config.mapsScraper.concurrency,
    includeEmails: request.includeEmails ?? config.mapsScraper.includeEmails,
    fastMode: request.fastMode ?? config.mapsScraper.fastMode,
    exitOnInactivity: request.exitOnInactivity || config.mapsScraper.exitOnInactivity,
    timeoutMs: request.timeoutMs || config.mapsScraper.timeoutMs
  };

  if (!normalizedRequest.query) {
    throw new MapsScraperAdapterError('Maps scraper query is required.', {
      code: 'maps_scraper_query_missing',
      statusCode: 400
    });
  }

  if (provider === 'local-docker' || provider === 'docker') {
    return runDockerProvider(normalizedRequest);
  }

  if (provider === 'local-binary' || provider === 'binary') {
    return runBinaryProvider(normalizedRequest);
  }

  if (provider === 'external-rest' || provider === 'remote') {
    return runRemoteProvider(normalizedRequest);
  }

  throw new MapsScraperAdapterError(`Unsupported maps scraper provider: ${provider}`, {
    code: 'maps_scraper_provider_invalid',
    statusCode: 503
  });
}
