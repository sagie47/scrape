import { supabaseAdmin } from "../lib/supabase.js";

const DEFAULT_BRANDING = {
    brandName: "Scrape Intelligence",
    senderName: "",
    senderTitle: "Founder",
    logoUrl: "",
    primaryColor: "#0ea5e9",
    supportEmail: ""
};

export async function getBrandingSettings(userId) {
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .single();

    if (error) throw error;
    return {
        ...DEFAULT_BRANDING,
        ...(data?.preferences?.branding || {})
    };
}

export async function updateBrandingSettings(userId, branding) {
    const { data: current, error: fetchError } = await supabaseAdmin
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .single();

    if (fetchError) throw fetchError;

    const preferences = {
        ...(current?.preferences || {}),
        branding: {
            ...DEFAULT_BRANDING,
            ...(current?.preferences?.branding || {}),
            ...(branding || {})
        }
    };

    const { data, error } = await supabaseAdmin
        .from("profiles")
        .update({ preferences })
        .eq("id", userId)
        .select("preferences")
        .single();

    if (error) throw error;
    return {
        ...DEFAULT_BRANDING,
        ...(data?.preferences?.branding || {})
    };
}
