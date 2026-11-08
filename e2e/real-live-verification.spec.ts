import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOTS_DIR = path.resolve(
  "C:/Users/vaibh/.gemini/antigravity/brain/efaf2b74-da3f-467a-81bd-9c6a0e1bfb6d/test-screenshots"
);

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Realistic Platform Services for real testing
const MOCK_SERVICES = [
  {
    id: "srv_ig_likes",
    name: "Instagram Likes [High Quality] [Instant]",
    displayName: "Instagram Likes - Premium High Retention",
    platform: "INSTAGRAM",
    kind: "LIKES",
    ratePer1000: 45.0,
    minQty: 100,
    maxQty: 10000,
    status: "ACTIVE",
    categoryName: "Instagram Likes",
  },
  {
    id: "srv_ig_views",
    name: "Instagram Video / Reel Views [High Speed]",
    displayName: "Instagram Reel Views - Algorithmic Boost",
    platform: "INSTAGRAM",
    kind: "VIEWS",
    ratePer1000: 25.0,
    minQty: 100,
    maxQty: 50000,
    status: "ACTIVE",
    categoryName: "Instagram Views",
  },
  {
    id: "srv_ig_followers",
    name: "Instagram Real Followers [Non-Drop 30d]",
    displayName: "Instagram Followers - Safe Drip Delivery",
    platform: "INSTAGRAM",
    kind: "FOLLOWERS",
    ratePer1000: 120.0,
    minQty: 100,
    maxQty: 50000,
    status: "ACTIVE",
    categoryName: "Instagram Followers",
  },
  {
    id: "srv_ig_shares",
    name: "Instagram Post Shares & Reach",
    displayName: "Instagram Post Shares - Explore Page Booster",
    platform: "INSTAGRAM",
    kind: "SHARES",
    ratePer1000: 60.0,
    minQty: 100,
    maxQty: 20000,
    status: "ACTIVE",
    categoryName: "Instagram Reach & Shares",
  },
  {
    id: "srv_ig_comments",
    name: "Instagram Custom Comments [Random / Paced]",
    displayName: "Instagram Custom Comments - Verified Paced",
    platform: "INSTAGRAM",
    kind: "COMMENTS",
    ratePer1000: 350.0,
    minQty: 5,
    maxQty: 5000,
    status: "ACTIVE",
    categoryName: "Instagram Comments",
  },
  {
    id: "srv_ig_saves",
    name: "Instagram Post Saves & Bookmarks [Algorithm Booster]",
    displayName: "Instagram Post Saves - High Retention",
    platform: "INSTAGRAM",
    kind: "SAVES",
    ratePer1000: 35.0,
    minQty: 50,
    maxQty: 10000,
    status: "ACTIVE",
    categoryName: "Instagram Saves & Impressions",
  },
  {
    id: "srv_ig_story",
    name: "Instagram Story Views [All Stories]",
    displayName: "Instagram Story Views - Organic Pace",
    platform: "INSTAGRAM",
    kind: "STORY_VIEWS",
    ratePer1000: 20.0,
    minQty: 100,
    maxQty: 25000,
    status: "ACTIVE",
    categoryName: "Instagram Stories",
  },
];

const MOCK_CUSTOM_ORDER = {
  id: "pkg_drip_1794089901_a1b2",
  platform: "INSTAGRAM",
  handle: "https://instagram.com/reel/DfZF7ZShr8c",
  status: "ACTIVE",
  reserveTotal: 137.51,
  completedRuns: 5,
  totalRuns: 45,
  executions: Array.from({ length: 45 }, (_, i) => ({
    id: `exec_${i}`,
    seq: i + 1,
    status: i < 5 ? "COMPLETED" : "SCHEDULED",
  })),
  rules: [
    {
      id: "rule_1",
      serviceId: "srv_ig_likes",
      quantityPerPost: 500,
      service: MOCK_SERVICES[0],
    },
    {
      id: "rule_2",
      serviceId: "srv_ig_views",
      quantityPerPost: 1000,
      service: MOCK_SERVICES[1],
    },
  ],
  priceSnapshot: {
    totalCharge: 137.51,
    durationDays: 7,
    servicesCount: 2,
    preview: {
      thumbnailUrl: "/api/v1/link-preview/proxy-image?url=test-thumb",
      title: "Instagram Reel • DfZF7ZShr8c",
      isCarousel: false,
    },
  },
  slots: [
    {
      slotNumber: 1,
      targetUrl: "https://instagram.com/reel/DfZF7ZShr8c",
      status: "ACTIVE",
    },
  ],
  createdAt: new Date().toISOString(),
};

