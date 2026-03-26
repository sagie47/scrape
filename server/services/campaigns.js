/**
 * Campaigns Service - State machine and business logic
 */

import { supabaseAdmin } from "../lib/supabase.js";
import * as rendering from "./rendering.js";
import * as exportsService from "./exports.js";

const OUTCOME_MAP = {
    replied: "replied",
    booked: "booked",
    not_interested: "not_interested",
    none: "none",
    no_response: "none",
    skipped: "not_interested"
};

export async function createCampaign(userId, { name, sequenceId, leadIds = [] }) {
    const { data: campaign, error } = await supabaseAdmin
        .from("campaigns")
        .insert({
            user_id: userId,
            name,
            sequence_id: sequenceId || null,
            status: "draft"
        })
        .select()
        .single();

    if (error) throw error;

    if (leadIds.length > 0) {
        const enrollments = leadIds.map((leadId) => ({
            campaign_id: campaign.id,
            lead_id: leadId,
            state: "queued"
        }));

        await supabaseAdmin.from("campaign_leads").upsert(enrollments, { onConflict: "campaign_id,lead_id" });
    }

    return campaign;
}

export async function getCampaigns(userId) {
    const { data, error } = await supabaseAdmin
        .from("campaigns")
        .select(`
            *,
            campaign_leads(count),
            sequences(name)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        sequenceName: row.sequences?.name || null,
        leadsCount: row.campaign_leads?.[0]?.count || 0,
        createdAt: row.created_at,
        startAt: row.start_at || row.started_at || null
    }));
}

export async function getCampaign(campaignId, userId) {
    const { data, error } = await supabaseAdmin
        .from("campaigns")
        .select(`
            *,
            sequences(*),
            campaign_leads(*)
        `)
        .eq("id", campaignId)
        .eq("user_id", userId)
        .single();

    if (error) throw error;
    if (!data) return null;

    const leads = data.campaign_leads || [];
    const stats = {
        total: leads.length,
        queued: leads.filter((lead) => lead.state === "queued").length,
        inProgress: leads.filter((lead) => lead.state === "in_progress").length,
        waiting: leads.filter((lead) => lead.state === "waiting").length,
        stopped: leads.filter((lead) => lead.state === "stopped").length,
        completed: leads.filter((lead) => lead.state === "completed").length,
        replied: leads.filter((lead) => lead.outcome === "replied").length,
        booked: leads.filter((lead) => lead.outcome === "booked").length
    };

    return {
        id: data.id,
        name: data.name,
        status: data.status,
        sequence: data.sequences,
        stats,
        leads: leads.map((lead) => ({
            id: lead.id,
            leadId: lead.lead_id,
            state: lead.state,
            currentStep: lead.current_step_order,
            nextDue: lead.next_due_at,
            outcome: lead.outcome
        })),
        createdAt: data.created_at,
        startAt: data.start_at || data.started_at || null
    };
}

export async function activateCampaign(campaignId, userId) {
    const { data: campaign, error: campaignError } = await supabaseAdmin
        .from("campaigns")
        .select(`*, sequences(*, sequence_steps(*))`)
        .eq("id", campaignId)
        .eq("user_id", userId)
        .single();

    if (campaignError || !campaign) throw new Error("Campaign not found");
    if (!campaign.sequence_id) throw new Error("No sequence assigned to campaign");
    if (campaign.status === "active") throw new Error("Campaign already active");

    const steps = (campaign.sequences?.sequence_steps || []).sort((a, b) => a.step_order - b.step_order);
    if (!steps.length) throw new Error("Sequence has no steps");

    const { data: campaignLeads } = await supabaseAdmin
        .from("campaign_leads")
        .select(`*, leads(*)`)
        .eq("campaign_id", campaignId);

    if (!campaignLeads?.length) throw new Error("No leads enrolled");

    const startAt = new Date();
    const tasksToInsert = [];

    for (const campaignLead of campaignLeads) {
        let cumulativeDelay = 0;
        for (const step of steps) {
            cumulativeDelay += step.delay_days;
            const dueAt = new Date(startAt);
            dueAt.setDate(dueAt.getDate() + cumulativeDelay);
            dueAt.setHours(9, 0, 0, 0);

            const variant = hashVariant(campaignLead.id, step.step_order);
            const template = variant === "A" ? step.template_a : (step.template_b || step.template_a);
            const subject = variant === "A" ? step.subject_a : (step.subject_b || step.subject_a);
            const rendered = rendering.renderStep({
                step,
                lead: campaignLead.leads,
                template,
                subject
            });

            tasksToInsert.push({
                campaign_lead_id: campaignLead.id,
                step_id: step.id,
                channel: step.channel,
                due_at: dueAt.toISOString(),
                variant,
                rendered_subject: rendered.subject,
                rendered_body: rendered.body,
                missing_fields: rendered.missingFields
            });
        }

        await supabaseAdmin
            .from("campaign_leads")
            .update({
                state: "in_progress",
                current_step_order: 1,
                next_due_at: tasksToInsert.find((task) => task.campaign_lead_id === campaignLead.id)?.due_at || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", campaignLead.id);
    }

    if (tasksToInsert.length) {
        const { error: taskError } = await supabaseAdmin.from("touch_tasks").insert(tasksToInsert);
        if (taskError) throw taskError;
    }

    await supabaseAdmin
        .from("campaigns")
        .update({ status: "active", start_at: startAt.toISOString() })
        .eq("id", campaignId);

    return { success: true, tasksGenerated: tasksToInsert.length };
}

export async function pauseCampaign(campaignId, userId) {
    const { error } = await supabaseAdmin
        .from("campaigns")
        .update({ status: "paused" })
        .eq("id", campaignId)
        .eq("user_id", userId);

    if (error) throw error;
    return { success: true };
}

export async function getTasks(campaignId, userId, bucket = "today") {
    const { data: campaign } = await supabaseAdmin
        .from("campaigns")
        .select("id")
        .eq("id", campaignId)
        .eq("user_id", userId)
        .single();

    if (!campaign) throw new Error("Campaign not found");

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    let query = supabaseAdmin
        .from("touch_tasks")
        .select(`
            *,
            campaign_leads!inner(id, campaign_id, lead_id, state, outcome, leads(*)),
            sequence_steps(*)
        `)
        .eq("campaign_leads.campaign_id", campaignId)
        .eq("status", "pending");

    if (bucket === "overdue") {
        query = query.lt("due_at", todayStart.toISOString());
    } else if (bucket === "today") {
        query = query.gte("due_at", todayStart.toISOString()).lt("due_at", todayEnd.toISOString());
    } else if (bucket === "upcoming") {
        query = query.gte("due_at", todayEnd.toISOString());
    }

    const { data, error } = await query.order("due_at");
    if (error) throw error;

    return (data || []).map((task) => ({
        id: task.id,
        campaignLeadId: task.campaign_lead_id,
        channel: task.channel,
        dueAt: task.due_at,
        status: task.status,
        variant: task.variant,
        subject: task.rendered_subject,
        body: task.rendered_body,
        missingFields: task.missing_fields || [],
        lead: task.campaign_leads?.leads || null,
        step: task.sequence_steps || null
    }));
}

export async function completeTask(taskId, userId) {
    const { data: task } = await supabaseAdmin
        .from("touch_tasks")
        .select(`
            *,
            campaign_leads!inner(
                *,
                campaigns!inner(user_id)
            )
        `)
        .eq("id", taskId)
        .single();

    if (!task || task.campaign_leads.campaigns.user_id !== userId) {
        throw new Error("Task not found");
    }

    await supabaseAdmin
        .from("touch_tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", taskId);

    await supabaseAdmin.from("activities").insert({
        campaign_lead_id: task.campaign_lead_id,
        type: "task_completed",
        meta: { task_id: taskId, channel: task.channel }
    });

    return { success: true };
}

export async function setOutcome(campaignLeadId, userId, outcome) {
    const canonicalOutcome = OUTCOME_MAP[outcome] || outcome;

    const { data: campaignLead } = await supabaseAdmin
        .from("campaign_leads")
        .select(`*, campaigns!inner(user_id, sequence_id)`) 
        .eq("id", campaignLeadId)
        .single();

    if (!campaignLead || campaignLead.campaigns.user_id !== userId) {
        throw new Error("Campaign lead not found");
    }

    const { data: campaign } = await supabaseAdmin
        .from("campaigns")
        .select(`sequences(stop_rules)`)
        .eq("id", campaignLead.campaign_id)
        .single();

    const stopRules = campaign?.sequences?.stop_rules?.stop_on || [];
    const shouldStop = stopRules.includes(canonicalOutcome);

    await supabaseAdmin
        .from("campaign_leads")
        .update({
            outcome: canonicalOutcome,
            state: shouldStop ? "stopped" : campaignLead.state,
            updated_at: new Date().toISOString()
        })
        .eq("id", campaignLeadId);

    if (shouldStop) {
        await supabaseAdmin
            .from("touch_tasks")
            .update({ status: "skipped" })
            .eq("campaign_lead_id", campaignLeadId)
            .eq("status", "pending");
    }

    await supabaseAdmin.from("activities").insert({
        campaign_lead_id: campaignLeadId,
        type: "outcome_set",
        meta: { outcome: canonicalOutcome, stopped: shouldStop }
    });

    return { success: true, stopped: shouldStop };
}

export async function exportCampaignToCsv(campaignId, userId, format = "csv") {
    return exportsService.exportCampaignToCsv(campaignId, userId, format);
}

function hashVariant(campaignLeadId, stepOrder) {
    const combined = `${campaignLeadId}-${stepOrder}`;
    let hash = 0;
    for (let index = 0; index < combined.length; index += 1) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(index);
        hash |= 0;
    }
    return hash % 2 === 0 ? "A" : "B";
}
