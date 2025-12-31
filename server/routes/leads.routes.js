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

const router = express.Router();

/**
 * POST /scrape-leads - Scrape leads from Google Places via Serper API
 */
router.post("/scrape-leads", requireAuth, express.json(), asyncHandler(async (req, res) => {
    const { keyword, location } = req.body;
    const userId = req.user.id;

    if (!keyword) {
        return res.status(400).json({ error: "Keyword is required." });
    }

    const limit = parseInt(req.body.limit) || 10;
    const query = location ? `${keyword} in ${location}` : keyword;
    const apiKey = process.env.SERPER_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Missing SERPER_API_KEY in environment." });
    }

    // Create a job to track this scrape batch
    const batchName = location ? `${keyword} in ${location}` : keyword;
    const job = await db.createJob(userId, "leads", {
        name: batchName,
        keyword,
        location
    });

    const allPlaces = [];
    try {
        while (allPlaces.length < limit) {
            const response = await fetch("https://google.serper.dev/places", {
                method: "POST",
                headers: {
                    "X-API-KEY": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ q: query }),
            });

            const data = await response.json();
            if (!data.places || data.places.length === 0) break;

            allPlaces.push(...data.places);
            break;
        }

        // Map to cleaner format and persist to DB
        const leads = allPlaces.slice(0, limit).map((p) => ({
            name: p.title,
            address: p.address,
            phone: p.phoneNumber,
            website: p.website,
            rating: p.rating,
            reviews: p.ratingCount,
            placeId: p.placeId || p.cid,
            coordinates: p.latitude && p.longitude ? { lat: p.latitude, lng: p.longitude } : null
        }));

        // Persist leads to database with job reference
        const savedLeads = await db.saveLeads(userId, leads, { keyword, location, jobId: job.id });

        // Mark job as complete
        await db.completeJob(job.id, savedLeads.length);

        return res.json({
            jobId: job.id,
            leads: savedLeads
        });
    } catch (error) {
        await db.failJob(job.id, error.message);
        throw error;
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Leads");

    worksheet.columns = [
        { header: "Name", key: "name", width: 30 },
        { header: "Address", key: "address", width: 40 },
        { header: "Phone", key: "phone", width: 20 },
        { header: "Website", key: "website", width: 40 },
        { header: "Rating", key: "rating", width: 10 },
        { header: "Reviews", key: "reviews", width: 10 }
    ];

    leads.forEach((lead) => {
        worksheet.addRow({
            name: lead.name || "",
            address: lead.address || "",
            phone: lead.phone || "",
            website: lead.website || "",
            rating: lead.rating || "",
            reviews: lead.reviews || ""
        });
    });

    worksheet.getRow(1).font = { bold: true };

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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Leads");

    worksheet.columns = [
        { header: "Name", key: "name", width: 30 },
        { header: "Address", key: "address", width: 40 },
        { header: "Phone", key: "phone", width: 20 },
        { header: "Website", key: "website", width: 40 },
        { header: "Rating", key: "rating", width: 10 },
        { header: "Reviews", key: "reviews", width: 10 }
    ];

    leads.forEach((lead) => {
        worksheet.addRow({
            name: lead.name || "",
            address: lead.address || "",
            phone: lead.phone || "",
            website: lead.website || "",
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

export default router;
