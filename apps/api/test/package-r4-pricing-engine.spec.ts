import {
  quotePackagePrice,
  generateDeterministicDripSchedule,
  validatePackageTemplateForPublish,
  DEFAULT_PRICING_SETTINGS,
} from "../src/modules/packages/package-v2-pricing.util";
import {
  allocateFixedPriceLargestRemainder,
  checkMarginFloor,
} from "../src/modules/packages/package-combos-engine.util";
import { ConflictException, BadRequestException } from "@nestjs/common";

describe("R4: Package V2 Pure Pricing Engine & Schedule Invariants", () => {
  describe("1. Largest-Remainder Integer Allocation (Hamilton Method)", () => {
    it("R4-P1: allocates fixed price with exact paise conservation (Worked example from SPEC §5.3)", () => {
      // Worked example: P = 29,900 paise (₹299.00), v(views) = 15,000, v(likes) = 25,000, V = 40,000
      // Expected: views = 11,213 paise, likes = 18,687 paise, sum = 29,900 paise exactly
      const items = [
        { id: "1_views", weight: 15000 },
        { id: "2_likes", weight: 25000 },
      ];

      const res = allocateFixedPriceLargestRemainder(29900, items);

      expect(res).toHaveLength(2);
      expect(res[0].id).toBe("1_views");
      expect(res[0].allocatedPaise).toBe(11213);
      expect(res[1].id).toBe("2_likes");
      expect(res[1].allocatedPaise).toBe(18687);

      const sum = res.reduce((acc, r) => acc + r.allocatedPaise, 0);
      expect(sum).toBe(29900);
    });

    it("R4-P2: Property test - preserves exact sum across 1,000 arbitrary integer prices and weights", () => {
      for (let trial = 0; trial < 1000; trial++) {
        // Random price between 1 paise and 1,000,000 paise (₹0.01 to ₹10,000.00)
        const price = Math.floor(Math.random() * 1000000) + 1;
        const itemCount = Math.floor(Math.random() * 5) + 1; // 1 to 5 items

        const items = Array.from({ length: itemCount }, (_, i) => ({
          id: `item_${i}`,
          weight: Math.floor(Math.random() * 50000) + 1,
        }));

        const allocated = allocateFixedPriceLargestRemainder(price, items);
        const sum = allocated.reduce((acc, it) => acc + it.allocatedPaise, 0);

        expect(sum).toBe(price);
        allocated.forEach((a) => {
          expect(Number.isSafeInteger(a.allocatedPaise)).toBe(true);
          expect(a.allocatedPaise).toBeGreaterThanOrEqual(0);
        });
      }
    });

    it("R4-P3: breaks ties deterministically by ID ascending", () => {
      // 10 paise split equally between 3 items with identical weight
      // nominal share = 3.333333 paise each -> base 3 paise each (sum = 9).
      // 1 leftover paise goes to item with lowest ID (item_a)
      const items = [
        { id: "item_c", weight: 100 },
        { id: "item_a", weight: 100 },
        { id: "item_b", weight: 100 },
      ];

      const res = allocateFixedPriceLargestRemainder(10, items);

      const map = new Map(res.map((r) => [r.id, r.allocatedPaise]));
      expect(map.get("item_a")).toBe(4); // gets extra 1 paise
      expect(map.get("item_b")).toBe(3);
      expect(map.get("item_c")).toBe(3);

      expect(res.reduce((sum, r) => sum + r.allocatedPaise, 0)).toBe(10);
    });
  });

  describe("2. Margin Guard & Pricing Quote", () => {
    it("R4-P4: FIXED template price passes margin check when margin >= marginFloor (15%)", () => {
      const result = quotePackagePrice({
        mode: "TEMPLATE",
        tierFixedPricePaise: 99900, // ₹999.00
        durationDays: 7,
        items: [
          {
            id: "i1",
            serviceId: "srv_views",
            quantity: 50000,
            ratePer1000Paise: 1500, // catalog value 75,000 paise
            providerCostPer1000Paise: 600, // provider cost 30,000 paise
          },
          {
            id: "i2",
            serviceId: "srv_likes",
            quantity: 2000,
            ratePer1000Paise: 5000, // catalog value 10,000 paise
            providerCostPer1000Paise: 2000, // provider cost 4,000 paise
          },
        ],
      });

      // Total provider cost = 30,000 + 4,000 = 34,000 paise
      // Margin = (99,900 - 34,000) / 99,900 = 65.96% >= 15%
      expect(result.finalPricePaise).toBe(99900);
      expect(result.totalProviderCostPaise).toBe(34000);
      expect(result.marginPct).toBeGreaterThan(65);

      const sumAllocated = result.items.reduce((s, it) => s + it.allocatedPaise, 0);
      expect(sumAllocated).toBe(99900);
    });

    it("R4-P5: FIXED template price rejects with ConflictException when margin < marginFloor", () => {
      expect(() =>
        quotePackagePrice({
          mode: "TEMPLATE",
          tierFixedPricePaise: 20000, // ₹200.00
          durationDays: 7,
          items: [
            {
              id: "i1",
              serviceId: "srv_high_cost",
              quantity: 1000,
              ratePer1000Paise: 25000,
              providerCostPer1000Paise: 19000, // cost 19,000 paise -> margin = (20,000 - 19,000) / 20,000 = 5% < 15%
            },
          ],
        })
      ).toThrow(ConflictException);
    });

    it("R4-P6: CUSTOM mode clamps price to minPricePaise if discounts breach margin floor", () => {
      // Cost is 8500 paise, margin floor is 15%
      // Min price = ceil(8500 / 0.85) = 10000 paise
      const result = quotePackagePrice({
        mode: "CUSTOM",
        durationDays: 30, // 15% duration discount + 5% custom discount = 20% discount
        couponDiscountPaise: 5000, // big coupon
        items: [
          {
            id: "i1",
            serviceId: "srv_test",
            quantity: 1000,
            ratePer1000Paise: 11000, // catalog value 11,000 paise
            providerCostPer1000Paise: 8500, // provider cost 8,500 paise
          },
        ],
      });

      expect(result.finalPricePaise).toBeGreaterThanOrEqual(10000);
      expect(result.marginPct).toBeGreaterThanOrEqual(15);
    });
  });

  describe("3. Deterministic Drip Schedule Math (SPEC §5.8)", () => {
    it("R4-P7: profile-level drip (Followers): spreads remainder over first runs and charges sum exactly", () => {
      // Q = 600, 30 days, interval 1 day (24h), min 50 -> 12 runs of 50
      const schedule = generateDeterministicDripSchedule({
        role: "PROFILE_DRIP",
        totalQuantity: 600,
        serviceMinQty: 50,
        serviceMaxQty: 10000,
        totalAllocatedPaise: 24000, // ₹240.00
        durationDays: 30,
        intervalHours: 24,
      });

      expect(schedule).toHaveLength(12);

      // Quantities conservation
      const totalQty = schedule.reduce((sum, r) => sum + r.quantity, 0);
      expect(totalQty).toBe(600);

      // Charges conservation in integer paise
      const totalCharge = schedule.reduce((sum, r) => sum + r.allocatedChargePaise, 0);
      expect(totalCharge).toBe(24000);

      // Spacing is deterministic
      expect(schedule[0].executeOffsetMinutes).toBe(0);
      expect(schedule[1].executeOffsetMinutes).toBe(3600); // 60h gap
    });

    it("R4-P8: per-post drip (Likes/Views): clamps to maxRunsPerPost and satisfies minGap", () => {
      // q = 600, window 6h (360m), min 50, minGap 10m -> 12 runs of 50 every 30m
      const schedule = generateDeterministicDripSchedule({
        role: "PER_SLOT",
        totalQuantity: 600,
        serviceMinQty: 50,
        serviceMaxQty: 50000,
        totalAllocatedPaise: 12000,
        windowMinutes: 360,
        minGapMinutes: 10,
        maxRuns: 24,
      });

      expect(schedule).toHaveLength(12);
      expect(schedule[0].quantity).toBe(50);

      const totalQty = schedule.reduce((sum, r) => sum + r.quantity, 0);
      expect(totalQty).toBe(600);

      const totalCharge = schedule.reduce((sum, r) => sum + r.allocatedChargePaise, 0);
      expect(totalCharge).toBe(12000);

      // Check gap is 30 minutes
      expect(schedule[1].executeOffsetMinutes - schedule[0].executeOffsetMinutes).toBe(30);
    });
  });

  describe("4. Template Publish Validator", () => {
    it("R4-P9: validates publishable template with active, package-eligible services and acceptable margin", () => {
      const template = {
        status: "DRAFT",
        scope: "MULTI_POST",
        tiers: [
          {
            id: "tier_growth",
            version: 1,
            soldCount: 0,
            pricePaise: 99900,
            items: [
              {
                serviceId: "srv_1",
                quantity: 10000,
                service: {
                  status: "ACTIVE",
                  isDeleted: false,
                  packageEligible: true,
                  minQty: 100,
                  maxQty: 50000,
                  ratePer1000: 50,
                  providerCostPer1000: 20, // 10k * 20 = 200 INR cost = 20,000 paise vs 99,900 price (>>15% margin)
                },
              },
            ],
          },
        ],
      };

      const result = validatePackageTemplateForPublish(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("R4-P10: rejects template with inactive services or quantities exceeding maxQty", () => {
      const template = {
        status: "DRAFT",
        scope: "MULTI_POST",
        tiers: [
          {
            id: "tier_growth",
            version: 1,
            soldCount: 0,
            pricePaise: 99900,
            items: [
              {
                serviceId: "srv_inactive",
                quantity: 100000, // exceeds maxQty 50000
                service: {
                  status: "INACTIVE",
                  isDeleted: false,
                  packageEligible: true,
                  minQty: 100,
                  maxQty: 50000,
                  ratePer1000: 50,
                },
              },
            ],
          },
        ],
      };

      const result = validatePackageTemplateForPublish(template);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors.some((e) => e.includes("not active"))).toBe(true);
      expect(result.errors.some((e) => e.includes("outside bounds"))).toBe(true);
    });
  });
});
