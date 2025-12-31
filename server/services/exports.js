/**
 * Export Service - CSV formatting for campaigns and leads
 * 
 * Provides standardized export functions with campaign/outreach data
 */

import ExcelJS from 'exceljs';
import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Export campaign to CSV with outreach data
 * @param {string} campaignId - Campaign ID
 * @param {string} format - 'csv' | 'xlsx'
 * @returns {Promise<Buffer>} File buffer
 */
export async function exportCampaignToCsv(campaignId, format = 'csv') {
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campaignError || !campaign) {
    throw new Error(`Campaign not found: ${campaignError?.message || 'Unknown'}`);
  }

  let campaignLeads = (await supabaseAdmin
    .from('campaign_leads')
    .select(`
      *,
      leads!inner(id, name, email, phone, website, address, rating, reviews),
      outreach_scripts (
        email_subject,
        email_body,
        sms_text,
        phone_script,
        status,
        sent_at
      )
    `)
    .eq('campaign_id', campaignId)).data;

  if (!campaignLeads) {
    campaignLeads = [];
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Campaign Export');

  worksheet.columns = [
    { header: 'Lead Name', key: 'lead_name', width: 30 },
    { header: 'Email', key: 'email', width: 35 },
    { header: 'Phone', key: 'phone', width: 20 },
    { header: 'Website', key: 'website', width: 40 },
    { header: 'Address', key: 'address', width: 40 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Current Step', key: 'current_step', width: 20 },
    { header: 'Next Task', key: 'next_task', width: 30 },
    { header: 'Email Subject', key: 'email_subject', width: 50 },
    { header: 'Email Body', key: 'email_body', width: 100 },
    { header: 'SMS Text', key: 'sms_text', width: 60 },
    { header: 'Phone Script', key: 'phone_script', width: 100 },
    { header: 'Sent At', key: 'sent_at', width: 20 },
    { header: 'Rating', key: 'rating', width: 10 },
    { header: 'Reviews', key: 'reviews', width: 10 }
  ];

  campaignLeads.forEach(cl => {
    const lead = cl.leads || {};
    const script = cl.outreach_scripts?.[0] || {};

    worksheet.addRow({
      lead_name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      website: lead.website || '',
      address: lead.address || '',
      status: cl.status || 'pending',
      current_step: cl.current_step || 'outreach',
      next_task: cl.next_task || 'Send initial contact',
      email_subject: script.email_subject || '',
      email_body: script.email_body || '',
      sms_text: script.sms_text || '',
      phone_script: script.phone_script || '',
      sent_at: script.sent_at ? new Date(script.sent_at).toLocaleString() : '',
      rating: lead.rating || '',
      reviews: lead.reviews || ''
    });
  });

  worksheet.getRow(1).font = { bold: true };

  if (format === 'csv') {
    const buffer = await workbook.csv.writeBuffer();
    return buffer;
  } else {
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}

/**
 * Export leads to CSV with atoms columns
 * @param {string[]} leadIds - Array of lead IDs
 * @param {string} format - 'csv' | 'xlsx'
 * @returns {Promise<Buffer>} File buffer
 */
export async function exportLeadsToCsv(leadIds, format = 'csv') {
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select(`
      *,
      atoms (
        id,
        type,
        key,
        value,
        category
      )
    `)
    .in('id', leadIds);

  if (!leads || leads.length === 0) {
    throw new Error('No leads found');
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Leads Export');

  worksheet.columns = [
    { header: 'Lead ID', key: 'id', width: 36 },
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Email', key: 'email', width: 35 },
    { header: 'Phone', key: 'phone', width: 20 },
    { header: 'Website', key: 'website', width: 40 },
    { header: 'Address', key: 'address', width: 40 },
    { header: 'Rating', key: 'rating', width: 10 },
    { header: 'Reviews', key: 'reviews', width: 10 },
    { header: 'Tags', key: 'tags', width: 30 },
    { header: 'Created At', key: 'created_at', width: 20 },
    { header: 'Atoms', key: 'atoms', width: 100 }
  ];

  leads.forEach(lead => {
    const atomsText = (lead.atoms || [])
      .map(a => `${a.category}.${a.key}: ${a.value}`)
      .join('; ');

    worksheet.addRow({
      id: lead.id,
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      website: lead.website || '',
      address: lead.address || '',
      rating: lead.rating || '',
      reviews: lead.reviews || '',
      tags: (lead.tags || []).join(', '),
      created_at: lead.created_at ? new Date(lead.created_at).toLocaleString() : '',
      atoms: atomsText
    });
  });

  worksheet.getRow(1).font = { bold: true };

  if (format === 'csv') {
    const buffer = await workbook.csv.writeBuffer();
    return buffer;
  } else {
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}

/**
 * Export all user leads to CSV (backward compatible with existing export)
 * @param {string} userId - User ID
 * @param {string} format - 'csv' | 'xlsx'
 * @returns {Promise<Buffer>} File buffer
 */
export async function exportUserLeads(userId, format = 'csv') {
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (!leads || leads.length === 0) {
    throw new Error('No leads found');
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Leads');

  worksheet.columns = [
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Address', key: 'address', width: 40 },
    { header: 'Phone', key: 'phone', width: 20 },
    { header: 'Website', key: 'website', width: 40 },
    { header: 'Rating', key: 'rating', width: 10 },
    { header: 'Reviews', key: 'reviews', width: 10 }
  ];

  leads.forEach(lead => {
    worksheet.addRow({
      name: lead.name || '',
      address: lead.address || '',
      phone: lead.phone || '',
      website: lead.website || '',
      rating: lead.rating || '',
      reviews: lead.reviews || ''
    });
  });

  worksheet.getRow(1).font = { bold: true };

  if (format === 'csv') {
    const buffer = await workbook.csv.writeBuffer();
    return buffer;
  } else {
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}
