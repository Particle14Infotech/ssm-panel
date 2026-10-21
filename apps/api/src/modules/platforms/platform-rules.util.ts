import { BadRequestException } from "@nestjs/common";

export interface PlatformRuleDefinition {
  platform: string;
  displayName: string;
  handleRegex: string;
  handleMaxLength: number;
  hostAllowlist: string[];
  pathPattern: string;
  mediaKeyExtractor: string;
  urlContainsHandle: boolean;
  eligibleRuleKinds: string[];
  followersIntervals: number[];
  minGapMinutes: number;
  maxRunsPerPost: number;
  defaultWindowMinutes: number;
  limits: Record<string, any>;
  active: boolean;
}

export const SHORT_LINK_HOSTS = new Set([
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
]);

export const DEFAULT_PLATFORM_CONFIGS: PlatformRuleDefinition[] = [
  {
    platform: "instagram",
    displayName: "Instagram",
    handleRegex: "^[a-zA-Z0-9._]{1,30}$",
    handleMaxLength: 30,
    hostAllowlist: ["instagram.com", "www.instagram.com"],
    pathPattern: "^/(?:p|reel|tv)/([a-zA-Z0-9_-]+)/?",
    mediaKeyExtractor: "$1",
    urlContainsHandle: false,
    eligibleRuleKinds: ["POST_TRIGGERED", "TIME_DRIP"],
    followersIntervals: [1, 2, 4, 8, 12, 24],
    minGapMinutes: 15,
    maxRunsPerPost: 10,
    defaultWindowMinutes: 180,
    limits: { exampleMinQty: 50, exampleMaxQty: 100000 },
    active: true,
  },
  {
    platform: "tiktok",
    displayName: "TikTok",
    handleRegex: "^[a-zA-Z0-9_.-]{2,24}$",
    handleMaxLength: 24,
    hostAllowlist: ["tiktok.com", "www.tiktok.com"],
    pathPattern: "^/@([a-zA-Z0-9_.-]+)/video/([0-9]+)/?",
    mediaKeyExtractor: "$2",
    urlContainsHandle: true,
    eligibleRuleKinds: ["POST_TRIGGERED", "TIME_DRIP"],
    followersIntervals: [1, 2, 4, 8, 12, 24],
    minGapMinutes: 15,
    maxRunsPerPost: 10,
    defaultWindowMinutes: 180,
    limits: { exampleMinQty: 100, exampleMaxQty: 200000 },
    active: true,
  },
  {
    platform: "youtube",
    displayName: "YouTube",
    handleRegex: "^[a-zA-Z0-9_.-]{3,30}$",
    handleMaxLength: 30,
    hostAllowlist: ["youtube.com", "www.youtube.com", "youtu.be"],
    pathPattern: "^(?:/watch\\?v=([a-zA-Z0-9_-]{11})|/shorts/([a-zA-Z0-9_-]{11})|/([a-zA-Z0-9_-]{11}))/?",
    mediaKeyExtractor: "$1||$2||$3",
    urlContainsHandle: false,
    eligibleRuleKinds: ["POST_TRIGGERED", "TIME_DRIP"],
    followersIntervals: [1, 2, 4, 8, 12, 24],
    minGapMinutes: 15,
    maxRunsPerPost: 10,
    defaultWindowMinutes: 180,
    limits: { exampleMinQty: 100, exampleMaxQty: 50000 },
    active: true,
  },
  {
    platform: "facebook",
    displayName: "Facebook",
    handleRegex: "^[a-zA-Z0-9.]{5,50}$",
    handleMaxLength: 50,
    hostAllowlist: ["facebook.com", "www.facebook.com", "fb.watch"],
    pathPattern: "^/(?:reel/([0-9]+)|watch/?\\?v=([0-9]+)|([a-zA-Z0-9.]+)/posts/([0-9]+))/?",
    mediaKeyExtractor: "$1||$2||$4",
    urlContainsHandle: false,
    eligibleRuleKinds: ["POST_TRIGGERED", "TIME_DRIP"],
    followersIntervals: [1, 2, 4, 8, 12, 24],
    minGapMinutes: 15,
    maxRunsPerPost: 10,
    defaultWindowMinutes: 180,
    limits: { exampleMinQty: 50, exampleMaxQty: 50000 },
    active: true,
  },
  {
    platform: "x",
    displayName: "X",
    handleRegex: "^[a-zA-Z0-9_]{1,15}$",
    handleMaxLength: 15,
    hostAllowlist: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
    pathPattern: "^/([a-zA-Z0-9_]+)/status/([0-9]+)/?",
    mediaKeyExtractor: "$2",
    urlContainsHandle: true,
    eligibleRuleKinds: ["POST_TRIGGERED", "TIME_DRIP"],
    followersIntervals: [1, 2, 4, 8, 12, 24],
    minGapMinutes: 15,
    maxRunsPerPost: 10,
    defaultWindowMinutes: 180,
    limits: { exampleMinQty: 50, exampleMaxQty: 50000 },
    active: true,
  },
  {
    platform: "telegram",
    displayName: "Telegram",
    handleRegex: "^[a-zA-Z0-9_]{5,32}$",
    handleMaxLength: 32,
    hostAllowlist: ["t.me", "telegram.me"],
    pathPattern: "^/([a-zA-Z0-9_]+)/([0-9]+)/?",
    mediaKeyExtractor: "$2",
    urlContainsHandle: true,
    eligibleRuleKinds: ["POST_TRIGGERED", "TIME_DRIP"],
    followersIntervals: [1, 2, 4, 8, 12, 24],
    minGapMinutes: 15,
    maxRunsPerPost: 10,
    defaultWindowMinutes: 180,
    limits: { exampleMinQty: 100, exampleMaxQty: 100000 },
    active: true,
  },
];