const MOCK_STANDARD_ORDER = {
  id: "ord_std_99812",
  userId: "usr_test_demo",
  serviceId: "srv_ig_likes",
  serviceName: "Instagram Likes - Premium High Retention",
  target: "https://instagram.com/p/C8xyz123",
  quantity: 2500,
  charge: 112.5,
  status: "PROCESSING",
  platform: "INSTAGRAM",
  createdAt: new Date().toISOString(),
};

const MOCK_USER_PACKAGE = {
  id: "pkg_user_template_555",
  platform: "INSTAGRAM",
  handle: "particle14_",
  status: "ACTIVE",
  reserveTotal: 499.0,
  mode: "TEMPLATE",
  rules: [
    {
      id: "rule_t1",
      serviceId: "srv_ig_followers",
      quantityPerPost: 3000,
      service: MOCK_SERVICES[2],
    },
  ],
  executions: [
    { id: "ex1", status: "COMPLETED" },
    { id: "ex2", status: "SCHEDULED" },
  ],
  createdAt: new Date().toISOString(),
};

test.describe("Real User Journey Verification Suite", () => {
  test.beforeEach(async ({ context, page }) => {
    // 1. Cookies for middleware
    await context.addCookies([
      {
        name: "authToken",
        value: "jwt_bholu_test_token_12345",
        domain: "localhost",
        path: "/",
      },
      {
        name: "token",
        value: "jwt_bholu_test_token_12345",
        domain: "localhost",
        path: "/",
      },
      {
        name: "userRole",
        value: "CUSTOMER",
        domain: "localhost",
        path: "/",
      },
    ]);

    // 2. Mock API routes with realistic business data
    await page.route("**/api/v1/services", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SERVICES),
      });
    });

    await page.route("**/api/v1/new-order/bootstrap*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          balance: 99570.76,
          enabledPlatforms: ["INSTAGRAM", "YOUTUBE", "TIKTOK", "TELEGRAM", "X"],
          durationChips: [1, 3, 5, 7, 10, 14, 21, 30, 45, 60],
          services: MOCK_SERVICES,
          categories: [
            { id: "cat_likes", name: "Instagram Likes" },
            { id: "cat_views", name: "Instagram Views" },
            { id: "cat_followers", name: "Instagram Followers" },
          ],
        }),
      });
    });

    await page.route("**/api/v1/packages", async (route) => {
      // Return both custom order and user package template
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_CUSTOM_ORDER, MOCK_USER_PACKAGE]),
      });
    });

    await page.route("**/api/v1/orders", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_STANDARD_ORDER]),
      });
    });

    await page.route("**/api/v1/wallet/balance", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ balance: 99570.76 }),
      });
    });

    await page.route("**/api/v1/link-preview*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "Instagram Reel • DfZF7ZShr8c",
          authorName: "test_creator",
          thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200",
          kind: "REEL",
        }),
      });
    });

    // 3. Set authUser in localStorage
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
  });

  test("Real Journey 1: New Order Link Reset & Form Clear", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?tab=custom_drip");
    await page.waitForLoadState("networkidle");

    // 1. Enter link in Quick Link Detection Bar
    const quickInput = page.locator("input[placeholder*='Paste profile or post link']");
    await quickInput.fill("https://instagram.com/reel/DfZF7ZShr8c");
    await expect(quickInput).toHaveValue("https://instagram.com/reel/DfZF7ZShr8c");

    // 2. Verify 'Reset Form' button is present and click it
    const resetFormBtn = page.locator("button:has-text('Reset Form')");
    await expect(resetFormBtn).toBeVisible();
    await resetFormBtn.click();
    await expect(quickInput).toHaveValue("");

    // 3. Type into Reel / Post input directly in Campaign Configuration
    const reelInput = page.locator("input[placeholder*='instagram.com/reel']");
    await reelInput.fill("https://instagram.com/reel/DfZF7ZShr8c");
    await expect(reelInput).toHaveValue("https://instagram.com/reel/DfZF7ZShr8c");

    // 4. Verify 'Reset Links' button appears in Campaign Configuration header
    const resetLinksBtn = page.locator("button:has-text('Reset Links')");
    await expect(resetLinksBtn).toBeVisible();
    await resetLinksBtn.click();
    await expect(reelInput).toHaveValue("");

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "01_link_reset_verified.png"),
      fullPage: true,
    });
  });

  test("Real Journey 2: Custom Package 3d Chip, 60d Cap & Range Slider", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?tab=custom_drip");
    await page.waitForLoadState("networkidle");

    // 1. Click 3d chip
    const threeDaysChip = page.locator("button:has-text('3d')").first();
    await expect(threeDaysChip).toBeVisible();
    await threeDaysChip.click();

    // Verify 3 Days Pacing badge is displayed
    const threeDaysBadge = page.locator("text=3 Days Pacing");
    await expect(threeDaysBadge).toBeVisible();

    // 2. Click 60d chip
    const sixtyDaysChip = page.locator("button:has-text('60d')").first();
    await expect(sixtyDaysChip).toBeVisible();
    await sixtyDaysChip.click();

    // Verify 60 Days Pacing badge is displayed
    const sixtyDaysBadge = page.locator("text=60 Days Pacing");
    await expect(sixtyDaysBadge).toBeVisible();

    // 3. Check slider has max 60
    const slider = page.locator("input[type='range'][max='60']");
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute("max", "60");

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "02_custom_package_duration_60d.png"),
      fullPage: true,
    });
  });

  test("Real Journey 3: All Platform Services Catalog & Dynamic Add", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?tab=custom_drip");
    await page.waitForLoadState("networkidle");

    // 1. Check "+ Add Other Service" button
    const addOtherBtn = page.locator("button:has-text('+ Add Other Service')");
    await expect(addOtherBtn).toBeVisible();
    await addOtherBtn.click();

    // 2. Search for 'Saves' in catalog
    const catalogSearchInput = page.locator("input[placeholder*='saves, reach']");
    await expect(catalogSearchInput).toBeVisible();
    await catalogSearchInput.fill("Saves");

    // 3. Click '+ Add' on the Saves service in the catalog (exact match to avoid matching '+ Add 5 Samples')
    const addSavesBtn = page.getByRole("button", { name: "+ Add", exact: true });
    await expect(addSavesBtn).toBeVisible();
    await addSavesBtn.click();

    // 4. Verify service card appears in Added Custom Services list
    const addedSection = page.locator("text=Added Custom Services (1)");
    await expect(addedSection).toBeVisible();

    // 5. Verify Smooth Intra-day Drip & Safe Random Triggers section
    const dripHeader = page.locator("text=Smooth Intra-Day Drip & Random Safe Triggers");
    await expect(dripHeader).toBeVisible();

    // Toggle between Organic Random and Uniform Paced
    const uniformBtn = page.locator("button:has-text('Uniform Paced')");
    await uniformBtn.click();
    const organicBtn = page.locator("button:has-text('Organic Random (Safe)')");
    await organicBtn.click();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "03_catalog_and_dynamic_service_added.png"),
      fullPage: true,
    });
  });

  test("Real Journey 4: Floating Liquid Glass Mobile Navigation & Wallet Balance", async ({ page }) => {
    // Set realistic mobile phone viewport (iPhone 14 / Samsung Galaxy standard)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:3000/dashboard");
    await page.waitForLoadState("networkidle");

    // 1. Verify floating capsule navigation bar
    const navBar = page.locator("nav.rounded-full");
    await expect(navBar).toBeVisible();

    // 2. Verify Wallet Balance under the Wallet icon
    const balanceText = page.locator("nav").locator("text=₹99,570");
    await expect(balanceText).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "04_liquid_glass_mobile_nav.png"),
      fullPage: false,
    });
  });

  test("Real Journey 5: Orders vs Packages Separation & Custom Order Actions", async ({ page }) => {
    // 1. Visit /orders
    await page.goto("http://localhost:3000/orders");
    await page.waitForLoadState("networkidle");

    // Check Order Type Switcher tabs
    const allTab = page.locator("button:has-text('All (')");
    const standardTab = page.locator("button:has-text('Standard (')");
    const customTab = page.locator("button:has-text('Custom Orders (')");

    await expect(allTab).toBeVisible();
    await expect(standardTab).toBeVisible();
    await expect(customTab).toBeVisible();

    // Click Custom Orders tab
    await customTab.click();

    // Verify Custom Order row/card shows "Custom Order" badge
    const customBadge = page.locator("text=Custom Order").first();
    await expect(customBadge).toBeVisible();

    // Verify "Save to My Packages" and "Save as Favorite" buttons are visible on the Custom Order (in desktop table)
    const saveToMyPackagesBtn = page.locator("table button:has-text('Save to My Packages')").first();
    await expect(saveToMyPackagesBtn).toBeVisible();

    const saveFavoriteBtn = page.locator("table button[title='Save as Favorite']").first();
    await expect(saveFavoriteBtn).toBeVisible();

    // 2. Visit /packages to verify one-off custom drip order is hidden
    await page.goto("http://localhost:3000/packages");
    await page.waitForLoadState("domcontentloaded");

    // pkg_drip_ should NOT be in My Packages; only user template should appear
    const customDripInPackages = page.locator("text=pkg_drip_1794089901_a1b2");
    await expect(customDripInPackages).toHaveCount(0);

    // Verify particle14_ (user package) is present
    const userPkgHandle = page.locator("text=particle14_");
    await expect(userPkgHandle).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "05_orders_and_packages_separation.png"),
      fullPage: true,
    });
  });

  test("Real Journey 6: Consolidated Wallet & Settings with Redirects", async ({ page }) => {
    // 1. Check /wallet tabs
    await page.goto("http://localhost:3000/wallet");
    await page.waitForLoadState("networkidle");
    const addFundsTab = page.locator("button:has-text('Add Funds')");
    const transTab = page.locator("button:has-text('Transactions & Invoices')");
    await expect(addFundsTab).toBeVisible();
    await expect(transTab).toBeVisible();
    await transTab.click();

    // 2. Test /transactions redirects to /wallet?tab=transactions
    await page.goto("http://localhost:3000/transactions");
    await page.waitForURL("**/wallet?tab=transactions");
    expect(page.url()).toContain("/wallet?tab=transactions");

    // 3. Check /settings tabs
    await page.goto("http://localhost:3000/settings");
    await page.waitForLoadState("networkidle");
    const profileTab = page.locator("button:has-text('Profile & Account')");
    const securityTab = page.locator("button:has-text('Security & Login')");
    const prefTab = page.locator("button:has-text('Preferences')");
    await expect(profileTab).toBeVisible();
    await expect(securityTab).toBeVisible();
    await expect(prefTab).toBeVisible();

    // 4. Test /profile redirects to /settings
    await page.goto("http://localhost:3000/profile");
    await page.waitForURL("**/settings");
    expect(page.url()).toContain("/settings");

    // 5. Verify Reseller API is NOT present
    const resellerLink = page.locator("a:has-text('Reseller API')");
    await expect(resellerLink).toHaveCount(0);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "06_consolidated_settings_and_wallet.png"),
      fullPage: true,
    });
  });
});

