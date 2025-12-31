/**
 * Normalize URL input to a consistent https/http form.
 * Returns an empty string if invalid.
 */
export function normalizeUrl(raw) {
    const input = String(raw || "").trim();
    if (!input) return "";

    const hasScheme = /^https?:\/\//i.test(input);
    const candidate = hasScheme ? input : `https://${input}`;

    try {
        const parsed = new URL(candidate);

        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return "";
        }

        parsed.hash = "";
        parsed.hostname = parsed.hostname.toLowerCase();

        let pathname = parsed.pathname.replace(/\/+$/, "");
        if (!pathname) pathname = "/";
        parsed.pathname = pathname;

        return parsed.toString();
    } catch {
        return "";
    }
}
