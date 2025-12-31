/**
 * Lead Scraper & CRO Audit Tool - Server Entry Point
 * 
 * Express server providing:
 * - Website screenshot capture & AI analysis
 * - Lead scraping from Google Places
 * - Outreach script generation
 * 
 * Routes, services, and job processing are modularized in:
 * - /routes - API endpoint handlers
 * - /services - Business logic (db, storage, gemini, job-processor)
 * - /middleware - Auth, error handling
 */

// Environment validation (fails fast if missing vars)
import { config } from "./config/env.js";

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";

// Route registration
import { registerRoutes } from "./routes/index.js";

// Middleware
import { errorHandler } from "./middleware/error-handler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = config.port;
const OUTPUTS_DIR = path.join(__dirname, "..", "outputs");
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

// Initialize Express app
const app = express();
app.use(cors());

// Static file serving
app.use(express.static(path.join(__dirname, "public")));
app.use("/outputs", express.static(OUTPUTS_DIR));

// Ensure required directories exist
await fs.mkdir(OUTPUTS_DIR, { recursive: true });
await fs.mkdir(UPLOADS_DIR, { recursive: true });

// Register all API routes
registerRoutes(app);

// Global error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log("Server starting...");
  console.log("Supabase:", config.supabaseUrl ? "Connected" : "Not configured");
  console.log(`Server running on http://localhost:${PORT}`);
});
