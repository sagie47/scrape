// Database service - wraps Supabase operations for jobs, leads, reports, and outreach

import { supabaseAdmin } from "../lib/supabase.js";

function firstEmail(value) {
    if (Array.isArray(value)) {
        return value.find(Boolean) || null;
    }
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }
    return null;
}

function normalizeTextArray(values) {
    if (!values) return [];
    if (Array.isArray(values)) {
        return values.map((value) => String(value).trim()).filter(Boolean);
    }
    return String(values)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}

function mapResult(row) {
    return {
        id: row.id,
        leadId: row.lead_id || null,
        row: row.row_index,
        name: row.name,
        url: row.url,
        screenshotKey: row.screenshot_key,
        screenshot: row.screenshot_path || (row.screenshot_key ? `/screenshot/${encodeURIComponent(row.screenshot_key)}?raw=1` : null),
        thumbnailKey: row.thumbnail_key || null,
        thumbnail: row.thumbnail_path || (row.thumbnail_key ? `/screenshot/${encodeURIComponent(row.thumbnail_key)}?raw=1` : null),
        report: row.report,
        error: row.error,
        createdAt: row.created_at
    };
}

function mapJob(row, includeResults = false) {
    const total = row.total_urls ?? row.total ?? 0;
    const processed = row.processed ?? 0;

    return {
        id: row.id,
        status: row.status,
        type: row.type,
        name: row.metadata?.name || row.name || row.type,
        total,
        processed,
        progress: total > 0 ? Math.round((processed / total) * 100) : 0,
        errors: row.errors || [],
        metadata: row.metadata || {},
        createdAt: row.created_at,
        startedAt: row.started_at || null,
        completedAt: row.completed_at || null,
        results: includeResults ? (row.job_results || []).map(mapResult) : []
    };
}

export function mapLead(row) {
    return {
        id: row.id,
        jobId: row.job_id,
        name: row.name,
        address: row.address,
        phone: row.phone,
        website: row.website,
        rating: row.rating,
        reviews: row.reviews,
        email: row.email || firstEmail(row.emails),
        emails: row.emails || [],
        placeId: row.place_id,
        source: row.source,
        sourceExternalId: row.source_external_id || row.place_id,
        category: row.category || null,
        city: row.city || null,
        region: row.region || null,
        country: row.country || null,
        mapsUrl: row.maps_url || null,
        tags: row.tags || [],
        analysis: row.analysis_summary || row.analysis || {},
        lastAnalyzedAt: row.last_analyzed_at || null,
        lastReportId: row.last_report_id || null,
        createdAt: row.created_at
    };
}

