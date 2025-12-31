import { chromium } from "playwright";

const url = "http://localhost:5173";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(url, { waitUntil: "networkidle" });

await page.evaluate(() => {
  const all = [document.scrollingElement, ...Array.from(document.querySelectorAll("*"))];

  let best = null;
  let bestDelta = 0;

  for (const el of all) {
    if (!el) continue;
    const cs = getComputedStyle(el);
    const delta = el.scrollHeight - el.clientHeight;

    if (delta > bestDelta && /(auto|scroll)/.test(cs.overflowY)) {
      best = el;
      bestDelta = delta;
    }
  }

  document.documentElement.style.overflow = "visible";
  document.body.style.overflow = "visible";
  document.documentElement.style.height = "auto";
  document.body.style.height = "auto";

  if (best && best !== document.scrollingElement && bestDelta > 0) {
    best.style.height = best.scrollHeight + "px";
    best.style.overflow = "visible";

    let p = best.parentElement;
    while (p && p !== document.body) {
      p.style.overflow = "visible";
      p.style.height = "auto";
      p = p.parentElement;
    }
  }
});

await page.waitForTimeout(200);
await page.screenshot({ path: "fullpage.png", fullPage: true });

await browser.close();
console.log("Saved fullpage.png");
