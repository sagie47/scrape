import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";
import { getBrandingSettings, updateBrandingSettings } from "../services/settings.js";

const router = express.Router();

router.get("/settings/branding", requireAuth, asyncHandler(async (req, res) => {
    const branding = await getBrandingSettings(req.user.id);
    res.json(branding);
}));

router.put("/settings/branding", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const branding = await updateBrandingSettings(req.user.id, req.body || {});
    res.json(branding);
}));

export default router;
