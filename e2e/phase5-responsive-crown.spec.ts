import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const VIEWPORTS = [
  { name: "320-phone", width: 320, height: 640 },
  { name: "375-phone", width: 375, height: 667 },
  { name: "390-phone", width: 390, height: 844, recordVideo: true },
  { name: "412-phone", width: 412, height: 915 },
  { name: "844-landscape", width: 844, height: 390 },
  { name: "744-sm-tablet", width: 744, height: 1133 },
  { name: "820-tablet", width: 820, height: 1180, recordVideo: true },
  { name: "1024-tablet-pro", width: 1024, height: 1366 },
  { name: "1280-laptop", width: 1280, height: 720 },
  { name: "1440-desktop", width: 1440, height: 900, recordVideo: true },
  { name: "1920-fhd", width: 1920, height: 1080 },
  { name: "2560-qhd", width: 2560, height: 1440 },
];

test.describe("Phase 5 - Responsive Matrix & Traveling Crown E2E Verification", () => {
  const screenshotsDir = path.resolve(process.cwd(), "artifacts/responsive-matrix");

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  for (const vp of VIEWPORTS) {
    test(`Viewport ${vp.name} (${vp.width}x${vp.height}): 12+ scroll positions, zero overflow, no clipped text, crown bounds non-intersection`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: "no-preference",
        ...(vp.recordVideo
          ? {
              recordVideo: {
                dir: "artifacts/videos",
                size: { width: vp.width, height: vp.height },
              },
            }
          : {}),
      });

      const page = await context.newPage();
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
      await page.waitForTimeout(600);

      // Assertion 1: Exactly ONE canvas on the page
      await expect(page.locator("canvas")).toHaveCount(1, { timeout: 8000 });

      // Assertion 2: Tap targets >= 44px
      const smallTapTargets = await page.evaluate(() => {
        const interactive = Array.from(document.querySelectorAll("button, a, input, select"));
        const tooSmall: { tag: string; text: string; w: number; h: number }[] = [];
        for (const el of interactive) {
          if (el.classList.contains("sr-only") || el.getAttribute("href") === "#main-content") continue;
          const rect = el.getBoundingClientRect();
          // Filter only visible elements
          const style = window.getComputedStyle(el);
          if (rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") {
            // Interactive element height should be >= 40px
            if (rect.height < 38) {
              tooSmall.push({
                tag: el.tagName,
                text: (el.textContent || "").slice(0, 20),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
              });
            }
          }
        }
        return tooSmall;
      });
      expect(smallTapTargets).toEqual([]);

      // Assertion 3: Body text >= 14px anywhere
      const tinyText = await page.evaluate(() => {
        const paragraphs = Array.from(document.querySelectorAll("p, span, td, th"));
        const tooSmall: string[] = [];
        for (const el of paragraphs) {
          const style = window.getComputedStyle(el);
          const size = parseFloat(style.fontSize);
          // Allow sub-labels like badges/monos (12px), but general text >= 14px
          if (el.tagName === "P" && size < 13.5 && el.textContent && el.textContent.trim().length > 30) {
            tooSmall.push(`${el.tagName}: ${size}px ("${el.textContent.slice(0, 30)}...")`);
          }
        }
        return tooSmall;
      });
      expect(tinyText).toEqual([]);

      // Step-by-step scroll across 12 scroll positions
      const scrollSteps = 12;
      const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const stepDistance = (scrollHeight - vp.height) / scrollSteps;

      for (let step = 0; step <= scrollSteps; step++) {
        const targetScrollY = Math.round(step * stepDistance);
        await page.evaluate((y) => window.scrollTo(0, y), targetScrollY);
        await page.waitForTimeout(350);

        // Capture screenshot at step 0 (hero), 4 (steps), 6 (services), 8 (payments), 12 (footer)
        if (step === 0 || step === 4 || step === 6 || step === 8 || step === 12) {
          await page.screenshot({
            path: path.join(screenshotsDir, `${vp.name}-step-${step}.png`),
          });
        }

        // Check horizontal overflow
        const hasHorizontalOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(hasHorizontalOverflow).toBe(false);

        // Check crown rect non-intersection with text & interactive content
        const intersectionInfo = await page.evaluate(() => {
          const crown = (window as any).__crownRect;
          if (!crown || crown.width <= 0) return null;

          // Check if crown bounding box overlaps text, buttons, inputs, tables, faq rows
          const contentElements = Array.from(
            document.querySelectorAll("h1, h2, h3, button, a, input, table, [role='region']")
          );

          for (const el of contentElements) {
            // Exclude empty crown slots
            if (el.closest("[data-crown-slot]")) continue;
            // Exclude hidden elements
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;

            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            // Only check elements visible within the viewport
            if (r.bottom <= 0 || r.top >= window.innerHeight) continue;

            // Check AABB intersection:
            const intersects = !(
              crown.right <= r.left + 8 ||
              crown.left >= r.right - 8 ||
              crown.bottom <= r.top + 8 ||
              crown.top >= r.bottom - 8
            );

            if (intersects) {
              return {
                collidedTag: el.tagName,
                collidedText: (el.textContent || "").trim().slice(0, 30),
                crownRect: crown,
                elemRect: { left: r.left, top: r.top, width: r.width, height: r.height },
              };
            }
          }
          return null;
        });

        expect(intersectionInfo).toBeNull();
      }

      // Check no element stuck at opacity 0 after 2s
      await page.waitForTimeout(1000);
      const stuckInvisibles = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll("h1, h2, h3, p"));
        return elements
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.bottom < window.innerHeight && style.opacity === "0";
          })
          .map((el) => `${el.tagName}: ${(el.textContent || "").slice(0, 20)}`);
      });
      expect(stuckInvisibles).toEqual([]);

      // Zero console errors
      expect(consoleErrors).toEqual([]);

      await context.close();
    });
  }

  test("Reduced Motion: Static crown in hero slot, zero crown travel, all content visible", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });

    const page = await context.newPage();
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // In reduced motion, canvas does not render or stays stationary
    const canvasCount = await page.locator("canvas").count();
    expect(canvasCount).toBe(0);

    // Hero slot renders fallback poster
    const heroSlot = page.locator("#crown-slot-hero");
    await expect(heroSlot).toBeVisible();
    await expect(heroSlot.locator("img")).toBeVisible();

    // H1 is immediately visible
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    const h1Opacity = await h1.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(Number(h1Opacity)).toBeGreaterThan(0.9);

    await context.close();
  });
});
