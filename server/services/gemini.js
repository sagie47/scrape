/**
 * Gemini AI Service - Centralized AI operations
 *
 * Handles screenshot analysis and outreach generation using Google's Gemini API.
 */

import fs from "fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config/env.js";

const MODEL_NAME = config.geminiModel;

function getModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: MODEL_NAME });
}

function parseJsonResponse(text) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : text;
    return JSON.parse(jsonText);
}

function normalizeConfidence(value) {
    if (typeof value === "number") {
        return Math.max(0, Math.min(100, Math.round(value)));
    }

    const lower = String(value || "").toLowerCase();
    if (lower === "high") return 85;
    if (lower === "medium") return 65;
    if (lower === "low") return 40;
    return 60;
}

export async function analyzeScreenshot(imagePath, url, context = {}) {
    const model = getModel();
    const imageData = await fs.readFile(imagePath, { encoding: "base64" });

    const prompt = [
        {
            text: [
                "You are a senior conversion-rate optimizer and local-business growth operator.",
                "Analyze this homepage screenshot and return a structured CRO intelligence object.",
                "Focus on message clarity, trust, CTA strength, friction, visual hierarchy, offer clarity, and obvious technical credibility issues.",
                "Use the supplied context when available.",
                `Context URL: ${url}`,
                `Context notes: ${JSON.stringify(context)}`,
                "Return JSON only with these fields:",
                "summary (string), issues (array of strings), quick_wins (array of strings), trust_signals (array of strings), conversion_gaps (array of strings), offer_angles (array of strings), confidence (0-100 integer)."
            ].join(" ")
        },
        {
            inlineData: {
                mimeType: "image/png",
                data: imageData
            }
        }
    ];

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
        const parsed = parseJsonResponse(text);
        return {
            summary: parsed.summary || "",
            issues: parsed.issues || [],
            quick_wins: parsed.quick_wins || parsed.quickWins || [],
            trust_signals: parsed.trust_signals || parsed.trustSignals || [],
            conversion_gaps: parsed.conversion_gaps || parsed.conversionGaps || [],
            offer_angles: parsed.offer_angles || parsed.offerAngles || [],
            confidence: normalizeConfidence(parsed.confidence)
        };
    } catch (err) {
        console.error("Failed to parse Gemini JSON:", err, "Raw text:", text);
        return {
            summary: "AI analysis could not be parsed cleanly.",
            issues: [],
            quick_wins: [],
            trust_signals: [],
            conversion_gaps: [],
            offer_angles: [],
            confidence: 50,
            raw: text
        };
    }
}

export async function generateOutreachAtoms({ lead, report, brand = {} }) {
    const model = getModel();

    const prompt = `
You create reusable outreach atoms for an agency-grade local business audit pipeline.
Business: ${lead?.name || "Unknown business"}
Website: ${lead?.website || "Unknown website"}
Category: ${lead?.category || "Unknown category"}
Location: ${[lead?.city, lead?.region, lead?.country].filter(Boolean).join(", ") || "Unknown"}
Brand: ${JSON.stringify(brand)}
Audit report: ${JSON.stringify(report)}

Return JSON only with these keys:
{
  "subject_lines": ["..."],
  "openers": ["..."],
  "problem_bullets": ["..."],
  "quick_win_bullets": ["..."],
  "proof_points": ["..."],
  "cta_options": ["..."],
  "call_openers": ["..."],
  "objection_handles": ["..."],
  "dm_one_liners": ["..."]
}
`.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseJsonResponse(text);

    return {
        subject_lines: parsed.subject_lines || [],
        openers: parsed.openers || [],
        problem_bullets: parsed.problem_bullets || [],
        quick_win_bullets: parsed.quick_win_bullets || [],
        proof_points: parsed.proof_points || [],
        cta_options: parsed.cta_options || [],
        call_openers: parsed.call_openers || [],
        objection_handles: parsed.objection_handles || [],
        dm_one_liners: parsed.dm_one_liners || []
    };
}

export async function generateOutreach({ lead, report, brand = {}, reportLinks = {} }) {
    const model = getModel();

    const prompt = `
You are an expert cold outreach copywriter writing for an agency that performs conversion audits for local businesses.
Lead: ${JSON.stringify(lead)}
Brand: ${JSON.stringify(brand)}
Report links: ${JSON.stringify(reportLinks)}
Audit findings: ${JSON.stringify(report)}

Return JSON only:
{
  "email": { "subject": "...", "body": "..." },
  "sms": "...",
  "phone": "..."
}

Rules:
- Be specific and low-pressure.
- Reference 1-2 concrete findings.
- Mention the report link naturally if provided.
- Keep the email under 180 words.
- Do not use hype language.
`.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJsonResponse(text);
}
