import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";
import * as db from "../services/db.js";
import { runLeadAnalysisJob } from "../services/job-processor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUTS_DIR = path.join(__dirname, "..", "..", "outputs");

const router = express.Router();

router.post("/analysis/jobs", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { leadIds = [], captureMode = "standard" } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: "leadIds array is required" });
    }

    const leads = await db.getLeadByIds(userId, leadIds);
    const analyzable = leads.filter((lead) => lead.website);

    if (!analyzable.length) {
        return res.status(400).json({ error: "No leads with websites were found" });
    }

    const job = await db.createJob(userId, "lead_analysis", {
        name: `Lead analysis (${analyzable.length})`,
        leadIds,
        captureMode
    }, { total_urls: analyzable.length });

    const jobDir = path.join(OUTPUTS_DIR, job.id);
    await fs.mkdir(jobDir, { recursive: true });

    runLeadAnalysisJob({ jobId: job.id, jobDir, leads: analyzable, userId, captureMode }).catch(async (err) => {
        await db.failJob(job.id, String(err?.message || err));
    });

    res.json({ jobId: job.id });
}));

router.get("/analysis/jobs/:jobId", requireAuth, asyncHandler(async (req, res) => {
    const job = await db.getJobWithResults(req.params.jobId, req.user.id);
    if (!job) {
        return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
}));

export default router;
