/**
 * Sequences Routes - Sequence template management
 * 
 * Handles sequence CRUD and step management.
 */

import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";
import * as sequences from "../services/sequences.js";

const router = express.Router();

/**
 * POST /sequences - Create a new sequence
 */
router.post("/sequences", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { name, tone, stopRules, steps } = req.body;
    const userId = req.user.id;

    if (!name) {
        return res.status(400).json({ error: "Sequence name is required" });
    }

    const sequence = await sequences.createSequence(userId, { name, tone, stopRules, steps });
    res.json(sequence);
}));

/**
 * GET /sequences - List user's sequences
 */
router.get("/sequences", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const list = await sequences.getSequences(userId);
    res.json(list);
}));

/**
 * GET /sequences/:id - Get sequence with steps
 */
router.get("/sequences/:id", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    const sequence = await sequences.getSequence(id, userId);
    if (!sequence) {
        return res.status(404).json({ error: "Sequence not found" });
    }

    res.json(sequence);
}));

/**
 * PUT /sequences/:id - Update sequence
 */
router.put("/sequences/:id", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, tone, stopRules } = req.body;

    const sequence = await sequences.updateSequence(id, userId, { name, tone, stopRules });
    res.json(sequence);
}));

/**
 * DELETE /sequences/:id - Delete sequence
 */
router.delete("/sequences/:id", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    await sequences.deleteSequence(id, userId);
    res.json({ success: true });
}));

/**
 * POST /sequences/:id/steps - Add step to sequence
 */
router.post("/sequences/:id/steps", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { channel, delayDays, templateA, templateB, subjectA, subjectB } = req.body;

    if (!channel || !templateA) {
        return res.status(400).json({ error: "Channel and template_a are required" });
    }

    const step = await sequences.addStep(id, userId, { channel, delayDays, templateA, templateB, subjectA, subjectB });
    res.json(step);
}));

/**
 * PUT /sequences/:id/steps/:stepId - Update step
 */
router.put("/sequences/:id/steps/:stepId", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id, stepId } = req.params;
    const updates = req.body;

    const step = await sequences.updateStep(id, stepId, userId, updates);
    res.json(step);
}));

/**
 * DELETE /sequences/:id/steps/:stepId - Delete step
 */
router.delete("/sequences/:id/steps/:stepId", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id, stepId } = req.params;

    await sequences.deleteStep(id, stepId, userId);
    res.json({ success: true });
}));

export default router;
