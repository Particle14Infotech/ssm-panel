import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Compare Crown Screenshot with Reference", () => {
  test("capture hero crown and create comparison", async ({ page }) => {
    const outDir = path.resolve(process.cwd(), "docs", "visual-diff", "crown-compare");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Capture hero viewport
    const heroPath = path.join(outDir, "hero-crown-1440.png");
    await page.screenshot({ path: heroPath });

    // Check DOM elements
    const domInfo = await page.evaluate(() => {
      return {
        canvasCount: document.querySelectorAll("canvas").length,
        container: Boolean(document.querySelector('[data-testid="crown-stage-container"]')),
        fallback: Boolean(document.querySelector('[data-testid="crown-stage-fallback"]')),
        userAgent: navigator.userAgent,
      };
    });
    console.log("DOM INFO:", domInfo);

    const canvas = page.locator("canvas").first();
    if (await canvas.count() > 0) {
      await canvas.screenshot({ path: path.join(outDir, "crown-canvas-1440.png") });
    }
  });
});
