// Dual Supabase clients: Admin (worker) + User-scoped (RLS)

import { createClient } from "@supabase/supabase-js";
import { config } from "../config/env.js";

const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
const supabaseUrl = config.supabaseUrl || (isTestEnv ? "https://placeholder.supabase.co" : config.supabaseUrl);
const supabaseServiceKey = config.supabaseServiceKey || (isTestEnv ? "placeholder-service-key" : config.supabaseServiceKey);
const supabaseAnonKey = config.supabaseAnonKey || (isTestEnv ? "placeholder-anon-key" : config.supabaseAnonKey);

/**
 * Admin client - bypasses RLS
 * USE ONLY for background workers, internal operations
 * NEVER expose to user-facing request handlers
 */
export const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
        auth: { persistSession: false }
    }
);

/**
 * Creates a user-scoped client that enforces RLS
 * Use this in request handlers after auth middleware validates the token
 * 
 * @param {string} accessToken - JWT from Authorization header
 * @returns Supabase client with user context
 */
export function supabaseAsUser(accessToken) {
    return createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            global: {
                headers: { Authorization: `Bearer ${accessToken}` }
            },
            auth: { persistSession: false }
        }
    );
}

/**
 * Helper to get signed URL for storage objects
 * @param {string} bucket - Storage bucket name
 * @param {string} path - Object path
 * @param {number} expiresIn - Seconds until expiry (default 1 hour)
 */
export async function getSignedUrl(bucket, path, expiresIn = 3600) {
    const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data.signedUrl;
}
