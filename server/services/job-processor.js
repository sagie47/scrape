/**
 * Job Processor Service - Unified job execution
 * 
 * Consolidates runJob, runLeadsJob, runSingleJob into a single processor.
 */

import fs from "fs/promises";
import path from "path";
import xlsx from "xlsx";
import { chromium } from "playwright";
import pLimit from "p-limit";

import { config } from "../config/env.js";
import * as db from "./db.js";
import * as storage from "./storage.js";
import * as audit from "./audit.js";
import { analyzeScreenshot } from "./gemini.js";
import { captureAuditScreenshot } from "../lib/capture.js";
import { normalizeUrl } from "../lib/url.js";

// Concurrency for parallel page processing
const CONCURRENCY_LIMIT = Math.max(1, Number.isFinite(config.captureConcurrency) ? config.captureConcurrency : 4);
const limit = pLimit(CONCURRENCY_LIMIT);

// Browser Pool Singleton
let browserInstance = null;

/**
 * Get or create shared browser instance
 */
export async function getBrowser() {
    if (!browserInstance) {
        console.log("Launching shared browser instance...");
        browserInstance = await chromium.launch({ headless: true });
    }
    return browserInstance;
}

// Track stopped jobs (shared mutable state)
const stoppedJobs = new Set();

function sanitizeCaptureMode(value) {
    return value === "fast" ? "fast" : "standard";
}

function buildCaptureOptions(captureMode, thumbnailPath) {
    const mode = sanitizeCaptureMode(captureMode);
    const fastMode = mode === "fast";

    return {
        captureMode: mode,
        navigationTimeout: 60000,
        blockResources: fastMode,
        blockImages: false,
        blockTrackers: fastMode,
        thumbnailPath
    };
}

function dedupeUrls(entries) {
    const seen = new Set();
    const normalized = [];

    for (const entry of entries) {
        const normalizedUrl = normalizeUrl(entry.url);
        if (!normalizedUrl) continue;
        if (seen.has(normalizedUrl)) continue;
        seen.add(normalizedUrl);
        normalized.push({ ...entry, url: normalizedUrl });
    }

    return normalized;
}

/**
 * Request a job to stop
 */
export function stopJob(jobId) {
    stoppedJobs.add(jobId);
}

/**
 * Check if a job has been stopped
 */
export function isJobStopped(jobId) {
    return stoppedJobs.has(jobId);
}

/**
 * Clear stopped status after job completes
 */
export function clearStoppedJob(jobId) {
    stoppedJobs.delete(jobId);
}

/**
 * Process a single URL - common logic for all job types
 */
async function processUrl({ browser, jobId, jobDir, entry, userId, includeSeo = false, captureMode = "standard" }) {
    if (isJobStopped(jobId)) return null;

    const { rowIndex, url, name } = entry;
    if (!url) return { rowIndex, url, skipped: true };

    const screenshotName = `row_${rowIndex}.png`;
    const screenshotLocalPath = path.join(jobDir, "screenshots", screenshotName);
    const thumbnailName = `row_${rowIndex}_thumb.jpg`;
    const thumbnailLocalPath = path.join(jobDir, "screenshots", thumbnailName);

    let report = null;
    let seoAudit = null;
    let error = null;
    let screenshotKey = null;
    let thumbnailKey = null;
    let thumbnailPath = null;
    let page = null;
    const captureOptions = buildCaptureOptions(captureMode, thumbnailLocalPath);

    try {
        console.log(`[processUrl] Starting: ${url} (row ${rowIndex})`);
        // Optionally run SEO audit in parallel with screenshot capture
        const seoPromise = includeSeo ? audit.runQuickAudit(url) : Promise.resolve(null);

        page = await browser.newPage({
            viewport: { width: 1440, height: 900 },
            ignoreHTTPSErrors: true
        });
        console.log(`[processUrl] Page created for ${url}`);
        page.setDefaultNavigationTimeout(captureOptions.navigationTimeout);

        // Use unified capture pipeline
        const captureResult = await captureAuditScreenshot(page, url, screenshotLocalPath, captureOptions);
        console.log(`[processUrl] Screenshot captured for ${url}`);
        if (captureResult?.usedThumbnail) {
            thumbnailPath = `/outputs/${jobId}/screenshots/${thumbnailName}`;
        }

        // Upload to Supabase Storage
        screenshotKey = await storage.uploadScreenshot(screenshotLocalPath, userId, jobId, `row_${rowIndex}`);
        console.log(`[processUrl] Storage upload done for ${url}`);

        if (captureResult?.usedThumbnail) {
            try {
                thumbnailKey = await storage.uploadThumbnail(thumbnailLocalPath, userId, jobId, `row_${rowIndex}`);
            } catch (err) {
                console.warn("Thumbnail upload failed:", err?.message || err);
            }
        }

        // Analyze the screenshot with Gemini
        const [aiReport, seoResult] = await Promise.all([
            analyzeScreenshot(screenshotLocalPath, url),
            seoPromise
        ]);
        console.log(`[processUrl] Gemini analysis done for ${url}`);

        // Combine AI vision report with SEO audit if available
        if (seoResult) {
            report = {
                ...aiReport,
                seo: seoResult?.seo || null,
                seoIssues: seoResult?.seo?.issues || [],
            };
            seoAudit = seoResult;
        } else {
            report = aiReport;
        }
    } catch (err) {
        console.error(`[processUrl] Error for ${url}:`, err?.message || err);
        error = String(err?.message || err);
    } finally {
        if (page) await page.close().catch(() => { });
    }

    // Insert result into DB with storage key
    await db.insertResult(jobId, {
        rowIndex,
        url,
        name,
        screenshotKey,
        screenshotPath: screenshotKey ? null : `/outputs/${jobId}/screenshots/${screenshotName}`,
        thumbnailKey,
        thumbnailPath: thumbnailKey ? null : thumbnailPath,
        report,
        error
    });
    console.log(`[processUrl] DB insert done for ${url}`);

    return { rowIndex, name, url, screenshotKey, report, error };
}

