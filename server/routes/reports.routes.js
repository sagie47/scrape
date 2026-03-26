import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";
import * as artifacts from "../services/artifacts.js";

const router = express.Router();

router.get("/reports", requireAuth, asyncHandler(async (req, res) => {
    const reports = await artifacts.listReports(req.user.id);
    res.json(reports);
}));

router.post("/reports", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { leadId, campaignId, forceRegenerate } = req.body || {};
    if (!leadId) {
        return res.status(400).json({ error: "leadId is required" });
    }

    const report = await artifacts.generateLeadReport(leadId, req.user.id, {
        campaignId,
        forceRegenerate
    });
    res.json(report);
}));

router.get("/reports/:id", requireAuth, asyncHandler(async (req, res) => {
    const artifact = await artifacts.getArtifactById(req.params.id, req.user.id);
    if (!artifact) {
        return res.status(404).json({ error: "Report not found" });
    }
    res.json(artifact);
}));

router.get("/reports/:id/download", requireAuth, asyncHandler(async (req, res) => {
    const artifact = await artifacts.getArtifactById(req.params.id, req.user.id);
    if (!artifact) {
        return res.status(404).json({ error: "Report not found" });
    }

    const response = await fetch(artifact.signedUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = artifact.metadata?.filename || "report.pdf";

    res.set("Content-Type", artifact.kind === "intelligence_report_pdf" ? "application/pdf" : "text/html");
    res.set("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
}));

export default router;
