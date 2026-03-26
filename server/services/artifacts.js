/**
 * Artifacts Service - Intelligence report generation and sharing
 */

import { randomBytes } from "crypto";
import { chromium } from "playwright";

import { supabaseAdmin } from "../lib/supabase.js";
import * as db from "./db.js";
import * as storage from "./storage.js";
import { getBrandingSettings } from "./settings.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderList(items, tone) {
  return (items || []).slice(0, 5).map((item) => `
    <li style="margin:0 0 12px;padding:14px 16px;border-radius:14px;background:${tone};line-height:1.6;">
      ${escapeHtml(item)}
    </li>`).join("");
}

function buildReportHtml({ branding, lead, jobResult, screenshotUrl }) {
  const report = jobResult?.report || lead.analysis || {};
  const confidence = Number(report.confidence || 50);
  const issues = report.issues || [];
  const wins = report.quick_wins || [];
  const trustSignals = report.trust_signals || [];
  const offerAngles = report.offer_angles || [];
  const auditDate = new Date(jobResult?.createdAt || Date.now()).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(lead.name)} Intelligence Report</title>
  <style>
    :root {
      --brand: ${branding.primaryColor || "#0ea5e9"};
      --bg: #07111a;
      --panel: #0d1824;
      --soft: #102133;
      --text: #e5eef8;
      --muted: #93a8bf;
      --danger: rgba(239,68,68,0.12);
      --success: rgba(16,185,129,0.12);
      --accent: rgba(14,165,233,0.12);
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: linear-gradient(180deg,#06101a 0%,#0b1621 100%); color: var(--text); }
    .shell { max-width: 1080px; margin: 0 auto; padding: 32px 24px 64px; }
    .hero { background: linear-gradient(135deg, rgba(14,165,233,0.18), rgba(15,23,42,0.9)); border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; padding: 28px; display: grid; grid-template-columns: 1.4fr 0.8fr; gap: 20px; }
    .hero h1 { margin: 0 0 8px; font-size: 38px; line-height: 1.02; }
    .muted { color: var(--muted); }
    .pill { display:inline-block; padding: 8px 12px; border-radius:999px; background: rgba(255,255,255,0.06); margin: 0 8px 8px 0; font-size: 13px; }
    .grid { margin-top: 22px; display:grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .card { background: var(--panel); border: 1px solid rgba(255,255,255,0.06); border-radius: 22px; padding: 22px; }
    .card h2 { margin: 0 0 14px; font-size: 14px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
    .summary { font-size: 18px; line-height: 1.7; }
    .screenshot { width: 100%; border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); background: #08111a; }
    .score { font-size: 56px; font-weight: 700; color: var(--brand); }
    .section { margin-top: 20px; }
    .cta { margin-top: 24px; padding: 22px; border-radius: 22px; background: linear-gradient(135deg, rgba(14,165,233,0.16), rgba(15,23,42,0.8)); border: 1px solid rgba(255,255,255,0.08); }
    .footer { margin-top: 28px; color: var(--muted); font-size: 13px; }
    @media (max-width: 860px) {
      .hero, .grid { grid-template-columns: 1fr; }
      .shell { padding: 20px 16px 48px; }
      .hero h1 { font-size: 30px; }
    }
    @media print {
      body { background: white; color: #0f172a; }
      .hero, .card, .cta { background: white; border-color: #dbe4ee; }
      .muted, .footer { color: #475569; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div>
        <div class="pill">${escapeHtml(branding.brandName || "Scrape Intelligence")}</div>
        <h1>${escapeHtml(lead.name || "Unknown business")}</h1>
        <p class="muted" style="margin:0 0 14px;">${escapeHtml(lead.website || lead.mapsUrl || "No website on file")}</p>
        <p class="summary">${escapeHtml(report.summary || "We ran a website intelligence pass and found a handful of practical conversion improvements worth addressing first.")}</p>
      </div>
      <div class="card" style="background:rgba(255,255,255,0.04)">
        <h2>Report Snapshot</h2>
        <div class="score">${confidence}%</div>
        <div class="muted" style="margin-bottom:10px;">Confidence score</div>
        <div class="pill">Category: ${escapeHtml(lead.category || "Unknown")}</div>
        <div class="pill">Location: ${escapeHtml([lead.city, lead.region, lead.country].filter(Boolean).join(", ") || "Unknown")}</div>
        <div class="pill">Generated: ${escapeHtml(auditDate)}</div>
      </div>
    </section>

    <div class="grid section">
      <div class="card">
        <h2>Top Friction Points</h2>
        <ul style="list-style:none;padding:0;margin:0;">${renderList(issues, "var(--danger)") || "<li class='muted'>No major blockers captured.</li>"}</ul>
      </div>
      <div class="card">
        <h2>Fastest Wins</h2>
        <ul style="list-style:none;padding:0;margin:0;">${renderList(wins, "var(--success)") || "<li class='muted'>No quick wins captured.</li>"}</ul>
      </div>
    </div>

    <div class="grid section">
      <div class="card">
        <h2>Trust and Credibility</h2>
        <ul style="list-style:none;padding:0;margin:0;">${renderList(trustSignals, "var(--accent)") || "<li class='muted'>No trust observations captured.</li>"}</ul>
      </div>
      <div class="card">
        <h2>Angles for Outreach</h2>
        <ul style="list-style:none;padding:0;margin:0;">${renderList(offerAngles, "rgba(255,255,255,0.05)") || "<li class='muted'>No outreach angles captured.</li>"}</ul>
      </div>
    </div>

    <div class="section card">
      <h2>Homepage Capture</h2>
      ${screenshotUrl ? `<img class="screenshot" src="${escapeHtml(screenshotUrl)}" alt="Homepage screenshot" />` : `<div class="muted">No screenshot available for this report.</div>`}
    </div>

    <section class="cta">
      <h2 style="margin:0 0 8px;font-size:18px;letter-spacing:0;color:white;text-transform:none;">What this report is for</h2>
      <p style="margin:0 0 12px;line-height:1.7;">This is a practical first-pass CRO review. If you want, ${escapeHtml(branding.senderName || branding.brandName || "our team")} can turn this into a prioritized implementation plan and managed follow-up.</p>
      <div class="muted">${escapeHtml(branding.senderName || "")}${branding.senderTitle ? `, ${escapeHtml(branding.senderTitle)}` : ""}${branding.supportEmail ? ` • ${escapeHtml(branding.supportEmail)}` : ""}</div>
    </section>

    <div class="footer">Generated by ${escapeHtml(branding.brandName || "Scrape Intelligence")}</div>
  </div>
</body>
</html>`;
}

export function buildMiniAuditPayload(lead, jobResult, branding = {}) {
  const html = buildReportHtml({
    branding: {
      brandName: branding.brandName || "Scrape Intelligence",
      senderName: branding.senderName || "",
      senderTitle: branding.senderTitle || "Founder",
      logoUrl: branding.logoUrl || "",
      primaryColor: branding.primaryColor || "#0ea5e9",
      supportEmail: branding.supportEmail || ""
    },
    lead,
    jobResult,
    screenshotUrl: jobResult?.screenshot_path || null
  });

  const filename = `audit-${String(lead.name || "lead").replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now()}.html`;
  return { html, filename };
}

function generateShareToken() {
  return randomBytes(16).toString("base64url");
}

async function createPdfBuffer(html) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    return await page.pdf({ format: "A4", printBackground: true, margin: { top: "12mm", right: "10mm", bottom: "12mm", left: "10mm" } });
  } finally {
    await browser.close();
  }
}

async function getLatestLeadResult(leadId, website) {
  let query = supabaseAdmin
    .from("job_results")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (leadId) {
    const { data } = await query.eq("lead_id", leadId);
    if (data?.length) return data[0];
  }

  if (website) {
    const { data } = await supabaseAdmin
      .from("job_results")
      .select("*")
      .eq("url", website)
      .order("created_at", { ascending: false })
      .limit(1);
    return data?.[0] || null;
  }

  return null;
}

export async function generateLeadReport(leadId, userId, options = {}) {
  const { campaignId = null, forceRegenerate = false } = options;

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", userId)
    .single();

  if (leadError || !lead) {
    throw new Error(`Lead not found: ${leadError?.message || "Unknown"}`);
  }

  if (!forceRegenerate) {
    const { data: existing } = await supabaseAdmin
      .from("artifacts")
      .select("*")
      .eq("user_id", userId)
      .eq("lead_id", leadId)
      .eq("kind", "intelligence_report_html")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.share_token) {
      const shareUrl = `${process.env.APP_URL || "http://localhost:5173"}/share/${existing.share_token}`;
      return {
        htmlArtifactId: existing.id,
        pdfArtifactId: existing.metadata?.pdfArtifactId || null,
        shareUrl,
        downloadUrl: existing.metadata?.pdfArtifactId ? `${process.env.APP_URL || "http://localhost:5173"}/reports/${existing.metadata.pdfArtifactId}/download` : null
      };
    }
  }

  const branding = await getBrandingSettings(userId);
  const latestResult = await getLatestLeadResult(lead.id, lead.website);
  const screenshotUrl = latestResult?.screenshot_key ? await storage.getSignedUrl(latestResult.screenshot_key, 3600).catch(() => null) : latestResult?.screenshot_path || null;

  const html = buildReportHtml({ branding, lead, jobResult: latestResult, screenshotUrl });
  const reportGroupId = randomBytes(10).toString("hex");
  const htmlFilename = `report-${reportGroupId}.html`;
  const pdfFilename = `report-${reportGroupId}.pdf`;
  const htmlStorageKey = `artifacts/${userId}/${leadId}/${htmlFilename}`;
  const pdfStorageKey = `artifacts/${userId}/${leadId}/${pdfFilename}`;

  await storage.uploadFile(Buffer.from(html), htmlStorageKey, "text/html");
  const shareToken = generateShareToken();

  const { data: htmlArtifact, error: htmlError } = await supabaseAdmin
    .from("artifacts")
    .insert({
      lead_id: leadId,
      campaign_id: campaignId,
      user_id: userId,
      kind: "intelligence_report_html",
      storage_key: htmlStorageKey,
      share_token: shareToken,
      metadata: {
        filename: htmlFilename,
        reportGroupId,
        sourceJobResultId: latestResult?.id || null
      }
    })
    .select()
    .single();

  if (htmlError) throw new Error(`Failed to create HTML artifact: ${htmlError.message}`);

  const pdfBuffer = await createPdfBuffer(html);
  await storage.uploadFile(pdfBuffer, pdfStorageKey, "application/pdf");

  const { data: pdfArtifact, error: pdfError } = await supabaseAdmin
    .from("artifacts")
    .insert({
      lead_id: leadId,
      campaign_id: campaignId,
      user_id: userId,
      kind: "intelligence_report_pdf",
      storage_key: pdfStorageKey,
      metadata: {
        filename: pdfFilename,
        reportGroupId,
        sourceHtmlArtifactId: htmlArtifact.id
      }
    })
    .select()
    .single();

  if (pdfError) throw new Error(`Failed to create PDF artifact: ${pdfError.message}`);

  await supabaseAdmin
    .from("artifacts")
    .update({ metadata: { ...(htmlArtifact.metadata || {}), pdfArtifactId: pdfArtifact.id, filename: htmlFilename, reportGroupId } })
    .eq("id", htmlArtifact.id);

  await db.updateLeadAnalysis(leadId, userId, lead.analysis_summary || {}, htmlArtifact.id).catch(() => {});
  await db.createUsageEvent(userId, "report_generated", 1, { reportGroupId }, { leadId, artifactId: htmlArtifact.id }).catch(() => {});

  return {
    htmlArtifactId: htmlArtifact.id,
    pdfArtifactId: pdfArtifact.id,
    shareUrl: `${process.env.APP_URL || "http://localhost:5173"}/share/${shareToken}`,
    downloadUrl: `${process.env.APP_URL || "http://localhost:5173"}/reports/${pdfArtifact.id}/download`
  };
}

export async function listReports(userId, limit = 100) {
  const { data, error } = await supabaseAdmin
    .from("artifacts")
    .select("*, leads(id, name, website)")
    .eq("user_id", userId)
    .eq("kind", "intelligence_report_html")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((artifact) => ({
    id: artifact.id,
    leadId: artifact.lead_id,
    leadName: artifact.leads?.name || "Unknown lead",
    website: artifact.leads?.website || "",
    createdAt: artifact.created_at,
    shareUrl: artifact.share_token ? `${process.env.APP_URL || "http://localhost:5173"}/share/${artifact.share_token}` : null,
    pdfArtifactId: artifact.metadata?.pdfArtifactId || null,
    metadata: artifact.metadata || {}
  }));
}

export async function getArtifactByToken(shareToken) {
  const { data, error } = await supabaseAdmin
    .from("artifacts")
    .select("*")
    .eq("share_token", shareToken)
    .eq("kind", "intelligence_report_html")
    .single();

  if (error || !data) {
    return null;
  }

  const signedUrl = await storage.getSignedUrl(data.storage_key, 86400);
  return { ...data, signedUrl };
}

export async function getArtifactById(artifactId, userId) {
  const { data, error } = await supabaseAdmin
    .from("artifacts")
    .select("*")
    .eq("id", artifactId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  const signedUrl = await storage.getSignedUrl(data.storage_key, 3600);
  return { ...data, signedUrl };
}
