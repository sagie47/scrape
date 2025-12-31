/**
 * Audit Service - SEO, PageSpeed Insights, and CrUX field data analysis
 * 
 * Integrates with the existing screenshot/Gemini analysis pipeline.
 * Can be called alongside or instead of AI vision analysis.
 */

import { load as loadHtml } from "cheerio";
import Bottleneck from "bottleneck";

// ---------- Config ----------
const PSI_API_KEY = process.env.PSI_API_KEY || "";
const CRUX_API_KEY = process.env.CRUX_API_KEY || "";

// Rate limiters to avoid API quota issues
const psiLimiter = new Bottleneck({
    minTime: Number(process.env.PSI_MIN_TIME_MS || 300), // ~200/min
    maxConcurrent: Number(process.env.PSI_MAX_CONCURRENT || 4),
});

const cruxLimiter = new Bottleneck({
    minTime: Number(process.env.CRUX_MIN_TIME_MS || 450), // ~133/min
    maxConcurrent: Number(process.env.CRUX_MAX_CONCURRENT || 4),
});

// Timeouts
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 20000);
const PSI_TIMEOUT_MS = Number(process.env.PSI_TIMEOUT_MS || 120000);
const CRUX_TIMEOUT_MS = Number(process.env.CRUX_TIMEOUT_MS || 20000);

// Core Web Vitals thresholds (Good)
const CWV_THRESHOLDS = {
    LCP_MS: 2500,
    INP_MS: 200,
    CLS: 0.1,
};

// ---------- Helpers ----------
export function normalizeUrl(input) {
    let s = String(input || "").trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    try {
        const u = new URL(s);
        u.hash = "";
        return u.toString();
    } catch {
        return null;
    }
}

function originFromUrl(url) {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
}

async function fetchWithTimeout(url, opts = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            ...opts,
            signal: controller.signal,
            redirect: "follow",
            headers: {
                "user-agent": opts.userAgent || "Mozilla/5.0 (compatible; LeadAuditBot/1.0)",
                ...(opts.headers || {}),
            },
        });
        return res;
    } finally {
        clearTimeout(t);
    }
}

function safeJsonParse(s) {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}

function cwvAssessmentFromCrux(p75) {
    const lcpOk = p75.lcpMs != null && p75.lcpMs <= CWV_THRESHOLDS.LCP_MS;
    const clsOk = p75.cls != null && p75.cls <= CWV_THRESHOLDS.CLS;
    const inpOk = p75.inpMs != null && p75.inpMs <= CWV_THRESHOLDS.INP_MS;

    const hasLcp = p75.lcpMs != null;
    const hasCls = p75.cls != null;

    if (!hasLcp || !hasCls) return { pass: null, reason: "insufficient_data" };
    if (p75.inpMs == null) return { pass: lcpOk && clsOk, reason: "inp_missing" };

    return { pass: lcpOk && clsOk && inpOk, reason: "ok" };
}

