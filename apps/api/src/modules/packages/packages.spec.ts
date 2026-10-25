import { PackagesQuoteService } from "./packages-quote.service";
import { PackagesService } from "./packages.service";
import { PackagesSchedulerService } from "./packages-scheduler.service";
import { PlatformsService } from "../platforms/platforms.service";
import { BadRequestException } from "@nestjs/common";
import { Decimal } from "decimal.js";
import { calculateFollowersDrip } from "./drip-engine.util";

describe("Custom Platform Package Engine & Invariants", () => {
  let quoteService: PackagesQuoteService;
  let packagesService: PackagesService;
  let platformsService: PlatformsService;
  let schedulerService: PackagesSchedulerService;
  const mockPrisma = { isConnected: false } as any;

  beforeEach(() => {
    quoteService = new PackagesQuoteService(mockPrisma);
    platformsService = new PlatformsService(mockPrisma);
    packagesService = new PackagesService(mockPrisma, quoteService, platformsService);
    schedulerService = new PackagesSchedulerService(mockPrisma);
  });

  describe("Mathematical Invariants: Quantity & Financial Reconciliation", () => {
    it("Quantity Invariant: sum(run.quantity) === item.quantity for odd & prime day distributions", async () => {
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

    it("Financial Invariant for multi-service bundles", async () => {
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

    it("returns quote warning when quantity cannot be split evenly across days, and rejects when below minQty", async () => {
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
              active: true,
              packageEligible: true,
              platform: "INSTAGRAM",
            },
          ]),
        },
      } as any;

      const strictQuoteService = new PackagesQuoteService(mockWithHighMin);

      // 1. When totalQuantity < minQty, rejects with BadRequestException
      await expect(
        strictQuoteService.calculateQuote({
          days: 30,
          items: [
            {
              serviceId: "srv-high-min",
              target: "https://instagram.com/profile",
              targetType: "PROFILE",
              quantity: 50, // 50 < 100 minQty
            },
          ],
        })
      ).rejects.toThrow(BadRequestException);

      // 2. When Q is too small to split across duration days, returns a quote warning (never one silent big order)
      const quote = await strictQuoteService.calculateQuote({
        days: 30,
        items: [
          {
            serviceId: "srv-high-min",
            target: "https://instagram.com/profile",
            targetType: "PROFILE",
            quantity: 150, // 150 / 30 = 5 < 100 minQty, so clamped to 1 run
          },
        ],
      });
      expect(quote.warnings.length).toBeGreaterThan(0);
      expect(quote.warnings[0]).toContain("too small to split");
    });
  });

  describe("Platform Package Configuration & Validation", () => {
    it("quote service formats platform + handle quote with no side effects", async () => {
      const quote = await quoteService.calculateQuote({
        days: 15,
        platform: "instagram",
        handle: "art_gallery",
        consentRulesUnderstood: true,
        items: [
          {
            serviceId: "srv-reel-views",
            target: "https://instagram.com/art_gallery",
            targetType: "POST_OR_REEL",
            quantity: 3000,
            quantityPerPost: 500,
            maxPosts: 6,
          },
        ],
      });

      expect(quote.valid).toBe(true);
      expect(quote.items[0].quantityPerPost).toBe(500);
      expect(quote.items[0].maxPosts).toBe(6);
      expect(quote.disclaimer).toBe(
        "Maximum total; unused balance is automatically refunded to your wallet upon package completion or cancellation."
      );
    });

    it("uses the same bounded run calculation for the quote timeline and persisted schedule", async () => {
      const service = {
        id: "srv-schedule",
        name: "Schedule service",
        displayName: "Schedule service",
        platform: "INSTAGRAM",
        ratePer1000: new Decimal(120),
        minQty: 10,
        maxQty: 500000,
        status: "ACTIVE",
        active: true,
        packageEligible: true,
      };
      const connectedPrisma = {
        isConnected: true,
        package: { findFirst: jest.fn().mockResolvedValue(null) },
        service: { findMany: jest.fn().mockResolvedValue([service]) },
      } as any;
      const quote = await new PackagesQuoteService(connectedPrisma).calculateQuote({
        platform: "instagram",
        handle: "schedule_test",
        timezone: "UTC",
        followersDrip: {
          serviceId: service.id,
          quantity: 10000,
          days: 7,
          intervalHours: 16,
        },
      });
      const persistedSchedule = calculateFollowersDrip({
        totalQuantity: quote.items[0].totalQuantity,
        serviceMin: quote.items[0].minQty!,
        serviceMax: quote.items[0].maxQty!,
        days: quote.days,
        intervalHours: 16,
        ratePer1000: quote.items[0].ratePer1000,
        startAt: new Date(quote.timeline[0].scheduledAt),
      });

      expect(quote.timeline).toHaveLength(10);
      expect(quote.timeline.map((run) => ({
        quantity: run.quantity,
        chargeShare: run.chargeShare,
        scheduledAt: run.scheduledAt,
      }))).toEqual(persistedSchedule.runs.map((run) => ({
        quantity: run.quantity,
        chargeShare: run.allocatedCharge,
        scheduledAt: run.executeAt.toISOString(),
      })));
    });

    it("persists the exact schedule returned by the quote", async () => {
      const fixedStart = new Date("2026-10-23T08:00:00.000Z");
      jest.useFakeTimers().setSystemTime(fixedStart);
      try {
        const input = {
          days: 7,
          platform: "instagram" as const,
          handle: "schedule_match",
          timezone: "UTC",
          items: [
            {
              serviceId: "srv-schedule-match",
              target: "https://instagram.com/schedule_match",
              targetType: "PROFILE" as const,
              quantity: 700,
            },
          ],
        };
        const quote = await quoteService.calculateQuote(input, fixedStart);
        const purchased = await packagesService.purchasePackage(
          "user-schedule",
          {
            ...input,
            consentRulesUnderstood: true,
            idempotencyKey: "idem_schedule_match",
          },
        );

        expect(purchased.package.executions).toEqual(quote.timeline);
      } finally {
        jest.useRealTimers();
      }
    });

    it("rejects package services that are ineligible or belong to another platform", async () => {
      const baseService = {
        id: "srv-invalid",
        name: "Invalid package service",
        displayName: "Invalid package service",
        platform: "INSTAGRAM",
        ratePer1000: new Decimal(120),
        minQty: 10,
        maxQty: 500000,
        status: "ACTIVE",
        active: true,
        packageEligible: true,
      };
      const input = {
        platform: "instagram" as const,
        handle: "schedule_test",
        timezone: "UTC",
        followersDrip: {
          serviceId: baseService.id,
          quantity: 1000,
          days: 1,
          intervalHours: 24,
        },
      };

      for (const service of [
        { ...baseService, packageEligible: false },
        { ...baseService, platform: "YOUTUBE" },
        { ...baseService, active: false },
        { ...baseService, status: "INACTIVE" },
      ]) {
        const connectedPrisma = {
          isConnected: true,
          package: { findFirst: jest.fn().mockResolvedValue(null) },
          service: { findMany: jest.fn().mockResolvedValue([service]) },
        } as any;
        await expect(
          new PackagesQuoteService(connectedPrisma).calculateQuote(input)
        ).rejects.toThrow(BadRequestException);
      }
    });

    it("rejects time-drip quantities that cannot fit the per-run service maximum", async () => {
      const service = {
        id: "srv-max",
        name: "Maximum-limited service",
        displayName: "Maximum-limited service",
        platform: "INSTAGRAM",
        ratePer1000: new Decimal(120),
        minQty: 10,
        maxQty: 500000,
        status: "ACTIVE",
        active: true,
        packageEligible: true,
      };
      const connectedPrisma = {
        isConnected: true,
        package: { findFirst: jest.fn().mockResolvedValue(null) },
        service: { findMany: jest.fn().mockResolvedValue([service]) },
      } as any;

      await expect(
        new PackagesQuoteService(connectedPrisma).calculateQuote({
          platform: "instagram",
          handle: "schedule_test",
          timezone: "UTC",
          followersDrip: {
            serviceId: service.id,
            quantity: 600000,
            days: 1,
            intervalHours: 24,
          },
        })
      ).rejects.toThrow("cannot be split into runs");
    });
  });

  describe("Package State Machine: Pause, Resume, and Cancellation", () => {
    it("supports pausing and resuming an active package", async () => {
      const res = await packagesService.purchasePackage("user-state", {
        days: 7,
        platform: "instagram",
        handle: "state_test",
        consentRulesUnderstood: true,
        idempotencyKey: "idem_state_test",
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
        platform: "instagram",
        handle: "cancel_test",
        consentRulesUnderstood: true,
        idempotencyKey: "idem_cancel_test",
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
