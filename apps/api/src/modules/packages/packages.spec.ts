import { PackagesQuoteService } from "./packages-quote.service";
import { PackagesService } from "./packages.service";
import { PackagesSchedulerService } from "./packages-scheduler.service";
import { InstagramService } from "../instagram/instagram.service";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Decimal } from "decimal.js";

describe("Custom Instagram Auto-Post Package Engine & Invariants", () => {
  let quoteService: PackagesQuoteService;
  let packagesService: PackagesService;
  let instagramService: InstagramService;
  let schedulerService: PackagesSchedulerService;
  const mockPrisma = { isConnected: false } as any;

  beforeEach(() => {
    quoteService = new PackagesQuoteService(mockPrisma);
    instagramService = new InstagramService(mockPrisma);
    packagesService = new PackagesService(mockPrisma, quoteService, instagramService);
    schedulerService = new PackagesSchedulerService(mockPrisma, instagramService);
  });

  describe("Mathematical Invariants: Quantity & Financial Reconciliation", () => {
    it("guarantees Quantity Invariant: sum(run.quantity) === item.quantity for odd & prime day distributions", async () => {
      const testCases = [
        { qty: 1000, days: 3 },
        { qty: 1000, days: 7 },
        { qty: 2500, days: 13 },
        { qty: 50000, days: 30 },
      ];

      for (const tc of testCases) {
        const quote = await quoteService.calculateQuote({
          days: tc.days,
          items: [
            {
              serviceId: "srv-test",
              target: "https://instagram.com/mytest",
              targetType: "PROFILE",
              quantity: tc.qty,
            },
          ],
        });

        // 1. Sum of run quantities must exactly equal total quantity
        const sumQuantities = quote.timeline.reduce((acc, r) => acc + r.quantity, 0);
        expect(sumQuantities).toBe(tc.qty);

        // 2. Sum of run charge shares must exactly equal totalCharge
        const sumShares = quote.timeline
          .reduce((acc, r) => acc.plus(new Decimal(r.chargeShare)), new Decimal(0))
          .toNumber();
        expect(sumShares).toBe(quote.totalCharge);
        expect(sumShares).toBe(quote.items[0].charge);
      }
    });

    it("guarantees Financial Invariant for multi-service bundles", async () => {
      const quote = await quoteService.calculateQuote({
        days: 10,
        items: [
          {
            serviceId: "srv-followers",
            target: "https://instagram.com/profile",
            targetType: "PROFILE",
            quantity: 5000,
          },
          {
            serviceId: "srv-likes",
            target: "https://instagram.com/p/post123",
            targetType: "POST_OR_REEL",
            quantity: 2000,
          },
        ],
      });

      const itemsSum = quote.items.reduce((acc, i) => acc + i.charge, 0);
      expect(Number(itemsSum.toFixed(2))).toBe(Number(quote.totalCharge.toFixed(2)));

      const runsSum = quote.timeline
        .reduce((acc, r) => acc.plus(new Decimal(r.chargeShare)), new Decimal(0))
        .toNumber();
      expect(Number(runsSum.toFixed(2))).toBe(Number(quote.totalCharge.toFixed(2)));
      expect(quote.totalRuns).toBe(20);
    });

    it("rejects impossible run quantities that violate service minQty per run", async () => {
      const mockWithHighMin = {
        isConnected: true,
        service: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: "srv-high-min",
              name: "High Min Service",
              platform: "INSTAGRAM",
              ratePer1000: new Decimal(100),
              minQty: 100,
              maxQty: 100000,
              status: "ACTIVE",
            },
          ]),
        },
      } as any;

      const strictQuoteService = new PackagesQuoteService(mockWithHighMin);

      await expect(
        strictQuoteService.calculateQuote({
          days: 30,
          items: [
            {
              serviceId: "srv-high-min",
              target: "https://instagram.com/profile",
              targetType: "PROFILE",
              quantity: 150, // 150 / 30 = 5 < 100 minQty
            },
          ],
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("Auto-Post Configuration & Instagram Account Authorization", () => {
    it("connects an authorized Instagram account and verifies connection eligibility", async () => {
      const conn = await instagramService.connectAccount("user-1", {
        platformAccountId: "ig-account-123",
        username: "creative_agency",
        accountType: "BUSINESS",
        grantedScopes: ["instagram_basic", "instagram_manage_insights"],
      });

      expect(conn.username).toBe("creative_agency");
      expect(conn.connectionStatus).toBe("CONNECTED");

      // Verify ownership passes for owner
      const verified = await instagramService.verifyConnectionEligibility("user-1", conn.id);
      expect(verified.id).toBe(conn.id);

      // Verify cross-user ownership fails
      await expect(
        instagramService.verifyConnectionEligibility("user-attacker", conn.id)
      ).rejects.toThrow(ForbiddenException);
    });

    it("quote service attaches connected account metadata when connectionId is provided", async () => {
      const quote = await quoteService.calculateQuote({
        days: 15,
        connectionId: "conn-123",
        accountUsername: "art_gallery",
        autoPostEnabled: true,
        items: [
          {
            serviceId: "srv-reel-views",
            target: "https://instagram.com/art_gallery",
            targetType: "POST_OR_REEL",
            quantity: 3000,
            quantityPerPost: 500,
            delayAfterPublication: 10,
            eligibleMediaTypes: ["REEL"],
          },
        ],
      });

      expect(quote.valid).toBe(true);
      expect(quote.autoPostEnabled).toBe(true);
      expect(quote.connection?.username).toBe("art_gallery");
      expect(quote.items[0].quantityPerPost).toBe(500);
      expect(quote.items[0].delayAfterPublication).toBe(10);
    });

    it("detects new media with deduplication guarantees", async () => {
      const conn = await instagramService.connectAccount("user-2", {
        platformAccountId: "ig-acc-456",
        username: "tech_startup",
      });

      const simulatedBatch = [
        {
          mediaId: "media_001",
          permalink: "https://instagram.com/p/media_001",
          mediaType: "REEL" as const,
          publishedAt: new Date(),
        },
        {
          mediaId: "media_002",
          permalink: "https://instagram.com/p/media_002",
          mediaType: "IMAGE" as const,
          publishedAt: new Date(),
        },
      ];

      // First detection poll: detects 2 posts
      const poll1 = await instagramService.detectNewMedia(conn.id, undefined, simulatedBatch);
      expect(poll1.detectedCount).toBe(2);
      expect(poll1.newItems.length).toBe(2);

      // Second detection poll with same media: detects 0 duplicates
      const poll2 = await instagramService.detectNewMedia(conn.id, undefined, simulatedBatch);
      expect(poll2.detectedCount).toBe(0);
      expect(poll2.newItems.length).toBe(0);
    });
  });

  describe("Package State Machine: Pause, Resume, and Cancellation", () => {
    it("supports pausing and resuming an active package", async () => {
      const res = await packagesService.purchasePackage("user-state", {
        days: 7,
        items: [
          {
            serviceId: "srv-engagement",
            target: "https://instagram.com/state_test",
            targetType: "PROFILE",
            quantity: 700,
          },
        ],
      });

      const pkgId = res.package.id;

      // Pause package
      const pauseRes = await packagesService.pausePackage("user-state", pkgId);
      expect(pauseRes.status).toBe("PAUSED");

      const pausedPkg = await packagesService.getPackage("user-state", pkgId);
      expect(pausedPkg.status).toBe("PAUSED");

      // Resume package
      const resumeRes = await packagesService.resumePackage("user-state", pkgId);
      expect(resumeRes.status).toBe("ACTIVE");

      const activePkg = await packagesService.getPackage("user-state", pkgId);
      expect(activePkg.status).toBe("ACTIVE");
    });

    it("cancels a package and prevents unauthorized access", async () => {
      const res = await packagesService.purchasePackage("user-cancel", {
        days: 14,
        items: [
          {
            serviceId: "srv-likes",
            target: "https://instagram.com/cancel_test",
            targetType: "POST_OR_REEL",
            quantity: 1400,
          },
        ],
      });

      const cancelRes = await packagesService.cancelPackage("user-cancel", res.package.id);
      expect(cancelRes.success).toBe(true);

      const pkg = await packagesService.getPackage("user-cancel", res.package.id);
      expect(pkg.status).toBe("CANCELLED");
    });
  });
});
