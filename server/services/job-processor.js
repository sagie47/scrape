/**
 * Job Processor Service - Unified job execution
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
import { analyzeScreenshot, generateOutreachAtoms } from "./gemini.js";
import { captureAuditScreenshot } from "../lib/capture.js";
import { normalizeUrl } from "../lib/url.js";
import { createMapsScrapeJob, normalizeGosomResults, waitForMapsScrapeJob } from "./gosom.js";

const CONCURRENCY_LIMIT = Math.max(1, Number.isFinite(config.captureConcurrency) ? config.captureConcurrency : 4);
const limit = pLimit(CONCURRENCY_LIMIT);

let browserInstance = null;
const stoppedJobs = new Set();

export async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await chromium.launch({ headless: true });
    }
    return browserInstance;
}

export function stopJob(jobId) {
    stoppedJobs.add(jobId);
}

export function isJobStopped(jobId) {
    return stoppedJobs.has(jobId);
}

function clearStoppedJob(jobId) {
    stoppedJobs.delete(jobId);
}

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

function dedupeEntries(entries) {
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

function mergeReports(aiReport, auditResult, lead = {}) {
    const seoIssues = auditResult?.seo?.issues || [];
    const mergedIssues = [...new Set([...(aiReport?.issues || []), ...seoIssues])];

    return {
        summary: aiReport?.summary || "No summary available.",
        issues: mergedIssues,
        quick_wins: aiReport?.quick_wins || [],
        trust_signals: aiReport?.trust_signals || [],
        conversion_gaps: aiReport?.conversion_gaps || [],
        offer_angles: aiReport?.offer_angles || [],
        confidence: aiReport?.confidence || 60,
        seo: auditResult?.seo || null,
        psi: auditResult?.psi || null,
        crux: auditResult?.crux || null,
        business: {
            name: lead.name || null,
            website: lead.website || null,
            category: lead.category || null,
            city: lead.city || null,
            region: lead.region || null
        }
    };
}

async function processUrl({ browser, jobId, jobDir, entry, userId, includeSeo = true, captureMode = "standard" }) {
    if (isJobStopped(jobId)) return null;

    const { rowIndex, url, name, leadId, lead } = entry;
    if (!url) return { rowIndex, url, skipped: true };

    const screenshotName = `row_${rowIndex}.png`;
    const screenshotLocalPath = path.join(jobDir, "screenshots", screenshotName);
    const thumbnailName = `row_${rowIndex}_thumb.jpg`;
    const thumbnailLocalPath = path.join(jobDir, "screenshots", thumbnailName);

    let report = null;
    let error = null;
    let screenshotKey = null;
    let thumbnailKey = null;
    let thumbnailPath = null;
    let page = null;
    const captureOptions = buildCaptureOptions(captureMode, thumbnailLocalPath);

    try {
        const seoPromise = includeSeo ? audit.runQuickAudit(url) : Promise.resolve(null);

        page = await browser.newPage({
            viewport: { width: 1440, height: 900 },
            ignoreHTTPSErrors: true
        });
        page.setDefaultNavigationTimeout(captureOptions.navigationTimeout);

        const captureResult = await captureAuditScreenshot(page, url, screenshotLocalPath, captureOptions);
        if (captureResult?.usedThumbnail) {
            thumbnailPath = `/outputs/${jobId}/screenshots/${thumbnailName}`;
        }

        screenshotKey = await storage.uploadScreenshot(screenshotLocalPath, userId, jobId, `row_${rowIndex}`);
        if (captureResult?.usedThumbnail) {
            try {
                thumbnailKey = await storage.uploadThumbnail(thumbnailLocalPath, userId, jobId, `row_${rowIndex}`);
            } catch (thumbErr) {
                console.warn("Thumbnail upload failed:", thumbErr?.message || thumbErr);
            }
        }

        const seoResult = await seoPromise;
        const aiReport = await analyzeScreenshot(screenshotLocalPath, url, {
            name,
            category: lead?.category,
            city: lead?.city,
            region: lead?.region,
            seoIssues: seoResult?.seo?.issues || []
        });

        report = mergeReports(aiReport, seoResult, lead || { name, website: url });
    } catch (err) {
        error = String(err?.message || err);
    } finally {
        if (page) await page.close().catch(() => { });
    }

    const jobResult = await db.insertResult(jobId, {
        leadId: leadId || null,
        rowIndex,
        url,
        name,
        screenshotKey,
        screenshotPath: screenshotKey ? null : `/outputs/${jobId}/screenshots/${screenshotName}`,
        thumbnailKey,
        thumbnailPath: thumbnailKey ? null : thumbnailPath,
        report,
        error,
        analysisVersion: "v2",
        analysisKind: "cro"
    });

    if (!error && leadId && report) {
        await db.updateLeadAnalysis(leadId, userId, report).catch((err) => {
            console.warn("Failed to update lead analysis:", err?.message || err);
        });

        try {
            const atoms = await generateOutreachAtoms({ lead, report });
            await db.saveOutreachAtoms(leadId, jobResult.id, atoms);
        } catch (atomsErr) {
            console.warn("Failed to generate outreach atoms:", atomsErr?.message || atomsErr);
        }
    }

    return {
        rowIndex,
        leadId,
        name,
        url,
        screenshotKey,
        thumbnailKey,
        report,
        error
    };
}

async function finalizeJob(jobId, results) {
    const processedCount = results.filter((row) => row !== null && !row.skipped).length;
    const errors = results.filter((row) => row?.error).map((row) => row.error);

    if (isJobStopped(jobId)) {
        await db.updateJob(jobId, {
            status: "stopped",
            processed: processedCount,
            completed_at: new Date().toISOString(),
            errors: errors.length ? errors : null
        });
        clearStoppedJob(jobId);
        return;
    }

    await db.updateJob(jobId, {
        status: "done",
        processed: processedCount,
        completed_at: new Date().toISOString(),
        errors: errors.length ? errors : null
    });
}

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
        .map((header) => ({ name: header, score: headerScore(header) }))
        .sort((a, b) => b.score - a.score);

    if (scored.length && scored[0].score > 0) {
        return scored[0].name;
    }

    for (const header of headers) {
        const values = rows.map((row) => String(row[header] || ""));
        const urlCount = values.filter((value) => normalizeUrl(value)).length;
        if (urlCount >= Math.max(3, Math.floor(values.length * 0.2))) {
            return header;
        }
    }

    return "";
}

async function ensureJobDirectories(jobDir) {
    await fs.mkdir(path.join(jobDir, "screenshots"), { recursive: true });
}

export async function runBatchJob({ jobId, jobDir, inputPath, sheetName, columnName, scrapeLimit, userId, captureMode = "standard" }) {
    const workbook = xlsx.readFile(inputPath);
    const sheetToUse = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];

    if (!sheetToUse) {
        await db.failJob(jobId, "Sheet not found.");
        return;
    }

    const rows = xlsx.utils.sheet_to_json(sheetToUse, { defval: "" });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const urlColumn = columnName && headers.includes(columnName) ? columnName : detectUrlColumn(rows, headers);

    if (!urlColumn) {
        await db.failJob(jobId, "Could not detect a URL column. Provide the column name.");
        return;
    }

    let urls = rows.map((row, index) => ({
        rowIndex: index + 2,
        url: String(row[urlColumn] || "").trim(),
        name: row.name || row.company || row.business || null,
        lead: { name: row.name || row.company || row.business || null }
    }));

    if (scrapeLimit && scrapeLimit > 0) {
        urls = urls.slice(0, scrapeLimit);
    }

    const normalizedUrls = dedupeEntries(urls);
    await db.updateJob(jobId, { total_urls: normalizedUrls.length, status: "running", started_at: new Date().toISOString() });
    await ensureJobDirectories(jobDir);

    const browser = await getBrowser();
    const results = await Promise.all(
        normalizedUrls.map((entry) => limit(() => processUrl({ browser, jobId, jobDir, entry, userId, includeSeo: true, captureMode })))
    );

    await finalizeJob(jobId, results);
}

export async function runLeadAnalysisJob({ jobId, jobDir, leads, userId, captureMode = "standard" }) {
    const entries = dedupeEntries(
        leads.map((lead, index) => ({
            rowIndex: index + 1,
            leadId: lead.id,
            name: lead.name,
            url: lead.website,
            lead
        }))
    );

    await db.updateJob(jobId, { total_urls: entries.length, status: "running", started_at: new Date().toISOString() });
    await ensureJobDirectories(jobDir);

    const browser = await getBrowser();
    const results = await Promise.all(
        entries.map((entry) => limit(() => processUrl({ browser, jobId, jobDir, entry, userId, includeSeo: true, captureMode })))
    );

    await finalizeJob(jobId, results);
}

export async function runLeadsJob({ jobId, jobDir, urls, userId, captureMode = "standard" }) {
    const entries = dedupeEntries(urls);
    await db.updateJob(jobId, { total_urls: entries.length, status: "running", started_at: new Date().toISOString() });
    await ensureJobDirectories(jobDir);

    const browser = await getBrowser();
    const results = await Promise.all(
        entries.map((entry) => limit(() => processUrl({ browser, jobId, jobDir, entry, userId, includeSeo: true, captureMode })))
    );

    await finalizeJob(jobId, results);
}

export async function runSingleJob({ jobId, jobDir, url, userId, captureMode = "standard" }) {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
        await db.failJob(jobId, "Invalid URL.");
        return;
    }

    await db.updateJob(jobId, { total_urls: 1, status: "running", started_at: new Date().toISOString() });
    await ensureJobDirectories(jobDir);

    const browser = await getBrowser();
    const result = await processUrl({
        browser,
        jobId,
        jobDir,
        entry: { rowIndex: 1, url: normalizedUrl, name: normalizedUrl, lead: { name: normalizedUrl, website: normalizedUrl } },
        userId,
        includeSeo: true,
        captureMode
    });

    if (result?.error) {
        await db.failJob(jobId, result.error);
        return;
    }

    await finalizeJob(jobId, [result]);
}

export async function runMapsImportJob({ jobId, keyword, location, limit = 25, userId, lang, email, depth = 1, radius, zoom, lat, lon, fastMode = false }) {
    await db.updateJob(jobId, {
        status: "running",
        started_at: new Date().toISOString(),
        total_urls: limit
    });
    await db.logEvent(jobId, "info", `Submitting maps import for ${keyword}${location ? ` in ${location}` : ""}`);

    try {
        const created = await createMapsScrapeJob({ keyword, location, limit, lang, email, depth, radius, zoom, lat, lon, fastMode });
        const externalJobId = created.id || created.job_id;
        await db.updateJob(jobId, {
            metadata: {
                keyword,
                location,
                externalJobId,
                source: "gosom"
            }
        });

        const completed = await waitForMapsScrapeJob(externalJobId);
        const normalized = normalizeGosomResults(completed, keyword).slice(0, limit);
        const saved = await db.saveLeads(userId, normalized, {
            jobId,
            keyword,
            location,
            source: "gosom"
        });

        await db.completeJob(jobId, saved.length, { total_urls: saved.length });
        await db.logEvent(jobId, "info", `Imported ${saved.length} leads from gosom`, {
            externalJobId,
            imported: saved.length
        });
        return saved;
    } catch (err) {
        await db.failJob(jobId, String(err?.message || err));
        await db.logEvent(jobId, "error", String(err?.message || err));
        throw err;
    }
}
