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
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    console.error("Add them to your .env file and restart the server.");
    process.exit(1);
}

export const config = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    gosomBaseUrl: process.env.GOSOM_BASE_URL || "http://localhost:8080",
    gosomApiKey: process.env.GOSOM_API_KEY || "",
    gosomTimeoutMs: parseInt(process.env.GOSOM_TIMEOUT_MS || "45000", 10),
    gosomEmailExtraction: process.env.GOSOM_EMAIL_EXTRACTION === "1" || process.env.GOSOM_EMAIL_EXTRACTION === "true",
    gosomDefaultLang: process.env.GOSOM_DEFAULT_LANG || "en",
    gosomProxyUrls: process.env.GOSOM_PROXY_URLS
        ? process.env.GOSOM_PROXY_URLS.split(",").map((value) => value.trim()).filter(Boolean)
        : [],
    captureConcurrency: parseInt(process.env.CAPTURE_CONCURRENCY || process.env.CONCURRENCY_LIMIT || "4", 10),
    port: parseInt(process.env.PORT || "3000", 10),
    appUrl: process.env.APP_URL || "http://localhost:5173",
    isDev: process.env.NODE_ENV !== "production"
};

console.log("Environment validated:", {
    supabase: config.supabaseUrl ? "configured" : "missing",
    gemini: config.geminiKey ? "configured" : "missing",
    gosom: config.gosomBaseUrl,
    port: config.port
});
