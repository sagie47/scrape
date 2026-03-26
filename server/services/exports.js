/**
 * Export Service - CSV/XLSX formatting for campaigns and leads
 */

import ExcelJS from "exceljs";
import { supabaseAdmin } from "../lib/supabase.js";

async function getReportMapForLeadIds(leadIds) {
  if (!leadIds.length) return new Map();

  const { data } = await supabaseAdmin
    .from("artifacts")
    .select("*")
    .in("lead_id", leadIds)
    .eq("kind", "intelligence_report_html");

  const reportMap = new Map();
  for (const artifact of data || []) {
    const current = reportMap.get(artifact.lead_id);
    if (!current || new Date(artifact.created_at) > new Date(current.created_at)) {
      reportMap.set(artifact.lead_id, artifact);
    }
  }
  return reportMap;
}

export async function buildCampaignExportRows(campaignId, userId, appUrl = process.env.APP_URL || "http://localhost:5173") {
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("id, user_id, name")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign || campaign.user_id !== userId) {
    throw new Error(`Campaign not found: ${campaignError?.message || "Unknown"}`);
  }

  const { data: campaignLeads, error } = await supabaseAdmin
    .from("campaign_leads")
    .select(`
      *,
      leads!inner(*),
      touch_tasks(*),
      outreach_scripts(*)
    `)
    .eq("campaign_id", campaignId);

  if (error) throw error;

  const leadIds = (campaignLeads || []).map((row) => row.lead_id).filter(Boolean);
  const reportMap = await getReportMapForLeadIds(leadIds);

  return (campaignLeads || []).map((row) => {
    const lead = row.leads || {};
    const tasks = (row.touch_tasks || []).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
    const pendingTask = tasks.find((task) => task.status === "pending") || null;
    const latestScript = (row.outreach_scripts || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || {};
    const report = reportMap.get(row.lead_id);
    const reportUrl = report?.share_token ? `${appUrl}/share/${report.share_token}` : "";
    const reportPdfUrl = report?.metadata?.pdfArtifactId ? `${appUrl}/reports/${report.metadata.pdfArtifactId}/download` : "";

    return {
      lead_name: lead.name || "",
      email: lead.email || (Array.isArray(lead.emails) ? lead.emails[0] : "") || "",
      phone: lead.phone || "",
      website: lead.website || "",
      address: lead.address || "",
      category: lead.category || "",
      city: lead.city || "",
      status: row.state || "queued",
      current_step: row.current_step_order ?? 0,
      next_task: pendingTask?.channel || "",
      next_due_at: pendingTask?.due_at || row.next_due_at || "",
      outcome: row.outcome || "",
      report_url: reportUrl,
      report_pdf_url: reportPdfUrl,
      email_subject: latestScript.email_subject || pendingTask?.rendered_subject || "",
      email_body: latestScript.email_body || pendingTask?.rendered_body || "",
      sms_text: latestScript.sms_text || "",
      phone_script: latestScript.phone_script || "",
      rating: lead.rating || "",
      reviews: lead.reviews || ""
    };
  });
}

export async function exportCampaignToCsv(campaignId, userId, format = "csv") {
  const rows = await buildCampaignExportRows(campaignId, userId);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Campaign Export");

  worksheet.columns = [
    { header: "Lead Name", key: "lead_name", width: 30 },
    { header: "Email", key: "email", width: 34 },
    { header: "Phone", key: "phone", width: 20 },
    { header: "Website", key: "website", width: 40 },
    { header: "Address", key: "address", width: 40 },
    { header: "Category", key: "category", width: 22 },
    { header: "City", key: "city", width: 18 },
    { header: "State", key: "status", width: 16 },
    { header: "Current Step", key: "current_step", width: 12 },
    { header: "Next Task", key: "next_task", width: 18 },
    { header: "Next Due", key: "next_due_at", width: 24 },
    { header: "Outcome", key: "outcome", width: 18 },
    { header: "Report URL", key: "report_url", width: 54 },
    { header: "Report PDF URL", key: "report_pdf_url", width: 54 },
    { header: "Email Subject", key: "email_subject", width: 50 },
    { header: "Email Body", key: "email_body", width: 100 },
    { header: "SMS Text", key: "sms_text", width: 60 },
    { header: "Phone Script", key: "phone_script", width: 100 },
    { header: "Rating", key: "rating", width: 10 },
    { header: "Reviews", key: "reviews", width: 10 }
  ];

  rows.forEach((row) => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };

  return format === "xlsx" ? workbook.xlsx.writeBuffer() : workbook.csv.writeBuffer();
}

export async function exportLeadsToCsv(leadIds, userId, format = "csv") {
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .in("id", leadIds);

  if (error) throw error;
  if (!leads?.length) {
    throw new Error("No leads found");
  }

  const reportMap = await getReportMapForLeadIds(leads.map((lead) => lead.id));
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Leads Export");

  worksheet.columns = [
    { header: "Lead ID", key: "id", width: 36 },
    { header: "Name", key: "name", width: 30 },
    { header: "Email", key: "email", width: 34 },
    { header: "Phone", key: "phone", width: 20 },
    { header: "Website", key: "website", width: 40 },
    { header: "Address", key: "address", width: 40 },
    { header: "Category", key: "category", width: 22 },
    { header: "City", key: "city", width: 18 },
    { header: "Region", key: "region", width: 18 },
    { header: "Country", key: "country", width: 18 },
    { header: "Rating", key: "rating", width: 10 },
    { header: "Reviews", key: "reviews", width: 10 },
    { header: "Report URL", key: "report_url", width: 54 },
    { header: "Created At", key: "created_at", width: 22 }
  ];

  leads.forEach((lead) => {
    const report = reportMap.get(lead.id);
    worksheet.addRow({
      id: lead.id,
      name: lead.name || "",
      email: lead.email || (Array.isArray(lead.emails) ? lead.emails[0] : "") || "",
      phone: lead.phone || "",
      website: lead.website || "",
      address: lead.address || "",
      category: lead.category || "",
      city: lead.city || "",
      region: lead.region || "",
      country: lead.country || "",
      rating: lead.rating || "",
      reviews: lead.reviews || "",
      report_url: report?.share_token ? `${appUrl}/share/${report.share_token}` : "",
      created_at: lead.created_at || ""
    });
  });

  worksheet.getRow(1).font = { bold: true };
  return format === "xlsx" ? workbook.xlsx.writeBuffer() : workbook.csv.writeBuffer();
}

export async function exportUserLeads(userId, format = "csv") {
  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;
  return exportLeadsToCsv((leads || []).map((lead) => lead.id), userId, format);
}
