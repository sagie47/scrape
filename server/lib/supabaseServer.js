import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn(
        'Missing Supabase environment variables. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env'
    );
}

// Server-side client with service role key (bypasses RLS)
export const supabaseAdmin = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseServiceKey || 'placeholder-key',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// Create client with user's JWT for RLS-respecting operations
export const createUserClient = (accessToken) => {
    return createClient(
        supabaseUrl || 'https://placeholder.supabase.co',
        process.env.SUPABASE_ANON_KEY || 'placeholder-key',
        {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        }
    );
};
