import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.use({
  video: {
    mode: "on",
    size: { width: 1280, height: 720 },
  },
});

test("records smooth scrolling of the landing page top to bottom", async ({ page }, testInfo) => {
  test.setTimeout(60000);

  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Smooth scroll down the page over ~6 seconds
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const steps = 30;
  const delay = 150;

  for (let i = 1; i <= steps; i++) {
    const target = (scrollHeight / steps) * i;
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), target);
    await page.waitForTimeout(delay);
  }

  await page.waitForTimeout(1500);

  // Close page to flush video
  await page.close();

  const video = page.video();
  if (video) {
    const videoPath = await video.path();
    const dest = path.resolve(process.cwd(), "artifacts", "landing-scroll.webm");
    fs.copyFileSync(videoPath, dest);
  }
});
