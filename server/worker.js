// Worker process - claims and processes jobs from Postgres queue

import { config } from "./config/env.js";
import { supabaseAdmin } from "./lib/supabase.js";
import * as db from "./services/db.js";
import * as storage from "./services/storage.js";

// Worker poll interval
const POLL_INTERVAL_MS = 5000;

// Track if currently processing
let isProcessing = false;

/**
 * Main worker loop
 */
async function workerLoop() {
    if (isProcessing) return;

    try {
        isProcessing = true;

        // Claim next job
        const job = await db.claimNextJob();

        if (!job) {
            // No jobs to process
            return;
        }

        console.log(`[Worker] Processing job ${job.id} (type: ${job.type})`);
        await db.logEvent(job.id, "info", "Worker claimed job");

        try {
            // Route to appropriate processor based on job type
            switch (job.type) {
                case "batch":
                    await processBatchJob(job);
                    break;
                case "single":
                    await processSingleJob(job);
                    break;
                case "leads":
                    await processLeadsJob(job);
                    break;
                default:
                    throw new Error(`Unknown job type: ${job.type}`);
            }

            // Mark complete
            const { count } = await supabaseAdmin
                .from("job_results")
                .select("id", { count: "exact" })
                .eq("job_id", job.id);

            await db.completeJob(job.id, count || 0);
            await db.logEvent(job.id, "info", `Job completed with ${count} results`);

            console.log(`[Worker] Job ${job.id} completed`);

        } catch (err) {
            console.error(`[Worker] Job ${job.id} failed:`, err);
            await db.failJob(job.id, err.message);
            await db.logEvent(job.id, "error", err.message, { stack: err.stack });
        }

    } catch (err) {
        console.error("[Worker] Loop error:", err);
    } finally {
        isProcessing = false;
    }
}

/**
 * Process batch analysis job
 */
async function processBatchJob(job) {
    const { urls, scrapeLimit } = job.metadata || {};
    if (!urls || !Array.isArray(urls)) {
        throw new Error("Batch job missing URLs");
    }

    // TODO: Implement batch processing logic
    // For now, log placeholder
    await db.logEvent(job.id, "info", `Processing ${urls.length} URLs`);

    // Placeholder - actual implementation would go here
    console.log(`[Worker] Batch job would process ${urls.length} URLs`);
}

/**
 * Process single URL analysis job
 */
async function processSingleJob(job) {
    const { url } = job.metadata || {};
    if (!url) {
        throw new Error("Single job missing URL");
    }

    await db.logEvent(job.id, "info", `Analyzing ${url}`);

    // Placeholder - actual implementation would use existing analyze logic
    console.log(`[Worker] Single job would analyze ${url}`);
}

/**
 * Process leads scraping job
 */
async function processLeadsJob(job) {
    const { websites } = job.metadata || {};
    if (!websites || !Array.isArray(websites)) {
        throw new Error("Leads job missing websites");
    }

    await db.logEvent(job.id, "info", `Processing ${websites.length} lead websites`);

    // Placeholder - actual implementation would use existing leads logic
    console.log(`[Worker] Leads job would process ${websites.length} websites`);
}

/**
 * Start worker
 */
export function startWorker() {
    console.log(`[Worker] Starting with ${POLL_INTERVAL_MS}ms poll interval`);
    setInterval(workerLoop, POLL_INTERVAL_MS);
    // Run once immediately
    workerLoop();
}

// If running directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
    startWorker();
}
