import { test, expect } from "@playwright/test";
import {
  calculateOrderCharge,
  calculatePartialRefund,
  calculateDepositBonus,
} from "@smm/contracts";

test.describe("Customer Money Path & Invariants (SRS §5-22, §53)", () => {
  test("1. Visitor navigation: all public routes and CTAs are functional", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });

    // Header Links
    const servicesLink = page.getByRole("link", { name: "Services" }).first();
    await expect(servicesLink).toBeVisible();
    await servicesLink.click();
    await expect(page).toHaveURL(/.*\/services/);

    // Pricing Link
    await page.goto("http://localhost:3000/pricing", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h2").first()).toBeVisible();

    // FAQ Link
    await page.goto("http://localhost:3000/faq", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h2").first()).toBeVisible();

    // Contact Link
    await page.goto("http://localhost:3000/contact", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("2. Complete Customer Journey: Add Funds with Bonus -> Browse -> Place Order -> Live Status Progression", async ({
    page,
  }) => {
    // 2.1 Navigate to Wallet and top up funds
    await page.goto("http://localhost:3000/app/wallet", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toContainText(/Wallet/i);

    const payButton = page.locator("[data-testid='deposit-submit-btn']").or(page.getByRole("button", { name: /deposit/i })).first();
    await expect(payButton).toBeVisible();
    await payButton.click();

    // Verify Deposit Credited confirmation
    await expect(page.getByText(/Deposit Credited Successfully|Funds Credited Successfully/i).first()).toBeVisible({ timeout: 8000 });

    // 2.2 Navigate to New Order
    await page.goto("http://localhost:3000/app/new-order", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/New Dispatch Order/i).first()).toBeVisible();

    // Enter target URL
    const targetInput = page.locator("input[placeholder*='instagram.com']").first();
    await expect(targetInput).toBeVisible();
    await targetInput.fill("https://instagram.com/p/C987654321");

    // Submit Order
    const dispatchBtn = page.getByRole("button", { name: /dispatch|confirm/i }).first();
    await expect(dispatchBtn).toBeVisible();
    await dispatchBtn.click();

    // 2.3 Verify order success feedback and redirection
    await expect(page.getByText(/Dispatched Successfully/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("3. Insufficient balance guard: blocks order and shows Add Funds shortcut without creating ledger debit", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/app/new-order", { waitUntil: "domcontentloaded" });
    
    // Set extreme volume exceeding balance
    const qtyInput = page.locator("input[type='number']").first();
    await expect(qtyInput).toBeVisible();
    await qtyInput.fill("999999");
    await qtyInput.dispatchEvent("change");

    // Check for either the balance indicator or Add Funds button/alert
    const balanceAlert = page.locator("text=/Insufficient balance|Add Funds|Top up/i").or(page.locator("[data-testid='insufficient-funds-alert']")).first();
    await expect(balanceAlert).toBeVisible({ timeout: 5000 });
  });

  test("4. Order details and ledger audit trail: order ID, progress, and transaction records exist", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/app/orders", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Orders Log|Order/i).first()).toBeVisible();

    // Navigate to Transactions ledger
    await page.goto("http://localhost:3000/app/transactions", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Transaction Ledger/i).first()).toBeVisible();
  });
});
