import { ServiceLinkType, ServicePlatform } from "./services";

export type LinkPlatform =
  | "YOUTUBE"
  | "TIKTOK"
  | "INSTAGRAM"
  | "X_TWITTER"
  | "TELEGRAM"
  | "FACEBOOK"
  | "SPOTIFY"
  | "UNKNOWN";

export type LinkKind =
  | "REEL"
  | "POST"
  | "VIDEO"
  | "SHORT"
  | "STATUS"
  | "PROFILE"
  | "CHANNEL"
  | "UNKNOWN";

export interface ParsedLinkResult {
  isValid: boolean;
  error?: string;
  platform: LinkPlatform;
  kind: LinkKind;
  mediaId: string | null;
  canonicalUrl: string | null;
  authorHandle: string | null;
  isShortLink?: boolean;
}

export const KNOWN_SHORT_LINK_HOSTS = new Set([
  "vm.tiktok.com",
  "vt.tiktok.com",
  "fb.watch",
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "cutt.ly",
  "bl.ink",
  "shorturl.at",
  "rb.gy",
  "qr.ae",
  "lnkd.in",
  "linktr.ee",
]);

/**
 * Strict dot-boundary suffix match.
 * Example: 'www.instagram.com' matches 'instagram.com',
 * but 'evil-instagram.com' and 'instagram.com.attacker.com' DO NOT match.
 */
function isHostAllowed(hostname: string, allowedDomains: string[]): boolean {
  const host = hostname.toLowerCase();
  for (const domain of allowedDomains) {
    const d = domain.toLowerCase();
    if (host === d || host.endsWith("." + d)) {
      return true;
    }
  }
  return false;
}

// Linear non-backtracking regexes (ReDoS safe)
const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const INSTAGRAM_MEDIA_REGEX = /^[A-Za-z0-9_-]{5,35}$/;
const INSTAGRAM_HANDLE_REGEX = /^[A-Za-z0-9_.]{1,30}$/;
const TIKTOK_VIDEO_ID_REGEX = /^\d{15,25}$/;
const TIKTOK_HANDLE_REGEX = /^[A-Za-z0-9_.-]{2,24}$/;
const X_STATUS_ID_REGEX = /^\d{5,25}$/;
const X_HANDLE_REGEX = /^[A-Za-z0-9_]{1,15}$/;
const TELEGRAM_ID_REGEX = /^\d+$/;
const TELEGRAM_HANDLE_REGEX = /^[A-Za-z0-9_]{5,32}$/;

/**
 * LP1: Robust WHATWG URL Parser & Platform Link Identifier.
 * Shared across frontend client and backend API.
 */
