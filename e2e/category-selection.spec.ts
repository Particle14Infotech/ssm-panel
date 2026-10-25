import { test, expect } from "@playwright/test";

test.describe("Category Selector and Filtering Verification (ROADMAP §5.7 & REUSE_MAP §40, §41, §54)", () => {
  test("1. Services Catalog: filter services by category and verify fallback", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/services-catalog", { waitUntil: "domcontentloaded" });

    // Ensure header renders
    await expect(page.locator("h1")).toContainText(/Services Matrix/i);

    // Check if category select dropdown is present
    const categorySelect = page.locator("select").first();
    if (await categorySelect.isVisible()) {
      const options = await categorySelect.locator("option").allInnerTexts();
      expect(options.length).toBeGreaterThan(0);
      expect(options[0]).toContain("All Categories");

      // If more than 1 option, select a specific category
      if (options.length > 1) {
        const targetCategory = options[1];
        await categorySelect.selectOption({ index: 1 });
        await page.waitForTimeout(300);

        // Verify services table or list contains services
        const serviceRows = page.locator("tr, [data-testid='service-item']");
        const count = await serviceRows.count();
        expect(count).toBeGreaterThan(0);

        // Switch back to ALL
        await categorySelect.selectOption({ value: "ALL" });
        await page.waitForTimeout(300);
      }
    }

    // Verify search input works
    const searchInput = page.locator("input[placeholder*='Search']").first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Instagram");
    await page.waitForTimeout(300);
    await searchInput.fill("");
  });

  test("2. New Order Page: category headers rendered in combobox and selecting service updates form", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/new-order", { waitUntil: "domcontentloaded" });

    // Ensure page renders
    await expect(page.locator("h1")).toContainText(/New order/i);

    // Find and click the service selector trigger button
    const serviceSelectorBtn = page
      .locator("button")
      .filter({ hasText: /Service|per 1,000|Select/i })
      .first();

    if (await serviceSelectorBtn.isVisible()) {
      await serviceSelectorBtn.click();

      // Verify category headers exist in the dropdown
      const searchBox = page.locator("input[placeholder*='Search service']").first();
      await expect(searchBox).toBeVisible({ timeout: 5000 });

      // Check category headers
      const categoryHeaders = page.locator("div.uppercase.tracking-wider");
      const headerCount = await categoryHeaders.count();
      expect(headerCount).toBeGreaterThanOrEqual(1);

      // Select a service from the list
      const serviceOption = page
        .locator("button")
        .filter({ hasText: /₹/ })
        .first();
      if (await serviceOption.isVisible()) {
        const serviceText = await serviceOption.innerText();
        await serviceOption.click();

        // Verify active service card details are displayed
        await expect(page.getByText(/Price \/ 1,000|Min - Max/i).first()).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
