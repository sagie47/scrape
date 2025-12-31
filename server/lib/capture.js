/**
 * Capture Pipeline - Unified screenshot capture for WordPress and dynamic sites
 * 
 * Consolidates: navigation, scrolling, prep, stabilization, and screenshot into one flow.
 */

const DEFAULT_CAPTURE_OPTIONS = {
    captureMode: "standard",
    navigationTimeout: 60000,
    navigationWaitUntil: "load",
    fallbackWaitUntil: "domcontentloaded",
    navigationAttempts: 2,
    allowHttpFallback: true,
    blockResources: false,
    blockImages: false,
    blockTrackers: false,
    maxScrollHeight: 12000,
    maxScrollSteps: 5,
    settleTimeout: 500,
    thumbnailWidth: 480,
    thumbnailHeight: 300
};

const TRACKER_HOST_SNIPPETS = [
    "googletagmanager.com",
    "google-analytics.com",
    "doubleclick.net",
    "facebook.net",
    "clarity.ms",
    "hotjar.com",
    "segment.com",
    "mixpanel.com"
];

function normalizeOptions(options = {}) {
    return { ...DEFAULT_CAPTURE_OPTIONS, ...options };
}

async function setupRequestBlocking(page, options) {
    const shouldBlockImages = options.blockImages === true;
    const shouldBlockTrackers = options.blockTrackers === true;
    const shouldBlockResources = options.blockResources === true;

    if (!shouldBlockResources && !shouldBlockTrackers && !shouldBlockImages) return;

    await page.route("**/*", (route) => {
        const request = route.request();
        const resourceType = request.resourceType();
        const url = request.url().toLowerCase();

        if (shouldBlockTrackers && TRACKER_HOST_SNIPPETS.some((host) => url.includes(host))) {
            return route.abort();
        }

        if (shouldBlockResources) {
            const blockedTypes = shouldBlockImages ? ["image", "media", "font"] : ["media", "font"];
            if (blockedTypes.includes(resourceType)) {
                return route.abort();
            }
        }

        return route.continue();
    });
}

async function navigateWithRetries(page, url, options) {
    let currentUrl = url;
    let lastError = null;

    for (let attempt = 1; attempt <= options.navigationAttempts; attempt += 1) {
        try {
            const waitUntil = attempt === 1 ? options.navigationWaitUntil : options.fallbackWaitUntil;
            await page.goto(currentUrl, { waitUntil, timeout: options.navigationTimeout });
            return currentUrl;
        } catch (err) {
            lastError = err;
            const isHttps = currentUrl.startsWith("https://");
            if (attempt === 1 && isHttps && options.allowHttpFallback) {
                currentUrl = currentUrl.replace(/^https:\/\//i, "http://");
            }
            if (attempt < options.navigationAttempts) {
                await page.waitForTimeout(400 * attempt);
            }
        }
    }

    throw lastError;
}

/**
 * Navigate to URL with WP-friendly load handling
 * Uses "load" (not domcontentloaded) + best-effort networkidle + layout stabilization
 */
export async function navigateAndSettle(page, url, options = {}) {
    const merged = normalizeOptions(options);

    // Use 'load' for better WP builder compatibility (Elementor, Divi, etc.)
    await navigateWithRetries(page, url, merged);

    // Best-effort short networkidle (don't block forever)
    try {
        await page.waitForLoadState("networkidle", { timeout: 5000 });
    } catch {
        // Many WP sites never go fully idle - that's okay
    }

    // Wait for fonts to load (best effort)
    await page.evaluate(() => {
        return document.fonts?.ready || Promise.resolve();
    }).catch(() => { });

    // 2x requestAnimationFrame to settle layout
    await page.evaluate(() => {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
            });
        });
    });

    // Brief additional settle for late-loading scripts
    await page.waitForTimeout(merged.settleTimeout);
}

/**
 * Scroll page to trigger lazy loading - stays at bottom (does NOT scroll back to top)
 * Scrolls in stages to trigger reveal animations and lazy content
 */
