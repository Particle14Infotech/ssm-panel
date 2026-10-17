import { test, expect } from "@playwright/test";

test.describe("Phase 0 - Animation Diagnostics", () => {
  test("Diagnose animation state with reducedMotion: no-preference", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "no-preference",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    const consoleLogs: string[] = [];
    page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // Check system preference evaluation
    const prefersReduced = await page.evaluate(() => {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    });

    // Check initial styles of elements before scrolling
    const heroH1Opacity = await page.$eval("h1", (el) => window.getComputedStyle(el).opacity);
    
    // Check how it works step cards before scroll
    const stepCards = await page.$$eval("[data-reveal]", (els) => {
      return els.map((el) => {
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          opacity: style.opacity,
          transform: style.transform,
          hasInlineStyle: el.getAttribute("style"),
        };
      });
    });

    // Scroll down to middle
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(600);

    const stepCardsAfterScroll = await page.$$eval("[data-reveal]", (els) => {
      return els.map((el) => {
        const style = window.getComputedStyle(el);
        return {
          opacity: style.opacity,
          transform: style.transform,
          hasInlineStyle: el.getAttribute("style"),
        };
      });
    });

    console.log("=== NO-PREFERENCE DIAGNOSTIC RESULT ===");
    console.log("prefersReduced:", prefersReduced);
    console.log("heroH1Opacity:", heroH1Opacity);
    console.log("data-reveal count:", stepCards.length);
    console.log("data-reveal initial sample:", stepCards.slice(0, 3));
    console.log("data-reveal after scroll sample:", stepCardsAfterScroll.slice(0, 3));
    console.log("console logs count:", consoleLogs.length);
    consoleLogs.forEach((l) => console.log(l));

    await context.close();
  });

  test("Diagnose animation state with reducedMotion: reduce", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    const prefersReduced = await page.evaluate(() => {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    });

    const stepCards = await page.$$eval("[data-reveal]", (els) => {
      return els.map((el) => {
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          opacity: style.opacity,
          transform: style.transform,
          inlineStyle: el.getAttribute("style"),
        };
      });
    });

    console.log("=== REDUCE DIAGNOSTIC RESULT ===");
    console.log("prefersReduced:", prefersReduced);
    console.log("data-reveal count:", stepCards.length);
    console.log("data-reveal sample (reduce):", stepCards.slice(0, 3));

    await context.close();
  });
});
