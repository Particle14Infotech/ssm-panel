import * as crypto from "crypto";

export const DEFAULT_QUOTE_TTL_MS = 10 * 60 * 1000; // max 10 minutes quote lifetime
export const DEFAULT_KID = "primary";

export interface CanonicalQuoteInput {
  userId?: string;
  platform: string;
  handle: string;
  timezone: string;
  days: number;
  intervalHours?: number;
  totalCharge: number;
  totalRuns: number;
  items: Array<{
    serviceId: string;
    kind?: string;
    totalQuantity: number;
    quantityPerPost?: number;
    charge: number;
    ratePer1000: number;
    rateSnapshot?: number;
    runs?: number;
    maxPosts?: number;
  }>;
}

// In-memory key map supporting key rotation (kid)
const quoteKeys: Map<string, string> = new Map();
let processEphemeralSecret: string | null = null;

/**
 * Configure or rotate quote secrets by key ID
 */
export function setQuoteSecret(kid: string, secret: string) {
  quoteKeys.set(kid, secret);
}

/**
 * Resolve quote secret for a given kid without hardcoded literals
 */
export function resolveQuoteSecret(kid: string = DEFAULT_KID): string | null {
  if (quoteKeys.has(kid)) {
    return quoteKeys.get(kid)!;
  }
  // Try environment variable QUOTE_SECRET or QUOTE_KEYS
  if (kid === DEFAULT_KID || kid === "k1") {
    const envSecret = process.env.QUOTE_SECRET || process.env.JWT_SECRET;
    if (envSecret && envSecret.trim() !== "") {
      return envSecret;
    }
    if (process.env.NODE_ENV === "test") {
      if (!processEphemeralSecret) {
        processEphemeralSecret = crypto.randomBytes(32).toString("hex");
      }
      return processEphemeralSecret;
    }
  }
  return null;
}

/**
 * Produces a deterministic canonical JSON representation of the quote payload
 * with stable sorted key order so property order or whitespace differences cannot alter the hash.
 */
export function computeCanonicalPayloadString(
  input: CanonicalQuoteInput,
  version: 1 | 2 = 2
): string {
  const normalizedUserId = (input.userId || "").trim();
  const normalizedPlatform = (input.platform || "").toLowerCase().trim();
  const normalizedHandle = (input.handle || "").toLowerCase().trim().replace(/^@/, "");
  const normalizedTimezone = (input.timezone || "UTC").trim();
  const days = Math.round(input.days || 1);
  const intervalHours = input.intervalHours ? Math.round(input.intervalHours) : 24;
  const totalCharge = Number(input.totalCharge || 0).toFixed(2);
  const totalRuns = Math.round(input.totalRuns || 0);

  const sortedItems = [...(input.items || [])]
    .map((item) => ({
      charge: Number(item.charge || 0).toFixed(2),
      kind: (item.kind || "TIME_DRIP").trim(),
      maxPosts: Math.round(item.maxPosts || 0),
      quantityPerPost: Math.round(item.quantityPerPost || 0),
      ratePer1000: Number(item.rateSnapshot ?? item.ratePer1000 ?? 0).toFixed(2),
      runs: Math.round(item.runs || 0),
      serviceId: (item.serviceId || "").trim(),
      totalQuantity: Math.round(item.totalQuantity || 0),
    }))
    .sort((a, b) => a.serviceId.localeCompare(b.serviceId) || a.kind.localeCompare(b.kind));

  if (version === 1) {
    // V1 legacy schema format
    return JSON.stringify({
      days,
      handle: normalizedHandle,
      items: sortedItems,
      platform: normalizedPlatform,
      timezone: normalizedTimezone,
      totalCharge,
      totalRuns,
    });
  }

  // V2 canonical format with userId, intervalHours, and kid binding
  const canonicalObj = {
    days,
    handle: normalizedHandle,
    intervalHours,
    items: sortedItems,
    platform: normalizedPlatform,
    timezone: normalizedTimezone,
    totalCharge,
    totalRuns,
    userId: normalizedUserId,
  };

  return JSON.stringify(canonicalObj);
}

/**
 * Generates an HMAC-SHA256 based quote hash with embedded key id (kid) and expiration timestamp.
 * Format:
 *   qh_v2_<kid>_<expiresAtMs>_<hmac> (when userId is provided)
 *   qh_v1_<expiresAtMs>_<hmac> (legacy fallback when unauthenticated)
 */
