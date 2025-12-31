// Auth middleware - validates JWT and attaches user-scoped Supabase client

import { supabaseAdmin, supabaseAsUser } from "../lib/supabase.js";

/**
 * Requires valid Supabase JWT in Authorization header
 * Attaches req.user, req.accessToken, req.supabase (RLS-enforced client)
 */
export async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");

    try {
        const { data, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !data?.user) {
            console.warn("Auth failed:", error?.message || "No user found");
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        // Attach to request for downstream use
        req.user = data.user;
        req.accessToken = token;
        req.supabase = supabaseAsUser(token); // RLS enforced

        next();
    } catch (err) {
        console.error("Auth middleware error:", err);
        return res.status(500).json({ error: "Authentication failed" });
    }
}

/**
 * Optional auth - attaches user if token present, but doesn't block
 * Useful for routes that work differently for authed vs anon users
 */
export async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        try {
            const { data } = await supabaseAdmin.auth.getUser(token);
            if (data?.user) {
                req.user = data.user;
                req.accessToken = token;
                req.supabase = supabaseAsUser(token);
            }
        } catch {
            // Ignore - proceed as unauthenticated
        }
    }

    next();
}
