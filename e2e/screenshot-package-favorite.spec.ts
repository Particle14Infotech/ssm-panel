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

test("Capture My Packages Save as Favorite Button and Action", async ({ page, context }) => {
  await context.addCookies([
    { name: "authToken", value: "jwt_bholu_test_token_12345", domain: "localhost", path: "/" },
    { name: "token", value: "jwt_bholu_test_token_12345", domain: "localhost", path: "/" },
    { name: "userRole", value: "CUSTOMER", domain: "localhost", path: "/" },
  ]);

  const mockUserPackage = {
    id: "pkg_user_template_77192",
    platform: "INSTAGRAM",
    handle: "particle14_",
    mode: "TEMPLATE",
    status: "ACTIVE",
    reserveTotal: 250.0,
    completedRuns: 12,
    totalRuns: 30,
    rules: [
      {
        id: "r1",
        serviceId: "srv_ig_likes",
        quantityPerPost: 500,
        service: { name: "Instagram Likes - Premium High Retention", displayName: "Instagram Likes - High Retention" },
      },
      {
        id: "r2",
        serviceId: "srv_ig_views",
        quantityPerPost: 1500,
        service: { name: "Instagram Video Views", displayName: "Instagram Video Views - Fast Drip" },
      },
    ],
    priceSnapshot: {
      totalCharge: 250.0,
      durationDays: 30,
      servicesCount: 2,
      preview: {
        thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200",
        title: "Instagram • particle14_",
      },
    },
    slots: [{ slotNumber: 1, targetUrl: "https://instagram.com/particle14_", status: "ACTIVE" }],
    createdAt: new Date().toISOString(),
  };

  await page.route("**/api/v1/packages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([mockUserPackage]),
    });
  });

  await page.route("**/api/v1/packages/bundle/templates", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/v1/favorites", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          favorite: { id: "fav_99", serviceId: "srv_ig_likes", customName: "Package: Instagram Likes" },
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await page.addInitScript(() => {
    localStorage.setItem("authToken", "jwt_bholu_test_token_12345");
    localStorage.setItem("token", "jwt_bholu_test_token_12345");
    localStorage.setItem(
      "authUser",
      JSON.stringify({
        id: "usr_test_demo",
        email: "bholu@gmail.com",
        name: "Bholu Customer",
        role: "CUSTOMER",
        tier: "GOLD",
        balance: 99570.76,
      })
    );
  });

  await page.goto("http://localhost:3000/packages");
  await page.waitForLoadState("domcontentloaded");

  // 1. Verify card is rendered
  await expect(page.locator("text=particle14_")).toBeVisible();

  // 2. Verify "Save as Favorite" button exists
  const favoriteBtn = page.locator("button[title='Save as Favorite']").first();
  await expect(favoriteBtn).toBeVisible();

  // 3. Click Favorite button
  await favoriteBtn.click();

  // 4. Verify Toast notification appears
  const toast = page.locator("text=Package saved to favorites!");
  await expect(toast).toBeVisible();

  // 5. Take high-res screenshot
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, "07_my_packages_favorite_button.png"),
    fullPage: true,
  });
});
