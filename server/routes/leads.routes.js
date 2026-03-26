/**
 * Leads Routes - lead ingestion, retrieval, and export endpoints
 */

import express from "express";
import ExcelJS from "exceljs";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";
import * as db from "../services/db.js";
import * as exportsService from "../services/exports.js";
import { createMapsScrapeJob, normalizeGosomResults, waitForMapsScrapeJob } from "../services/gosom.js";

const router = express.Router();

router.post("/scrape-leads", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { keyword, location, limit = 10, email, depth = 1, lang, radius, zoom, lat, lon, fastMode = false } = req.body || {};
    const userId = req.user.id;

    if (!keyword) {
        return res.status(400).json({ error: "Keyword is required." });
    }

    const batchName = location ? `${keyword} in ${location}` : keyword;
    const job = await db.createJob(userId, "maps_import", {
        name: batchName,
        keyword,
        location,
        source: "gosom"
    }, { total_urls: limit });

    try {
        const created = await createMapsScrapeJob({ keyword, location, limit, email, depth, lang, radius, zoom, lat, lon, fastMode });
        const externalJobId = created.id || created.job_id;
        await db.updateJob(job.id, {
            status: "running",
            started_at: new Date().toISOString(),
            metadata: {
                name: batchName,
                keyword,
                location,
                source: "gosom",
                externalJobId
            }
        });

        const completed = await waitForMapsScrapeJob(externalJobId);
        const leads = normalizeGosomResults(completed, keyword).slice(0, limit);
        const savedLeads = await db.saveLeads(userId, leads, { keyword, location, jobId: job.id, source: "gosom" });
        await db.completeJob(job.id, savedLeads.length, { total_urls: savedLeads.length });

        return res.json({
            jobId: job.id,
            leads: savedLeads
        });
    } catch (error) {
        await db.failJob(job.id, error.message);
        throw error;
    }
}));

router.get("/leads", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const leads = await db.getUserLeads(userId);
    res.json(leads);
}));

router.post("/export-leads", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { leads, format = "xlsx" } = req.body || {};

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ error: "Leads array is required." });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Leads");

    worksheet.columns = [
        { header: "Name", key: "name", width: 30 },
        { header: "Email", key: "email", width: 34 },
        { header: "Address", key: "address", width: 40 },
        { header: "Phone", key: "phone", width: 20 },
        { header: "Website", key: "website", width: 40 },
        { header: "Category", key: "category", width: 20 },
        { header: "City", key: "city", width: 20 },
        { header: "Rating", key: "rating", width: 10 },
        { header: "Reviews", key: "reviews", width: 10 }
    ];

    leads.forEach((lead) => {
        worksheet.addRow({
            name: lead.name || "",
            email: lead.email || (Array.isArray(lead.emails) ? lead.emails[0] : "") || "",
            address: lead.address || "",
            phone: lead.phone || "",
            website: lead.website || "",
            category: lead.category || "",
            city: lead.city || "",
            rating: lead.rating || "",
            reviews: lead.reviews || ""
        });
    });

    worksheet.getRow(1).font = { bold: true };

    if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=leads_${Date.now()}.csv`);
        await workbook.csv.write(res);
    } else {
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=leads_${Date.now()}.xlsx`);
        await workbook.xlsx.write(res);
    }
    res.end();
}));

router.get("/export-my-leads", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const format = req.query.format || "xlsx";
    const buffer = await exportsService.exportUserLeads(userId, format);

    if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=leads_${Date.now()}.csv`);
    } else {
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=leads_${Date.now()}.xlsx`);
    }

    res.send(Buffer.from(buffer));
}));

export default router;
