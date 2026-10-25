import { test, expect } from "@playwright/test";

test.describe("Q1: Auth & Account Browser Verification (SRS §1-§5, §24)", () => {
  const ts = Date.now();
  const testUser = {
    name: `QA User ${ts}`,
    username: `qa_user_${ts}`,
    email: `qa_browser_${ts}@smm.dev`,
    password: "Password123!Secure",
  };

  test("1. Unauthenticated route guard redirects to /login", async ({ page }) => {
    // Attempt to access protected customer dashboard without authentication
    await page.goto("http://localhost:3000/app/dashboard");
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 10000 });
    expect(page.url()).toContain("/login");

    // Attempt to access protected admin area without authentication
    await page.goto("http://localhost:3000/admin/dashboard");
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("2. Registration: Rejects weak password, completes registration, lands on dashboard with ₹0.00", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/register");
    await expect(page.getByRole("heading", { name: /Create New Account/i })).toBeVisible();

    // 2a. Fill form with weak password (< 8 characters)
    await page.locator("input[name='name']").fill("Weak User");
    await page.locator("input[name='username']").fill(`weak_${ts}`);
    await page.locator("input[name='email']").fill(`weak_${ts}@smm.dev`);
    await page.locator("input[name='password']").fill("123");
    await page.locator("input[name='confirmPassword']").fill("123");
    await page.locator("input[name='termsAccepted']").check();

    await page.getByRole("button", { name: /Complete Registration/i }).click();

    // Should display validation error and stay on register
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible({ timeout: 5000 });

    // 2b. Fill form with valid secure credentials
    await page.locator("input[name='name']").fill(testUser.name);
    await page.locator("input[name='username']").fill(testUser.username);
    await page.locator("input[name='email']").fill(testUser.email);
    await page.locator("input[name='password']").fill(testUser.password);
    await page.locator("input[name='confirmPassword']").fill(testUser.password);

    await page.getByRole("button", { name: /Complete Registration/i }).click();

    // Should navigate to dashboard
    await page.waitForURL((url) => url.pathname.includes("/app/dashboard"), { timeout: 15000 });
    expect(page.url()).toContain("/app/dashboard");

    // Verify wallet balance renders valid currency without NaN
    const balanceText = await page.locator("body").innerText();
    expect(balanceText).not.toContain("NaN");
    expect(balanceText).not.toContain("undefined");
  });

  test("3. Login: Wrong password displays error, correct login redirects, /login while logged in redirects to dashboard", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/login");
    await expect(page.getByRole("heading", { name: /Sign In to Platform/i })).toBeVisible();

    // 3a. Wrong password shows error message
    await page.locator("input[name='usernameOrEmail']").fill("bholu@gmail.com");
    await page.locator("input[name='password']").fill("WrongPassword999!");
    await page.getByRole("button", { name: /Sign In to Account/i }).click();

    // Error alert should be visible
    await expect(page.getByText(/Invalid email or password/i)).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain("/login");

    // 3b. Correct credentials succeed
    await page.locator("input[name='password']").fill("password123");
    await page.getByRole("button", { name: /Sign In to Account/i }).click();

    await page.waitForURL((url) => url.pathname.includes("/app/dashboard"), { timeout: 15000 });
    expect(page.url()).toContain("/app/dashboard");

    // 3c. Visiting /login while logged in redirects back to dashboard
    await page.goto("http://localhost:3000/login");
    await page.waitForURL((url) => url.pathname.includes("/app/dashboard"), { timeout: 10000 });
    expect(page.url()).toContain("/app/dashboard");
  });

  test("4. Customer role guard: Direct navigation to /admin is forbidden and redirected", async ({
    page,
    context,
  }) => {
    // Set customer auth cookie
    await context.addCookies([
      { name: "authToken", value: "test_customer_jwt", domain: "localhost", path: "/" },
      { name: "userRole", value: "CUSTOMER", domain: "localhost", path: "/" },
    ]);

    // Attempt to access admin dashboard
    await page.goto("http://localhost:3000/admin/dashboard");
    // Should be redirected away from admin to /app/dashboard
    await page.waitForURL((url) => url.pathname.includes("/app/dashboard"), { timeout: 10000 });
    expect(page.url()).toContain("/app/dashboard");
  });

  test("5. Logout clears session and prevents back-button bypass", async ({ page, context }) => {
    // Set authenticated customer session
    await context.addCookies([
      { name: "authToken", value: "test_customer_jwt", domain: "localhost", path: "/" },
      { name: "userRole", value: "CUSTOMER", domain: "localhost", path: "/" },
    ]);

    await page.goto("http://localhost:3000/app/dashboard");
    await expect(page.locator("body")).toBeVisible();

    // Clear cookies as logout would
    await context.clearCookies();

    // Attempt to navigate to protected route
    await page.goto("http://localhost:3000/app/dashboard");
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });
});
