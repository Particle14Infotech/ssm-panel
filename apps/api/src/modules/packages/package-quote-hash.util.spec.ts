import {
  generateQuoteHash,
  verifyQuoteHash,
  computeCanonicalPayloadString,
  CanonicalQuoteInput,
} from "./package-quote-hash.util";

describe("PackageQuoteHashUtil", () => {
  const baseQuote: CanonicalQuoteInput = {
    platform: "instagram",
    handle: "testuser",
    timezone: "Asia/Kolkata",
    days: 30,
    totalCharge: 150.0,
    totalRuns: 30,
    items: [
      {
        serviceId: "svc_likes_1",
        kind: "POST_TRIGGERED",
        totalQuantity: 1000,
        quantityPerPost: 100,
        charge: 50.0,
        ratePer1000: 50.0,
        runs: 10,
        maxPosts: 10,
      },
      {
        serviceId: "svc_followers_1",
        kind: "TIME_DRIP",
        totalQuantity: 2000,
        quantityPerPost: 66,
        charge: 100.0,
        ratePer1000: 50.0,
        runs: 30,
        maxPosts: 1,
      },
    ],
  };

  it("produces deterministic canonical payload regardless of item array order", () => {
    const reversedQuote: CanonicalQuoteInput = {
      ...baseQuote,
      items: [...baseQuote.items].reverse(),
    };

    const str1 = computeCanonicalPayloadString(baseQuote);
    const str2 = computeCanonicalPayloadString(reversedQuote);
    expect(str1).toEqual(str2);
  });

  it("successfully verifies an unchanged valid quote before expiry", () => {
    const now = Date.now();
    const { quoteHash } = generateQuoteHash(baseQuote, now + 60000);

    const result = verifyQuoteHash(quoteHash, baseQuote, now);
    expect(result.valid).toBe(true);
  });

  it("rejects an expired quote with EXPIRED reason", () => {
    const now = Date.now();
    const { quoteHash } = generateQuoteHash(baseQuote, now - 1000); // 1 second in the past

    const result = verifyQuoteHash(quoteHash, baseQuote, now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("EXPIRED");
      expect(result.message).toContain("expired");
    }
  });

  it("detects and rejects price changes (ratePer1000 or totalCharge)", () => {
    const now = Date.now();
    const { quoteHash } = generateQuoteHash(baseQuote, now + 60000);

    const modifiedQuote: CanonicalQuoteInput = {
      ...baseQuote,
      totalCharge: 175.0, // price increased
    };

    const result = verifyQuoteHash(quoteHash, modifiedQuote, now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("TAMPERED");
      expect(result.message).toContain("changed");
    }
  });

  it("detects and rejects quantity changes", () => {
    const now = Date.now();
    const { quoteHash } = generateQuoteHash(baseQuote, now + 60000);

    const modifiedQuote: CanonicalQuoteInput = {
      ...baseQuote,
      items: [
        { ...baseQuote.items[0], totalQuantity: 1500 },
        baseQuote.items[1],
      ],
    };

    const result = verifyQuoteHash(quoteHash, modifiedQuote, now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("TAMPERED");
    }
  });

  it("detects and rejects interval / days changes", () => {
    const now = Date.now();
    const { quoteHash } = generateQuoteHash(baseQuote, now + 60000);

    const modifiedQuote: CanonicalQuoteInput = {
      ...baseQuote,
      days: 15,
    };

    const result = verifyQuoteHash(quoteHash, modifiedQuote, now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("TAMPERED");
    }
  });

  it("detects and rejects service catalog / service ID changes", () => {
    const now = Date.now();
    const { quoteHash } = generateQuoteHash(baseQuote, now + 60000);

    const modifiedQuote: CanonicalQuoteInput = {
      ...baseQuote,
      items: [
        { ...baseQuote.items[0], serviceId: "svc_likes_different" },
        baseQuote.items[1],
      ],
    };

    const result = verifyQuoteHash(quoteHash, modifiedQuote, now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("TAMPERED");
    }
  });

  it("rejects malformed or invalid hash formats", () => {
    const now = Date.now();
    expect(verifyQuoteHash("", baseQuote, now).valid).toBe(false);
    expect(verifyQuoteHash("invalid_hash", baseQuote, now).valid).toBe(false);
    expect(verifyQuoteHash("qh_v1_notanumber_abc", baseQuote, now).valid).toBe(false);
    expect(verifyQuoteHash("qh_v2_12345_abc", baseQuote, now).valid).toBe(false);
  });

  it("rejects forged hashes with different secret keys", () => {
    const now = Date.now();
    const { quoteHash } = generateQuoteHash(baseQuote, now + 60000, "attacker-secret");

    const result = verifyQuoteHash(quoteHash, baseQuote, now, "server-secret");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("TAMPERED");
    }
  });
});