export async function createJob(userId, type, metadata = {}, overrides = {}) {
    const payload = {
        user_id: userId,
        type,
        status: "queued",
        metadata,
        total_urls: overrides.total ?? overrides.total_urls ?? 0,
        processed: overrides.processed ?? 0,
        ...overrides
    };

    const { data, error } = await supabaseAdmin
        .from("jobs")
        .insert(payload)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateJob(jobId, updates) {
    const { error } = await supabaseAdmin
        .from("jobs")
        .update(updates)
        .eq("id", jobId);

    if (error) throw error;
}

export async function completeJob(jobId, resultCount, extra = {}) {
    return updateJob(jobId, {
        status: "done",
        processed: resultCount,
        completed_at: new Date().toISOString(),
        ...extra
    });
}

export async function failJob(jobId, errorMessage) {
    return updateJob(jobId, {
        status: "error",
        errors: [errorMessage],
        completed_at: new Date().toISOString()
    });
}

export async function insertResult(jobId, result) {
    const insertData = {
        job_id: jobId,
        lead_id: result.leadId || null,
        row_index: result.rowIndex,
        url: result.url,
        name: result.name,
        screenshot_key: result.screenshotKey || null,
        screenshot_path: result.screenshotPath || null,
        thumbnail_key: result.thumbnailKey || null,
        thumbnail_path: result.thumbnailPath || null,
        report: result.report || null,
        error: result.error || null,
        analysis_version: result.analysisVersion || "v2",
        analysis_kind: result.analysisKind || "cro"
    };

    const { data, error } = await supabaseAdmin
        .from("job_results")
        .upsert(insertData, { onConflict: "job_id,row_index" })
        .select()
        .single();

    if (error) {
        console.error("insertResult error:", error.message, { jobId, url: result.url });
        throw error;
    }
    return data;
}

export async function logEvent(jobId, level, message, metadata = {}) {
    const { error } = await supabaseAdmin.rpc("log_job_event", {
        p_job_id: jobId,
        p_level: level,
        p_message: message,
        p_metadata: metadata,
    });

    if (error) {
        await supabaseAdmin.from("job_events").insert({
            job_id: jobId,
            level,
            message,
            metadata,
        });
    }
}

export async function getJobWithResults(jobId, userId) {
    const { data, error } = await supabaseAdmin
        .from("jobs")
        .select("*, job_results(*)")
        .eq("id", jobId)
        .eq("user_id", userId)
        .single();

    if (error) throw error;
    if (!data) return null;
    return mapJob(data, true);
}

export async function getUserJobs(userId, limit = 50, type = null) {
    let query = supabaseAdmin
        .from("jobs")
        .select("*, job_results(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (type) {
        query = query.eq("type", type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => mapJob(row, true));
}

export async function claimNextJob() {
    const { data, error } = await supabaseAdmin.rpc("claim_next_job");
    if (error) throw error;
    return data;
}

export async function saveOutreachScript({ resultId = null, leadId = null, campaignLeadId = null, scripts, status = "draft" }) {
    const { data, error } = await supabaseAdmin
        .from("outreach_scripts")
        .insert({
            result_id: resultId,
            lead_id: leadId,
            campaign_lead_id: campaignLeadId,
            email_subject: scripts.email?.subject,
            email_body: scripts.email?.body,
            sms_text: scripts.sms,
            phone_script: scripts.phone,
            status
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteJob(jobId, userId) {
    const { data: job, error: fetchError } = await supabaseAdmin
        .from("jobs")
        .select("user_id")
        .eq("id", jobId)
        .single();

    if (fetchError) throw fetchError;
    if (!job || job.user_id !== userId) {
        throw new Error("Job not found or access denied");
    }

    const { error } = await supabaseAdmin
        .from("jobs")
        .delete()
        .eq("id", jobId);

    if (error) throw error;
}

async function findExistingLead(userId, lead) {
    if (lead.placeId) {
        const { data } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("user_id", userId)
            .eq("place_id", lead.placeId)
            .maybeSingle();
        if (data?.id) return data.id;
    }

    if (lead.website) {
        const { data } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("user_id", userId)
            .eq("website", lead.website)
            .maybeSingle();
        if (data?.id) return data.id;
    }

    if (lead.phone) {
        const { data } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("user_id", userId)
            .eq("phone", lead.phone)
            .maybeSingle();
        if (data?.id) return data.id;
    }

    return null;
}

function buildLeadPayload(userId, lead, metadata = {}) {
    const emails = normalizeTextArray(lead.emails || lead.email);
    const primaryEmail = lead.email || firstEmail(emails);
    const keywordTag = metadata.keyword ? [metadata.keyword] : [];
    const source = lead.source || metadata.source || "manual";

    return {
        user_id: userId,
        job_id: metadata.jobId || null,
        name: lead.name,
        address: lead.address || null,
        phone: lead.phone || null,
        website: lead.website || null,
        rating: lead.rating ?? null,
        reviews: lead.reviews ?? null,
        place_id: lead.placeId || null,
        coordinates: lead.coordinates || null,
        source,
        source_external_id: lead.sourceExternalId || lead.placeId || null,
        email: primaryEmail,
        emails,
        category: lead.category || null,
        city: lead.city || null,
        region: lead.region || null,
        country: lead.country || null,
        maps_url: lead.mapsUrl || null,
        raw_source: lead.rawSource || lead.raw_source || {},
        tags: [...new Set([...(lead.tags || []), ...keywordTag])]
    };
}

export async function saveLeads(userId, leads, metadata = {}) {
    const savedLeads = [];

    for (const lead of leads) {
        const payload = buildLeadPayload(userId, lead, metadata);
        const existingId = await findExistingLead(userId, lead);

        let query = supabaseAdmin.from("leads");
        let result;

        if (existingId) {
            result = await query
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq("id", existingId)
                .select()
                .single();
        } else {
            result = await query.insert(payload).select().single();
        }

        if (result.error) {
            console.error("saveLeads error:", result.error.message, { lead: lead.name });
            continue;
        }

        if (result.data) {
            savedLeads.push(mapLead(result.data));
        }
    }

    return savedLeads;
}

export async function getUserLeads(userId, limit = 1000) {
    const { data, error } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data || []).map(mapLead);
}

export async function getLeadById(userId, leadId) {
    const { data, error } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .eq("user_id", userId)
        .single();

    if (error) throw error;
    return data ? mapLead(data) : null;
}

export async function getLeadByIds(userId, leadIds) {
    const { data, error } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("user_id", userId)
        .in("id", leadIds);

    if (error) throw error;
    return (data || []).map(mapLead);
}

export async function updateLeadAnalysis(leadId, userId, analysisSummary, lastReportId = null) {
    const updates = {
        analysis_summary: analysisSummary || {},
        analysis: analysisSummary || {},
        last_analyzed_at: new Date().toISOString()
    };

    if (lastReportId !== undefined) {
        updates.last_report_id = lastReportId;
    }

    const { data, error } = await supabaseAdmin
        .from("leads")
        .update(updates)
        .eq("id", leadId)
        .eq("user_id", userId)
        .select()
        .single();

    if (error) throw error;
    return mapLead(data);
}

export async function saveOutreachAtoms(leadId, jobResultId, atoms) {
    const payload = {
        lead_id: leadId,
        job_result_id: jobResultId || null,
        subject_lines: atoms.subject_lines || [],
        openers: atoms.openers || [],
        problem_bullets: atoms.problem_bullets || [],
        quick_win_bullets: atoms.quick_win_bullets || [],
        proof_points: atoms.proof_points || [],
        cta_options: atoms.cta_options || [],
        call_openers: atoms.call_openers || [],
        objection_handles: atoms.objection_handles || [],
        dm_one_liners: atoms.dm_one_liners || []
    };

    const { data, error } = await supabaseAdmin
        .from("outreach_atoms")
        .insert(payload)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function createUsageEvent(userId, eventType, units = 1, metadata = {}, refs = {}) {
    const { data, error } = await supabaseAdmin
        .from("usage_events")
        .insert({
            user_id: userId,
            job_id: refs.jobId || null,
            lead_id: refs.leadId || null,
            artifact_id: refs.artifactId || null,
            event_type: eventType,
            units,
            metadata
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}