/**
 * Finalize a job after all URLs are processed
 */
async function finalizeJob(jobId, results) {
    const processedCount = results.filter(r => r !== null && !r.skipped).length;
    const errors = results.filter(r => r?.error).map(r =>
        r.name ? `${r.name}: ${r.error}` : `Row ${r.rowIndex}: ${r.error}`
    );

    if (isJobStopped(jobId)) {
        await db.updateJob(jobId, { status: "stopped", processed: processedCount });
        clearStoppedJob(jobId);
    } else {
        await db.updateJob(jobId, {
            status: "done",
            processed: processedCount,
            errors: errors.length > 0 ? errors : null,
            completed_at: new Date().toISOString()
        });
    }
}

/**
 * Detect which column contains URLs in an Excel sheet
 */
function detectUrlColumn(rows, headers) {
    const headerScore = (name) => {
        const lower = name.toLowerCase();
        if (lower.includes("website")) return 5;
        if (lower.includes("url")) return 4;
        if (lower.includes("link")) return 3;
        if (lower.includes("google")) return 2;
        return 0;
    };

    const scored = headers
        .map((h) => ({ name: h, score: headerScore(h) }))
        .sort((a, b) => b.score - a.score);

    if (scored.length && scored[0].score > 0) {
        return scored[0].name;
    }

    for (const header of headers) {
        const values = rows.map((r) => String(r[header] || ""));
        const urlCount = values.filter((v) => normalizeUrl(v)).length;
        if (urlCount >= Math.max(3, Math.floor(values.length * 0.2))) {
            return header;
        }
    }

    return "";
}

/**
 * Run a batch job from Excel file
 */
export async function runBatchJob({ jobId, jobDir, inputPath, sheetName, columnName, scrapeLimit, userId, captureMode = "standard" }) {
    const workbook = xlsx.readFile(inputPath);
    const sheetToUse = sheetName
        ? workbook.Sheets[sheetName]
        : workbook.Sheets[workbook.SheetNames[0]];

    if (!sheetToUse) {
        await db.failJob(jobId, "Sheet not found.");
        return;
    }

    const rows = xlsx.utils.sheet_to_json(sheetToUse, { defval: "" });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const urlColumn =
        columnName && headers.includes(columnName)
            ? columnName
            : detectUrlColumn(rows, headers);

    if (!urlColumn) {
        await db.failJob(jobId, "Could not detect a URL column. Provide the column name.");
        return;
    }

    let urls = rows.map((row, index) => ({
        rowIndex: index + 2,
        url: String(row[urlColumn] || "").trim()
    }));

    if (scrapeLimit && scrapeLimit > 0) {
        urls = urls.slice(0, scrapeLimit);
    }

    const normalizedUrls = dedupeUrls(urls);
    await db.updateJob(jobId, { total_urls: normalizedUrls.length });

    const browser = await getBrowser();
    const results = await Promise.all(
        normalizedUrls.map(entry => limit(() => processUrl({ browser, jobId, jobDir, entry, userId, includeSeo: true, captureMode })))
    );

    await finalizeJob(jobId, results);
}

/**
 * Run a leads analysis job
 */
export async function runLeadsJob({ jobId, jobDir, urls, userId, captureMode = "standard" }) {
    console.log(`[runLeadsJob] Starting job ${jobId} with ${urls.length} URLs`);
    const browser = await getBrowser();
    console.log(`[runLeadsJob] Browser ready, deduping URLs...`);
    const normalizedUrls = dedupeUrls(urls);
    console.log(`[runLeadsJob] Processing ${normalizedUrls.length} unique URLs`);
    await db.updateJob(jobId, { total_urls: normalizedUrls.length });
    const results = await Promise.all(
        normalizedUrls.map(entry => limit(() => processUrl({ browser, jobId, jobDir, entry, userId, includeSeo: false, captureMode })))
    );
    console.log(`[runLeadsJob] All URLs processed, finalizing job...`);
    await finalizeJob(jobId, results);
    console.log(`[runLeadsJob] Job ${jobId} complete`);
}

/**
 * Run a single URL analysis job
 */
export async function runSingleJob({ jobId, jobDir, url, userId, captureMode = "standard" }) {
    const browser = await getBrowser();
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
        await db.updateJob(jobId, {
            status: "error",
            processed: 0,
            errors: ["Invalid URL."],
            completed_at: new Date().toISOString()
        });
        return;
    }

    const entry = { rowIndex: 1, url: normalizedUrl };

    const result = await processUrl({ browser, jobId, jobDir, entry, userId, includeSeo: false, captureMode });

    if (result?.error) {
        await db.updateJob(jobId, {
            status: "error",
            processed: 1,
            errors: [result.error],
            completed_at: new Date().toISOString()
        });
    } else {
        await db.updateJob(jobId, {
            status: "done",
            processed: 1,
            completed_at: new Date().toISOString()
        });
    }
}
