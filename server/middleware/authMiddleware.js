import { supabaseAdmin } from '../lib/supabaseServer.js';

/**
 * Express middleware to verify Supabase JWT and attach user to request
 * Usage: app.use('/protected', authMiddleware, protectedRoutes)
 */
export const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Attach user and token to request for downstream use
        req.user = user;
        req.accessToken = token;
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

/**
 * Optional auth middleware - continues even without valid auth
 * Useful for routes that work both with and without authentication
 */
export const optionalAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        req.user = error ? null : user;
        req.accessToken = error ? null : token;
    } catch {
        req.user = null;
    }

    next();
};
