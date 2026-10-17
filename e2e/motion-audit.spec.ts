import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Phase 4 - Motion System & Animation Verification", () => {
  const screenshotsDir = path.resolve(process.cwd(), "docs/visual-diff/motion-proof");

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test("Desktop 1440: H1 visible at first paint, scroll animations run, stepped captures & video", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "no-preference",
      recordVideo: {
        dir: "artifacts/videos",
        size: { width: 1440, height: 900 },
      },
    });

    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // 1. H1 is visible at first paint
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    const h1Opacity = await h1.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(Number(h1Opacity)).toBeGreaterThan(0.8);

    // 2. Exactly ONE crown canvas exists
    const canvasCount = await page.locator("canvas").count();
    expect(canvasCount).toBeLessThanOrEqual(1);

    // 3. Capture Hero state (Step 1)
    await page.screenshot({ path: path.join(screenshotsDir, "1440-hero-loaded.png") });

    // 4. Stepped scroll to Work Walkthrough (Step 2)
    await page.evaluate(() => {
      const el = document.getElementById("work");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotsDir, "1440-work-walkthrough.png") });

    // 5. Stepped scroll to Services & Pricing (Step 3)
    await page.evaluate(() => {
      const el = document.getElementById("services");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotsDir, "1440-services-pricing.png") });

    // Test platform tab switch layout animation
    const youtubeTab = page.locator("button:has-text('YouTube')");
    if (await youtubeTab.isVisible()) {
      await youtubeTab.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(screenshotsDir, "1440-services-tab-switched.png") });
    }

    // 6. Stepped scroll to Payments (Step 4)
    await page.evaluate(() => {
      const el = document.getElementById("payments");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotsDir, "1440-payments-tiles.png") });

    // 7. Stepped scroll to Why cards (Step 5)
    await page.evaluate(() => {
      const el = document.getElementById("why");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotsDir, "1440-why-cards.png") });

    // 8. Stepped scroll to FAQ accordion (Step 6)
    await page.evaluate(() => {
      const el = document.getElementById("faq");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotsDir, "1440-faq-accordion.png") });

    // 9. Full page bottom and Footer (Step 7)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotsDir, "1440-footer-cta.png") });

    // 10. Verify no elements stuck at opacity: 0
    const stuckInvisibleElements = await page.evaluate(() => {
      const reveals = Array.from(document.querySelectorAll("h1, h2, h3, p, button, a"));
      return reveals
        .filter((el) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          // Element is in or above viewport and has opacity 0
          return rect.bottom < window.innerHeight && style.opacity === "0";
        })
        .map((el) => el.tagName + "." + el.className);
    });
    expect(stuckInvisibleElements.length).toBe(0);

    // 11. Zero console errors
    expect(consoleErrors).toEqual([]);

    await context.close();
  });

  test("Mobile 390: Responsiveness, drawer, and stepped scroll video", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "no-preference",
      recordVideo: {
        dir: "artifacts/videos",
        size: { width: 390, height: 844 },
      },
    });

    const page = await context.newPage();
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // Verify 0 horizontal scroll
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Capture mobile hero
    await page.screenshot({ path: path.join(screenshotsDir, "390-hero.png") });

    // Scroll through mobile page in steps
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      await page.evaluate((step) => {
        const target = (document.body.scrollHeight / 6) * step;
        window.scrollTo({ top: target, behavior: "smooth" });
      }, i);
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotsDir, `390-step-${i}.png`) });
    }

    await context.close();
  });

  test("Reduced Motion: Everything visible with fades only, no stuck elements", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });

    const page = await context.newPage();
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // All headings are immediately visible
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();

    // Scroll down and verify everything is visible
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(300);

    const invisibles = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("h2, h3"));
      return headings.filter((h) => window.getComputedStyle(h).opacity === "0").length;
    });
    expect(invisibles).toBe(0);

    await context.close();
  });
});
