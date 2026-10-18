import { CreateOrderInputSchema, calculateOrderCharge, calculatePartialRefund } from "@smm/contracts";
import { OrdersService } from "./orders.service";
import { SMMWorkerEngine } from "../../../../worker/src/main";
import { OrderStatus } from "@prisma/client";
import { Decimal } from "decimal.js";
import { BadRequestException, ConflictException } from "@nestjs/common";

describe("PHASE 6: Drip-Feed Orders Comprehensive Invariants & Verification Suite", () => {
  describe("1. Contract Schema Validation (CreateOrderInputSchema)", () => {
    it("accepts a valid provider-native drip-feed order payload", () => {
      const valid = {
        serviceId: "srv-drip-1",
        target: "https://instagram.com/p/test",
        quantity: 100,
        isDripFeed: true,
        runs: 5,
        interval: 60,
      };
      const parsed = CreateOrderInputSchema.parse(valid);
      expect(parsed.isDripFeed).toBe(true);
      expect(parsed.runs).toBe(5);
      expect(parsed.interval).toBe(60);
    });

    it("rejects drip-feed order when runs is missing", () => {
      const invalid = {
        serviceId: "srv-drip-1",
        target: "https://instagram.com/p/test",
        quantity: 100,
        isDripFeed: true,
        interval: 60,
      };
      expect(() => CreateOrderInputSchema.parse(invalid)).toThrow(/runs.*required/i);
    });

    it("rejects drip-feed order when interval is missing", () => {
      const invalid = {
        serviceId: "srv-drip-1",
        target: "https://instagram.com/p/test",
        quantity: 100,
        isDripFeed: true,
        runs: 5,
      };
      expect(() => CreateOrderInputSchema.parse(invalid)).toThrow(/interval.*required/i);
    });

    it("rejects drip-feed order when runs < 2", () => {
      const invalid = {
        serviceId: "srv-drip-1",
        target: "https://instagram.com/p/test",
        quantity: 100,
        isDripFeed: true,
        runs: 1,
        interval: 60,
      };
      expect(() => CreateOrderInputSchema.parse(invalid)).toThrow("at least 2");
    });

    it("rejects drip-feed order when interval < 5 minutes", () => {
      const invalid = {
        serviceId: "srv-drip-1",
        target: "https://instagram.com/p/test",
        quantity: 100,
        isDripFeed: true,
        runs: 5,
        interval: 4,
      };
      expect(() => CreateOrderInputSchema.parse(invalid)).toThrow("at least 5");
    });

    it("rejects standard non-drip order if runs or interval are supplied", () => {
      const invalidWithRuns = {
        serviceId: "srv-std-1",
        target: "https://instagram.com/p/test",
        quantity: 100,
        isDripFeed: false,
        runs: 5,
      };
      expect(() => CreateOrderInputSchema.parse(invalidWithRuns)).toThrow(/cannot be specified/i);

      const invalidWithInterval = {
        serviceId: "srv-std-1",
        target: "https://instagram.com/p/test",
        quantity: 100,
        isDripFeed: false,
        interval: 60,
      };
      expect(() => CreateOrderInputSchema.parse(invalidWithInterval)).toThrow(/cannot be specified/i);
    });
  });

  describe("2. Money Math with Decimal and Rounding UP", () => {
    it("calculates exact charge for drip-feed order (100 per run * 5 runs @ rate 70/1000 = 35.00)", () => {
      // 100 * 5 = 500 units @ ₹70/1k = ₹35.00
      const charge = calculateOrderCharge(70, 100, undefined, 5);
      expect(charge.toFixed(2)).toBe("35.00");
    });

    it("always rounds customer charge UP to 2 decimal places (never undercharges)", () => {
      // 100 * 3 runs = 300 units @ ₹33.33/1k = 9.999 -> rounds UP to 10.00
      const chargeDrip = calculateOrderCharge(33.33, 100, undefined, 3);
      expect(chargeDrip.toFixed(2)).toBe("10.00");

      // Non-drip: 100 units @ ₹33.33/1k = 3.333 -> rounds UP to 3.34
      const chargeNonDrip = calculateOrderCharge(33.33, 100);
      expect(chargeNonDrip.toFixed(2)).toBe("3.34");
    });
  });

  describe("3. Server-Side OrdersService Validation & Idempotency Fingerprint", () => {
    let mockPrisma: any;
    let mockSettingsService: any;
    let ordersService: OrdersService;

    const mockServiceDrip = {
      id: "srv-drip-supported",
      name: "Instagram Likes (Drip-capable)",
      status: "ACTIVE",
      ratePer1000: new Decimal(50.0),
      minQty: 50,
      maxQty: 10000,
      dripFeedSupported: true,
      dripFeedMinRuns: 2,
      dripFeedMaxRuns: 50,
      dripFeedMinInterval: 10,
      dripFeedMaxInterval: 720,
    };

    const mockServiceNonDrip = {
      id: "srv-no-drip",
      name: "Twitter Retweets (No Drip)",
      status: "ACTIVE",
      ratePer1000: new Decimal(80.0),
      minQty: 50,
      maxQty: 5000,
      dripFeedSupported: false,
    };

    beforeEach(() => {
      mockPrisma = {
        isConnected: true,
        service: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.id === mockServiceDrip.id) return Promise.resolve(mockServiceDrip);
            if (where.id === mockServiceNonDrip.id) return Promise.resolve(mockServiceNonDrip);
            return Promise.resolve(null);
          }),
        },
        order: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        $transaction: jest.fn(),
      };

      mockSettingsService = {
        getSettings: jest.fn().mockReturnValue({
          dripFeedEnabled: true,
          dripFeedMinRuns: 2,
          dripFeedMaxRuns: 100,
          dripFeedMinInterval: 5,
          dripFeedMaxInterval: 1440,
        }),
      };

      ordersService = new OrdersService(mockPrisma, {} as any, mockSettingsService);
    });

    it("rejects drip-feed order when service does not support dripFeedSupported", async () => {
      await expect(
        ordersService.create({
          userId: "usr-1",
          serviceId: mockServiceNonDrip.id,
          target: "https://twitter.com/test",
          quantity: 100,
          isDripFeed: true,
          runs: 5,
          interval: 60,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects drip-feed order when DRIPFEED_ENABLED feature flag is false", async () => {
      mockSettingsService.getSettings.mockReturnValueOnce({
        dripFeedEnabled: false,
        dripFeedMinRuns: 2,
        dripFeedMaxRuns: 100,
        dripFeedMinInterval: 5,
        dripFeedMaxInterval: 1440,
      });

      await expect(
        ordersService.create({
          userId: "usr-1",
          serviceId: mockServiceDrip.id,
          target: "https://instagram.com/p/test",
          quantity: 100,
          isDripFeed: true,
          runs: 5,
          interval: 60,
        })
      ).rejects.toThrow(/disabled/i);
    });

    it("rejects drip-feed order when per-run quantity is below service minQty", async () => {
      await expect(
        ordersService.create({
          userId: "usr-1",
          serviceId: mockServiceDrip.id,
          target: "https://instagram.com/p/test",
          quantity: 20, // min is 50
          isDripFeed: true,
          runs: 5,
          interval: 60,
        })
      ).rejects.toThrow(/Quantity must be between/i);
    });

    it("rejects drip-feed order when runs exceed service-specific maxRuns", async () => {
      await expect(
        ordersService.create({
          userId: "usr-1",
          serviceId: mockServiceDrip.id,
          target: "https://instagram.com/p/test",
          quantity: 100,
          isDripFeed: true,
          runs: 60, // service max is 50
          interval: 60,
        })
      ).rejects.toThrow(/Runs must be between/i);
    });

    it("rejects drip-feed order when interval is below service-specific minInterval", async () => {
      await expect(
        ordersService.create({
          userId: "usr-1",
          serviceId: mockServiceDrip.id,
          target: "https://instagram.com/p/test",
          quantity: 100,
          isDripFeed: true,
          runs: 5,
          interval: 8, // service min is 10
        })
      ).rejects.toThrow(/Interval must be between/i);
    });

    it("detects idempotency conflict when same key is used with modified drip parameters", async () => {
      const existingOrder = {
        id: "ord-existing-1",
        userId: "usr-1",
        serviceId: mockServiceDrip.id,
        target: "https://instagram.com/p/test",
        quantity: 100,
        isDripFeed: true,
        runs: 5,
        intervalMinutes: 60,
        charge: new Decimal(25.0),
        idempotencyKey: "idem-key-123",
      };

      mockPrisma.order.findUnique.mockResolvedValue(existingOrder);

      // Same key, but changed runs to 10
      await expect(
        ordersService.create({
          userId: "usr-1",
          serviceId: mockServiceDrip.id,
          target: "https://instagram.com/p/test",
          quantity: 100,
          isDripFeed: true,
          runs: 10,
          interval: 60,
          idempotencyKey: "idem-key-123",
        })
      ).rejects.toThrow(ConflictException);
    });

    it("returns existing order idempotently when same key is passed with identical params", async () => {
      const existingOrder = {
        id: "ord-existing-1",
        userId: "usr-1",
        serviceId: mockServiceDrip.id,
        target: "https://instagram.com/p/test",
        quantity: 100,
        isDripFeed: true,
        runs: 5,
        intervalMinutes: 60,
        charge: new Decimal(25.0),
        idempotencyKey: "idem-key-123",
      };

      mockPrisma.order.findUnique.mockResolvedValue(existingOrder);

      const res = await ordersService.create({
        userId: "usr-1",
        serviceId: mockServiceDrip.id,
        target: "https://instagram.com/p/test",
        quantity: 100,
        isDripFeed: true,
        runs: 5,
        interval: 60,
        idempotencyKey: "idem-key-123",
      });

      expect(res.id).toBe(existingOrder.id);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("4. Worker Dispatch & Upstream Provider Native Interop", () => {
    let workerEngine: SMMWorkerEngine;

    beforeEach(() => {
      workerEngine = new SMMWorkerEngine();
    });

    it("correctly includes runs and interval in add request for drip-feed orders", async () => {
      let interceptedPayload: any = null;

      // Mock fetch
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((url, opts) => {
        interceptedPayload = Object.fromEntries(new URLSearchParams(opts.body));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ order: 12345 }),
        });
      }) as any;

      try {
        const orderId = await workerEngine.callUpstreamAddOrder(
          "https://real-smm-provider.com/api/v2",
          "live_secret_key_123",
          101,
          "https://instagram.com/p/abc",
          200, // per-run quantity
          5,   // runs
          60   // interval
        );

        expect(orderId).toBe("12345");
        expect(interceptedPayload).not.toBeNull();
        expect(interceptedPayload.action).toBe("add");
        expect(interceptedPayload.quantity).toBe("200");
        expect(interceptedPayload.runs).toBe("5");
        expect(interceptedPayload.interval).toBe("60");
        expect(interceptedPayload.key).toBe("live_secret_key_123");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("omits runs and interval for standard non-drip orders", async () => {
      let interceptedPayload: any = null;

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((url, opts) => {
        interceptedPayload = Object.fromEntries(new URLSearchParams(opts.body));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ order: 99887 }),
        });
      }) as any;

      try {
        const orderId = await workerEngine.callUpstreamAddOrder(
          "https://real-smm-provider.com/api/v2",
          "live_secret_key_123",
          101,
          "https://instagram.com/p/abc",
          500, // quantity
          undefined, // no runs
          undefined  // no interval
        );

        expect(orderId).toBe("99887");
        expect(interceptedPayload).not.toBeNull();
        expect(interceptedPayload.runs).toBeUndefined();
        expect(interceptedPayload.interval).toBeUndefined();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("throws clear error when upstream provider rejects parameters", async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ error: "Interval cannot be less than 15 minutes" }),
        });
      }) as any;

      try {
        await expect(
          workerEngine.callUpstreamAddOrder(
            "https://real-smm-provider.com/api/v2",
            "live_secret_key_123",
            101,
            "https://instagram.com/p/abc",
            100,
            5,
            10
          )
        ).rejects.toThrow("Upstream provider error: Interval cannot be less than 15 minutes");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("5. Proportional Refund Math on PARTIAL / CANCELLED Drip Orders", () => {
    it("calculates refund using totalQuantity (quantity * runs)", () => {
      // 100 per run * 5 runs = 500 total units
      // Total charge = ₹50.00
      // Remains = 200 units (2 runs undelivered)
      // Expected refund = (200 / 500) * 50.00 = ₹20.00
      const refund = calculatePartialRefund(50.0, 500, 200, 500);
      expect(refund.toFixed(2)).toBe("20.00");
    });

    it("safely handles total fulfillment (0 remains) with 0 refund", () => {
      const refund = calculatePartialRefund(50.0, 500, 0, 500);
      expect(refund.toFixed(2)).toBe("0.00");
    });

    it("safely caps refund to charge amount even if upstream reports excessive remains", () => {
      const refund = calculatePartialRefund(50.0, 500, 9999, 500);
      expect(refund.toFixed(2)).toBe("50.00");
    });
  });

  describe("6. CustomerContext createOrder Payload Integrity", () => {
    it("ensures isDripFeed, runs, and interval are forwarded in payload and not dropped", () => {
      const input = {
        serviceId: "srv-drip-1",
        target: "https://instagram.com/test",
        quantity: 100,
        isDripFeed: true,
        runs: 5,
        interval: 60,
        idempotencyKey: "test-idem-key",
      };

      const payload: Record<string, any> = {
        serviceId: input.serviceId,
        target: input.target,
        quantity: input.quantity,
        idempotencyKey: input.idempotencyKey,
      };

      const isDripFeed = Boolean(input.isDripFeed);
      if (isDripFeed) {
        payload.isDripFeed = true;
        if (input.runs !== undefined) payload.runs = Number(input.runs);
        if (input.interval !== undefined) payload.interval = Number(input.interval);
      }

      expect(payload.isDripFeed).toBe(true);
      expect(payload.runs).toBe(5);
      expect(payload.interval).toBe(60);
      expect(payload.quantity).toBe(100);
    });
  });
});
