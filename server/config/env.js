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
const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
    console.error("Add them to your .env file and restart the server.");
    if (!isTestEnv) {
        process.exit(1);
    }
}

export const config = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    serperKey: process.env.SERPER_API_KEY,
    captureConcurrency: parseInt(process.env.CAPTURE_CONCURRENCY || process.env.CONCURRENCY_LIMIT || "4", 10),
    mapsScraper: {
        provider: process.env.MAPS_SCRAPER_PROVIDER || 'local-docker',
        dockerImage: process.env.MAPS_SCRAPER_DOCKER_IMAGE || 'gosom/google-maps-scraper:latest',
        binaryPath: process.env.MAPS_SCRAPER_BINARY_PATH || 'google-maps-scraper',
        baseUrl: process.env.MAPS_SCRAPER_BASE_URL || '',
        apiKey: process.env.MAPS_SCRAPER_API_KEY || '',
        concurrency: parseInt(process.env.MAPS_SCRAPER_CONCURRENCY || '1', 10),
        depth: parseInt(process.env.MAPS_SCRAPER_DEPTH || '1', 10),
        language: process.env.MAPS_SCRAPER_LANG || 'en',
        exitOnInactivity: process.env.MAPS_SCRAPER_EXIT_ON_INACTIVITY || '3m',
        timeoutMs: parseInt(process.env.MAPS_SCRAPER_TIMEOUT_MS || '180000', 10),
        remotePollMs: parseInt(process.env.MAPS_SCRAPER_REMOTE_POLL_MS || '2000', 10),
        includeEmails: process.env.MAPS_SCRAPER_INCLUDE_EMAILS === 'true',
        fastMode: process.env.MAPS_SCRAPER_FAST_MODE === 'true'
    },
    port: parseInt(process.env.PORT) || 3000,
    isDev: process.env.NODE_ENV !== "production"
};

console.log("✅ Environment validated:", {
    supabase: config.supabaseUrl ? "configured" : "missing",
    gemini: config.geminiKey ? "configured" : "missing",
    mapsScraperProvider: config.mapsScraper.provider,
    port: config.port
});
