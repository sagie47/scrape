/**
 * Screenshots Routes - Screenshot URL generation
 * 
 * Handles signed URL generation for Supabase Storage screenshots.
 */

import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";
import * as storage from "../services/storage.js";

const router = express.Router();

/**
 * GET /screenshot/:key(*) - Generate signed URL for screenshot
 */
router.get("/screenshot/:key(*)", requireAuth, asyncHandler(async (req, res) => {
    const key = decodeURIComponent(req.params.key || "");

    if (!key) {
        return res.status(400).json({ error: "Screenshot key required" });
    }

    // Generate 1-hour signed URL
    const signedUrl = await storage.getSignedUrl(key, 3600);
    if (req.query.raw === "1") {
        return res.redirect(signedUrl);
    }

    res.json({ url: signedUrl });
}));

export default router;
