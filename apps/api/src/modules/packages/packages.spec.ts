import { PackagesQuoteService } from "./packages-quote.service";
import { PackagesService } from "./packages.service";
import { BadRequestException } from "@nestjs/common";
import { Decimal } from "decimal.js";

describe("Packages Engine & Invariants (Phase 2 & 3 Unit Tests)", () => {
  let quoteService: PackagesQuoteService;
  let packagesService: PackagesService;
  const mockPrisma = { isConnected: false } as any;

  beforeEach(() => {
    quoteService = new PackagesQuoteService(mockPrisma);
    packagesService = new PackagesService(mockPrisma, quoteService);
  });

  describe("Mathematical Invariants: Quantity & Financial Reconciliation", () => {
    it("guarantees Quantity Invariant: sum(run.quantity) === item.quantity for odd & prime day distributions", async () => {
      // Test cases with remainders: 1000 over 3 days, 1000 over 7 days, 2500 over 13 days
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

      // Sum of item charges must exactly equal total package charge
      const itemsSum = quote.items.reduce((acc, i) => acc + i.charge, 0);
      expect(Number(itemsSum.toFixed(2))).toBe(Number(quote.totalCharge.toFixed(2)));

      // Sum of all individual run charge shares must equal total package charge
      const runsSum = quote.timeline
        .reduce((acc, r) => acc.plus(new Decimal(r.chargeShare)), new Decimal(0))
        .toNumber();
      expect(Number(runsSum.toFixed(2))).toBe(Number(quote.totalCharge.toFixed(2)));

      // Timeline must have exactly days * items.length runs
      expect(quote.totalRuns).toBe(20);
    });

    it("rejects impossible run quantities that violate service minQty per run", async () => {
      // If service minQty is 100, requesting 150 items over 30 days means 5/day which violates minQty
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

  describe("Purchase and Cancellation Lifecycle", () => {
    it("creates a scheduled package with sandbox fallback", async () => {
      const res = await packagesService.purchasePackage("user-test", {
        days: 7,
        items: [
          {
            serviceId: "srv-growth",
            target: "https://instagram.com/growth",
            targetType: "PROFILE",
            quantity: 1400,
          },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.package.totalRuns).toBe(7);

      const list = await packagesService.listPackages("user-test");
      expect(list.length).toBe(1);
      expect(list[0].totalRuns).toBe(7);
    });
  });
});