export function parseTargetUrl(rawInput: string): ParsedLinkResult {
  const input = (rawInput || "").trim();
  if (!input) {
    return {
      isValid: false,
      error: "Link is required",
      platform: "UNKNOWN",
      kind: "UNKNOWN",
      mediaId: null,
      canonicalUrl: null,
      authorHandle: null,
    };
  }

  if (input.length > 2048) {
    return {
      isValid: false,
      error: "Link exceeds maximum length of 2048 characters",
      platform: "UNKNOWN",
      kind: "UNKNOWN",
      mediaId: null,
      canonicalUrl: null,
      authorHandle: null,
    };
  }

  // Handle direct username handle (e.g. @username)
  if (input.startsWith("@")) {
    const cleanHandle = input.slice(1).trim();
    if (!cleanHandle) {
      return {
        isValid: false,
        error: "Please enter a valid handle",
        platform: "UNKNOWN",
        kind: "UNKNOWN",
        mediaId: null,
        canonicalUrl: null,
        authorHandle: null,
      };
    }
    // Generic profile format
    return {
      isValid: true,
      platform: "INSTAGRAM", // default assumed or platform-agnostic profile
      kind: "PROFILE",
      mediaId: null,
      canonicalUrl: `https://www.instagram.com/${cleanHandle}/`,
      authorHandle: cleanHandle,
    };
  }

  // WHATWG URL parsing
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return {
      isValid: false,
      error: "Please enter a valid URL",
      platform: "UNKNOWN",
      kind: "UNKNOWN",
      mediaId: null,
      canonicalUrl: null,
      authorHandle: null,
    };
  }

  // Protocol: HTTPS only
  if (parsed.protocol !== "https:") {
    return {
      isValid: false,
      error: "Only secure https:// links are supported",
      platform: "UNKNOWN",
      kind: "UNKNOWN",
      mediaId: null,
      canonicalUrl: null,
      authorHandle: null,
    };
  }

  // No userinfo (credentials)
  if (parsed.username || parsed.password) {
    return {
      isValid: false,
      error: "Links with credentials (userinfo) are not permitted",
      platform: "UNKNOWN",
      kind: "UNKNOWN",
      mediaId: null,
      canonicalUrl: null,
      authorHandle: null,
    };
  }

  // No non-default port
  if (parsed.port && parsed.port !== "443" && parsed.port !== "") {
    return {
      isValid: false,
      error: "Links with non-default ports are not permitted",
      platform: "UNKNOWN",
      kind: "UNKNOWN",
      mediaId: null,
      canonicalUrl: null,
      authorHandle: null,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject short links
  if (KNOWN_SHORT_LINK_HOSTS.has(hostname) || hostname === "vm.tiktok.com" || hostname === "vt.tiktok.com") {
    return {
      isValid: false,
      error: "Paste the full link",
      isShortLink: true,
      platform: "UNKNOWN",
      kind: "UNKNOWN",
      mediaId: null,
      canonicalUrl: null,
      authorHandle: null,
    };
  }

  const pathname = parsed.pathname;

  // 1. YouTube
  if (isHostAllowed(hostname, ["youtube.com", "youtu.be"])) {
    // youtu.be/<id>
    if (hostname === "youtu.be") {
      const match = pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/);
      if (match && YOUTUBE_ID_REGEX.test(match[1])) {
        const id = match[1];
        return {
          isValid: true,
          platform: "YOUTUBE",
          kind: "VIDEO",
          mediaId: id,
          canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
          authorHandle: null,
        };
      }
    }

    // /watch?v=<id>
    if (pathname === "/watch" || pathname === "/watch/") {
      const v = parsed.searchParams.get("v");
      if (v && YOUTUBE_ID_REGEX.test(v)) {
        return {
          isValid: true,
          platform: "YOUTUBE",
          kind: "VIDEO",
          mediaId: v,
          canonicalUrl: `https://www.youtube.com/watch?v=${v}`,
          authorHandle: null,
        };
      }
    }

    // /shorts/<id>
    const shortsMatch = pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})\/?$/);
    if (shortsMatch && YOUTUBE_ID_REGEX.test(shortsMatch[1])) {
      const id = shortsMatch[1];
      return {
        isValid: true,
        platform: "YOUTUBE",
        kind: "SHORT",
        mediaId: id,
        canonicalUrl: `https://www.youtube.com/shorts/${id}`,
        authorHandle: null,
      };
    }

    // /live/<id>
    const liveMatch = pathname.match(/^\/live\/([A-Za-z0-9_-]{11})\/?$/);
    if (liveMatch && YOUTUBE_ID_REGEX.test(liveMatch[1])) {
      const id = liveMatch[1];
      return {
        isValid: true,
        platform: "YOUTUBE",
        kind: "VIDEO",
        mediaId: id,
        canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
        authorHandle: null,
      };
    }

    // Channel / Profile: /@<handle>, /channel/<id>, /c/<custom>
    const channelMatch = pathname.match(/^\/(?:@([A-Za-z0-9_.-]+)|channel\/([A-Za-z0-9_-]+)|c\/([A-Za-z0-9_.-]+))\/?$/);
    if (channelMatch) {
      const handle = channelMatch[1] || channelMatch[2] || channelMatch[3];
      return {
        isValid: true,
        platform: "YOUTUBE",
        kind: "PROFILE",
        mediaId: null,
        canonicalUrl: `https://www.youtube.com/@${handle}`,
        authorHandle: handle,
      };
    }

    return {
      isValid: false,
      error: "Please enter a valid YouTube video, shorts, or channel link",
      platform: "YOUTUBE",
      kind: "UNKNOWN",
      mediaId: null,
      canonicalUrl: null,
      authorHandle: null,
    };
  }

  // 2. Instagram
  if (isHostAllowed(hostname, ["instagram.com"])) {
    // Reel / Post / TV: /reel/<id>, /reels/<id>, /p/<id>, /tv/<id>
    const igPostMatch = pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,35})\/?$/i);
    if (igPostMatch && INSTAGRAM_MEDIA_REGEX.test(igPostMatch[2])) {
      const type = igPostMatch[1].toLowerCase();
      const id = igPostMatch[2];
      const kind: LinkKind = type === "reel" || type === "reels" ? "REEL" : "POST";
      const pathSegment = kind === "REEL" ? "reel" : "p";
      return {
        isValid: true,
        platform: "INSTAGRAM",
        kind,
        mediaId: id,
        canonicalUrl: `https://www.instagram.com/${pathSegment}/${id}/`,
        authorHandle: null,
      };
    }

    // Story / Highlights: /stories/highlights/<id> or /stories/<username>/<id>
    const igStoryMatch = pathname.match(/^\/stories\/(?:highlights\/(\d{5,35})|([A-Za-z0-9_.]{1,30})\/(\d{5,35}))\/?$/i);
    if (igStoryMatch) {
      const id = igStoryMatch[1] || igStoryMatch[3];
      const handle = igStoryMatch[2] || null;
      return {
        isValid: true,
        platform: "INSTAGRAM",
        kind: "POST",
        mediaId: id,
        canonicalUrl: handle
          ? `https://www.instagram.com/stories/${handle}/${id}/`
          : `https://www.instagram.com/stories/highlights/${id}/`,
        authorHandle: handle,
      };
    }

    // Profile: /<username>/ (excluding reserved paths)
    const igProfileMatch = pathname.match(/^\/(?!p\/|reel\/|reels\/|tv\/|stories\/|explore\/|direct\/|accounts\/)([A-Za-z0-9_.]{1,30})\/?$/i);
    if (igProfileMatch && INSTAGRAM_HANDLE_REGEX.test(igProfileMatch[1])) {
      const handle = igProfileMatch[1];
      return {
        isValid: true,
        platform: "INSTAGRAM",
        kind: "PROFILE",
        mediaId: null,
        canonicalUrl: `https://www.instagram.com/${handle}/`,
        authorHandle: handle,
      };
    }

    return {
      isValid: false,
      error: "Please enter a valid Instagram post, reel, or profile link",
      platform: "INSTAGRAM",
      kind: "UNKNOWN",
      mediaId: null,
      canonicalUrl: null,
      authorHandle: null,
    };
  }

  // 3. TikTok
  if (isHostAllowed(hostname, ["tiktok.com"])) {
    // Video: /@<handle>/video/<id>
    const ttVideoMatch = pathname.match(/^\/@([A-Za-z0-9_.-]{2,24})\/video\/(\d{15,25})\/?$/);
    if (ttVideoMatch && TIKTOK_VIDEO_ID_REGEX.test(ttVideoMatch[2])) {
      const handle = ttVideoMatch[1];
      const id = ttVideoMatch[2];
      return {
        isValid: true,
        platform: "TIKTOK",
        kind: "VIDEO",
        mediaId: id,
        canonicalUrl: `https://www.tiktok.com/@${handle}/video/${id}`,
        authorHandle: handle,
      };
    }

    // Profile: /@<handle>
    const ttProfileMatch = pathname.match(/^\/@([A-Za-z0-9_.-]{2,24})\/?$/);
    if (ttProfileMatch && TIKTOK_HANDLE_REGEX.test(ttProfileMatch[1])) {
      const handle = ttProfileMatch[1];
      return {
        isValid: true,
        platform: "TIKTOK",
        kind: "PROFILE",
        mediaId: null,
        canonicalUrl: `https://www.tiktok.com/@${handle}`,
        authorHandle: handle,
      };
    }

    return {
      isValid: false,
      error: "Please enter a valid TikTok video or profile link",
      platform: "TIKTOK",
      kind: "UNKNOWN",
      mediaId: null,
      canonicalUrl: null,
      authorHandle: null,
    };
  }

  // 4. X (Twitter)
  if (isHostAllowed(hostname, ["twitter.com", "x.com"])) {
    const xStatusMatch = pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})\/?$/);
    if (xStatusMatch && X_STATUS_ID_REGEX.test(xStatusMatch[2])) {
      const handle = xStatusMatch[1];
      const id = xStatusMatch[2];
      return {
        isValid: true,
        platform: "X_TWITTER",
        kind: "STATUS",
        mediaId: id,
        canonicalUrl: `https://x.com/${handle}/status/${id}`,
        authorHandle: handle,
      };
    }

    const xProfileMatch = pathname.match(/^\/(?!status|i\/)([A-Za-z0-9_]{1,15})\/?$/);
    if (xProfileMatch && X_HANDLE_REGEX.test(xProfileMatch[1])) {
      const handle = xProfileMatch[1];
      return {
        isValid: true,
        platform: "X_TWITTER",
        kind: "PROFILE",
        mediaId: null,
        canonicalUrl: `https://x.com/${handle}`,
        authorHandle: handle,
      };
    }

    return {
      isValid: false,
      error: "Please enter a valid X post or profile link",
      platform: "X_TWITTER",
      kind: "UNKNOWN",
      mediaId: null,
      canonicalUrl: null,
      authorHandle: null,
    };
  }

  // 5. Telegram
  if (isHostAllowed(hostname, ["t.me", "telegram.me"])) {
    const tgPostMatch = pathname.match(/^\/([A-Za-z0-9_]{5,32})\/(\d+)\/?$/);
    if (tgPostMatch && TELEGRAM_ID_REGEX.test(tgPostMatch[2])) {
      const handle = tgPostMatch[1];
      const id = tgPostMatch[2];
      return {
        isValid: true,
        platform: "TELEGRAM",
        kind: "POST",
        mediaId: id,
        canonicalUrl: `https://t.me/${handle}/${id}`,
        authorHandle: handle,
      };
    }

    const tgChannelMatch = pathname.match(/^\/(?!joinchat|addstickers)([A-Za-z0-9_]{5,32})\/?$/);
    if (tgChannelMatch && TELEGRAM_HANDLE_REGEX.test(tgChannelMatch[1])) {
      const handle = tgChannelMatch[1];
      return {
        isValid: true,
        platform: "TELEGRAM",
        kind: "CHANNEL",
        mediaId: null,
        canonicalUrl: `https://t.me/${handle}`,
        authorHandle: handle,
      };
    }

    return {
      isValid: false,
      error: "Please enter a valid Telegram channel or post link",
      platform: "TELEGRAM",
      kind: "UNKNOWN",
      mediaId: null,
      canonicalUrl: null,
      authorHandle: null,
    };
  }

  // 6. Facebook
  if (isHostAllowed(hostname, ["facebook.com", "fb.watch", "m.facebook.com"])) {
    const isReel = pathname.includes("/reel/") || pathname.includes("/share/r/") || hostname.includes("fb.watch");
    const isWatch = pathname.includes("/watch") || pathname.includes("/videos/");
    const isPost = pathname.includes("/posts/") || pathname.includes("/story.php");

    const kind: LinkKind = isReel ? "REEL" : isWatch ? "VIDEO" : isPost ? "POST" : "PROFILE";
    return {
      isValid: true,
      platform: "FACEBOOK",
      kind,
      mediaId: pathname,
      canonicalUrl: parsed.href,
      authorHandle: null,
    };
  }

  // 7. Spotify
  if (isHostAllowed(hostname, ["spotify.com", "open.spotify.com"])) {
    const isArtist = pathname.includes("/artist/");
    const kind: LinkKind = isArtist ? "PROFILE" : "POST";
    return {
      isValid: true,
      platform: "SPOTIFY",
      kind,
      mediaId: pathname.replace(/^\//, ""),
      canonicalUrl: parsed.href,
      authorHandle: null,
    };
  }

  // Host not in allowlist
  return {
    isValid: false,
    error: "Please enter a valid supported platform link",
    platform: "UNKNOWN",
    kind: "UNKNOWN",
    mediaId: null,
    canonicalUrl: null,
    authorHandle: null,
  };
}

