import { parseTargetUrl, ParsedLinkResult, LinkPlatform, LinkKind } from "@smm/contracts";

export interface ServiceRecommendation {
  tag: "BEST_VIEWS" | "BEST_LIKES" | "BEST_FOLLOWERS" | "VIRAL_COMBO" | "BEST_VALUE" | "RECOMMENDED";
  badgeLabel: string;
  badgeColor: string; // Tailwind color class
  service: any;
  reason: string;
}

export interface RecommendationResult {
  detectedPlatform: LinkPlatform;
  detectedKind: LinkKind;
  mediaId: string | null;
  authorHandle: string | null;
  recommendations: ServiceRecommendation[];
}

/**
 * Clean helper to test if a service name matches any search keywords
 */
function matchesAny(str: string, keywords: string[]): boolean {
  const lower = str.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Intelligent recommendation matcher for any target URL
 */
export function getRecommendedServicesForTarget(
  targetUrl: string,
  services: any[] = []
): RecommendationResult | null {
  if (!targetUrl || !targetUrl.trim() || targetUrl.trim().length < 4) {
    return null;
  }

  const parsed = parseTargetUrl(targetUrl);
  if (!parsed.isValid && parsed.platform === "UNKNOWN") {
    return null;
  }

  const platformLower = parsed.platform.toLowerCase();
  // Filter services by platform (handling X_TWITTER / TWITTER mapping)
  const candidateServices = services.filter((s) => {
    const sPlatform = (s.platform || "").toLowerCase();
    if (platformLower === "x_twitter" || platformLower === "twitter") {
      return sPlatform === "x_twitter" || sPlatform === "twitter";
    }
    return sPlatform === platformLower;
  });

  if (candidateServices.length === 0) {
    return {
      detectedPlatform: parsed.platform,
      detectedKind: parsed.kind,
      mediaId: parsed.mediaId,
      authorHandle: parsed.authorHandle,
      recommendations: [],
    };
  }

  const recommendations: ServiceRecommendation[] = [];

  // Match based on Kind & Platform
  if (parsed.platform === "INSTAGRAM") {
    if (parsed.kind === "REEL") {
      // 1. Reel Views
      const viewsSvc = candidateServices.find(
        (s) => matchesAny(s.name, ["reel view", "reels view", "video view", "ig views"]) && !matchesAny(s.name, ["story", "live"])
      ) || candidateServices.find((s) => matchesAny(s.name, ["view"]));

      if (viewsSvc) {
        recommendations.push({
          tag: "BEST_VIEWS",
          badgeLabel: "🔥 Best for Views",
          badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
          service: viewsSvc,
          reason: "High Retention • Instant Algorithm Push",
        });
      }

      // 2. Reel Likes
      const likesSvc = candidateServices.find(
        (s) => matchesAny(s.name, ["reel like", "reels like", "instagram like", "hq like"]) && !matchesAny(s.name, ["story", "comment"])
      ) || candidateServices.find((s) => matchesAny(s.name, ["like"]));

      if (likesSvc && likesSvc.id !== viewsSvc?.id) {
        recommendations.push({
          tag: "BEST_LIKES",
          badgeLabel: "❤️ Best for Likes",
          badgeColor: "bg-rose-500/15 text-rose-400 border-rose-500/30",
          service: likesSvc,
          reason: "Non-Drop • Real Accounts Delivery",
        });
      }

      // 3. Shares / Saves / Combo
      const reachSvc = candidateServices.find(
        (s) => matchesAny(s.name, ["save", "share", "reach", "impression"])
      ) || candidateServices.find((s) => !recommendations.some((r) => r.service.id === s.id));

      if (reachSvc && !recommendations.some((r) => r.service.id === reachSvc.id)) {
        recommendations.push({
          tag: "VIRAL_COMBO",
          badgeLabel: "🚀 Viral Reach",
          badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          service: reachSvc,
          reason: "Boosts Explore Page Distribution",
        });
      }
    } else if (parsed.kind === "PROFILE") {
      // 1. Followers
      const followersSvc = candidateServices.find(
        (s) => matchesAny(s.name, ["follower", "followers"]) && !matchesAny(s.name, ["story", "comment", "like"])
      );
      if (followersSvc) {
        recommendations.push({
          tag: "BEST_FOLLOWERS",
          badgeLabel: "👥 Real Followers",
          badgeColor: "bg-purple-500/15 text-purple-300 border-purple-500/30",
          service: followersSvc,
          reason: "30-Day Auto-Refill Guarantee",
        });
      }

      // 2. Profile Visits
      const visitsSvc = candidateServices.find(
        (s) => matchesAny(s.name, ["profile visit", "impression", "reach"])
      );
      if (visitsSvc && visitsSvc.id !== followersSvc?.id) {
        recommendations.push({
          tag: "BEST_VALUE",
          badgeLabel: "⚡ Profile Visits",
          badgeColor: "bg-sky-500/15 text-sky-400 border-sky-500/30",
          service: visitsSvc,
          reason: "Natural Organic Discovery",
        });
      }
    } else {
      // Post / Carousel
      const likesSvc = candidateServices.find(
        (s) => matchesAny(s.name, ["like", "likes"]) && !matchesAny(s.name, ["comment", "follower"])
      );
      if (likesSvc) {
        recommendations.push({
          tag: "BEST_LIKES",
          badgeLabel: "❤️ Post Likes",
          badgeColor: "bg-rose-500/15 text-rose-400 border-rose-500/30",
          service: likesSvc,
          reason: "Instant Start • Fast Delivery",
        });
      }

      const commentsSvc = candidateServices.find(
        (s) => matchesAny(s.name, ["comment", "comments", "custom"])
      );
      if (commentsSvc && commentsSvc.id !== likesSvc?.id) {
        recommendations.push({
          tag: "RECOMMENDED",
          badgeLabel: "💬 Comments & Buzz",
          badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
          service: commentsSvc,
          reason: "High Engagement Conversions",
        });
      }
    }
  } else if (parsed.platform === "YOUTUBE") {
    // 1. Views
    const viewsSvc = candidateServices.find(
      (s) => matchesAny(s.name, ["youtube view", "high retention", "monetizable", "views"])
    );
    if (viewsSvc) {
      recommendations.push({
        tag: "BEST_VIEWS",
        badgeLabel: "👁️ High-Retention Views",
        badgeColor: "bg-red-500/15 text-red-400 border-red-500/30",
        service: viewsSvc,
        reason: "Suggested Video & Search Algorithm Rank",
      });
    }

    // 2. Likes
    const likesSvc = candidateServices.find(
      (s) => matchesAny(s.name, ["like", "likes"]) && !matchesAny(s.name, ["comment", "dislike"])
    );
    if (likesSvc && likesSvc.id !== viewsSvc?.id) {
      recommendations.push({
        tag: "BEST_LIKES",
        badgeLabel: "👍 Video Likes",
        badgeColor: "bg-rose-500/15 text-rose-400 border-rose-500/30",
        service: likesSvc,
        reason: "Non-Drop Lifetime Warranty",
      });
    }
  } else if (parsed.platform === "TELEGRAM") {
    const membersSvc = candidateServices.find((s) => matchesAny(s.name, ["member", "members", "subscriber"]));
    if (membersSvc) {
      recommendations.push({
        tag: "BEST_FOLLOWERS",
        badgeLabel: "📢 Channel Members",
        badgeColor: "bg-sky-500/15 text-sky-400 border-sky-500/30",
        service: membersSvc,
        reason: "Zero Drop • 100% Real",
      });
    }

    const viewsSvc = candidateServices.find((s) => matchesAny(s.name, ["view", "post view"]));
    if (viewsSvc && viewsSvc.id !== membersSvc?.id) {
      recommendations.push({
        tag: "BEST_VIEWS",
        badgeLabel: "👁️ Post Views",
        badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        service: viewsSvc,
        reason: "Instant Delivery on Recent Posts",
      });
    }
  }

  // If specific matcher didn't populate 3, fill with top rate-efficient services
  if (recommendations.length < 3) {
    for (const s of candidateServices) {
      if (recommendations.length >= 3) break;
      if (!recommendations.some((r) => r.service.id === s.id)) {
        recommendations.push({
          tag: "BEST_VALUE",
          badgeLabel: "⚡ Best Value",
          badgeColor: "bg-accent/15 text-accent-text border-accent/30",
          service: s,
          reason: "Top Customer Selection",
        });
      }
    }
  }

  return {
    detectedPlatform: parsed.platform,
    detectedKind: parsed.kind,
    mediaId: parsed.mediaId,
    authorHandle: parsed.authorHandle,
    recommendations: recommendations.slice(0, 3),
  };
}