export async function autoScroll(page, options = {}) {
    const merged = normalizeOptions(options);
    await page.evaluate(async ({ maxScrollHeight, maxScrollSteps }) => {
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const isScrollable = (el) => el && el.scrollHeight > el.clientHeight + 50;

        // Find the best scroll target
        const candidates = Array.from(document.querySelectorAll('body *')).filter(el => {
            const style = window.getComputedStyle(el);
            return (style.overflowY === 'auto' || style.overflowY === 'scroll') && isScrollable(el);
        });

        let scrollTarget = document.scrollingElement || document.documentElement;
        if (!isScrollable(scrollTarget) && candidates.length) {
            candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
            scrollTarget = candidates[0];
        }

        if (!scrollTarget) return;

        const viewportHeight = window.innerHeight;
        const totalHeight = Math.min(scrollTarget.scrollHeight, maxScrollHeight || scrollTarget.scrollHeight);
        const stepCount = Math.max(2, maxScrollSteps || 5);

        // Scroll down in stages, pausing at key points to trigger reveals
        const keyPositions = [];
        for (let i = 0; i <= stepCount; i += 1) {
            keyPositions.push(totalHeight * (i / stepCount));
        }

        for (const pos of keyPositions) {
            scrollTarget.scrollTo({ top: pos, behavior: 'instant' });
            await sleep(200);
        }

        // Final smooth scroll to bottom and stay there
        scrollTarget.scrollTo({ top: totalHeight, behavior: 'instant' });
        await sleep(300);

        // DO NOT scroll back to top - stay at final position
        // This preserves reveal-on-scroll elements that hide when out of view
    }, { maxScrollHeight: merged.maxScrollHeight, maxScrollSteps: merged.maxScrollSteps });
}

/**
 * Prepare page for screenshot capture
 * Disables animations, forces reveal elements visible, pauses media
 */
