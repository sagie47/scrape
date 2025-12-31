/**
 * Campaigns Routes - Campaign management endpoints
 * 
 * Handles campaign CRUD, activation, and task management.
 */

import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";
import * as campaigns from "../services/campaigns.js";

const router = express.Router();

/**
 * POST /campaigns - Create a new campaign
 */
router.post("/campaigns", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { name, sequenceId, leadIds } = req.body;
    const userId = req.user.id;

    if (!name) {
        return res.status(400).json({ error: "Campaign name is required" });
    }

    const campaign = await campaigns.createCampaign(userId, { name, sequenceId, leadIds });
    res.json(campaign);
}));

/**
 * GET /campaigns - List user's campaigns
 */
router.get("/campaigns", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const list = await campaigns.getCampaigns(userId);
    res.json(list);
}));

/**
 * GET /campaigns/:id - Get campaign details with stats
 */
router.get("/campaigns/:id", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    const campaign = await campaigns.getCampaign(id, userId);
    if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
    }

    res.json(campaign);
}));

/**
 * POST /campaigns/:id/activate - Activate campaign and generate tasks
 */
router.post("/campaigns/:id/activate", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await campaigns.activateCampaign(id, userId);
    res.json(result);
}));

/**
 * POST /campaigns/:id/pause - Pause campaign
 */
router.post("/campaigns/:id/pause", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await campaigns.pauseCampaign(id, userId);
    res.json(result);
}));

/**
 * GET /campaigns/:id/tasks - Get campaign tasks by bucket
 */
router.get("/campaigns/:id/tasks", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const bucket = req.query.bucket || "today"; // today|overdue|upcoming

    const tasks = await campaigns.getTasks(id, userId, bucket);
    res.json(tasks);
}));

/**
 * POST /tasks/:id/complete - Mark task as done
 */
router.post("/tasks/:id/complete", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await campaigns.completeTask(id, userId);
    res.json(result);
}));

/**
 * POST /campaign-leads/:id/outcome - Set lead outcome
 */
router.post("/campaign-leads/:id/outcome", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { outcome } = req.body;

    if (!["replied", "booked", "not_interested", "none"].includes(outcome)) {
        return res.status(400).json({ error: "Invalid outcome" });
    }

    const result = await campaigns.setOutcome(id, userId, outcome);
    res.json(result);
}));

/**
 * GET /campaigns/:id/export.csv - Export campaign data
 */
router.get("/campaigns/:id/export.csv", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    const csv = await campaigns.exportCampaignToCsv(id, userId);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=campaign_${id}.csv`);
    res.send(csv);
}));

export default router;
