// Database service - wraps Supabase job/result operations

import { supabaseAdmin } from "../lib/supabase.js";

/**
 * Create a new job
 */
export async function createJob(userId, type, metadata = {}) {
    const { data, error } = await supabaseAdmin
        .from("jobs")
        .insert({
            user_id: userId,
            type,
            status: "queued",
            metadata,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update job status
 */
export async function updateJob(jobId, updates) {
    const { error } = await supabaseAdmin
        .from("jobs")
        .update(updates)
        .eq("id", jobId);

    if (error) throw error;
}

export async function mergeJobMetadata(jobId, patch = {}) {
    const { data, error } = await supabaseAdmin
        .from("jobs")
        .select("metadata")
        .eq("id", jobId)
        .single();

    if (error) throw error;

    const metadata = {
        ...(data?.metadata || {}),
        ...patch
    };

    await updateJob(jobId, { metadata });
    return metadata;
}

/**
 * Mark job as complete
 */
export async function completeJob(jobId, resultCount) {
    return updateJob(jobId, {
        status: "done",
        processed: resultCount,
        completed_at: new Date().toISOString(),
    });
}

/**
 * Mark job as failed
 */
export async function failJob(jobId, errorMessage) {
    return updateJob(jobId, {
        status: "error",
        errors: [errorMessage],
    });
}

function mergeTags(existingTags = [], incomingTags = []) {
    return Array.from(new Set([...(existingTags || []), ...(incomingTags || [])].filter(Boolean)));
}

function toLeadResponse(data) {
    return {
        id: data.id,
        jobId: data.job_id,
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        rating: data.rating,
        reviews: data.reviews,
        placeId: data.place_id,
        dedupeKey: data.dedupe_key,
        cid: data.source_metadata?.cid || null,
        completeAddress: data.source_metadata?.completeAddress || null,
        mapsUrl: data.source_metadata?.mapsUrl || null,
        tags: data.tags || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        source: data.source,
        sourceMetadata: data.source_metadata || {},
        lastScrapedAt: data.last_scraped_at || null
    };
}

function buildLeadPayload(userId, lead, metadata, existingLead = null) {
    const keywordTags = metadata.keyword ? [metadata.keyword] : [];
    const dedupeKey = lead.dedupeKey || lead.dedupe_key || existingLead?.dedupe_key || null;

    return {
        user_id: userId,
        job_id: metadata.jobId || existingLead?.job_id || null,
        name: lead.name || existingLead?.name || 'Unknown',
        address: lead.address || existingLead?.address || null,
        phone: lead.phone || existingLead?.phone || null,
        email: lead.email || existingLead?.email || null,
        website: lead.website || existingLead?.website || null,
        rating: lead.rating ?? existingLead?.rating ?? null,
        reviews: lead.reviews ?? existingLead?.reviews ?? null,
        place_id: lead.placeId || existingLead?.place_id || null,
        dedupe_key: dedupeKey,
        coordinates: lead.coordinates || existingLead?.coordinates || null,
        source: metadata.source || lead.source || existingLead?.source || 'serper',
        source_metadata: {
            ...(existingLead?.source_metadata || {}),
            ...(lead.sourceMetadata || {}),
            query: metadata.query || lead.sourceMetadata?.query || existingLead?.source_metadata?.query || null,
            provider: metadata.provider || existingLead?.source_metadata?.provider || null,
            providerJobId: metadata.providerJobId || existingLead?.source_metadata?.providerJobId || null,
            scraperVersion: metadata.scraperVersion || existingLead?.source_metadata?.scraperVersion || null,
            cid: lead.cid || existingLead?.source_metadata?.cid || null,
            completeAddress: lead.completeAddress || existingLead?.source_metadata?.completeAddress || null,
            mapsUrl: lead.mapsUrl || existingLead?.source_metadata?.mapsUrl || null,
            dedupeKey
        },
        tags: mergeTags(existingLead?.tags || [], keywordTags),
        last_scraped_at: new Date().toISOString()
    };
}

/**
 * Insert a job result
 */
export async function insertResult(jobId, result) {
    // Build insert object
    const insertData = {
        job_id: jobId,
        row_index: result.rowIndex,
        url: result.url,
        name: result.name,
        screenshot_key: result.screenshotKey,
        screenshot_path: result.screenshotPath,
        report: result.report,
        error: result.error,
    };

    const { data, error } = await supabaseAdmin
        .from("job_results")
        .insert(insertData)
        .select()
        .single();

    if (error) {
        console.error("insertResult error:", error.message, { jobId, url: result.url });
        throw error;
    }
    return data;
}

/**
 * Log a job event
 */
export async function logEvent(jobId, level, message, metadata = {}) {
    const { error } = await supabaseAdmin.rpc("log_job_event", {
        p_job_id: jobId,
        p_level: level,
        p_message: message,
        p_metadata: metadata,
    });

    if (error) {
        // Fallback to direct insert if RPC fails
        await supabaseAdmin.from("job_events").insert({
            job_id: jobId,
            level,
            message,
            metadata,
        });
    }
}

/**
 * Get job with results (with ownership check)
 */
export async function getJobWithResults(jobId, userId) {
    const { data, error } = await supabaseAdmin
        .from("jobs")
        .select("*, job_results(*)")
        .eq("id", jobId)
        .eq("user_id", userId)
        .single();

    if (error) throw error;
    if (!data) return null;

    // Transform to frontend-expected format
    return {
        id: data.id,
        status: data.status,
        total: data.total_urls || 0,
        processed: data.processed || 0,
        errors: data.errors || [],
        name: data.metadata?.name || data.type,
        results: (data.job_results || []).map(r => ({
            row: r.row_index,
            name: r.name,
            url: r.url,
            screenshotKey: r.screenshot_key, // For signed URL generation
            screenshot: r.screenshot_path || (r.screenshot_key ? `/screenshot/${r.screenshot_key}?raw=1` : null),
            thumbnailKey: r.thumbnail_key,
            thumbnail: r.thumbnail_path || (r.thumbnail_key ? `/screenshot/${r.thumbnail_key}?raw=1` : null),
            report: r.report,
            error: r.error
        }))
    };
}

/**
 * Get user's jobs for history view
 */
export async function getUserJobs(userId, limit = 50) {
    const { data, error } = await supabaseAdmin
        .from("jobs")
        .select("*, job_results(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;

    // Transform to frontend-expected format
    return data.map(job => ({
        id: job.id,
        status: job.status,
        type: job.metadata?.name || job.type,
        createdAt: job.created_at,
        total: job.total_urls || 0,
        processed: job.processed || 0,
        results: job.status === 'done' ? (job.job_results || []).map(r => ({
            row: r.row_index,
            name: r.name,
            url: r.url,
            screenshotKey: r.screenshot_key, // For signed URL generation
            screenshot: r.screenshot_path || (r.screenshot_key ? `/screenshot/${r.screenshot_key}?raw=1` : null),
            thumbnailKey: r.thumbnail_key,
            thumbnail: r.thumbnail_path || (r.thumbnail_key ? `/screenshot/${r.thumbnail_key}?raw=1` : null),
            report: r.report,
            error: r.error
        })) : []
    }));
}

/**
 * Claim next queued job (for worker)
 */
export async function claimNextJob() {
    const { data, error } = await supabaseAdmin.rpc("claim_next_job");
    if (error) throw error;
    return data;
}

/**
 * Save outreach script
 */
export async function saveOutreachScript(resultId, leadId, scripts) {
    const { data, error } = await supabaseAdmin
        .from("outreach_scripts")
        .insert({
            result_id: resultId,
            lead_id: leadId,
            email_subject: scripts.email?.subject,
            email_body: scripts.email?.body,
            sms_text: scripts.sms,
            phone_script: scripts.phone,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a job (with ownership check)
 */
export async function deleteJob(jobId, userId) {
    // First verify ownership
    const { data: job, error: fetchError } = await supabaseAdmin
        .from("jobs")
        .select("user_id")
        .eq("id", jobId)
        .single();

    if (fetchError) throw fetchError;
    if (!job || job.user_id !== userId) {
        throw new Error("Job not found or access denied");
    }

    // Delete the job (cascades to results due to FK)
    const { error } = await supabaseAdmin
        .from("jobs")
        .delete()
        .eq("id", jobId);

    if (error) throw error;
}

/**
 * Save leads to database
 */
export async function saveLeads(userId, leads, metadata = {}) {
    const savedLeads = [];
    const jobId = metadata.jobId || null;

    for (const lead of leads) {
        let existingLead = null;

        if (lead.dedupeKey) {
            const { data: match } = await supabaseAdmin
                .from("leads")
                .select("*")
                .eq("user_id", userId)
                .eq("dedupe_key", lead.dedupeKey)
                .maybeSingle();

            existingLead = match || null;
        }

        if (!existingLead && lead.placeId) {
            const { data: match } = await supabaseAdmin
                .from("leads")
                .select("*")
                .eq("user_id", userId)
                .eq("place_id", lead.placeId)
                .maybeSingle();

            existingLead = match || null;
        }

        const payload = buildLeadPayload(userId, lead, { ...metadata, jobId }, existingLead);
        let data = null;
        let error = null;

        if (existingLead) {
            const updateResult = await supabaseAdmin
                .from("leads")
                .update(payload)
                .eq("id", existingLead.id)
                .select()
                .single();

            data = updateResult.data;
            error = updateResult.error;
        } else {
            const insertResult = await supabaseAdmin
                .from("leads")
                .insert(payload)
                .select()
                .single();

            data = insertResult.data;
            error = insertResult.error;
        }

        if (error) {
            console.error("saveLeads insert error:", error.message, { lead: lead.name });
            continue;
        }
        if (data) {
            savedLeads.push(toLeadResponse(data));
        }
    }

    return savedLeads;
}

/**
 * Get user's leads
 */
export async function getUserLeads(userId, limit = 100) {
    const { data, error } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;

    return data.map(lead => ({
        ...toLeadResponse(lead)
    }));
}
