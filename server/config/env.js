// Environment configuration with validation
// Throws at boot if required vars are missing

import "dotenv/config";

const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY"
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
    console.error("Add them to your .env file and restart the server.");
    process.exit(1);
}

export const config = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    serperKey: process.env.SERPER_API_KEY,
    captureConcurrency: parseInt(process.env.CAPTURE_CONCURRENCY || process.env.CONCURRENCY_LIMIT || "4", 10),
    port: parseInt(process.env.PORT) || 3000,
    isDev: process.env.NODE_ENV !== "production"
};

console.log("✅ Environment validated:", {
    supabase: config.supabaseUrl ? "configured" : "missing",
    gemini: config.geminiKey ? "configured" : "missing",
    port: config.port
});