// ---------- SEO HTML Audit ----------
export async function runSeoAudit(url) {
    const out = {
        fetched: false,
        status: null,
        finalUrl: null,
        title: null,
        metaDescription: null,
        canonical: null,
        robotsMeta: null,
        h1Count: null,
        h1Text: null,
        hasViewportMeta: null,
        hasOgTitle: null,
        hasOgDescription: null,
        hasSitemap: null,
        hasRobotsTxt: null,
        imagesTotal: null,
        imagesMissingAlt: null,
        schemaTypes: [],
        issues: [],
    };

    try {
        const res = await fetchWithTimeout(url, { timeoutMs: FETCH_TIMEOUT_MS });
        out.status = res.status;
        out.finalUrl = res.url;
        out.fetched = res.ok;

        if (!res.ok) {
            out.issues.push(`html_fetch_failed_${res.status}`);
            return out;
        }

        const html = await res.text();
        const $ = loadHtml(html);

        out.title = $("title").first().text().trim() || null;
        out.metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
        out.canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
        out.robotsMeta = $('meta[name="robots"]').attr("content")?.trim() || null;

        const h1s = $("h1");
        out.h1Count = h1s.length;
        out.h1Text = h1s.first().text().trim() || null;

        out.hasViewportMeta = Boolean($('meta[name="viewport"]').attr("content"));
        out.hasOgTitle = Boolean($('meta[property="og:title"]').attr("content"));
        out.hasOgDescription = Boolean($('meta[property="og:description"]').attr("content"));

        const imgs = $("img");
        out.imagesTotal = imgs.length;
        let missingAlt = 0;
        imgs.each((_, el) => {
            const alt = $(el).attr("alt");
            if (alt == null || String(alt).trim() === "") missingAlt++;
        });
        out.imagesMissingAlt = missingAlt;

        // Detect JSON-LD schema types
        const schemaTypes = new Set();
        $('script[type="application/ld+json"]').each((_, el) => {
            const json = safeJsonParse($(el).text());
            if (!json) return;
            const collectType = (obj) => {
                if (!obj) return;
                if (Array.isArray(obj)) return obj.forEach(collectType);
                if (typeof obj === "object") {
                    const t = obj["@type"];
                    if (typeof t === "string") schemaTypes.add(t);
                    if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && schemaTypes.add(x));
                    for (const k of Object.keys(obj)) collectType(obj[k]);
                }
            };
            collectType(json);
        });
        out.schemaTypes = [...schemaTypes].slice(0, 30);

        // robots.txt and sitemap.xml checks
        try {
            const origin = originFromUrl(out.finalUrl || url);
            const [robotsRes, sitemapRes] = await Promise.all([
                fetchWithTimeout(`${origin}/robots.txt`, { timeoutMs: 8000 }),
                fetchWithTimeout(`${origin}/sitemap.xml`, { timeoutMs: 8000 }),
            ]);
            out.hasRobotsTxt = robotsRes.ok;
            out.hasSitemap = sitemapRes.ok;
        } catch {
            out.hasRobotsTxt = null;
            out.hasSitemap = null;
        }

        // Issues detection
        if (!out.title) out.issues.push("missing_title");
        if (!out.metaDescription) out.issues.push("missing_meta_description");
        if (out.h1Count === 0) out.issues.push("missing_h1");
        if (out.h1Count > 1) out.issues.push("multiple_h1");
        if (!out.hasViewportMeta) out.issues.push("missing_viewport");
        if (out.imagesMissingAlt != null && out.imagesMissingAlt > 0) out.issues.push("images_missing_alt");
        if (!out.canonical) out.issues.push("missing_canonical");

        return out;
    } catch (e) {
        out.issues.push("seo_audit_error");
        out.error = String(e?.message || e);
        return out;
    }
}

// ---------- PageSpeed Insights (Lab Data) ----------
export async function runPsi(url, strategy = "mobile") {
    if (!PSI_API_KEY) {
        return { ok: false, error: "missing_PSI_API_KEY", strategy };
    }

    const endpoint = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
    const params = new URLSearchParams();
    params.set("url", url);
    params.set("strategy", strategy);
    params.append("category", "performance");
    params.append("category", "seo");
    params.set("key", PSI_API_KEY);

    const fullUrl = `${endpoint}?${params.toString()}`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);

    try {
        const res = await fetch(fullUrl, {
            method: "GET",
            signal: controller.signal,
            headers: { "accept": "application/json" },
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`PSI_${strategy}_HTTP_${res.status}: ${body.slice(0, 200)}`);
        }

        const data = await res.json();
        const lh = data?.lighthouseResult;
        const categories = lh?.categories || {};

        const getAuditNumeric = (id) => lh?.audits?.[id]?.numericValue ?? null;

        const metrics = {
            fcpMs: getAuditNumeric("first-contentful-paint"),
            lcpMs: getAuditNumeric("largest-contentful-paint"),
            inpMs: getAuditNumeric("interaction-to-next-paint"),
            cls: getAuditNumeric("cumulative-layout-shift"),
            tbtMs: getAuditNumeric("total-blocking-time"),
            ttfbMs: getAuditNumeric("server-response-time"),
        };

        const opportunities = Object.values(lh?.audits || {})
            .filter((a) => a?.details?.type === "opportunity")
            .sort((a, b) => (b?.details?.overallSavingsMs || 0) - (a?.details?.overallSavingsMs || 0))
            .slice(0, 3)
            .map((a) => ({
                id: a.id,
                title: a.title,
                savingsMs: a.details?.overallSavingsMs ?? null,
            }));

        return {
            ok: true,
            strategy,
            finalUrl: data?.id || url,
            scores: {
                performance: categories?.performance?.score ?? null,
                seo: categories?.seo?.score ?? null,
            },
            metrics,
            topOpportunities: opportunities,
        };
    } catch (e) {
        return { ok: false, error: String(e?.message || e), strategy };
    } finally {
        clearTimeout(t);
    }
}