/**
 * Service-Kind and Platform Compatibility Guard.
 * Ensures the parsed link type matches the selected service type and platform.
 */
export function validateServiceLinkCompatibility(
  parsed: ParsedLinkResult,
  servicePlatform: string,
  serviceMetricOrKind: string
): { isCompatible: boolean; error?: string } {
  if (!parsed.isValid) {
    return { isCompatible: false, error: parsed.error || "Invalid link" };
  }

  const sPlat = (servicePlatform || "").toUpperCase();
  const linkPlat = parsed.platform.toUpperCase();

  // Platform Matching (e.g. Instagram vs YouTube)
  if (sPlat && linkPlat !== "UNKNOWN") {
    const isPlatformMatch =
      sPlat === linkPlat ||
      (sPlat === "X" && linkPlat === "X_TWITTER") ||
      (sPlat === "TWITTER" && linkPlat === "X_TWITTER");

    if (!isPlatformMatch) {
      const friendlyPlatName =
        linkPlat === "X_TWITTER"
          ? "X (Twitter)"
          : linkPlat.charAt(0) + linkPlat.slice(1).toLowerCase();
      const friendlyServicePlatName =
        sPlat === "X" || sPlat === "X_TWITTER"
          ? "X (Twitter)"
          : sPlat.charAt(0) + sPlat.slice(1).toLowerCase();
      return {
        isCompatible: false,
        error: `This link is for ${friendlyPlatName}, but the selected service is for ${friendlyServicePlatName}.`,
      };
    }
  }

  const metric = (serviceMetricOrKind || "").toUpperCase();

  const isPostMetric =
    metric.includes("LIKE") ||
    metric.includes("VIEW") ||
    metric.includes("COMMENT") ||
    metric.includes("SHARE") ||
    metric.includes("RETWEET") ||
    metric.includes("REACTION") ||
    metric.includes("SAVE") ||
    metric.includes("REPOST") ||
    metric.includes("POST") ||
    metric.includes("REEL") ||
    metric.includes("VIDEO");

  const isProfileMetric =
    metric.includes("FOLLOWER") ||
    metric.includes("SUBSCRIBER") ||
    metric.includes("MEMBER") ||
    metric.includes("PROFILE") ||
    metric.includes("CHANNEL");

  const isPostLink =
    parsed.kind === "POST" ||
    parsed.kind === "REEL" ||
    parsed.kind === "VIDEO" ||
    parsed.kind === "SHORT" ||
    parsed.kind === "STATUS";

  const isProfileLink = parsed.kind === "PROFILE" || parsed.kind === "CHANNEL";

  if (isPostMetric && isProfileLink) {
    const descriptor = linkPlat === "YOUTUBE" ? "video" : linkPlat === "INSTAGRAM" ? "post or reel" : "post";
    return {
      isCompatible: false,
      error: `This service needs a ${descriptor} link, not a profile link.`,
    };
  }

  if (isProfileMetric && isPostLink) {
    const descriptor = linkPlat === "YOUTUBE" ? "channel" : "profile";
    const postDescriptor = linkPlat === "YOUTUBE" ? "video" : "post";
    return {
      isCompatible: false,
      error: `This service needs a ${descriptor} link, not a ${postDescriptor} link.`,
    };
  }

  return { isCompatible: true };
}

