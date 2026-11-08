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

const REAL_SERVICES = [
  {
    id: "srv_ig_likes",
    name: "Instagram Likes [High Speed Non-Drop]",
    displayName: "Instagram Likes - High Retention",
    platform: "INSTAGRAM",
    kind: "LIKES",
    ratePer1000: 45.0,
    minQty: 100,
    maxQty: 100000,
    status: "ACTIVE",
    categoryName: "Instagram Likes",
  },
  {
    id: "srv_ig_views",
    name: "Instagram Video / Reel Views [Instant Drip]",
    displayName: "Instagram Reel Views - High Retention",
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
    name: "Instagram Real Followers [Safe Pace]",
    displayName: "Instagram Followers - Organic Drip",
    platform: "INSTAGRAM",
    kind: "FOLLOWERS",
    ratePer1000: 120.0,
    minQty: 100,
    maxQty: 50000,
    status: "ACTIVE",
    categoryName: "Instagram Followers",
  },
  {
    id: "srv_ig_saves",
    name: "Instagram Post Saves & Impressions [Algorithm Booster]",
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
];

test.describe("Practical Real Verification of All 5 Overhaul Features", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([
      { name: "authToken", value: "jwt_bholu_test_token_12345", domain: "localhost", path: "/" },
      { name: "token", value: "jwt_bholu_test_token_12345", domain: "localhost", path: "/" },
      { name: "userRole", value: "CUSTOMER", domain: "localhost", path: "/" },
    ]);

    await page.route("**/api/v1/services", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(REAL_SERVICES),
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
          services: REAL_SERVICES,
          categories: [
            { id: "cat_likes", name: "Instagram Likes" },
            { id: "cat_views", name: "Instagram Views" },
            { id: "cat_followers", name: "Instagram Followers" },
            { id: "cat_saves", name: "Instagram Saves & Impressions" },
            { id: "cat_story", name: "Instagram Stories" },
          ],
        }),
      });
    });

    // Realistic quote response generator matching backend formula
    await page.route("**/api/v1/packages/custom-campaign/quote", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      const duration = body.durationDays || 7;
      let totalCharge = 0;
      const timeline: any[] = [];
      const items = (body.services || []).map((s: any) => {
        const found = REAL_SERVICES.find((rs) => rs.id === s.serviceId) || REAL_SERVICES[0];
        const cost = (found.ratePer1000 * s.quantity) / 1000;
        totalCharge += cost;
        return {
          serviceId: s.serviceId,
          serviceName: found.displayName,
          quantity: s.quantity,
          charge: cost,
          ratePer1000: found.ratePer1000,
        };
      });

      for (let day = 1; day <= duration; day++) {
        timeline.push({
          day,
          quantity: Math.round(500 + Math.sin(day) * 50),
          executeAt: new Date(Date.now() + day * 86400000).toISOString(),
        });
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          quoteHash: "qhash_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
          totalCharge,
          durationDays: duration,
          servicesCount: items.length,
          items,
          timeline,
          fitsDuration: true,
          warnings: [],
          finishesAt: new Date(Date.now() + duration * 86400000).toISOString(),
        }),
      });
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
  });

  test("Feature 1 & 2: Auto-Fetch by Link Pasting & Real Reel Thumbnail Preview", async ({ page }) => {
    // Intercept link-preview endpoint with realistic scraped metadata
    await page.route("**/api/v1/link-preview*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "INSTAGRAM",
          kind: "REEL",
          mediaId: "DfZF7ZShr8c",
          canonicalUrl: "https://www.instagram.com/reel/DfZF7ZShr8c/",
          title: "Viral Instagram Reel • High Engagement",
          authorName: "creative_artist",
          thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300",
          status: "OK",
          metrics: { views: "45.2K", likes: "3.8K", comments: "142" },
        }),
      });
    });

    await page.goto("http://localhost:3000/new-order?tab=custom_drip");
    await page.waitForLoadState("domcontentloaded");

    // 1. Paste link into Reel / Post input
    const reelInput = page.locator("input[placeholder*='instagram.com/reel']");
    await expect(reelInput).toBeVisible();
    await reelInput.fill("https://www.instagram.com/reel/DfZF7ZShr8c");

    // 2. Verify Auto-Fetch triggers and Scraped Thumbnail Card appears
    const previewTitle = page.locator("text=Viral Instagram Reel");
    await expect(previewTitle).toBeVisible({ timeout: 10000 });

    const previewAuthor = page.locator("text=creative_artist");
    await expect(previewAuthor).toBeVisible();

    // 3. Verify Thumbnail image element is rendered with non-empty src
    const thumbImg = page.locator("img[alt*='Viral Instagram Reel'], img[alt*='Link preview']").first();
    await expect(thumbImg).toBeVisible();

    // 4. Capture screenshot of Auto Fetch & Reel Thumbnail
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "feat_01_auto_fetch_scraping_and_thumbnail.png"),
      fullPage: false,
    });
  });

  test("Feature 3: Custom Services All List (Catalog, Search & Dynamic Add)", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?tab=custom_drip");
    await page.waitForLoadState("domcontentloaded");

    // 1. Click "+ Add Other Service" button
    const openCatalogBtn = page.locator("button:has-text('+ Add Other Service')");
    await expect(openCatalogBtn).toBeVisible();
    await openCatalogBtn.click();

    // 2. Verify all platform services are shown in catalog
    const catalogHeader = page.locator("text=All Platform Services (6 available)");
    await expect(catalogHeader).toBeVisible();

    // 3. Search for "Saves" in the catalog
    const searchInput = page.locator("input[placeholder*='saves, reach']");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Saves");

    // Verify filtered service
    const savesService = page.locator("text=Instagram Post Saves - High Retention");
    await expect(savesService).toBeVisible();

    // 4. Click "+ Add" on the Saves service (exact name)
    const addBtn = page.getByRole("button", { name: "+ Add", exact: true });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // 5. Verify service is dynamically added into "Added Custom Services (1)"
    const addedSection = page.locator("text=Added Custom Services (1)");
    await expect(addedSection).toBeVisible();

    // Verify quantity input & remove button on added service
    const qtyInput = page.locator("input[type='number']").first();
    await expect(qtyInput).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "feat_03_all_platform_services_catalog.png"),
      fullPage: false,
    });
  });

  test("Feature 4: Custom & Random Triggers (Followers, Likes, Views Pacing)", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?tab=custom_drip");
    await page.waitForLoadState("domcontentloaded");

    // 1. Verify "Smooth Intra-Day Drip & Random Safe Triggers" container
    const triggersHeader = page.locator("text=Smooth Intra-Day Drip & Random Safe Triggers");
    await expect(triggersHeader).toBeVisible();

    // 2. Verify both modes are present and switchable
    const organicBtn = page.locator("button:has-text('Organic Random (Safe)')");
    const uniformBtn = page.locator("button:has-text('Uniform Paced')");
    await expect(organicBtn).toBeVisible();
    await expect(uniformBtn).toBeVisible();

    // Click Uniform Paced
    await uniformBtn.click();
    await expect(page.locator("text=Uniform delivery distributes batches equally")).toBeVisible();

    // Click Organic Random (Safe)
    await organicBtn.click();
    await expect(page.locator("text=Organic random variance (±15% natural jitter)")).toBeVisible();

    // 3. Verify Followers, Likes, Views pacing indicators
    await expect(page.locator("text=Followers: Safe daily pacing")).toBeVisible();
    await expect(page.locator("text=Likes: Natural intra-day curve")).toBeVisible();
    await expect(page.locator("text=Views: High-retention drip")).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "feat_04_safe_random_triggers_intra_day.png"),
      fullPage: false,
    });
  });

  test("Feature 5: Number of Days Change Upto 60 Days (3d Chip, 60d Chip & Slider)", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?tab=custom_drip");
    await page.waitForLoadState("domcontentloaded");

    // 1. Verify and click 3d chip
    const threeDaysChip = page.locator("button:has-text('3d')").first();
    await expect(threeDaysChip).toBeVisible();
    await threeDaysChip.click();

    // Verify 3 Days Pacing badge
    await expect(page.locator("text=3 Days Pacing")).toBeVisible();

    // 2. Verify and click 60d chip
    const sixtyDaysChip = page.locator("button:has-text('60d')").first();
    await expect(sixtyDaysChip).toBeVisible();
    await sixtyDaysChip.click();

    // Verify 60 Days Pacing badge
    await expect(page.locator("text=60 Days Pacing")).toBeVisible();
    await expect(page.locator("text=60 Days (Max 60d)")).toBeVisible();

    // 3. Verify range slider has max 60 and interactive number box has 60
    const slider = page.locator("input[type='range'][max='60']");
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute("max", "60");

    const numberBox = page.locator("input[type='number'][max='60']");
    await expect(numberBox).toBeVisible();
    await expect(numberBox).toHaveValue("60");

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "feat_05_duration_upto_60_days.png"),
      fullPage: false,
    });
  });
});