export async function prepForScreenshot(page) {
    await page.evaluate(() => {
        // Inject CSS to disable animations and transitions
        const style = document.createElement('style');
        style.id = 'cro-screenshot-prep';
        style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
      /* Force common WP reveal libraries to show content */
      .elementor-invisible,
      [data-aos],
      .wow,
      .animate__animated,
      .sal-animate,
      .is-hidden,
      .hidden-on-scroll {
        opacity: 1 !important;
        visibility: visible !important;
        transform: none !important;
      }
    `;
        document.head.appendChild(style);

        // Pause all videos and audio
        document.querySelectorAll('video, audio').forEach(el => {
            try { el.pause(); } catch { }
        });

        // Stop any GIF animations by replacing with static frame (optional)
        // document.querySelectorAll('img[src$=".gif"]').forEach(img => {
        //   img.style.visibility = 'visible';
        // });
    });
}

async function dismissOverlays(page) {
    await page.evaluate(() => {
        const textMatches = [
            "accept", "agree", "ok", "okay", "got it", "allow all", "accept all", "yes"
        ];

        const clickable = Array.from(document.querySelectorAll(
            "button, [role='button'], input[type='button'], input[type='submit']"
        ));

        clickable.forEach((el) => {
            const text = (el.textContent || "").trim().toLowerCase();
            if (!text) return;
            if (textMatches.some((match) => text.includes(match))) {
                try { el.click(); } catch { }
            }
        });

        const overlaySelectors = [
            "[id*='cookie']",
            "[class*='cookie']",
            "[id*='consent']",
            "[class*='consent']",
            "[id*='gdpr']",
            "[class*='gdpr']",
            "[class*='cc-']"
        ];

        overlaySelectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((el) => {
                const style = window.getComputedStyle(el);
                if (style.position === "fixed" || style.position === "sticky") {
                    el.style.setProperty("display", "none", "important");
                    el.style.setProperty("visibility", "hidden", "important");
                }
            });
        });
    });
}

/**
 * Wait for visual stability after scrolling
 * Uses rAF + timeout + best-effort networkidle
 */
export async function waitForVisualStability(page, ms = 500) {
    // 2x requestAnimationFrame
    await page.evaluate(() => {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
            });
        });
    });

    // Wait period
    await page.waitForTimeout(ms);

    // Best-effort very short networkidle
    try {
        await page.waitForLoadState('networkidle', { timeout: 2000 });
    } catch {
        // Fine if it times out
    }
}

/**
 * Capture full-page screenshot with consistent options
 */
async function captureFullPage(page, screenshotPath) {
    return await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        animations: 'disabled', // Playwright option to freeze CSS animations
    });
}

async function captureViewport(page, screenshotPath) {
    return await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        animations: "disabled"
    });
}

/**
 * Capture scrollable container as fallback (restores original styles after)
 */
async function captureScrollableContainer(page, screenshotPath) {
    const result = await page.evaluate(() => {
        const isScrollable = (el) => el && el.scrollHeight > el.clientHeight + 100;

        const candidates = Array.from(document.querySelectorAll('body *')).filter(el => {
            const style = window.getComputedStyle(el);
            return (style.overflowY === 'auto' || style.overflowY === 'scroll') && isScrollable(el);
        });

        if (!candidates.length) return null;

        candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
        const target = candidates[0];

        // Store original styles
        const originalStyles = {
            overflow: target.style.overflow,
            height: target.style.height
        };

        // Set for full-height capture
        target.setAttribute('data-cro-scroll-container', 'true');
        target.style.overflow = 'visible';
        target.style.height = 'auto';

        return {
            selector: "[data-cro-scroll-container='true']",
            originalStyles
        };
    });

    if (!result) return false;

    const handle = await page.$(result.selector);
    if (!handle) return false;

    await handle.screenshot({
        path: screenshotPath,
        animations: 'disabled'
    });

    // Restore original styles
    await page.evaluate((originalStyles) => {
        const el = document.querySelector("[data-cro-scroll-container='true']");
        if (el) {
            el.style.overflow = originalStyles.overflow;
            el.style.height = originalStyles.height;
            el.removeAttribute('data-cro-scroll-container');
        }
    }, result.originalStyles);

    return true;
}

async function captureThumbnail(page, thumbnailPath, options) {
    const viewport = page.viewportSize();
    if (!viewport) return false;

    const width = Math.min(options.thumbnailWidth, viewport.width);
    const height = Math.min(options.thumbnailHeight, viewport.height);

    await page.screenshot({
        path: thumbnailPath,
        clip: { x: 0, y: 0, width, height },
        type: "jpeg",
        quality: 65,
        animations: "disabled"
    });

    return true;
}

/**
 * MAIN PIPELINE: Capture audit screenshot
 * 
 * This is the ONE function all job runners should call.
 * Handles: navigate → scroll → prep → stabilize → screenshot
 * 
 * @param {Page} page - Playwright page instance
 * @param {string} url - URL to capture
 * @param {string} screenshotPath - Where to save the screenshot
 * @returns {Promise<{ success: boolean, usedFallback: boolean, usedThumbnail: boolean }>}
 */
export async function captureAuditScreenshot(page, url, screenshotPath, options = {}) {
    const merged = normalizeOptions(options);
    const fastMode = merged.captureMode === "fast";

    await setupRequestBlocking(page, merged);

    // 1. Navigate with WP-friendly load handling
    await navigateAndSettle(page, url, merged);

    // 2. Scroll to trigger lazy loading (stays at bottom)
    if (!fastMode) {
        await autoScroll(page, merged);
    }

    // 3. Prepare page: disable animations, force reveals visible
    await prepForScreenshot(page);

    // 4. Dismiss cookie overlays/modals and wait for visual stability
    await dismissOverlays(page);
    await waitForVisualStability(page, fastMode ? 250 : 500);

    if (!fastMode) {
        // 5. Scroll to top for full-page capture (now safe after prep disabled animations)
        await page.evaluate(() => {
            (document.scrollingElement || document.documentElement).scrollTo(0, 0);
        });
        await page.waitForTimeout(100);
    }

    // 6. Capture screenshot (full page or viewport)
    let usedFallback = false;
    try {
        if (fastMode) {
            await captureViewport(page, screenshotPath);
        } else {
            await captureFullPage(page, screenshotPath);
        }
    } catch (err) {
        console.warn("Full-page screenshot failed, trying container fallback:", err.message);
        const success = await captureScrollableContainer(page, screenshotPath);
        if (!success) {
            await page.screenshot({ path: screenshotPath });
        }
        usedFallback = true;
    }

    let usedThumbnail = false;
    if (merged.thumbnailPath) {
        try {
            await captureThumbnail(page, merged.thumbnailPath, merged);
            usedThumbnail = true;
        } catch {
            usedThumbnail = false;
        }
    }

    return { success: true, usedFallback, usedThumbnail };
}
