/**
 * Artifacts Routes - compatibility wrappers for report generation and sharing
 */

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, createHttpError } from "../middleware/error-handler.js";
import * as artifacts from "../services/artifacts.js";
import * as exportsService from "../services/exports.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { deleteFile } from "../services/storage.js";

const router = express.Router();
const shareRouter = express.Router();

router.post("/generate", requireAuth, express.json(), asyncHandler(async (req, res) => {
  const { leadId, campaignId, forceRegenerate } = req.body || {};
  const userId = req.user.id;

  if (!leadId) {
    throw createHttpError(400, "leadId is required");
  }

  const result = await artifacts.generateLeadReport(leadId, userId, { campaignId, forceRegenerate });
  res.json({
    id: result.htmlArtifactId,
    shareUrl: result.shareUrl,
    pdfArtifactId: result.pdfArtifactId,
    downloadUrl: result.downloadUrl
  });
}));

router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const artifact = await artifacts.getArtifactById(req.params.id, req.user.id);
  if (!artifact) {
    throw createHttpError(404, "Artifact not found");
  }
  res.json(artifact);
}));

router.get("/:id/download", requireAuth, asyncHandler(async (req, res) => {
  const artifact = await artifacts.getArtifactById(req.params.id, req.user.id);
  if (!artifact) {
    throw createHttpError(404, "Artifact not found");
  }

  const response = await fetch(artifact.signedUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  res.set("Content-Type", artifact.kind === "intelligence_report_pdf" ? "application/pdf" : "text/html");
  res.set("Content-Disposition", `attachment; filename="${artifact.metadata?.filename || "report"}"`);
  res.send(buffer);
}));

router.delete("/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { data: artifact, error } = await supabaseAdmin
    .from("artifacts")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !artifact) {
    throw createHttpError(404, "Artifact not found");
  }

  const { error: deleteError } = await supabaseAdmin
    .from("artifacts")
    .delete()
    .eq("id", id);

  if (deleteError) {
    throw createHttpError(500, "Failed to delete artifact");
  }

  await deleteFile(artifact.storage_key).catch(() => {});
  res.json({ success: true });
}));

router.post("/export/campaign", requireAuth, express.json(), asyncHandler(async (req, res) => {
  const { campaignId, format = "csv" } = req.body || {};
  if (!campaignId) {
    throw createHttpError(400, "campaignId is required");
  }

  const buffer = await exportsService.exportCampaignToCsv(campaignId, req.user.id, format);
  const contentType = format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv";
  const extension = format === "xlsx" ? "xlsx" : "csv";

  res.set("Content-Type", contentType);
  res.set("Content-Disposition", `attachment; filename="campaign_export_${Date.now()}.${extension}"`);
  res.send(Buffer.from(buffer));
}));

router.post("/export/leads", requireAuth, express.json(), asyncHandler(async (req, res) => {
  const { leadIds, format = "csv" } = req.body || {};
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    throw createHttpError(400, "leadIds array is required");
  }

  const buffer = await exportsService.exportLeadsToCsv(leadIds, req.user.id, format);
  const contentType = format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv";
  const extension = format === "xlsx" ? "xlsx" : "csv";

  res.set("Content-Type", contentType);
  res.set("Content-Disposition", `attachment; filename="leads_export_${Date.now()}.${extension}"`);
  res.send(Buffer.from(buffer));
}));

shareRouter.get("/share/:token", asyncHandler(async (req, res) => {
  const artifact = await artifacts.getArtifactByToken(req.params.token);
  if (!artifact) {
    return res.status(404).send("<html><body style='font-family:sans-serif;padding:40px;background:#07111a;color:#e5eef8;'><h1>Report not found</h1><p>The report link is missing or expired.</p></body></html>");
  }

  const response = await fetch(artifact.signedUrl);
  const html = await response.text();
  res.set("Content-Type", "text/html");
  res.send(html);
}));

export { router, shareRouter };
