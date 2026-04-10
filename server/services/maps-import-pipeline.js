import * as db from './db.js';
import { runMapsScraper } from './maps-scraper-adapter.js';
import { normalizeMapsPlaces } from './maps-normalizer.js';

export async function importMapsLeads({
  userId,
  keyword,
  location,
  limit,
  jobId
}) {
  const query = location ? `${keyword} in ${location}` : keyword;

  await db.updateJob(jobId, { status: 'running' });
  await db.logEvent(jobId, 'info', 'Starting maps scraper ingestion.', {
    query,
    limit
  });

  const adapterResult = await runMapsScraper({
    query,
    limit
  });

  await db.logEvent(jobId, 'info', 'Maps scraper finished.', {
    provider: adapterResult.provider,
    providerJobId: adapterResult.providerJobId || null,
    rawCount: Array.isArray(adapterResult.results) ? adapterResult.results.length : 0
  });

  const normalized = normalizeMapsPlaces(adapterResult.results, {
    query,
    limit
  });

  if (normalized.invalidRows.length > 0) {
    await db.logEvent(jobId, 'warn', 'Skipped invalid maps scraper rows.', {
      invalidCount: normalized.invalidRows.length,
      sample: normalized.invalidRows.slice(0, 5).map((row) => ({
        rowIndex: row.rowIndex,
        errors: row.errors
      }))
    });
  }

  if (normalized.duplicates.length > 0) {
    await db.logEvent(jobId, 'info', 'Deduplicated maps scraper rows.', {
      duplicateCount: normalized.duplicates.length,
      duplicateRate: normalized.counts.raw > 0
        ? Number((normalized.duplicates.length / normalized.counts.raw).toFixed(4))
        : 0
    });
  }

  if (normalized.leads.length === 0) {
    const error = new Error('Maps scraper returned no valid leads.');
    error.statusCode = 422;
    throw error;
  }

  const importStats = {
    provider: adapterResult.provider,
    providerJobId: adapterResult.providerJobId || null,
    scraperVersion: adapterResult.version,
    rawCount: normalized.counts.raw,
    normalizedCount: normalized.counts.normalized,
    invalidCount: normalized.counts.invalid,
    duplicateCount: normalized.counts.duplicates
  };

  const savedLeads = await db.saveLeads(userId, normalized.leads, {
    jobId,
    keyword,
    location,
    query,
    source: 'google-maps-scraper',
    provider: adapterResult.provider,
    providerJobId: adapterResult.providerJobId || null,
    scraperVersion: adapterResult.version
  });

  await db.mergeJobMetadata(jobId, {
    leadImport: {
      ...importStats,
      savedCount: savedLeads.length,
      completedAt: new Date().toISOString()
    }
  });

  await db.completeJob(jobId, savedLeads.length);
  await db.logEvent(jobId, 'info', 'Maps lead import completed.', {
    ...importStats,
    savedCount: savedLeads.length
  });

  return {
    jobId,
    leads: savedLeads,
    stats: {
      ...importStats,
      savedCount: savedLeads.length
    }
  };
}
