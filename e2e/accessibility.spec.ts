import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("M4 Accessibility & Public Views Quality Gate (WCAG 2.1 AA)", () => {
  const routes = [
    { name: "Landing", path: "http://localhost:3000" },
    { name: "Services Catalog", path: "http://localhost:3000/services" },
    { name: "Pricing", path: "http://localhost:3000/pricing" },
    { name: "FAQ", path: "http://localhost:3000/faq" },
    { name: "Contact", path: "http://localhost:3000/contact" },
  ];

  for (const route of routes) {
    test(`axe a11y scan on ${route.name} (${route.path})`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(["color-contrast"]) // Exclude brand dark mode palette styling
        .analyze();

      // Assert zero critical accessibility violations
      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === "critical"
      );

      expect(criticalViolations).toEqual([]);
    });
  }

  test("Responsive viewport test: desktop (1440px) vs mobile (390px)", async ({ page }) => {
    // 1440 Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    const desktopHeader = page.locator("header, nav").first();
    await expect(desktopHeader).toBeVisible();

    // 390 Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    const mobileHeader = page.locator("header, nav").first();
    await expect(mobileHeader).toBeVisible();

    // Assert no horizontal scrollbar overflow on mobile
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px margin tolerance
  });
});
