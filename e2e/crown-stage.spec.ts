import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("CrownStage Persistent 3D Crown E2E Verification", () => {
  const sections = [
    { id: "hero", name: "hero" },
    { id: "benefits", name: "benefits" },
    { id: "services", name: "services" },
    { id: "work", name: "how-it-works" },
    { id: "pricing", name: "pricing" },
    { id: "faq", name: "faq" },
    { id: "contact", name: "contact" },
  ];

  test("1. asserts single crown canvas mounted once, no console errors, captures 1440 & 390 screenshots", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    const outDir = path.resolve(process.cwd(), "docs", "visual-diff", "crown-stage");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // Desktop 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Assert ONE canvas is mounted
    const canvasList = page.locator("canvas");
    await expect(canvasList).toHaveCount(1);

    // Capture each section at 1440
    for (const sec of sections) {
      const el = page.locator(`#${sec.id}`);
      if (await el.count()) {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(outDir, `${sec.name}-1440.png`) });
      }
    }

    // Capture footer
    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "footer-1440.png") });

    // Mobile 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    // On mobile (<768), canvas must NOT be mounted, fallback static image shown in hero
    const mobileCanvas = page.locator("canvas");
    await expect(mobileCanvas).toHaveCount(0);
    const fallback = page.getByTestId("crown-stage-fallback");
    await expect(fallback).toBeAttached();

    for (const sec of sections) {
      const el = page.locator(`#${sec.id}`);
      if (await el.count()) {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(outDir, `${sec.name}-390.png`) });
      }
    }
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, "footer-390.png") });

    if (consoleErrors.length > 0) {
      console.log("Captured console errors:", JSON.stringify(consoleErrors, null, 2));
    }
    expect(consoleErrors.length).toBe(0);
  });

  test("2. asserts reduced-motion shows fallback without 3D canvas", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });

    const canvas = page.locator("canvas");
    await expect(canvas).toHaveCount(0);

    const fallback = page.getByTestId("crown-stage-fallback");
    await expect(fallback).toBeAttached();
  });

  test("3. captures 6-frame scroll series", async ({ page }) => {
    test.setTimeout(60000);
    const outDir = path.resolve(process.cwd(), "docs", "visual-diff", "crown-stage");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    const scrollSteps = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    for (let i = 0; i < scrollSteps.length; i++) {
      const p = scrollSteps[i];
      await page.evaluate((progress) => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: maxScroll * progress, behavior: "instant" });
      }, p);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(outDir, `scroll-frame-${i + 1}.png`) });
    }
  });
});
