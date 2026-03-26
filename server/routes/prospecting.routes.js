import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";
import * as db from "../services/db.js";
import { runMapsImportJob } from "../services/job-processor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUTS_DIR = path.join(__dirname, "..", "..", "outputs");

const router = express.Router();

router.post("/prospecting/maps/jobs", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { keyword, location, limit = 25, email, depth = 1, lang, radius, zoom, lat, lon, fastMode = false } = req.body;
    const userId = req.user.id;

    if (!keyword) {
        return res.status(400).json({ error: "keyword is required" });
    }

    const job = await db.createJob(userId, "maps_import", {
        name: location ? `${keyword} in ${location}` : keyword,
        keyword,
        location,
        source: "gosom"
    });

    const jobDir = path.join(OUTPUTS_DIR, job.id);

    runMapsImportJob({
        jobId: job.id,
        keyword,
        location,
        limit,
        userId,
        email,
        depth,
        lang,
        radius,
        zoom,
        lat,
        lon,
        fastMode,
        jobDir
    }).catch(async (err) => {
        await db.failJob(job.id, String(err?.message || err));
    });

    res.json({ jobId: job.id });
}));

router.get("/prospecting/maps/jobs/:jobId", requireAuth, asyncHandler(async (req, res) => {
    const job = await db.getJobWithResults(req.params.jobId, req.user.id);
    if (!job) {
        return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
}));

export default router;
