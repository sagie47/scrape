/**
 * Campaigns Service - State machine and business logic
 * 
 * Single source of truth for campaign state transitions.
 */

import { supabaseAdmin } from "../lib/supabase.js";
import * as rendering from "./rendering.js";

/**
 * Create a new campaign in draft state
 */
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

    // Enroll leads if provided
    if (leadIds.length > 0) {
        const enrollments = leadIds.map(leadId => ({
            campaign_id: campaign.id,
            lead_id: leadId,
            state: "queued"
        }));

        await supabaseAdmin.from("campaign_leads").insert(enrollments);
    }

    return campaign;
}

/**
 * Get campaigns for a user
 */
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

    return data.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        sequenceName: c.sequences?.name || null,
        leadsCount: c.campaign_leads?.[0]?.count || 0,
        createdAt: c.created_at,
        startAt: c.start_at
    }));
}

/**
 * Get campaign details with stats
 */
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

    // Calculate stats
    const leads = data.campaign_leads || [];
    const stats = {
        total: leads.length,
        queued: leads.filter(l => l.state === "queued").length,
        inProgress: leads.filter(l => l.state === "in_progress").length,
        waiting: leads.filter(l => l.state === "waiting").length,
        stopped: leads.filter(l => l.state === "stopped").length,
        completed: leads.filter(l => l.state === "completed").length,
        replied: leads.filter(l => l.outcome === "replied").length,
        booked: leads.filter(l => l.outcome === "booked").length
    };

    return {
        id: data.id,
        name: data.name,
        status: data.status,
        sequence: data.sequences,
        stats,
        leads: leads.map(l => ({
            id: l.id,
            leadId: l.lead_id,
            state: l.state,
            currentStep: l.current_step_order,
            nextDue: l.next_due_at,
            outcome: l.outcome
        })),
        createdAt: data.created_at,
        startAt: data.start_at
    };
}

/**
 * Activate campaign - generate all tasks for enrolled leads
 */
export async function activateCampaign(campaignId, userId) {
    // Verify ownership and get sequence
    const { data: campaign, error: campError } = await supabaseAdmin
        .from("campaigns")
        .select(`*, sequences(*, sequence_steps(*))`)
        .eq("id", campaignId)
        .eq("user_id", userId)
        .single();

    if (campError || !campaign) throw new Error("Campaign not found");
    if (!campaign.sequence_id) throw new Error("No sequence assigned to campaign");
    if (campaign.status === "active") throw new Error("Campaign already active");

    const steps = campaign.sequences?.sequence_steps || [];
    if (steps.length === 0) throw new Error("Sequence has no steps");

    // Sort steps by order
    steps.sort((a, b) => a.step_order - b.step_order);

    // Get enrolled leads with their data
    const { data: campaignLeads } = await supabaseAdmin
        .from("campaign_leads")
        .select(`*, leads(*)`)
        .eq("campaign_id", campaignId);

    if (!campaignLeads?.length) throw new Error("No leads enrolled");

    const startAt = new Date();
    const tasksToInsert = [];
    const leadsToUpdate = [];

    for (const cl of campaignLeads) {
        // Generate tasks for all steps
        let cumDays = 0;
        for (const step of steps) {
            cumDays += step.delay_days;
            const dueAt = new Date(startAt);
            dueAt.setDate(dueAt.getDate() + cumDays);
            dueAt.setHours(9, 0, 0, 0); // Schedule at 9am

            // Deterministic A/B variant based on hash
            const variant = hashVariant(cl.id, step.step_order);
            const template = variant === "A" ? step.template_a : (step.template_b || step.template_a);
            const subject = variant === "A" ? step.subject_a : (step.subject_b || step.subject_a);

            // Render template
            const rendered = rendering.renderStep({
                step,
                lead: cl.leads,
                template,
                subject
            });

            tasksToInsert.push({
                campaign_lead_id: cl.id,
                step_id: step.id,
                channel: step.channel,
                due_at: dueAt.toISOString(),
                variant,
                rendered_subject: rendered.subject,
                rendered_body: rendered.body,
                missing_fields: rendered.missingFields
            });
        }

        // Update campaign lead state
        leadsToUpdate.push({
            id: cl.id,
            state: "in_progress",
            current_step_order: 1,
            next_due_at: tasksToInsert.find(t => t.campaign_lead_id === cl.id)?.due_at
        });
    }

    // Insert all tasks
    if (tasksToInsert.length > 0) {
        const { error: taskError } = await supabaseAdmin
            .from("touch_tasks")
            .insert(tasksToInsert);
        if (taskError) throw taskError;
    }

    // Update campaign lead states
    for (const update of leadsToUpdate) {
        await supabaseAdmin
            .from("campaign_leads")
            .update({
                state: update.state,
                current_step_order: update.current_step_order,
                next_due_at: update.next_due_at,
                updated_at: new Date().toISOString()
            })
            .eq("id", update.id);
    }

    // Activate campaign
    await supabaseAdmin
        .from("campaigns")
        .update({
            status: "active",
            start_at: startAt.toISOString()
        })
        .eq("id", campaignId);

    return { success: true, tasksGenerated: tasksToInsert.length };
}

