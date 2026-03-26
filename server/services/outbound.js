import { supabaseAdmin } from "../lib/supabase.js";
import { buildCampaignExportRows } from "./exports.js";
import * as db from "./db.js";

export async function listDestinations(userId) {
    const { data, error } = await supabaseAdmin
        .from("outbound_destinations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function saveDestination(userId, destination) {
    const payload = {
        user_id: userId,
        name: destination.name,
        kind: destination.kind || "webhook",
        target_url: destination.targetUrl || destination.target_url || null,
        headers: destination.headers || {},
        metadata: destination.metadata || {},
        is_active: destination.isActive ?? destination.is_active ?? true
    };

    let query = supabaseAdmin.from("outbound_destinations");
    let result;

    if (destination.id) {
        result = await query.update(payload).eq("id", destination.id).eq("user_id", userId).select().single();
    } else {
        result = await query.insert(payload).select().single();
    }

    if (result.error) throw result.error;
    return result.data;
}

export async function buildOutboundPayload({ campaignId, userId, appUrl }) {
    const rows = await buildCampaignExportRows(campaignId, userId, appUrl);
    return {
        campaignId,
        exportedAt: new Date().toISOString(),
        count: rows.length,
        rows
    };
}

export async function deliverOutboundPayload({ campaignId, destinationId, userId, appUrl }) {
    const payload = await buildOutboundPayload({ campaignId, userId, appUrl });

    if (!destinationId) {
        return { mode: "preview", payload };
    }

    const { data: destination, error } = await supabaseAdmin
        .from("outbound_destinations")
        .select("*")
        .eq("id", destinationId)
        .eq("user_id", userId)
        .single();

    if (error || !destination) {
        throw new Error("Destination not found");
    }

    if (destination.kind !== "webhook") {
        return { mode: "preview", payload, destination };
    }

    const response = await fetch(destination.target_url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(destination.headers || {})
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Webhook delivery failed: ${response.status} ${text}`);
    }

    await db.createUsageEvent(userId, "outbound_export", 1, { destinationId, campaignId }).catch(() => {});

    return {
        mode: "webhook",
        destination,
        payload,
        delivered: true
    };
}
