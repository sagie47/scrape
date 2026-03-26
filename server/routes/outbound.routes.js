import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";
import { deliverOutboundPayload, listDestinations, saveDestination } from "../services/outbound.js";

const router = express.Router();

router.get("/outbound/destinations", requireAuth, asyncHandler(async (req, res) => {
    const destinations = await listDestinations(req.user.id);
    res.json(destinations);
}));

router.post("/outbound/destinations", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const destination = await saveDestination(req.user.id, req.body || {});
    res.json(destination);
}));

router.post("/outbound/exports", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { campaignId, destinationId } = req.body || {};

    if (!campaignId) {
        return res.status(400).json({ error: "campaignId is required" });
    }

    const result = await deliverOutboundPayload({
        campaignId,
        destinationId,
        userId: req.user.id,
        appUrl: process.env.APP_URL || "http://localhost:5173"
    });

    res.json(result);
}));

export default router;