/**
 * Pause campaign
 */
export async function pauseCampaign(campaignId, userId) {
    const { error } = await supabaseAdmin
        .from("campaigns")
        .update({ status: "paused" })
        .eq("id", campaignId)
        .eq("user_id", userId);

    if (error) throw error;
    return { success: true };
}

/**
 * Get tasks for a campaign by bucket
 */
export async function getTasks(campaignId, userId, bucket = "today") {
    // Verify ownership
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
            campaign_leads!inner(campaign_id, leads(*)),
            sequence_steps(*)
        `)
        .eq("campaign_leads.campaign_id", campaignId)
        .eq("status", "pending");

    if (bucket === "overdue") {
        query = query.lt("due_at", todayStart.toISOString());
    } else if (bucket === "today") {
        query = query
            .gte("due_at", todayStart.toISOString())
            .lt("due_at", todayEnd.toISOString());
    } else if (bucket === "upcoming") {
        query = query.gte("due_at", todayEnd.toISOString());
    }

    const { data, error } = await query.order("due_at");
    if (error) throw error;

    return data.map(t => ({
        id: t.id,
        channel: t.channel,
        dueAt: t.due_at,
        status: t.status,
        variant: t.variant,
        subject: t.rendered_subject,
        body: t.rendered_body,
        missingFields: t.missing_fields,
        lead: t.campaign_leads?.leads,
        step: t.sequence_steps
    }));
}

/**
 * Mark task as done
 */
export async function completeTask(taskId, userId) {
    // Get task and verify ownership via campaign chain
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

    // Update task
    await supabaseAdmin
        .from("touch_tasks")
        .update({
            status: "done",
            completed_at: new Date().toISOString()
        })
        .eq("id", taskId);

    // Log activity
    await supabaseAdmin
        .from("activities")
        .insert({
            campaign_lead_id: task.campaign_lead_id,
            type: "task_completed",
            meta: { task_id: taskId, channel: task.channel }
        });

    return { success: true };
}

/**
 * Set outcome for a campaign lead
 */
export async function setOutcome(campaignLeadId, userId, outcome) {
    // Verify ownership
    const { data: cl } = await supabaseAdmin
        .from("campaign_leads")
        .select(`*, campaigns!inner(user_id)`)
        .eq("id", campaignLeadId)
        .single();

    if (!cl || cl.campaigns.user_id !== userId) {
        throw new Error("Campaign lead not found");
    }

    // Check if this outcome triggers a stop rule
    const { data: campaign } = await supabaseAdmin
        .from("campaigns")
        .select(`sequences(stop_rules)`)
        .eq("id", cl.campaign_id)
        .single();

    const stopRules = campaign?.sequences?.stop_rules?.stop_on || [];
    const shouldStop = stopRules.includes(outcome);

    // Update campaign lead
    await supabaseAdmin
        .from("campaign_leads")
        .update({
            outcome,
            state: shouldStop ? "stopped" : cl.state,
            updated_at: new Date().toISOString()
        })
        .eq("id", campaignLeadId);

    // If stopped, skip all pending tasks
    if (shouldStop) {
        await supabaseAdmin
            .from("touch_tasks")
            .update({ status: "skipped" })
            .eq("campaign_lead_id", campaignLeadId)
            .eq("status", "pending");
    }

    // Log activity
    await supabaseAdmin
        .from("activities")
        .insert({
            campaign_lead_id: campaignLeadId,
            type: "outcome_set",
            meta: { outcome, stopped: shouldStop }
        });

    return { success: true, stopped: shouldStop };
}

/**
 * Export campaign to CSV
 */
export async function exportCampaignToCsv(campaignId, userId) {
    const campaign = await getCampaign(campaignId, userId);
    if (!campaign) throw new Error("Campaign not found");

    // Get all tasks with lead data
    const { data: tasks } = await supabaseAdmin
        .from("touch_tasks")
        .select(`
            *,
            campaign_leads!inner(
                *,
                leads(*)
            )
        `)
        .in("campaign_leads.id", campaign.leads.map(l => l.id))
        .order("due_at");

    const lines = [
        ["Lead Name", "Email", "Phone", "Website", "Step", "Channel", "Status", "Due At", "Subject", "Body"].join(",")
    ];

    for (const t of tasks || []) {
        const lead = t.campaign_leads?.leads;
        lines.push([
            escapeCsv(lead?.name || ""),
            escapeCsv(lead?.email || ""),
            escapeCsv(lead?.phone || ""),
            escapeCsv(lead?.website || ""),
            t.step_id || "",
            t.channel,
            t.status,
            t.due_at,
            escapeCsv(t.rendered_subject || ""),
            escapeCsv(t.rendered_body || "")
        ].join(","));
    }

    return lines.join("\n");
}

// Helpers

function escapeCsv(str) {
    if (!str) return "";
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function hashVariant(campaignLeadId, stepOrder) {
    // Deterministic A/B based on simple hash
    const combined = `${campaignLeadId}-${stepOrder}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(i);
        hash |= 0;
    }
    return hash % 2 === 0 ? "A" : "B";
}
