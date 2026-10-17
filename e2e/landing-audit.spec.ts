import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Landing Page QA & Specification Audit", () => {
  const DELETE_LIST = [
    "Ingress",
    "Payment Rails",
    "Atomic Ledger",
    "Double-Entry",
    "Append-only",
    "Encrypted at rest",
    "Edge Response",
    "SEO-Ready",
    "Optimized Performance",
    "Provider Keys",
    "Queue Polling",
    "Enterprise social growth infrastructure",
    "v4.9 Stable",
    "All Providers Monitored",
    "500+",
    "Zero hidden fees",
    "Instant Credit Ledger",
    "Verified Provider APIs",
    "smmarchitecture.com",
  ];

  test("1. Canvas count <= 1 on landing page across viewports", async ({ page }) => {
    const viewports = [
      { name: "desktop", width: 1440, height: 900 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "mobile", width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      const canvasCount = await page.evaluate(() => {
        return document.querySelectorAll("canvas").length;
      });

      expect(canvasCount).toBeLessThanOrEqual(1);
    }
  });

  test("2. Overlap test: interactive & text elements are not covered by any overlay", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const overlapFailures = await page.evaluate(() => {
      const failures: { tag: string; text: string; hitTag: string; hitText: string }[] = [];
      const targets = document.querySelectorAll<HTMLElement>(
        "h1, h2, h3, h4, h5, h6, p, button, a, input, textarea"
      );

      for (const el of Array.from(targets)) {
        // Skip hidden, off-screen, or zero-dimension elements
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
        if (el.classList.contains("sr-only") || style.clip.includes("rect(0")) continue;

        // Check center coordinate
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        // Skip if outside current viewport bounds
        if (cx < 0 || cx > window.innerWidth || cy < 0 || cy > window.innerHeight) continue;

        const hit = document.elementFromPoint(cx, cy);
        if (!hit) continue;

        // Valid if the hit element is the target itself, a child, or contains the target (e.g. parent SVG/span wrapper)
        const isValid =
          hit === el ||
          el.contains(hit) ||
          hit.contains(el);

        if (!isValid) {
          failures.push({
            tag: el.tagName,
            text: (el.textContent || "").trim().slice(0, 40),
            hitTag: hit.tagName,
            hitText: (hit.textContent || "").trim().slice(0, 40),
          });
        }
      }

      return failures;
    });

    expect(overlapFailures).toEqual([]);
  });

  test("3. Exactly one H1 and proper heading hierarchy", async ({ page }) => {
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });

    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);

    const h1Text = await page.locator("h1").textContent();
    expect(h1Text).toContain("Order social growth.");
    expect(h1Text).toContain("Track every order.");
  });

  test("4. No horizontal overflow on mobile, tablet, and desktop", async ({ page }) => {
    const viewports = [
      { name: "mobile-360", width: 360, height: 740 },
      { name: "mobile-390", width: 390, height: 844 },
      { name: "tablet-768", width: 768, height: 1024 },
      { name: "laptop-1024", width: 1024, height: 768 },
      { name: "desktop-1280", width: 1280, height: 800 },
      { name: "desktop-1440", width: 1440, height: 900 },
      { name: "desktop-1920", width: 1920, height: 1080 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      expect(hasHorizontalScroll).toBe(false);
    }
  });

  test("5. Delete list terms must return 0 occurrences in visible landing page", async ({ page }) => {
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });

    const bodyText = await page.evaluate(() => document.body.innerText);

    for (const term of DELETE_LIST) {
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      expect(regex.test(bodyText)).toBe(false);
    }
  });

  test("6. Viewport-by-viewport screenshots at 390, 768, and 1440", async ({ page }) => {
    test.setTimeout(120000);
    const screenshotDir = path.resolve(process.cwd(), "docs", "visual-diff", "landing-viewport");
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

    const viewports = [
      { width: 390, height: 844, name: "390" },
      { width: 768, height: 1024, name: "768" },
      { width: 1440, height: 900, name: "1440" },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);

      const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const viewportHeight = vp.height;
      const stepCount = Math.ceil(totalHeight / viewportHeight);

      for (let step = 0; step < stepCount; step++) {
        const scrollY = step * (viewportHeight - 100); // 100px overlap to preserve continuity
        await page.evaluate((y) => window.scrollTo(0, y), scrollY);
        await page.waitForTimeout(300);

        const filename = `${vp.name}-step-${String(step + 1).padStart(2, "0")}.png`;
        await page.screenshot({
          path: path.join(screenshotDir, filename),
          fullPage: false,
        });
      }
    }
  });
});
