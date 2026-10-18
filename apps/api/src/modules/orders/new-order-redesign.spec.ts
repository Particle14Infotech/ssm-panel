import { cleanServiceName, validateServiceLink, calculateCustomerCharge } from "@smm/contracts";
import { OrdersService } from "./orders.service";
import { Decimal } from "decimal.js";
import { ConflictException, BadRequestException } from "@nestjs/common";

describe("New Order Redesign & Hygiene Unit Tests", () => {
  describe("1. Service Name Hygiene & Cleaning", () => {
    it("strips emojis, decorative symbols, and junk bracket spam while preserving meaningful tags", () => {
      const raw = "🔥 [Instagram] Followers ★ Best Quality ⚡ [30 days refill] [] 🚀";
      const { displayName, tags } = cleanServiceName(raw);

      expect(displayName).not.toMatch(/🔥|★|⚡|🚀/);
      expect(displayName).not.toContain("[]");
      expect(displayName).toContain("[30 days refill]");
      expect(tags).toContain("30 days refill");
      expect(tags).toContain("Instagram");
    });

    it("handles plain service names without changes", () => {
      const raw = "YouTube Video Views - High Retention";
      const { displayName, tags } = cleanServiceName(raw);
      expect(displayName).toBe("YouTube Video Views - High Retention");
      expect(tags.length).toBe(0);
    });
  });

  describe("2. Inline Format Validation per Platform and Link Type", () => {
    it("accepts Instagram profile link when PROFILE is expected", () => {
      const res = validateServiceLink("https://instagram.com/therock", "INSTAGRAM", "PROFILE");
      expect(res.isValid).toBe(true);
      expect(res.detectedType).toBe("PROFILE");
    });

    it("rejects Instagram post link with clear error when PROFILE is expected", () => {
      const res = validateServiceLink("https://instagram.com/p/C0xyz123", "INSTAGRAM", "PROFILE");
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("This service needs a profile link, not a post link.");
      expect(res.detectedType).toBe("POST_OR_REEL");
    });

    it("accepts Instagram reel link when POST_OR_REEL is expected", () => {
      const res = validateServiceLink("https://www.instagram.com/reel/C0xyz123/?utm_source=ig", "INSTAGRAM", "POST_OR_REEL");
      expect(res.isValid).toBe(true);
      expect(res.detectedType).toBe("POST_OR_REEL");
    });

    it("rejects Instagram profile link with clear error when POST_OR_REEL is expected", () => {
      const res = validateServiceLink("https://instagram.com/therock", "INSTAGRAM", "POST_OR_REEL");
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("This service needs a post or reel link, not a profile link.");
      expect(res.detectedType).toBe("PROFILE");
    });

    it("rejects YouTube video link when CHANNEL is expected", () => {
      const res = validateServiceLink("https://youtube.com/watch?v=dQw4w9WgXcQ", "YOUTUBE", "CHANNEL");
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("This service needs a channel link, not a video link.");
    });

    it("accepts YouTube channel link when CHANNEL is expected", () => {
      const res = validateServiceLink("https://youtube.com/@mkbhd", "YOUTUBE", "CHANNEL");
      expect(res.isValid).toBe(true);
      expect(res.detectedType).toBe("CHANNEL");
    });

    it("rejects X status link when PROFILE is expected", () => {
      const res = validateServiceLink("https://x.com/elonmusk/status/123456789", "X", "PROFILE");
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("This service needs a profile link, not a post link.");
    });
  });

  describe("3. Financial Snapshot & Customer Sanitization (No Cost Leakage)", () => {
    let ordersService: OrdersService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        isConnected: false,
      };
      ordersService = new OrdersService(mockPrisma, { debitForOrder: jest.fn().mockResolvedValue({}) } as any);
    });

    it("strips profit and cost fields completely for CUSTOMER role", () => {
      const orderWithFinancials = {
        id: "ord-1",
        userId: "usr-1",
        charge: 50.0,
        costRatePer1k: 20.0,
        fxRateUsed: 84.5,
        providerCurrency: "USD",
        estimatedProviderCost: 15.0,
        estimatedGrossProfit: 35.0,
        paymentFeeEstimate: 1.18,
        estimatedNetProfit: 33.82,
        actualProviderCost: 14.5,
        actualProfit: 34.32,
        costUnknown: false,
        service: {
          id: "srv-1",
          name: "Instagram Likes",
          providerCostPer1k: 0.2,
          costINR: 16.9,
          marginPercentOverride: 50,
        },
      };

      const sanitized = (ordersService as any).sanitizeOrderForRole(orderWithFinancials, "CUSTOMER");
      expect(sanitized.charge).toBe(50.0);
      expect(sanitized.costRatePer1k).toBeUndefined();
      expect(sanitized.fxRateUsed).toBeUndefined();
      expect(sanitized.providerCurrency).toBeUndefined();
      expect(sanitized.estimatedProviderCost).toBeUndefined();
      expect(sanitized.estimatedGrossProfit).toBeUndefined();
      expect(sanitized.paymentFeeEstimate).toBeUndefined();
      expect(sanitized.estimatedNetProfit).toBeUndefined();
      expect(sanitized.actualProviderCost).toBeUndefined();
      expect(sanitized.actualProfit).toBeUndefined();
      expect(sanitized.costUnknown).toBeUndefined();
      expect(sanitized.service.costINR).toBeUndefined();
      expect(sanitized.service.providerCostPer1k).toBeUndefined();
    });

    it("preserves financial and cost fields for ADMIN role", () => {
      const orderWithFinancials = {
        id: "ord-1",
        userId: "usr-1",
        charge: 50.0,
        costRatePer1k: 20.0,
        estimatedGrossProfit: 35.0,
      };

      const adminView = (ordersService as any).sanitizeOrderForRole(orderWithFinancials, "ADMIN");
      expect(adminView.costRatePer1k).toBe(20.0);
      expect(adminView.estimatedGrossProfit).toBe(35.0);
    });
  });

  describe("4. Quote = Charge Verification", () => {
    let ordersService: OrdersService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        isConnected: true,
        service: {
          findUnique: jest.fn().mockResolvedValue({
            id: "srv-rate-1",
            name: "Test Service",
            status: "ACTIVE",
            ratePer1000: new Decimal(100.0), // current rate in DB is 100
            minQty: 10,
            maxQty: 10000,
            costINR: new Decimal(60.0),
          }),
        },
        order: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      ordersService = new OrdersService(mockPrisma, {} as any);
    });

    it("throws 409 Conflict when expectedRate does not match current DB rate", async () => {
      await expect(
        ordersService.create({
          userId: "usr-1",
          serviceId: "srv-rate-1",
          target: "https://instagram.com/test",
          quantity: 100,
          expectedRate: 90.0, // user saw 90, but DB is 100
        })
      ).rejects.toThrow(ConflictException);
    });

    it("proceeds when expectedRate matches current DB rate", async () => {
      // Mock wallet and db transaction
      mockPrisma.$transaction = jest.fn().mockImplementation(async (cb) => {
        return { id: "ord-new-1", charge: 10.0 };
      });

      const res = await ordersService.create({
        userId: "usr-1",
        serviceId: "srv-rate-1",
        target: "https://instagram.com/test",
        quantity: 100,
        expectedRate: 100.0,
      });

      expect(res).toBeDefined();
    });
  });
});
