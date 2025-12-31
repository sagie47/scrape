/**
 * Outreach Routes - AI-generated outreach scripts
 * 
 * Handles generation of email, SMS, and phone scripts via Gemini.
 */

import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, createHttpError } from "../middleware/error-handler.js";
import { generateOutreach } from "../services/gemini.js";

const router = express.Router();

/**
 * POST /generate-outreach - Generate AI-powered outreach scripts
 */
router.post("/generate-outreach", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { name, url, report } = req.body;

    if (!url) {
        throw createHttpError(400, "URL is required");
    }

    const scripts = await generateOutreach({ name, url, report });
    res.json(scripts);
}));

export default router;
