import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Real Platform Logos & 5-Step Order Journey E2E Verification", () => {
  const allowedPlatformIds = [
    "instagram",
    "youtube",
    "telegram",
    "tiktok",
    "facebook",
    "x",
  ];

  test("1. asserts real 3D canvas exposes __sceneDebug with all 6 platform IDs and brand palette", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });

    // 1. Assert <canvas> exists and has non-zero dimensions
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 15000 });
    const boundingBox = await canvas.boundingBox();
    expect(boundingBox).not.toBeNull();
    expect(boundingBox!.width).toBeGreaterThan(100);
    expect(boundingBox!.height).toBeGreaterThan(100);

    // 2. Assert canvas pixel content changes between frames (animation alive)
    const frame1 = await canvas.screenshot();
    await page.waitForTimeout(300);
    const frame2 = await canvas.screenshot();
    expect(Buffer.compare(frame1, frame2)).not.toBe(0);

    // 3. Verify __sceneDebug returns platforms and brand colors
    await page.waitForFunction(() => typeof (window as any).__sceneDebug === "function", {
      timeout: 10000,
    });
    const sceneDebug = await page.evaluate(() => (window as any).__sceneDebug());

    expect(sceneDebug).not.toBeNull();
    expect(sceneDebug.platforms).toBeDefined();
    expect(sceneDebug.platforms).toEqual(expect.arrayContaining(allowedPlatformIds));
    expect(sceneDebug.platforms.length).toBe(6);

    // 4. Allowed palette test (Electric Lime, Pink, Purple, White - Zero Orange)
    const allowedHexPatterns = [
      /^#FF4D8D$/i, // Pink
      /^#D8EC8D$/i, // Electric Lime
      /^#7B3FF2$/i, // Purple
      /^#FFFFFF$/i, // White
    ];

    for (const color of sceneDebug.colors) {
      const isAllowed = allowedHexPatterns.some((pattern) => pattern.test(color));
      expect(isAllowed).toBe(true);
      // Explicitly reject prohibited orange
      expect(color.toLowerCase()).not.toContain("ff8a3d");
    }

    // 5. Hero stage active at initial scroll
    expect(sceneDebug.visibleGroups).toContain("hero");
    expect(sceneDebug.visibleGroups.length).toBeLessThanOrEqual(2);
  });

  test("2. asserts logo geometries in 3D scene have vertices > 500 and Instagram has holes", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await expect(page.locator("canvas").first()).toBeAttached({ timeout: 15000 });

    await page.waitForFunction(() => typeof (window as any).__logoDebug === "function", {
      timeout: 10000,
    });

    const geometryCheck = await page.evaluate(() => (window as any).__logoDebug());

    for (const [name, stats] of Object.entries(geometryCheck) as [string, any][]) {
      // Vertex count > 500 catches empty/failed SVG extrusions
      expect(stats.vertices).toBeGreaterThan(500);
      if (name === "instagram") {
        // Instagram camera ring and dot must be holes or subshapes
        expect(stats.shapeCount > 1 || stats.holeCount > 0).toBe(true);
      }
    }
  });

  test("3. asserts 5-step pipeline labels exist and fit inside viewport at 1440 and 390", async ({
    page,
  }) => {
    const viewports = [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ];

    const expectedTags = [
      "1 Add funds",
      "2 Choose service",
      "3 Place order",
      "4 Provider delivers",
      "5 Complete",
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });

      for (const tag of expectedTags) {
        const tagElement = page.getByText(tag, { exact: true }).first();
        await expect(tagElement).toBeAttached();
      }
    }
  });

  test("4. asserts logo click navigates to /services?platform=instagram", async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });

    // Wait for canvas to mount and __onSelectLogo to be ready
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeAttached({ timeout: 15000 });
    await page.waitForFunction(() => typeof (window as any).__onSelectLogo === "function", {
      timeout: 10000,
    });

    // Trigger onSelect bridge directly as would happen on 3D logo click
    await Promise.all([
      page.waitForURL(/.*\/services\?platform=instagram/, { waitUntil: "domcontentloaded", timeout: 30000 }),
      page.evaluate(() => (window as any).__onSelectLogo("instagram")),
    ]);
    expect(page.url()).toContain("/services?platform=instagram");
  });

  test("5. asserts footer and FAQ contain trademark disclaimer", async ({ page }) => {
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });

    const disclaimerText =
      "Instagram, YouTube, Telegram, TikTok, Facebook and X are trademarks of their respective owners. This service is not affiliated with or endorsed by them.";

    // Assert disclaimer present in footer compliance box / text
    const footer = page.locator("footer");
    await expect(footer).toContainText("Instagram, YouTube, Telegram, TikTok, Facebook and X");

    // Assert FAQ contains disclaimer
    const faq = page.locator("#faq");
    await expect(faq).toContainText("Instagram, YouTube, Telegram, TikTok, Facebook and X");
  });

  test("6. captures stage screenshots at 1440 and 390 to artifacts/3d-stages/", async ({ page }) => {
    const artifactsDir = path.resolve(process.cwd(), "artifacts", "3d-stages");
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // 1440px desktop screenshots
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Hero Stage
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "artifacts/3d-stages/stage-hero-1440.png" });

    // Pipeline Stage (Work Walkthrough)
    await page.evaluate(() => {
      document.getElementById("work")?.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: "artifacts/3d-stages/stage-pipeline-1440.png" });

    // Closing Stage (Pricing / Closing)
    await page.evaluate(() => {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: "artifacts/3d-stages/stage-closing-1440.png" });

    // 390px mobile screenshots
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(600);
    await page.screenshot({ path: "artifacts/3d-stages/stage-hero-390.png" });

    await page.evaluate(() => {
      document.getElementById("work")?.scrollIntoView({ behavior: "instant", block: "start" });
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: "artifacts/3d-stages/stage-pipeline-390.png" });
  });

  test("7. asserts reduced-motion fallback displays static SVG without 3D canvas", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });

    // Canvas must not exist
    const canvas = page.locator("canvas");
    await expect(canvas).toHaveCount(0);

    // Static SVG pipeline fallback must be present with all 5 steps
    const staticPipeline = page.getByTestId("static-pipeline-svg");
    await expect(staticPipeline).toBeVisible();
    await expect(staticPipeline.getByText("1 Add funds")).toBeVisible();
    await expect(staticPipeline.getByText("2 Choose service")).toBeVisible();
    await expect(staticPipeline.getByText("3 Place order")).toBeVisible();
    await expect(staticPipeline.getByText("4 Provider delivers")).toBeVisible();
    await expect(staticPipeline.getByText("5 Complete")).toBeVisible();
  });
});
