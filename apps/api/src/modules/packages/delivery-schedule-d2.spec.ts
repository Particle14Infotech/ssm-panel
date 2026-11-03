import {
  validateDeliveryWindow,
  STANDARD_DELIVERY_WINDOW_PRESETS,
  DeliveryWindowConfig,
} from "@smm/contracts";
import {
  computeCanonicalPayloadString,
  generateQuoteHash,
  verifyQuoteHash,
  setQuoteSecret,
} from "./package-quote-hash.util";

describe("D2 Delivery Window Validation and Quote Hash Invariants", () => {
  const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  beforeAll(() => {
    setQuoteSecret("primary", TEST_SECRET);
  });

  describe("validateDeliveryWindow", () => {
    it("should accept undefined or empty window as valid (24/7 delivery)", () => {
      const res = validateDeliveryWindow(undefined);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("should accept valid standard presets (e.g. Daytime 09:00 - 21:00)", () => {
      const window: DeliveryWindowConfig = {
        timezone: "Asia/Kolkata",
        ranges: [{ startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 }],
      };
      const res = validateDeliveryWindow(window);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("should reject invalid IANA timezone", () => {
      const window: DeliveryWindowConfig = {
        timezone: "Mars/Olympus_Mons",
        ranges: [{ startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 }],
      };
      const res = validateDeliveryWindow(window);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toMatch(/Invalid IANA timezone/i);
    });

    it("should reject window with more than 4 ranges", () => {
      const window: DeliveryWindowConfig = {
        timezone: "Asia/Kolkata",
        ranges: [
          { startHour: 0, endHour: 2 },
          { startHour: 3, endHour: 5 },
          { startHour: 6, endHour: 8 },
          { startHour: 9, endHour: 11 },
          { startHour: 12, endHour: 14 },
        ],
      };
      const res = validateDeliveryWindow(window);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toMatch(/exceeds maximum allowed ranges/i);
    });

    it("should reject invalid hours or minutes outside 0..1439", () => {
      const invalidHour: DeliveryWindowConfig = {
        timezone: "UTC",
        ranges: [{ startHour: 25, endHour: 10 }],
      };
      const res = validateDeliveryWindow(invalidHour);
      expect(res.valid).toBe(false);

      const invalidMinute: DeliveryWindowConfig = {
        timezone: "UTC",
        ranges: [{ startHour: 10, startMinute: 75, endHour: 12 }],
      };
      const res2 = validateDeliveryWindow(invalidMinute);
      expect(res2.valid).toBe(false);
    });

    it("should reject equal start and end time range", () => {
      const zeroWindow: DeliveryWindowConfig = {
        timezone: "UTC",
        ranges: [{ startHour: 14, startMinute: 30, endHour: 14, endMinute: 30 }],
      };
      const res = validateDeliveryWindow(zeroWindow);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toMatch(/cannot be identical/i);
    });
  });

  describe("Quote Hash Binding with Delivery Window", () => {
    const baseQuote = {
      userId: "usr_buyer_123",
      platform: "instagram",
      handle: "bholu_official",
      timezone: "Asia/Kolkata",
      days: 7,
      intervalHours: 24,
      totalCharge: 38.5,
      totalRuns: 7,
      items: [
        {
          serviceId: "srv_insta_views",
          kind: "TIME_DRIP",
          totalQuantity: 7000,
          quantityPerPost: 1000,
          charge: 38.5,
          ratePer1000: 5.5,
          runs: 7,
          maxPosts: 7,
        },
      ],
    };

    it("should include deliveryWindow deterministically in quote hash", () => {
      const quoteWithWindowA = {
        ...baseQuote,
        deliveryWindow: {
          timezone: "Asia/Kolkata",
          ranges: [{ startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 }],
        },
      };

      const hash1 = generateQuoteHash(quoteWithWindowA, 1800000000000, "primary", TEST_SECRET);
      const hash2 = generateQuoteHash(quoteWithWindowA, 1800000000000, "primary", TEST_SECRET);
      expect(hash1.quoteHash).toEqual(hash2.quoteHash);

      const verified = verifyQuoteHash(hash1.quoteHash, quoteWithWindowA, 1700000000000, TEST_SECRET);
      expect(verified.valid).toBe(true);
    });

    it("should produce DIFFERENT quote hash when deliveryWindow or timezone changes", () => {
      const quoteDaytime = {
        ...baseQuote,
        deliveryWindow: {
          timezone: "Asia/Kolkata",
          ranges: [{ startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 }],
        },
      };

      const quoteEvening = {
        ...baseQuote,
        deliveryWindow: {
          timezone: "Asia/Kolkata",
          ranges: [{ startHour: 17, startMinute: 0, endHour: 23, endMinute: 0 }],
        },
      };

      const quoteDifferentTz = {
        ...baseQuote,
        deliveryWindow: {
          timezone: "America/New_York",
          ranges: [{ startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 }],
        },
      };

      const hashDaytime = generateQuoteHash(quoteDaytime, 1800000000000, "primary", TEST_SECRET);
      const hashEvening = generateQuoteHash(quoteEvening, 1800000000000, "primary", TEST_SECRET);
      const hashTz = generateQuoteHash(quoteDifferentTz, 1800000000000, "primary", TEST_SECRET);

      expect(hashDaytime.quoteHash).not.toEqual(hashEvening.quoteHash);
      expect(hashDaytime.quoteHash).not.toEqual(hashTz.quoteHash);

      // Verifying Daytime hash against Evening quote must FAIL with TAMPERED
      const tamperCheck = verifyQuoteHash(hashDaytime.quoteHash, quoteEvening, 1700000000000, TEST_SECRET);
      expect(tamperCheck.valid).toBe(false);
      if (!tamperCheck.valid) {
        expect(tamperCheck.reason).toBe("TAMPERED");
      }
    });
  });
});

