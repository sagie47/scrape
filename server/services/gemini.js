/**
 * Gemini AI Service - Centralized AI operations
 * 
 * Handles screenshot analysis and outreach generation using Google's Gemini API.
 */

import fs from "fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config/env.js";

const MODEL_NAME = config.geminiModel;

/**
 * Analyze a screenshot for CRO issues using Gemini Vision
 * @param {string} imagePath - Path to the screenshot image
 * @param {string} url - URL that was captured
 * @returns {Promise<object>} Analysis report with summary, issues, quick_wins, confidence
 */
export async function analyzeScreenshot(imagePath, url) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return {
            error: "Missing GEMINI_API_KEY. Set it in the environment."
        };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const imageData = await fs.readFile(imagePath, { encoding: "base64" });
    const prompt = [
        {
            text: [
                "You are a conversion rate optimizer.",
                "Analyze the screenshot for conversion blockers and design flaws.",
                "Focus on hierarchy, CTA clarity, trust signals, load clutter,",
                "form friction, messaging alignment, and visual noise.",
                "Return JSON with fields:",
                "summary (string), issues (array of strings),",
                "action_items (array of strings: specific, actionable fixes),",
                "confidence (low|medium|high).",
                `Context URL: ${url}`
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

    // Use regex to find the first JSON-like block if multiple blocks or extra text exist
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : text;

    try {
        const parsed = JSON.parse(jsonText);
        // Normalize field names if Gemini uses camelCase or variations
        return {
            summary: parsed.summary || parsed.Summary || "",
            issues: parsed.issues || parsed.Issues || [],
            quick_wins: parsed.quick_wins || parsed.quickWins || parsed["quick-wins"] || parsed.QuickWins || [],
            confidence: parsed.confidence || parsed.Confidence || "medium"
        };
    } catch (err) {
        console.error("Failed to parse Gemini JSON:", err, "Raw text:", text);
        return { raw: text };
    }
}

/**
 * Generate outreach scripts (email, SMS, phone) for a prospect
 * @param {object} context - { name, url, report }
 * @returns {Promise<object>} Scripts with email, sms, phone fields
 */
export async function generateOutreach({ name, url, report }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `
    You are an expert sales copywriter.
    Context: We analyzed ${name ? name : "a potential client"} (${url}).
    Findings: ${JSON.stringify(report || "No specific report, just general optimization needed.")}
    
    Task: Create 3 outreach scripts to pitch our "Conversion Optimization Services".
    1. Cold Email (Short, personalized, value-first).
    2. SMS (One sentence hook).
    3. Cold Call Script (Opening + value prop).

    Return JSON ONLY:
    {
      "email": { "subject": "...", "body": "..." },
      "sms": "...",
      "phone": "..."
    }
  `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : text;

    return JSON.parse(jsonText);
}
