/**
 * Jobs Routes - Job management endpoints
 * 
 * Handles batch upload, single URL analysis, job history/status, and job control.
 */

import express from "express";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";
import * as db from "../services/db.js";
import { runBatchJob, runSingleJob, runLeadsJob, stopJob } from "../services/job-processor.js";
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

/**
 * POST /upload - Upload Excel file for batch analysis
 */
router.post("/upload", requireAuth, upload.single("excel"), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Missing Excel file." });
    }

    const userId = req.user.id;
    const sheetName = (req.body.sheet || "").trim();
    const columnName = (req.body.column || "").trim();
    const scrapeLimit = parseInt(req.body.limit || "10", 10);
    const captureMode = resolveCaptureMode((req.body.captureMode || "").trim().toLowerCase());

    // Create job in Supabase DB
    const job = await db.createJob(userId, "batch", {
        sheetName,
        columnName,
        scrapeLimit,
        captureMode,
        originalFilename: req.file.originalname
    });
    const jobId = job.id;

    // Create job directories
    const jobDir = path.join(OUTPUTS_DIR, jobId);
    const screenshotsDir = path.join(jobDir, "screenshots");
    await fs.mkdir(screenshotsDir, { recursive: true });

    const inputPath = path.join(jobDir, req.file.originalname);
    await fs.rename(req.file.path, inputPath);

    // Update job to running
    await db.updateJob(jobId, { status: "running" });

    // Run job in background
    runBatchJob({ jobId, jobDir, inputPath, sheetName, columnName, scrapeLimit, userId, captureMode }).catch(
        async (err) => {
            await db.failJob(jobId, String(err?.message || err));
        }
    );

    return res.json({ jobId });
}));

/**
 * POST /analyze-single - Analyze a single URL
 */
router.post("/analyze-single", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { url } = req.body;
    const userId = req.user.id;
    const captureMode = resolveCaptureMode((req.body.captureMode || "").trim().toLowerCase());
    const normalizedUrl = normalizeUrl(url);

    if (!normalizedUrl) {
        return res.status(400).json({ error: "A valid URL is required." });
    }

    // Create job in Supabase DB
    const job = await db.createJob(userId, "single", { url: normalizedUrl, captureMode });
    const jobId = job.id;

    const jobDir = path.join(OUTPUTS_DIR, jobId);
    const screenshotsDir = path.join(jobDir, "screenshots");
    await fs.mkdir(screenshotsDir, { recursive: true });

    await db.updateJob(jobId, { status: "running", total_urls: 1 });

    runSingleJob({ jobId, jobDir, url: normalizedUrl, userId, captureMode }).catch(async (err) => {
        await db.failJob(jobId, String(err?.message || err));
    });

    return res.json({ jobId });
}));

/**
 * POST /analyze-leads - Analyze leads with websites
 */
router.post("/analyze-leads", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { leads, keyword, location } = req.body;
    const userId = req.user.id;
    const captureMode = resolveCaptureMode((req.body.captureMode || "").trim().toLowerCase());

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ error: "Leads array is required." });
    }

    // Filter leads with websites
    const urlsToAnalyze = leads
        .map((lead, index) => ({
            rowIndex: index + 1,
            url: normalizeUrl(lead.website || ""),
            name: lead.name
        }))
        .filter((lead) => lead.url);

    if (urlsToAnalyze.length === 0) {
        return res.status(400).json({ error: "No leads with valid websites found." });
    }

    // Create job in Supabase DB
    const jobName = location ? `${keyword} in ${location}` : keyword;
    const job = await db.createJob(userId, "leads", { name: jobName, keyword, location, captureMode });
    const jobId = job.id;

    const jobDir = path.join(OUTPUTS_DIR, jobId);
    const screenshotsDir = path.join(jobDir, "screenshots");
    await fs.mkdir(screenshotsDir, { recursive: true });

    await db.updateJob(jobId, { status: "running", total_urls: urlsToAnalyze.length });

    // Run analysis in background
    runLeadsJob({ jobId, jobDir, urls: urlsToAnalyze, userId, captureMode }).catch(async (err) => {
        await db.failJob(jobId, String(err?.message || err));
    });

    return res.json({ jobId });
}));

/**
 * GET /jobs - List user's job history
 */
router.get("/jobs", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const jobs = await db.getUserJobs(userId);
    res.json(jobs);
}));

/**
 * DELETE /jobs/:id - Delete a job
 */
router.delete("/jobs/:id", requireAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    // Delete from DB (with ownership check)
    await db.deleteJob(id, userId);

    // Also clean up local files if they exist
    const jobDir = path.join(OUTPUTS_DIR, id);
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => { });

    res.json({ success: true });
}));

/**
 * GET /status/:jobId - Get job status with results
 */
router.get("/status/:jobId", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const job = await db.getJobWithResults(req.params.jobId, userId);

    if (!job) {
        return res.status(404).json({ error: "Job not found." });
    }

    res.json(job);
}));

/**
 * POST /stop/:jobId - Request job stop
 */
router.post("/stop/:jobId", requireAuth, (req, res) => {
    const { jobId } = req.params;
    stopJob(jobId);
    res.json({ message: "Job stop requested" });
});

export default router;