// ---------- CrUX (Field Data) ----------
async function queryCrux({ url, origin, formFactor = "PHONE" }) {
    if (!CRUX_API_KEY) {
        return { ok: false, error: "missing_CRUX_API_KEY" };
    }

    const endpoint = `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(CRUX_API_KEY)}`;

    const body = {
        formFactor,
        metrics: ["largest_contentful_paint", "interaction_to_next_paint", "cumulative_layout_shift"],
        ...(url ? { url } : { origin }),
    };

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), CRUX_TIMEOUT_MS);

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            signal: controller.signal,
            headers: { "content-type": "application/json", "accept": "application/json" },
            body: JSON.stringify(body),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
            return { ok: false, status: res.status, error: json?.error?.message || "crux_error" };
        }

        const metrics = json?.record?.metrics || {};
        const p75 = {
            lcpMs: metrics?.largest_contentful_paint?.percentiles?.p75 ?? null,
            inpMs: metrics?.interaction_to_next_paint?.percentiles?.p75 ?? null,
            cls: metrics?.cumulative_layout_shift?.percentiles?.p75 ?? null,
        };

        return { ok: true, formFactor, p75, raw: json };
    } finally {
        clearTimeout(t);
    }
}

export async function runCruxAudit(url) {
    const origin = originFromUrl(url);

    // Try URL-level first, fallback to origin
    const urlPhone = await cruxLimiter.schedule(() => queryCrux({ url, formFactor: "PHONE" }));
    let originPhone = null;
    if (!urlPhone.ok) {
        originPhone = await cruxLimiter.schedule(() => queryCrux({ origin, formFactor: "PHONE" }));
    }

    const urlDesktop = await cruxLimiter.schedule(() => queryCrux({ url, formFactor: "DESKTOP" }));
    let originDesktop = null;
    if (!urlDesktop.ok) {
        originDesktop = await cruxLimiter.schedule(() => queryCrux({ origin, formFactor: "DESKTOP" }));
    }

    const pick = (a, b) => (a?.ok ? a : b?.ok ? b : a || b);
    const phone = pick(urlPhone, originPhone);
    const desktop = pick(urlDesktop, originDesktop);

    const assessmentPhone = phone?.ok ? cwvAssessmentFromCrux(phone.p75) : { pass: null, reason: "no_data" };
    const assessmentDesktop = desktop?.ok ? cwvAssessmentFromCrux(desktop.p75) : { pass: null, reason: "no_data" };

    return {
        phone: phone?.ok
            ? { level: urlPhone.ok ? "url" : "origin", p75: phone.p75, assessment: assessmentPhone }
            : { level: null, error: phone?.error || "no_data", assessment: assessmentPhone },
        desktop: desktop?.ok
            ? { level: urlDesktop.ok ? "url" : "origin", p75: desktop.p75, assessment: assessmentDesktop }
            : { level: null, error: desktop?.error || "no_data", assessment: assessmentDesktop },
    };
}

// ---------- Full Site Audit (Combined) ----------
/**
 * Run comprehensive audit on a URL
 * Includes: SEO HTML checks, PSI lab data, CrUX field data
 * 
 * @param {string} inputUrl - URL to audit
 * @param {object} options - { skipPsi, skipCrux, skipSeo }
 * @returns {Promise<object>} Full audit result
 */
export async function runFullAudit(inputUrl, options = {}) {
    const url = normalizeUrl(inputUrl);
    if (!url) return { inputUrl, ok: false, errors: ["invalid_url"] };

    const startedAt = new Date().toISOString();
    const errors = [];

    // SEO Audit (HTML checks)
    let seo = null;
    if (!options.skipSeo) {
        seo = await runSeoAudit(url).catch((e) => {
            errors.push(`seo:${String(e?.message || e)}`);
            return null;
        });
    }

    // CrUX (field data)
    let crux = null;
    if (!options.skipCrux && CRUX_API_KEY) {
        crux = await runCruxAudit(seo?.finalUrl || url).catch((e) => {
            errors.push(`crux:${String(e?.message || e)}`);
            return null;
        });
    }

    // PSI (lab data) - rate limited
    let psi = { mobile: null, desktop: null };
    if (!options.skipPsi && PSI_API_KEY) {
        const targetUrl = seo?.finalUrl || url;

        psi.mobile = await psiLimiter.schedule(() => runPsi(targetUrl, "mobile")).catch((e) => {
            errors.push(`psi_mobile:${String(e?.message || e)}`);
            return null;
        });

        psi.desktop = await psiLimiter.schedule(() => runPsi(targetUrl, "desktop")).catch((e) => {
            errors.push(`psi_desktop:${String(e?.message || e)}`);
            return null;
        });
    }

    return {
        inputUrl,
        url: seo?.finalUrl || url,
        startedAt,
        finishedAt: new Date().toISOString(),
        ok: errors.length === 0,
        seo,
        crux,
        psi,
        errors,
    };
}

// ---------- Quick Audit (SEO only, no API calls) ----------
/**
 * Fast audit that only does HTML checks (no external API calls)
 * Use this when you don't have PSI/CrUX API keys or want faster results
 */
export async function runQuickAudit(url) {
    return runFullAudit(url, { skipPsi: true, skipCrux: true });
}
