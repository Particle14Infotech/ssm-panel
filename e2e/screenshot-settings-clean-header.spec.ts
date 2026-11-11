import { test, expect } from "@playwright/test";
import path from "path";

const SCREENSHOTS_DIR = path.join(
  "C:",
  "Users",
  "vaibh",
  ".gemini",
  "antigravity",
  "brain",
  "efaf2b74-da3f-467a-81bd-9c6a0e1bfb6d",
  "test-screenshots"
);

test("Capture Settings Page with single clean theme toggle", async ({ page, context }) => {
  await context.addCookies([
    { name: "authToken", value: "jwt_bholu_test_token_12345", domain: "localhost", path: "/" },
    { name: "token", value: "jwt_bholu_test_token_12345", domain: "localhost", path: "/" },
    { name: "userRole", value: "CUSTOMER", domain: "localhost", path: "/" },
  ]);

  await page.addInitScript(() => {
    localStorage.setItem("authToken", "jwt_bholu_test_token_12345");
    localStorage.setItem("token", "jwt_bholu_test_token_12345");
    localStorage.setItem(
      "authUser",
      JSON.stringify({
        id: "usr_test_demo",
        email: "bholu@gmail.com",
        name: "Bholu Customer",
        phone: "+91 98765 43210",
        role: "CUSTOMER",
        tier: "GOLD",
        balance: 99570.76,
      })
    );
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/settings");
  await page.waitForLoadState("domcontentloaded");

  // Verify only 1 theme toggle exists on the page
  const themeToggles = page.locator("button[aria-label*='switch theme']");
  await expect(themeToggles).toHaveCount(1);

  // Take screenshot
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "08_settings_single_clean_theme_toggle.png"),
    fullPage: false,
  });
});

