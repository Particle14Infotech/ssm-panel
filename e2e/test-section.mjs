import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const VIEWPORTS = [
  { name: "390x844-mobile", width: 390, height: 844 },
  { name: "820x1180-tablet", width: 820, height: 1180 },
  { name: "1440x900-desktop", width: 1440, height: 900 },
];

const qaDir = path.resolve(process.cwd(), "qa");
if (!fs.existsSync(qaDir)) {
  fs.mkdirSync(qaDir, { recursive: true });
}

export async function testSection(sectionName, sectionSelector = null) {
  console.log(`\n========================================`);
  console.log(`Testing Section: ${sectionName}`);
  console.log(`========================================`);

  const browser = await chromium.launch({
    args: ["--enable-webgl", "--use-gl=angle", "--use-gl=swiftshader"],
  });

  const results = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: "no-preference",
    });

    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Scroll to position or selector
    if (sectionSelector === "top" || !sectionSelector) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(600);
    } else if (typeof sectionSelector === "number" || !isNaN(Number(sectionSelector))) {
      await page.evaluate((y) => window.scrollTo(0, Number(y)), sectionSelector);
      await page.waitForTimeout(600);
    } else if (sectionSelector) {
      const sectionEl = page.locator(sectionSelector);
      if (await sectionEl.count() > 0) {
        await sectionEl.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
      }
    }

    // Capture screenshot
    const screenshotPath = path.join(qaDir, `${sectionName}-${vp.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[PASS] Screenshot saved: ${screenshotPath}`);

    // Check tap targets
    const smallTapTargets = await page.evaluate(() => {
      const interactive = Array.from(document.querySelectorAll("button, a, input, select"));
      const tooSmall = [];
      for (const el of interactive) {
        if (el.classList.contains("sr-only") || el.getAttribute("href") === "#main-content") continue;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") {
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

    // Check horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    // Check canvas presence
    const canvasCount = await page.locator("canvas").count();

    console.log(`  - Viewport: ${vp.name}`);
    console.log(`  - Canvas count: ${canvasCount}`);
    console.log(`  - Horizontal overflow: ${hasHorizontalOverflow}`);
    console.log(`  - Small tap targets: ${smallTapTargets.length}`);
    console.log(`  - Console errors: ${consoleErrors.length}`);

    results.push({
      vp: vp.name,
      canvasCount,
      hasHorizontalOverflow,
      smallTapTargets,
      consoleErrors,
    });

    await context.close();
  }

  await browser.close();
  return results;
}

// CLI direct run
if (process.argv[2]) {
  const section = process.argv[2];
  const selector = process.argv[3] || null;
  testSection(section, selector).then((res) => {
    const hasFailures = res.some(
      (r) => r.canvasCount !== 1 || r.hasHorizontalOverflow || r.smallTapTargets.length > 0 || r.consoleErrors.length > 0
    );
    if (hasFailures) {
      console.error("[FAIL] QA assertions failed on one or more viewports");
      process.exit(1);
    } else {
      console.log(`[SUCCESS] All viewports passed for ${section}!`);
      process.exit(0);
    }
  });
}
