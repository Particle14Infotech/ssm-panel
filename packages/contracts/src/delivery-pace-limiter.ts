/**
 * Delivery Pace Limiter & Catch-Up Policy
 *
 * Enforces per-link rate control, provider concurrency serialization,
 * and deterministic catch-up pacing during dispatch cycles.
 */

export interface KindPaceLimits {
  [kind: string]: number;
}

export const DEFAULT_KIND_PACE_CAPS: KindPaceLimits = {
  LIKES: 150,
  VIEWS: 1000,
  SHARES: 30,
  COMMENTS: 20,
  SAVES: 50,
  FOLLOWERS: 50,
  DEFAULT: 500,
};

export const DEFAULT_CATCHUP_MAX_PER_TICK = 2; // At most K overdue runs per package per tick
export const DEFAULT_STALL_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Normalizes a social media URL or handle for deterministic per-link rate tracking.
 */
export function normalizeTargetUrl(url: string | null | undefined): string {
  if (!url) return "";
  let clean = url.trim().toLowerCase();

  // Strip query parameters and hash fragments
  clean = clean.split("#")[0].split("?")[0].trim();

  // Strip trailing slashes
  clean = clean.replace(/\/+$/, "");

  // If handle with @ prefix and no url scheme
  if (clean.startsWith("@")) {
    return clean.replace(/^@+/, "");
  }

  // Remove protocol and www for uniform matching
  clean = clean.replace(/^https?:\/\/(www\.)?/, "");

  // Strip trailing slashes again after domain/path cleanup
  clean = clean.replace(/\/+$/, "");

  // If pure handle without slash
  if (!clean.includes("/") && clean.startsWith("@")) {
    clean = clean.replace(/^@+/, "");
  }

  return clean;
}

/**
 * Checks whether an in-flight dispatch would exceed the per-link unit rate cap.
 */
export function canDispatchUnitsOnLink(
  currentInFlightUnits: number,
  candidateQuantity: number,
  kind: string | null | undefined,
  capOverride?: number | KindPaceLimits
): { allowed: boolean; cap: number; remainingCapacity: number; available: number; reason?: string } {
  const normalizedKind = (kind || "DEFAULT").toUpperCase();
  let cap = DEFAULT_KIND_PACE_CAPS[normalizedKind] || DEFAULT_KIND_PACE_CAPS.DEFAULT;

  if (typeof capOverride === "number") {
    cap = capOverride;
  } else if (capOverride && typeof capOverride === "object") {
    cap = capOverride[normalizedKind] || cap;
  }

  const remainingCapacity = Math.max(0, cap - (currentInFlightUnits + candidateQuantity));
  const allowed = currentInFlightUnits + candidateQuantity <= cap;
  const reason = allowed
    ? undefined
    : `In-flight cap exceeded for ${normalizedKind}: current in-flight ${currentInFlightUnits} + candidate ${candidateQuantity} exceeds cap ${cap}`;

  return {
    allowed,
    cap,
    remainingCapacity,
    available: Math.max(0, cap - currentInFlightUnits),
    reason,
  };
}
