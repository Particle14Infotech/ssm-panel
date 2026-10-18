import { ServiceLinkType, ServicePlatform } from "./services";

export interface LinkValidationResult {
  isValid: boolean;
  error?: string;
  detectedType?: "PROFILE" | "POST_OR_REEL" | "CHANNEL" | "OTHER";
}

/**
 * Validates a target link according to the platform and expected link type.
 * Returns friendly, actionable error messages with mismatch diagnosis.
 */
export function validateServiceLink(
  rawUrl: string,
  platform: ServicePlatform | string,
  expectedType: ServiceLinkType | string = "POST_OR_REEL"
): LinkValidationResult {
  const url = (rawUrl || "").trim();
  if (!url) {
    return { isValid: false, error: "Link is required." };
  }

  // Basic URL sanity check (accepts http, https, or username handles with @)
  const isHandle = url.startsWith("@");
  if (!isHandle && !/^https?:\/\//i.test(url)) {
    return {
      isValid: false,
      error: "Please enter a valid URL starting with http:// or https:// (or @username for profiles).",
    };
  }

  const normalizedPlatform = (platform || "").toUpperCase();

  // Platform-specific rules
  switch (normalizedPlatform) {
    case "INSTAGRAM": {
      const isPost = /(?:instagram\.com\/(?:p|reel|tv|reels)\/([A-Za-z0-9_-]+))/i.test(url);
      const isProfile = isHandle || /(?:instagram\.com\/(?!p\/|reel\/|tv\/|reels\/|stories\/)([A-Za-z0-9_.]+))\/?(?:\?.*)?$/i.test(url);

      if (expectedType === "PROFILE") {
        if (isPost) {
          return { isValid: false, error: "This service needs a profile link, not a post link.", detectedType: "POST_OR_REEL" };
        }
        if (!isProfile) {
          return { isValid: false, error: "Please enter a valid Instagram profile link (e.g. https://instagram.com/username).", detectedType: "OTHER" };
        }
        return { isValid: true, detectedType: "PROFILE" };
      } else {
        // Expected POST_OR_REEL
        if (isProfile && !isPost) {
          return { isValid: false, error: "This service needs a post or reel link, not a profile link.", detectedType: "PROFILE" };
        }
        if (!isPost) {
          return { isValid: false, error: "Please enter a valid Instagram post or reel link (e.g. https://instagram.com/reel/...).", detectedType: "OTHER" };
        }
        return { isValid: true, detectedType: "POST_OR_REEL" };
      }
    }

    case "YOUTUBE": {
      const isVideo = /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i.test(url);
      const isChannel = /(?:youtube\.com\/(?:@|channel\/|c\/|user\/)[A-Za-z0-9_.-]+)/i.test(url);

      if (expectedType === "PROFILE" || expectedType === "CHANNEL") {
        if (isVideo) {
          return { isValid: false, error: "This service needs a channel link, not a video link.", detectedType: "POST_OR_REEL" };
        }
        if (!isChannel) {
          return { isValid: false, error: "Please enter a valid YouTube channel link (e.g. https://youtube.com/@channel).", detectedType: "OTHER" };
        }
        return { isValid: true, detectedType: "CHANNEL" };
      } else {
        // Expected video / post
        if (isChannel && !isVideo) {
          return { isValid: false, error: "This service needs a video link, not a channel link.", detectedType: "CHANNEL" };
        }
        if (!isVideo) {
          return { isValid: false, error: "Please enter a valid YouTube video or shorts link (e.g. https://youtube.com/watch?v=...).", detectedType: "OTHER" };
        }
        return { isValid: true, detectedType: "POST_OR_REEL" };
      }
    }

    case "TIKTOK": {
      const isVideo = /(?:tiktok\.com\/@[^/]+\/video\/\d+|vm\.tiktok\.com\/[A-Za-z0-9]+)/i.test(url);
      const isProfile = isHandle || /(?:tiktok\.com\/@[A-Za-z0-9_.-]+)\/?(?:\?.*)?$/i.test(url);

      if (expectedType === "PROFILE") {
        if (isVideo) {
          return { isValid: false, error: "This service needs a profile link, not a video link.", detectedType: "POST_OR_REEL" };
        }
        if (!isProfile) {
          return { isValid: false, error: "Please enter a valid TikTok profile link (e.g. https://tiktok.com/@username).", detectedType: "OTHER" };
        }
        return { isValid: true, detectedType: "PROFILE" };
      } else {
        if (isProfile && !isVideo) {
          return { isValid: false, error: "This service needs a video link, not a profile link.", detectedType: "PROFILE" };
        }
        if (!isVideo) {
          return { isValid: false, error: "Please enter a valid TikTok video link.", detectedType: "OTHER" };
        }
        return { isValid: true, detectedType: "POST_OR_REEL" };
      }
    }

    case "X_TWITTER":
    case "X": {
      const isStatus = /(?:(?:twitter|x)\.com\/[A-Za-z0-9_]+\/status\/\d+)/i.test(url);
      const isProfile = isHandle || /(?:(?:twitter|x)\.com\/(?!status)[A-Za-z0-9_]+)\/?(?:\?.*)?$/i.test(url);

      if (expectedType === "PROFILE") {
        if (isStatus) {
          return { isValid: false, error: "This service needs a profile link, not a post link.", detectedType: "POST_OR_REEL" };
        }
        if (!isProfile) {
          return { isValid: false, error: "Please enter a valid X (Twitter) profile link.", detectedType: "OTHER" };
        }
        return { isValid: true, detectedType: "PROFILE" };
      } else {
        if (isProfile && !isStatus) {
          return { isValid: false, error: "This service needs a post link, not a profile link.", detectedType: "PROFILE" };
        }
        if (!isStatus) {
          return { isValid: false, error: "Please enter a valid X post link (e.g. https://x.com/username/status/...).", detectedType: "OTHER" };
        }
        return { isValid: true, detectedType: "POST_OR_REEL" };
      }
    }

    case "TELEGRAM": {
      const isMsg = /(?:t\.me\/[A-Za-z0-9_]+\/\d+)/i.test(url);
      const isChannel = isHandle || /(?:t\.me\/(?!joinchat)[A-Za-z0-9_]+)\/?(?:\?.*)?$/i.test(url);

      if (expectedType === "PROFILE" || expectedType === "CHANNEL") {
        if (isMsg) {
          return { isValid: false, error: "This service needs a channel/group link, not a message link.", detectedType: "POST_OR_REEL" };
        }
        if (!isChannel) {
          return { isValid: false, error: "Please enter a valid Telegram channel or username (e.g. https://t.me/channel).", detectedType: "OTHER" };
        }
        return { isValid: true, detectedType: "CHANNEL" };
      } else {
        if (!isMsg && !isChannel) {
          return { isValid: false, error: "Please enter a valid Telegram message or post link.", detectedType: "OTHER" };
        }
        return { isValid: true, detectedType: "POST_OR_REEL" };
      }
    }

    default: {
      // Generic URL validation
      if (!/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(url) && !url.startsWith("@")) {
        return { isValid: false, error: "Please enter a valid link." };
      }
      return { isValid: true, detectedType: "OTHER" };
    }
  }
}
