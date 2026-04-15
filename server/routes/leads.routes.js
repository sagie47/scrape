/**
 * Leads Routes - Lead scraping and export endpoints
 * 
 * Handles Google Places scraping, lead retrieval, and export to Excel/CSV.
 */

import express from "express";
import ExcelJS from "exceljs";

import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";
import * as db from "../services/db.js";
import { importMapsLeads } from "../services/maps-import-pipeline.js";

const router = express.Router();

function createLeadsWorkbook(leads) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Leads");

    worksheet.columns = [
        { header: "Name", key: "name", width: 30 },
        { header: "Email", key: "email", width: 35 },
        { header: "Address", key: "address", width: 40 },
        { header: "Phone", key: "phone", width: 20 },
        { header: "Website", key: "website", width: 40 },
        { header: "Rating", key: "rating", width: 10 },
        { header: "Reviews", key: "reviews", width: 10 },
        { header: "Source", key: "source", width: 24 }
    ];

    leads.forEach((lead) => {
        worksheet.addRow({
            name: lead.name || "",
            email: lead.email || "",
            address: lead.address || "",
            phone: lead.phone || "",
            website: lead.website || "",
            rating: lead.rating || "",
            reviews: lead.reviews || "",
            source: lead.source || ""
        });
    });

    worksheet.getRow(1).font = { bold: true };

    return workbook;
}

/**
 * POST /scrape-leads - Scrape leads from Google Maps via adapter pipeline
 */
router.post("/scrape-leads", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { keyword, location } = req.body;
    const userId = req.user.id;

    if (!keyword) {
        return res.status(400).json({ error: "Keyword is required." });
    }

    const limit = parseInt(req.body.limit) || 10;

    // Create a job to track this scrape batch
    const batchName = location ? `${keyword} in ${location}` : keyword;
    const job = await db.createJob(userId, "leads", {
        name: batchName,
        keyword,
        location,
        source: 'google-maps-scraper'
    });

    try {
        const result = await importMapsLeads({
            userId,
            keyword,
            location,
            limit,
            jobId: job.id
        });

        return res.json(result);
    } catch (error) {
        await db.failJob(job.id, error.message);
        await db.logEvent(job.id, 'error', 'Maps scraper ingestion failed.', {
            message: error.message,
            code: error.code || 'maps_scraper_route_error'
        });

        const status = error.statusCode || 500;
        return res.status(status).json({
            error: error.message,
            jobId: job.id
        });
    }
}));

/**
 * GET /leads - Get user's saved leads
 */
router.get("/leads", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const leads = await db.getUserLeads(userId);
    res.json(leads);
}));

/**
 * POST /export-leads - Export provided leads to XLSX
 */
router.post("/export-leads", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { leads } = req.body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ error: "Leads array is required." });
    }

    const workbook = createLeadsWorkbook(leads);

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
        "Content-Disposition",
        `attachment; filename=leads_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
}));

/**
 * GET /export-my-leads - Export user's saved leads from database
 */
router.get("/export-my-leads", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const format = req.query.format || "xlsx";

    const leads = await db.getUserLeads(userId, 1000);

    if (leads.length === 0) {
        return res.status(400).json({ error: "No leads to export" });
    }

    const workbook = createLeadsWorkbook(leads);

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

export default router;
