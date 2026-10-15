import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("3D Lab Verification & Screenshots", () => {
  const targets = [
    "instagram",
    "youtube",
    "telegram",
    "tiktok",
    "facebook",
    "x",
    "wallet",
    "package",
    "provider",
    "complete",
    "journey",
  ];

  test("captures 800x800 screenshots for all 3d lab assets", async ({ page }) => {
    test.setTimeout(120000);
    // Ensure artifacts directory exists
    const artifactsDir = path.resolve(process.cwd(), "artifacts", "3d-lab");
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    page.on("console", (msg) => console.log(`PAGE LOG [${msg.type()}]:`, msg.text()));
    page.on("pageerror", (err) => console.log(`PAGE ERROR:`, err));

    await page.setViewportSize({ width: 1200, height: 1000 });
    await page.goto("http://localhost:3000/dev/3d-lab", { waitUntil: "networkidle" });

    const select = page.locator("#lab-select");
    await expect(select).toBeVisible({ timeout: 15000 });

    const canvasContainer = page.locator("#lab-canvas-container");
    await expect(canvasContainer).toBeVisible();

    for (const target of targets) {
      await select.selectOption(target);
      await expect(page.getByTestId("lab-target-badge")).toHaveText(target, {
        timeout: 5000,
      });
      // Allow frame to render cleanly
      await page.waitForTimeout(400);

      const filePath = path.join(artifactsDir, `${target}.png`);
      await canvasContainer.screenshot({ path: filePath });
      console.log(`Saved screenshot: ${filePath}`);
    }
  });
});
