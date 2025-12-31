/**
 * Routes Index - Aggregates all route modules
 * 
 * Mount this on the Express app to register all routes.
 */

import jobsRoutes from "./jobs.routes.js";
import leadsRoutes from "./leads.routes.js";
import screenshotsRoutes from "./screenshots.routes.js";
import outreachRoutes from "./outreach.routes.js";
import campaignsRoutes from "./campaigns.routes.js";
import sequencesRoutes from "./sequences.routes.js";
import { router as artifactsRoutes, shareRouter } from "./artifacts.routes.js";

/**
 * Register all routes on the Express app
 * @param {import('express').Application} app - Express application
 */
export function registerRoutes(app) {
    // Jobs endpoints
    app.use(jobsRoutes);

    // Leads endpoints
    app.use(leadsRoutes);

    // Screenshots endpoints
    app.use(screenshotsRoutes);

    // Outreach endpoints
    app.use(outreachRoutes);

    // Campaigns endpoints (MVP1)
    app.use(campaignsRoutes);

    // Sequences endpoints (MVP1)
    app.use(sequencesRoutes);

    // Artifacts endpoints (MVP1) - mounted at /artifacts prefix
    app.use('/artifacts', artifactsRoutes);

    // Public share route (mounted at root for clean URLs like /share/token-abc)
    app.use('/', shareRouter);
}

export default { registerRoutes };
