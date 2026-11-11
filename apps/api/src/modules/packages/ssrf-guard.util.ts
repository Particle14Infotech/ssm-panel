import { URL } from "url";
import * as dns from "dns/promises";
import * as net from "net";

export const ALLOWED_IMAGE_DOMAINS = [
  "cdninstagram.com",
  "instagram.com",
  "fbcdn.net",
  "ytimg.com",
  "youtube.com",
  "ggpht.com",
  "images.unsplash.com",
  "t.me",
  "telegram.org",
  "telesco.pe",
  "tiktokcdn.com",
  "tiktokcdn-eu.com",
  "tiktok.com",
  "twimg.com",
  "twitter.com",
  "x.com",
];

const PRIVATE_IP_REGEX = /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2[0-9]|3[0-1])\.|0\.|::1|localhost)/i;

/**
 * Checks if a resolved IP address belongs to private, loopback, link-local, or cloud metadata ranges.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip) return true;

  // Normalize IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;

    // 0.0.0.0/8 (Broadcast/Current network)
    if (parts[0] === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link-local / AWS / Cloud metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 255.255.255.255 (Broadcast)
    if (parts[0] === 255 && parts[1] === 255 && parts[2] === 255 && parts[3] === 255) return true;

    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // ::1 (Loopback) or :: (Unspecified)
    if (normalized === "::1" || normalized === "::") return true;
    // fe80::/10 (Link-local)
    if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    // fc00::/7 (Unique local)
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

    return false;
  }

  return true;
}

/**
 * Performs DNS resolution and asserts that ALL resolved IPs for hostname are non-private and public.
 */
export async function isSafeResolvedIp(hostname: string): Promise<boolean> {
  if (!hostname || typeof hostname !== "string") return false;
  if (PRIVATE_IP_REGEX.test(hostname)) return false;

  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) return false;

    for (const record of addresses) {
      if (isPrivateOrReservedIp(record.address)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates whether an image URL is safe to proxy (blocks SSRF, private IPs, non-HTTPS).
 */
export function isSafeImageUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;

  try {
    const u = new URL(rawUrl.trim());

    // Protocol must strictly be HTTPS
    if (u.protocol !== "https:") return false;

    const hostname = u.hostname.toLowerCase();

    // Block private IPs / localhost / cloud metadata
    if (PRIVATE_IP_REGEX.test(hostname)) return false;

    // Check against allowed domains
    const isAllowed = ALLOWED_IMAGE_DOMAINS.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
    );

    return isAllowed;
  } catch {
    return false;
  }
}

/**
 * Validates social media platform target URLs for scrapers
 */
export function isSafePlatformUrl(
  rawUrl: string,
  expectedPlatform: "INSTAGRAM" | "YOUTUBE" | "TELEGRAM" | "TIKTOK" | "TWITTER" | "X" | "X_TWITTER"
): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;

  try {
    const u = new URL(rawUrl.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;

    const hostname = u.hostname.toLowerCase();
    if (PRIVATE_IP_REGEX.test(hostname)) return false;

    if (expectedPlatform === "INSTAGRAM") {
      return hostname === "instagram.com" || hostname.endsWith(".instagram.com");
    }

    if (expectedPlatform === "YOUTUBE") {
      return hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be";
    }

    if (expectedPlatform === "TELEGRAM") {
      return hostname === "t.me" || hostname.endsWith(".t.me") || hostname === "telegram.me";
    }

    if (expectedPlatform === "TIKTOK") {
      return hostname === "tiktok.com" || hostname.endsWith(".tiktok.com");
    }

    if (expectedPlatform === "TWITTER" || expectedPlatform === "X" || expectedPlatform === "X_TWITTER") {
      return (
        hostname === "x.com" ||
        hostname.endsWith(".x.com") ||
        hostname === "twitter.com" ||
        hostname.endsWith(".twitter.com")
      );
    }

    return false;
  } catch {
    return false;
  }
}

