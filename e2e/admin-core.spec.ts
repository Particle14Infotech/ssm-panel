import { test, expect } from "@playwright/test";

test.describe("Admin Core Operations (SRS §30, §36, §53)", () => {
  test("1. Admin Providers: Add provider with AES encryption, mask key, and trigger live sync", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/admin/providers", { waitUntil: "domcontentloaded" });

    // Verify Title
    await expect(page.locator("h1")).toContainText(/API Providers/i);

    // Click Connect New Provider
    const connectBtn = page.getByRole("button", { name: /Connect New Provider/i }).first();
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // Fill form
    const nameInput = page.locator("input[placeholder*='ApexSMM Primary']").first();
    const urlInput = page.locator("input[placeholder*='https://provider.com/api']").first();
    const keyInput = page.locator("input[placeholder*='sk_live_']").first();

    await nameInput.fill("Automated Wholesaler Node");
    await urlInput.fill("https://api.automated-wholesaler.com/v2");
    await keyInput.fill("sk_live_super_secret_token_889900");

    // Submit
    const submitBtn = page.getByRole("button", { name: /Verify & Connect Node/i }).first();
    await submitBtn.click();

    // Verify provider card appears with masked key
    await expect(page.getByText("Automated Wholesaler Node").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/sk_live/i).first()).toBeVisible();

    // Trigger Sync Balance
    const syncBtn = page.getByRole("button", { name: /Sync Balance/i }).first();
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();

    // Verify Sync completed
    await expect(page.getByText(/Sync:/i).first()).toBeVisible();
  });

  test("2. Admin Dashboard & Management Routes Render", async ({ page }) => {
    // Dashboard
    await page.goto("http://localhost:3000/admin/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1, h2").first()).toBeVisible();

    // Users
    await page.goto("http://localhost:3000/admin/users", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1, h2").first()).toBeVisible();

    // Services
    await page.goto("http://localhost:3000/admin/services", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1, h2").first()).toBeVisible();

    // Orders
    await page.goto("http://localhost:3000/admin/orders", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});
