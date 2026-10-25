/**
 * Engagement Ratio Guardrail (Smart Ratio Lock)
 *
 * Prevents shadowban risk by detecting when a user orders engagement metrics
 * in disproportionate ratios. For example, ordering 50,000 likes on a video
 * with only 2,000 views is a red flag.
 *
 * Rules:
 *   - Likes ordered > 3× current view estimate → suggest view bundle
 *   - Comments ordered > Likes ordered   → suggest like bundle first
 *   - Shares ordered  > Views ordered    → suggest view bundle first
 *
 * This module is pure logic with zero side effects — safe for unit testing.
 */

export interface RatioCheckInput {
  /** The service type category being ordered (lowercase) */
  serviceCategory: string;
  /** The quantity being ordered */
  quantity: number;
  /** Known metrics for the same target (views, likes, etc.) from existing orders */
  existingMetrics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    followers?: number;
    subscribers?: number;
  };
}

export interface RatioWarning {
  /** Severity level */
  level: "info" | "warning" | "danger";
  /** User-facing warning message */
  message: string;
  /** Suggested action */
  suggestion: string;
  /** The metric that triggered the warning */
  triggerMetric: string;
  /** The metric that is too low */
  lowMetric: string;
  /** Suggested quantity for the low metric */
  suggestedQuantity?: number;
}

/**
 * Classify a service name or category into a normalized metric type.
 * Returns null if the service doesn't map to a trackable engagement metric.
 */
export function classifyServiceMetric(
  serviceName: string
): "views" | "likes" | "comments" | "shares" | "followers" | "subscribers" | null {
  const lower = serviceName.toLowerCase();

  if (/\bview(s)?\b/.test(lower) || /\bwatch\b/.test(lower) || /\bimpression(s)?\b/.test(lower) || /\breach\b/.test(lower)) {
    return "views";
  }
  if (/\blike(s)?\b/.test(lower) || /\bheart(s)?\b/.test(lower) || /\breaction(s)?\b/.test(lower)) {
    return "likes";
  }
  if (/\bcomment(s)?\b/.test(lower)) {
    return "comments";
  }
  if (/\bshare(s)?\b/.test(lower) || /\brepost(s)?\b/.test(lower) || /\bretweet(s)?\b/.test(lower)) {
    return "shares";
  }
  if (/\bfollower(s)?\b/.test(lower)) {
    return "followers";
  }
  if (/\bsubscriber(s)?\b/.test(lower)) {
    return "subscribers";
  }

  return null;
}

/**
 * Check engagement ratio and return warnings if the order looks disproportionate.
 * Returns an empty array if the ratio is healthy.
 */
export function checkEngagementRatio(input: RatioCheckInput): RatioWarning[] {
  const warnings: RatioWarning[] = [];
  const metric = classifyServiceMetric(input.serviceCategory);
  if (!metric || !input.existingMetrics) return warnings;

  const existing = input.existingMetrics;
  const qty = input.quantity;

  // Rule 1: Likes ordered > 3× views → suggest views
  if (metric === "likes" && existing.views !== undefined && existing.views > 0) {
    if (qty > 3 * existing.views) {
      const suggestedViews = Math.ceil(qty / 2); // At least half as many views as likes
      warnings.push({
        level: "danger",
        message: `Ordering ${qty.toLocaleString("en-IN")} likes with only ${existing.views.toLocaleString("en-IN")} views may trigger platform detection.`,
        suggestion: `Consider adding at least ${suggestedViews.toLocaleString("en-IN")} views first to maintain a natural ratio.`,
        triggerMetric: "likes",
        lowMetric: "views",
        suggestedQuantity: suggestedViews,
      });
    } else if (qty > 1.5 * existing.views) {
      warnings.push({
        level: "warning",
        message: `Your likes-to-views ratio is above average. Most organic content has fewer likes than views.`,
        suggestion: `Adding some views alongside likes helps maintain a natural engagement pattern.`,
        triggerMetric: "likes",
        lowMetric: "views",
      });
    }
  }

  // Rule 2: Comments ordered > likes → suggest likes first
  if (metric === "comments") {
    const effectiveLikes = (existing.likes ?? 0);
    if (effectiveLikes > 0 && qty > effectiveLikes) {
      warnings.push({
        level: "warning",
        message: `Ordering ${qty.toLocaleString("en-IN")} comments with only ${effectiveLikes.toLocaleString("en-IN")} likes looks unnatural.`,
        suggestion: `Add likes before or alongside comments. A natural ratio is 5-10 likes per comment.`,
        triggerMetric: "comments",
        lowMetric: "likes",
        suggestedQuantity: qty * 5,
      });
    }
  }

  // Rule 3: Shares/reposts ordered > views → suggest views first
  if (metric === "shares" && existing.views !== undefined && existing.views > 0) {
    if (qty > existing.views) {
      warnings.push({
        level: "danger",
        message: `Ordering ${qty.toLocaleString("en-IN")} shares with only ${existing.views.toLocaleString("en-IN")} views is a red flag for platforms.`,
        suggestion: `Add views first. A natural ratio is at most 1 share per 10 views.`,
        triggerMetric: "shares",
        lowMetric: "views",
        suggestedQuantity: qty * 10,
      });
    }
  }

  return warnings;
}