/**
 * Normalizes user handle: trims whitespace and strips leading '@'.
 */
export function normalizeHandle(handle: string): string {
  if (!handle) return "";
  return handle.trim().replace(/^@+/, "");
}

/**
 * Validates a normalized handle against a platform's configuration rules.
 */
export function validateHandle(handle: string, config: PlatformRuleDefinition): string {
  const normalized = normalizeHandle(handle);
  if (!normalized) {
    throw new BadRequestException("Handle is required.");
  }
  if (normalized.length > config.handleMaxLength) {
    throw new BadRequestException(
      `Handle exceeds maximum allowed length of ${config.handleMaxLength} characters for ${config.displayName}.`
    );
  }
  const regex = new RegExp(config.handleRegex);
  if (!regex.test(normalized)) {
    throw new BadRequestException(
      `Invalid handle format for ${config.displayName}. Must match pattern: ${config.handleRegex}`
    );
  }
  return normalized;
}

export interface LinkValidationResult {
  valid: boolean;
  isValid: boolean;
  platform: string;
  mediaKey: string;
  normalizedUrl: string;
  urlHandle?: string;
  error?: string;
}

/**
 * Validates and extracts media key from a post link strictly using offline regex/URL parsing.
 * NEVER makes outbound HTTP requests.
 * Rejects short links with a clear error.
 */
export function validatePlatformLink(
  rawUrl: string,
  config: PlatformRuleDefinition,
  expectedHandle?: string
): LinkValidationResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new BadRequestException("URL is required.");
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException("Invalid URL format. Please provide a full URL with https://");
  }

  const hostname = parsed.hostname.toLowerCase();

  // 1. Strict short-link rejection
  if (SHORT_LINK_HOSTS.has(hostname) || hostname.endsWith(".bit.ly") || hostname.endsWith(".tinyurl.com")) {
    throw new BadRequestException(
      "Shortened URLs are not permitted. Please provide the direct platform link."
    );
  }

  // 2. Host allowlist check
  const hostAllowed = config.hostAllowlist.some(
    (allowed) => hostname === allowed.toLowerCase() || hostname.endsWith(`.${allowed.toLowerCase()}`)
  );

  if (!hostAllowed) {
    throw new BadRequestException(
      `Invalid host "${hostname}" for ${config.displayName}. Allowed hosts: ${config.hostAllowlist.join(", ")}`
    );
  }

  // 3. Path pattern and media key extraction
  // Combine pathname and search for platforms like YouTube (?v=...)
  const fullPath = parsed.pathname + parsed.search;
  const pathRegex = new RegExp(config.pathPattern);
  const match = fullPath.match(pathRegex);

  if (!match) {
    throw new BadRequestException(
      `Invalid post/video link format for ${config.displayName}. Please verify the link points to a single post or video.`
    );
  }

  // Extract mediaKey
  let mediaKey = "";
  let urlHandle: string | undefined = undefined;

  if (config.platform === "tiktok") {
    urlHandle = match[1];
    mediaKey = match[2];
  } else if (config.platform === "x") {
    urlHandle = match[1];
    mediaKey = match[2];
  } else if (config.platform === "telegram") {
    urlHandle = match[1];
    mediaKey = match[2];
  } else if (config.platform === "youtube") {
    mediaKey = match[1] || match[2] || match[3] || "";
  } else if (config.platform === "facebook") {
    mediaKey = match[1] || match[2] || match[4] || "";
    if (match[3]) urlHandle = match[3];
  } else {
    // instagram and general
    mediaKey = match[1];
  }

  if (!mediaKey) {
    throw new BadRequestException(`Could not extract media key from the provided ${config.displayName} URL.`);
  }

  // 4. Handle matching if URL contains handle and expectedHandle is provided
  if (config.urlContainsHandle && expectedHandle && urlHandle) {
    const normalizedExpected = normalizeHandle(expectedHandle).toLowerCase();
    const normalizedUrlHandle = normalizeHandle(urlHandle).toLowerCase();
    if (normalizedExpected !== normalizedUrlHandle) {
      throw new BadRequestException(
        `The post link handle (@${urlHandle}) does not match the package handle (@${expectedHandle}).`
      );
    }
  }

  // Canonical clean URL without query params (except for youtube ?v=)
  let cleanUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  if (config.platform === "youtube" && parsed.searchParams.has("v")) {
    cleanUrl = `${parsed.protocol}//${parsed.hostname}/watch?v=${parsed.searchParams.get("v")}`;
  }

  return {
    valid: true,
    isValid: true,
    platform: config.platform,
    mediaKey,
    normalizedUrl: cleanUrl,
    urlHandle,
  };
}
