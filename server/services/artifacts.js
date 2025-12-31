/**
 * Artifacts Service - Mini Audit Generator
 * 
 * Generates shareable HTML audit documents for leads
 */

import { randomBytes } from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import * as db from './db.js';
import * as storage from './storage.js';
import { render } from '../lib/templates.js';

const MINI_AUDIT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRO Audit: {{lead.name}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 100%);
      color: #e2e8f0;
      padding: 2rem;
      min-height: 100vh;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      backdrop-filter: blur(20px);
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    header {
      padding: 2.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: linear-gradient(180deg, rgba(0, 240, 255, 0.05) 0%, transparent 100%);
    }
    h1 {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      background: linear-gradient(to bottom, #fff, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.02em;
    }
    .meta {
      color: #94a3b8;
      font-size: 0.9rem;
      margin-bottom: 0.25rem;
    }
    .screenshot-section {
      padding: 2rem;
      text-align: center;
      background: rgba(0, 0, 0, 0.2);
    }
    .screenshot {
      width: 100%;
      max-width: 100%;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.3);
    }
    .screenshot-placeholder {
      padding: 4rem;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;
      border: 1px dashed rgba(255, 255, 255, 0.2);
      color: #64748b;
    }
    .section {
      padding: 2.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .section:last-child {
      border-bottom: none;
    }
    h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      color: #fff;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-size: 0.75rem;
    }
    .confidence-bar {
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }
    .confidence-fill {
      height: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, #f59e0b 0%, #10b981 100%);
      transition: width 0.3s ease;
    }
    .confidence-text {
      font-size: 2.5rem;
      font-weight: 200;
      color: #fff;
      letter-spacing: -0.05em;
    }
    .confidence-label {
      color: #64748b;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    ul {
      list-style: none;
    }
    li {
      padding: 1rem;
      margin-bottom: 0.75rem;
      background: rgba(255, 255, 255, 0.02);
      border-left: 3px solid;
      border-radius: 0 4px 4px 0;
      line-height: 1.6;
    }
    .issues li { border-color: #ef4444; }
    .wins li { border-color: #10b981; }
    footer {
      padding: 2rem;
      text-align: center;
      color: #64748b;
      font-size: 0.85rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    @media print {
      body { background: white; color: black; }
      .container { box-shadow: none; border: 1px solid #ccc; }
      header, .screenshot-section, .section { background: white; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>{{lead.name}}</h1>
      <div class="meta">{{lead.website}}</div>
      <div class="meta">Audited: {{audit_date}}</div>
    </header>

    {{#if screenshot_url}}
    <div class="screenshot-section">
      <img src="{{screenshot_url}}" alt="Site screenshot" class="screenshot" />
    </div>
    {{else}}
    <div class="screenshot-section">
      <div class="screenshot-placeholder">No screenshot available</div>
    </div>
    {{/if}}

    <div class="section">
      <div class="confidence-label">Analysis Confidence</div>
      <div class="confidence-bar">
        <div class="confidence-fill" style="width: {{confidence}}%"></div>
      </div>
      <div class="confidence-text">{{confidence}}%</div>
    </div>

    {{#if has_issues}}
    <div class="section issues">
      <h2>Issues Found</h2>
      <ul>
        {{issues_list}}
      </ul>
    </div>
    {{/if}}

    {{#if has_wins}}
    <div class="section wins">
      <h2>Quick Wins</h2>
      <ul>
        {{wins_list}}
      </ul>
    </div>
    {{/if}}

    {{#if summary}}
    <div class="section">
      <h2>Executive Summary</h2>
      <p style="line-height: 1.8; color: #cbd5e1;">{{summary}}</p>
    </div>
    {{/if}}

    <footer>
      Generated by Lead Scraper Pro
    </footer>
  </div>
</body>
</html>`;

/**
 * Build HTML mini audit payload from lead and job result
 * @param {Object} lead - Lead record
 * @param {Object} jobResult - Job result with report
 * @returns { html: string, filename: string }
 */
export function buildMiniAuditPayload(lead, jobResult) {
  const report = jobResult?.report || {};
  const issues = report.issues || [];
  const wins = report.quick_wins || [];
  const confidence = report.confidence === 'high' ? 85
    : report.confidence === 'medium' ? 60
      : 40;

  const context = {
    lead: {
      name: lead.name || 'Unknown',
      website: lead.website || ''
    },
    audit_date: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    screenshot_url: jobResult?.screenshot_path || null,
    confidence,
    has_issues: issues.length > 0,
    has_wins: wins.length > 0,
    summary: report.summary || '',
    issues_list: issues.slice(0, 3).map(issue => `<li>${issue}</li>`).join(''),
    wins_list: wins.slice(0, 3).map(win => `<li>${win}</li>`).join('')
  };

  const fallbacks = {
    'lead.name': 'Unknown',
    'lead.website': 'No website',
    'audit_date': 'Pending audit',
    'screenshot_url': null,
    'confidence': 50,
    'summary': 'No summary available'
  };

  const { result: html } = render(MINI_AUDIT_TEMPLATE, context, fallbacks);

  const filename = `audit-${lead.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.html`;

  return { html, filename };
}

/**
 * Generate URL-safe share token
 * @returns {string} URL-safe random token
 */
function generateShareToken() {
  return randomBytes(16).toString('base64url');
}

/**
 * Generate a mini audit artifact for a lead
 * @param {string} leadId - Lead ID
 * @param {Object} options - { campaignId?, forceRegenerate? }
 * @returns { Promise<{ artifactId: string, storageKey: string, shareToken: string, shareUrl: string }> }
 */
export async function generateMiniAudit(leadId, options = {}) {
  const { campaignId, forceRegenerate = false } = options;

  const { data: lead, error: leadError } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    throw new Error(`Lead not found: ${leadError?.message || 'Unknown'}`);
  }

  const { data: existingArtifact } = await supabaseAdmin
    .from('artifacts')
    .select('*')
    .eq('lead_id', leadId)
    .eq('kind', 'mini_audit')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingArtifact && !forceRegenerate) {
    const shareToken = existingArtifact.share_token;
    return {
      artifactId: existingArtifact.id,
      storageKey: existingArtifact.storage_key,
      shareToken,
      shareUrl: `${process.env.APP_URL || 'http://localhost:5173'}/share/${shareToken}`
    };
  }

  const { data: jobResults } = await supabaseAdmin
    .from('job_results')
    .select('*')
    .eq('url', lead.website)
    .order('created_at', { ascending: false })
    .limit(1);

  const jobResult = jobResults?.[0] || null;

  const { html, filename } = buildMiniAuditPayload(lead, jobResult);

  const storageKey = `artifacts/${lead.user_id}/${leadId}/${filename}`;
  await storage.uploadFile(Buffer.from(html), storageKey, 'text/html');

  const shareToken = generateShareToken();

  const { data: artifact, error: artifactError } = await supabaseAdmin
    .from('artifacts')
    .insert({
      lead_id: leadId,
      campaign_id: campaignId || null,
      user_id: lead.user_id,
      kind: 'mini_audit',
      storage_key: storageKey,
      share_token: shareToken,
      metadata: {
        filename,
        hasJobResult: !!jobResult,
        issuesCount: jobResult?.report?.issues?.length || 0,
        winsCount: jobResult?.report?.quick_wins?.length || 0
      }
    })
    .select()
    .single();

  if (artifactError) {
    throw new Error(`Failed to create artifact: ${artifactError.message}`);
  }

  return {
    artifactId: artifact.id,
    storageKey,
    shareToken,
    shareUrl: `${process.env.APP_URL || 'http://localhost:5173'}/share/${shareToken}`
  };
}

/**
 * Get artifact by share token (public access)
 * @param {string} shareToken - Share token
 * @returns { Promise<Object|null> } Artifact record or null
 */
export async function getArtifactByToken(shareToken) {
  const { data, error } = await supabaseAdmin
    .from('artifacts')
    .select('*')
    .eq('share_token', shareToken)
    .eq('kind', 'mini_audit')
    .single();

  if (error || !data) {
    return null;
  }

  const signedUrl = await storage.getSignedUrl(data.storage_key, 86400);

  return {
    ...data,
    signedUrl
  };
}

/**
 * Get artifact by ID (requires auth)
 * @param {string} artifactId - Artifact ID
 * @param {string} userId - User ID for ownership check
 * @returns { Promise<Object|null> } Artifact with signed URL
 */
export async function getArtifactById(artifactId, userId) {
  const { data, error } = await supabaseAdmin
    .from('artifacts')
    .select('*')
    .eq('id', artifactId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  const signedUrl = await storage.getSignedUrl(data.storage_key, 3600);

  return {
    ...data,
    signedUrl
  };
}
