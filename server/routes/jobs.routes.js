/**
 * Jobs Routes - batch upload, single URL analysis, and legacy analysis shims.
 */

import express from "express";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";
import * as db from "../services/db.js";
import { runBatchJob, runLeadAnalysisJob, runLeadsJob, runSingleJob, stopJob } from "../services/job-processor.js";
import { normalizeUrl } from "../lib/url.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUTS_DIR = path.join(__dirname, "..", "..", "outputs");
const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");
const upload = multer({ dest: UPLOADS_DIR });
const router = express.Router();

function resolveCaptureMode(value) {
    return value === "fast" ? "fast" : "standard";
}

router.post("/upload", requireAuth, upload.single("excel"), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Missing Excel file." });
    }

    const userId = req.user.id;
    const sheetName = (req.body.sheet || "").trim();
    const columnName = (req.body.column || "").trim();
    const scrapeLimit = parseInt(req.body.limit || "10", 10);
    const captureMode = resolveCaptureMode((req.body.captureMode || "").trim().toLowerCase());

    const job = await db.createJob(userId, "batch", {
        sheetName,
        columnName,
        scrapeLimit,
        captureMode,
        originalFilename: req.file.originalname,
        name: req.file.originalname
    });

    const jobDir = path.join(OUTPUTS_DIR, job.id);
    await fs.mkdir(path.join(jobDir, "screenshots"), { recursive: true });

    const inputPath = path.join(jobDir, req.file.originalname);
    await fs.rename(req.file.path, inputPath);

    runBatchJob({ jobId: job.id, jobDir, inputPath, sheetName, columnName, scrapeLimit, userId, captureMode }).catch(async (err) => {
        await db.failJob(job.id, String(err?.message || err));
    });

    return res.json({ jobId: job.id });
}));

router.post("/analyze-single", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { url } = req.body || {};
    const userId = req.user.id;
    const captureMode = resolveCaptureMode((req.body.captureMode || "").trim().toLowerCase());
    const normalizedUrl = normalizeUrl(url);

    if (!normalizedUrl) {
        return res.status(400).json({ error: "A valid URL is required." });
    }

    const job = await db.createJob(userId, "single", {
        url: normalizedUrl,
        captureMode,
        name: normalizedUrl
    }, { total_urls: 1 });

    const jobDir = path.join(OUTPUTS_DIR, job.id);
    await fs.mkdir(path.join(jobDir, "screenshots"), { recursive: true });

    runSingleJob({ jobId: job.id, jobDir, url: normalizedUrl, userId, captureMode }).catch(async (err) => {
        await db.failJob(job.id, String(err?.message || err));
    });

    return res.json({ jobId: job.id });
}));

router.post("/analyze-leads", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { leads, keyword, location } = req.body || {};
    const userId = req.user.id;
    const captureMode = resolveCaptureMode((req.body.captureMode || "").trim().toLowerCase());

    if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ error: "Leads array is required." });
    }

    const analyzable = leads
        .map((lead, index) => ({
            rowIndex: index + 1,
            leadId: lead.id || null,
            url: normalizeUrl(lead.website || lead.url || ""),
            name: lead.name || lead.company || null,
            lead
        }))
        .filter((lead) => lead.url);

    if (analyzable.length === 0) {
        return res.status(400).json({ error: "No leads with valid websites found." });
    }

    const jobName = location ? `${keyword} in ${location}` : keyword || `Lead analysis (${analyzable.length})`;
    const job = await db.createJob(userId, "lead_analysis", {
        name: jobName,
        keyword,
        location,
        captureMode
    }, { total_urls: analyzable.length });

    const jobDir = path.join(OUTPUTS_DIR, job.id);
    await fs.mkdir(path.join(jobDir, "screenshots"), { recursive: true });

    const withIds = analyzable.filter((lead) => lead.leadId);
    if (withIds.length === analyzable.length) {
        const persistedLeads = await db.getLeadByIds(userId, withIds.map((lead) => lead.leadId));
        runLeadAnalysisJob({ jobId: job.id, jobDir, leads: persistedLeads, userId, captureMode }).catch(async (err) => {
            await db.failJob(job.id, String(err?.message || err));
        });
    } else {
        runLeadsJob({ jobId: job.id, jobDir, urls: analyzable, userId, captureMode }).catch(async (err) => {
            await db.failJob(job.id, String(err?.message || err));
        });
    }

    return res.json({ jobId: job.id });
}));

router.get("/jobs", requireAuth, asyncHandler(async (req, res) => {
    const jobs = await db.getUserJobs(req.user.id);
    res.json(jobs);
}));

router.delete("/jobs/:id", requireAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    await db.deleteJob(id, req.user.id);
    const jobDir = path.join(OUTPUTS_DIR, id);
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => { });
    res.json({ success: true });
}));

router.get("/status/:jobId", requireAuth, asyncHandler(async (req, res) => {
    const job = await db.getJobWithResults(req.params.jobId, req.user.id);
    if (!job) {
        return res.status(404).json({ error: "Job not found." });
    }
    res.json(job);
}));

router.post("/stop/:jobId", requireAuth, (req, res) => {
    stopJob(req.params.jobId);
    res.json({ message: "Job stop requested" });
});

export default router;