export interface LinkValidationResult {
  isValid: boolean;
  error?: string;
  detectedType?: "PROFILE" | "POST_OR_REEL" | "CHANNEL" | "OTHER";
  parsed?: ParsedLinkResult;
}

/**
 * Backward-compatible wrapper for existing validateServiceLink calls.
 */
export function validateServiceLink(
  rawUrl: string,
  platform: ServicePlatform | string,
  expectedType: ServiceLinkType | string = "POST_OR_REEL"
): LinkValidationResult {
  const parsed = parseTargetUrl(rawUrl);
  if (!parsed.isValid) {
    return {
      isValid: false,
      error: parsed.error,
      detectedType: parsed.kind === "PROFILE" || parsed.kind === "CHANNEL" ? "PROFILE" : "OTHER",
      parsed,
    };
  }

  const expectedKind = (expectedType || "").toUpperCase();
  const check = validateServiceLinkCompatibility(
    parsed,
    platform,
    expectedKind === "PROFILE" || expectedKind === "CHANNEL" ? "FOLLOWER" : "LIKE"
  );

  let detectedType: "PROFILE" | "POST_OR_REEL" | "CHANNEL" | "OTHER" = "OTHER";
  if (parsed.kind === "PROFILE") {
    detectedType = parsed.platform === "YOUTUBE" ? "CHANNEL" : "PROFILE";
  } else if (parsed.kind === "CHANNEL") {
    detectedType = "CHANNEL";
  } else if (
    parsed.kind === "POST" ||
    parsed.kind === "REEL" ||
    parsed.kind === "VIDEO" ||
    parsed.kind === "SHORT" ||
    parsed.kind === "STATUS"
  ) {
    detectedType = "POST_OR_REEL";
  }

  if (!check.isCompatible) {
    return {
      isValid: false,
      error: check.error,
      detectedType,
      parsed,
    };
  }

  return {
    isValid: true,
    detectedType,
    parsed,
  };
}