export function generateQuoteHash(
  input: CanonicalQuoteInput,
  expiresAtMs: number = Date.now() + DEFAULT_QUOTE_TTL_MS,
  kid: string = DEFAULT_KID,
  explicitSecret?: string
): { quoteHash: string; expiresAt: string } {
  let secretKey = explicitSecret || resolveQuoteSecret(kid);
  let resolvedKid = kid;
  if (!secretKey && kid && kid !== DEFAULT_KID && kid !== "k1") {
    secretKey = kid;
    resolvedKid = DEFAULT_KID;
  }
  if (!secretKey) {
    throw new Error(
      `QUOTE_SECRET is not configured for key id "${kid}". Boot check or environment must define QUOTE_SECRET.`
    );
  }

  const isV2 = Boolean(input.userId && input.userId.trim() !== "");
  const canonical = computeCanonicalPayloadString(input, isV2 ? 2 : 1);
  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(`${canonical}::expires=${expiresAtMs}`)
    .digest("hex");

  const quoteHash = isV2
    ? `qh_v2_${resolvedKid}_${expiresAtMs}_${hmac}`
    : `qh_v1_${expiresAtMs}_${hmac}`;

  return {
    quoteHash,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export type QuoteVerificationResult =
  | { valid: true }
  | {
      valid: false;
      reason: "EXPIRED" | "TAMPERED" | "MALFORMED" | "UNKNOWN_KID" | "USER_MISMATCH";
      message: string;
    };

/**
 * Cryptographically verifies that the user-provided quote hash matches
 * the authoritative server-side quote, user ID, and has not expired.
 */
export function verifyQuoteHash(
  providedHash: string,
  currentQuote: CanonicalQuoteInput,
  nowMs: number = Date.now(),
  explicitSecret?: string
): QuoteVerificationResult {
  if (!providedHash || typeof providedHash !== "string") {
    return { valid: false, reason: "MALFORMED", message: "Quote hash is missing or malformed." };
  }

  const parts = providedHash.split("_");
  let isV2 = false;
  let kid = DEFAULT_KID;
  let expiresAtMs = 0;
  let providedHmac = "";

  if (parts.length === 5 && parts[0] === "qh" && parts[1] === "v2") {
    isV2 = true;
    kid = parts[2];
    expiresAtMs = Number(parts[3]);
    providedHmac = parts[4];
  } else if (parts.length === 4 && parts[0] === "qh" && parts[1] === "v1") {
    isV2 = false;
    kid = DEFAULT_KID;
    expiresAtMs = Number(parts[2]);
    providedHmac = parts[3];
  } else {
    return { valid: false, reason: "MALFORMED", message: "Unrecognized quote hash format." };
  }

  if (!Number.isFinite(expiresAtMs) || !providedHmac) {
    return { valid: false, reason: "MALFORMED", message: "Quote hash has invalid timestamp or signature." };
  }

  if (nowMs > expiresAtMs) {
    return {
      valid: false,
      reason: "EXPIRED",
      message: "The package quote has expired. Please refresh your quote before purchasing.",
    };
  }

  const secretKey = explicitSecret || resolveQuoteSecret(kid);
  if (!secretKey) {
    return {
      valid: false,
      reason: "UNKNOWN_KID",
      message: `Quote key ID "${kid}" is not recognized or has been retired.`,
    };
  }

  const canonical = computeCanonicalPayloadString(currentQuote, isV2 ? 2 : 1);
  const expectedHmac = crypto
    .createHmac("sha256", secretKey)
    .update(`${canonical}::expires=${expiresAtMs}`)
    .digest("hex");

  try {
    const providedBuf = Buffer.from(providedHmac, "hex");
    const expectedBuf = Buffer.from(expectedHmac, "hex");

    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return {
        valid: false,
        reason: "TAMPERED",
        message: "Service pricing, schedule, or catalog has changed since this quote was generated. Please refresh your quote before purchasing.",
      };
    }
  } catch {
    return {
      valid: false,
      reason: "MALFORMED",
      message: "Quote hash signature could not be verified.",
    };
  }

  return { valid: true };
}
