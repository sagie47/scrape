/**
 * Artifacts Routes - Mini audit generation and sharing
 * 
 * Handles artifact creation, retrieval, and public sharing
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, createHttpError } from '../middleware/error-handler.js';
import * as artifacts from '../services/artifacts.js';
import * as exports from '../services/exports.js';

const router = express.Router();
const shareRouter = express.Router();

/**
 * POST /artifacts/generate - Generate a mini audit artifact
 * Body: { leadId, campaignId?, forceRegenerate? }
 * Returns: { id, shareUrl }
 */
router.post('/generate', requireAuth, express.json(), asyncHandler(async (req, res) => {
  const { leadId, campaignId, forceRegenerate } = req.body;
  const userId = req.user.id;

  if (!leadId) {
    throw createHttpError(400, 'leadId is required');
  }

  const result = await artifacts.generateMiniAudit(leadId, {
    campaignId,
    forceRegenerate
  });

  res.json({
    id: result.artifactId,
    shareUrl: result.shareUrl
  });
}));

/**
 * GET /artifacts/:id - Get artifact by ID (requires auth)
 * Returns: artifact record + signed download URL
 */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const artifact = await artifacts.getArtifactById(id, userId);

  if (!artifact) {
    throw createHttpError(404, 'Artifact not found');
  }

  res.json(artifact);
}));

/**
 * GET /artifacts/:id/download - Download artifact file (requires auth)
 */
router.get('/:id/download', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const artifact = await artifacts.getArtifactById(id, userId);

  if (!artifact) {
    throw createHttpError(404, 'Artifact not found');
  }

  const response = await fetch(artifact.signedUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  res.set('Content-Type', 'text/html');
  res.set('Content-Disposition', `attachment; filename="${artifact.metadata?.filename || 'audit.html'}"`);
  res.send(buffer);
}));

/**
 * DELETE /artifacts/:id - Delete an artifact (requires auth)
 */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { supabaseAdmin } = await import('../lib/supabase.js');
  const { deleteFile } = await import('../services/storage.js');

  const { data: artifact, error: fetchError } = await supabaseAdmin
    .from('artifacts')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !artifact) {
    throw createHttpError(404, 'Artifact not found');
  }

  const { error: deleteError } = await supabaseAdmin
    .from('artifacts')
    .delete()
    .eq('id', id);

  if (deleteError) {
    throw createHttpError(500, 'Failed to delete artifact');
  }

  await deleteFile(artifact.storage_key).catch(() => {
    console.warn('Failed to delete artifact from storage:', artifact.storage_key);
  });

  res.json({ success: true });
}));

/**
 * POST /export/campaign - Export campaign to CSV/XLSX
 * Body: { campaignId, format? }
 * Returns: File download
 */
router.post('/export/campaign', requireAuth, express.json(), asyncHandler(async (req, res) => {
  const { campaignId, format = 'csv' } = req.body;
  const userId = req.user.id;

  if (!campaignId) {
    throw createHttpError(400, 'campaignId is required');
  }

  const buffer = await exports.exportCampaignToCsv(campaignId, format);

  const contentType = format === 'csv'
    ? 'text/csv'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const extension = format === 'csv' ? 'csv' : 'xlsx';

  res.set('Content-Type', contentType);
  res.set('Content-Disposition', `attachment; filename="campaign_export_${Date.now()}.${extension}"`);
  res.send(buffer);
}));

/**
 * POST /export/leads - Export leads with atoms to CSV/XLSX
 * Body: { leadIds[], format? }
 * Returns: File download
 */
router.post('/export/leads', requireAuth, express.json(), asyncHandler(async (req, res) => {
  const { leadIds, format = 'csv' } = req.body;

  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    throw createHttpError(400, 'leadIds array is required');
  }

  const buffer = await exports.exportLeadsToCsv(leadIds, format);

  const contentType = format === 'csv'
    ? 'text/csv'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const extension = format === 'csv' ? 'csv' : 'xlsx';

  res.set('Content-Type', contentType);
  res.set('Content-Disposition', `attachment; filename="leads_export_${Date.now()}.${extension}"`);
  res.send(buffer);
}));

/**
 * GET /share/:token - Public view of mini audit (no auth)
 * Returns: HTML page
 * Note: Mounted at root for clean URLs like /share/token-abc
 */
shareRouter.get('/share/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  const artifact = await artifacts.getArtifactByToken(token);

  if (!artifact) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Link Expired</title>
        <style>
          body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0c; color: #fff; }
          h1 { font-size: 2rem; margin-bottom:1rem; }
          p { color: #94a3b8; }
        </style>
      </head>
      <body>
        <div style="text-align: center;">
          <h1>Link Not Found</h1>
          <p>This audit link has expired or does not exist.</p>
        </div>
      </body>
      </html>
    `);
  }

  const response = await fetch(artifact.signedUrl);
  const html = await response.text();

  res.set('Content-Type', 'text/html');
  res.send(html);
}));

export { router, shareRouter };
