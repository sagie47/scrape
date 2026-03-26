import { config } from "../config/env.js";

function buildHeaders() {
    const headers = {
        "Content-Type": "application/json"
    };

    if (config.gosomApiKey) {
        headers["X-API-Key"] = config.gosomApiKey;
    }

    return headers;
}

async function gosomRequest(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.gosomTimeoutMs);

    try {
        const response = await fetch(`${config.gosomBaseUrl.replace(/\/$/, "")}${path}`, {
            ...options,
            headers: {
                ...buildHeaders(),
                ...(options.headers || {})
            },
            signal: controller.signal
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`gosom ${response.status}: ${text}`);
        }

        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

export async function createMapsScrapeJob({ keyword, location, limit = 25, lang, email, depth = 1, radius, zoom, lat, lon, fastMode = false }) {
    const query = location ? `${keyword} in ${location}` : keyword;
    return gosomRequest("/api/v1/jobs", {
        method: "POST",
        body: JSON.stringify({
            name: query,
            keywords: [query],
            lang: lang || config.gosomDefaultLang,
            zoom: zoom || 15,
            lat,
            lon,
            fast_mode: fastMode,
            radius,
            depth,
            email: email ?? config.gosomEmailExtraction,
            max_time: Math.max(600, limit * 30),
            proxies: config.gosomProxyUrls
        })
    });
}

export async function getMapsScrapeJob(jobId) {
    return gosomRequest(`/api/v1/jobs/${jobId}`);
}

export async function waitForMapsScrapeJob(jobId, { pollMs = 5000, timeoutMs = 5 * 60 * 1000 } = {}) {
    const started = Date.now();

    while (true) {
        const job = await getMapsScrapeJob(jobId);
        const status = String(job.status || "").toLowerCase();

        if (["completed", "done", "success"].includes(status)) {
            return job;
        }

        if (["failed", "error"].includes(status)) {
            throw new Error(job.error || `gosom job ${jobId} failed`);
        }

        if (Date.now() - started > timeoutMs) {
            throw new Error(`gosom job ${jobId} timed out`);
        }

        await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
}

function parseEmails(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
    return String(value).split(",").map((entry) => entry.trim()).filter(Boolean);
}

export function normalizeGosomPlace(place = {}, keyword = "") {
    const title = place.title || place.name || place.business_name || "Unknown business";
    const emails = parseEmails(place.emails || place.email);

    return {
        name: title,
        address: place.address || place.complete_address || null,
        phone: place.phone || null,
        website: place.website || null,
        rating: place.review_rating ?? place.rating ?? null,
        reviews: place.review_count ?? place.reviews ?? null,
        placeId: place.place_id || place.data_id || place.cid || null,
        sourceExternalId: place.data_id || place.cid || place.place_id || null,
        category: place.category || null,
        city: place.city || null,
        region: place.state || place.region || null,
        country: place.country || null,
        mapsUrl: place.link || place.reviews_link || null,
        coordinates: place.latitude && place.longitude ? { lat: Number(place.latitude), lng: Number(place.longitude) } : null,
        email: emails[0] || null,
        emails,
        source: "gosom",
        rawSource: place,
        tags: keyword ? [keyword] : []
    };
}

export function normalizeGosomResults(job, keyword = "") {
    const results = Array.isArray(job.results) ? job.results : Array.isArray(job.data) ? job.data : [];
    return results.map((place) => normalizeGosomPlace(place, keyword));
}
