import { Injectable, Logger } from "@nestjs/common";
import * as https from "https";
import * as http from "http";
import { URL } from "url";
import { isSafeResolvedIp } from "./ssrf-guard.util";

export interface DetectedMedia {
  platform: "INSTAGRAM" | "YOUTUBE";
  mediaKey: string;
  url: string;
  title: string;
  author: string;
  publishedAt: string;
  thumbnailUrl: string;
  rawImage?: string;
  isLiveDetected: boolean;
  mediaType: "REEL" | "POST" | "VIDEO" | "SHORTS";
  recentCodes?: string[];
  note?: string;
}

export interface DetectedProfile {
  platform: "INSTAGRAM" | "YOUTUBE";
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  followerCount?: string;
}

export interface AutopilotPreviewResult {
  profile: DetectedProfile;
  latestMedia: DetectedMedia | null;
}

function cleanUnicode(str: string): string {
  if (!str) return "";
  return str
    .replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16)))
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

const PRIVATE_IP_REGEX = /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2[0-9]|3[0-1])\.|0\.|::1|localhost)/i;

function isHostAllowedForScraping(hostname: string): boolean {
  if (PRIVATE_IP_REGEX.test(hostname)) return false;
  return (
    hostname === "instagram.com" ||
    hostname.endsWith(".instagram.com") ||
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtu.be"
  );
}

async function fetchHttp(
  targetUrl: string,
  headers: Record<string, string> = {},
  maxHops = 5
): Promise<{ status: number; data: string; headers: Record<string, any> }> {
  if (maxHops <= 0) throw new Error("Too many redirects");

  const u = new URL(targetUrl);
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("Disallowed protocol for scraping");
  }

  const hostname = u.hostname.toLowerCase();
  if (!isHostAllowedForScraping(hostname)) {
    throw new Error(`Host '${hostname}' is disallowed or internal.`);
  }

  const isDnsSafe = await isSafeResolvedIp(hostname);
  if (!isDnsSafe) {
    throw new Error(`Host '${hostname}' resolved to a private or disallowed IP address.`);
  }

  return new Promise((resolve, reject) => {
    try {
      const client = u.protocol === "https:" ? https : http;

      const defaultHeaders: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...headers,
      };

      const req = client.get(targetUrl, { headers: defaultHeaders, timeout: 5000 }, async (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          let nextLoc = res.headers.location;
          if (nextLoc.startsWith("/")) {
            nextLoc = `${u.protocol}//${u.host}${nextLoc}`;
          }
          try {
            const redirectU = new URL(nextLoc);
            if (!isHostAllowedForScraping(redirectU.hostname.toLowerCase())) {
              return reject(new Error(`Redirect to disallowed host '${redirectU.hostname}' blocked.`));
            }
            const isRedirectDnsSafe = await isSafeResolvedIp(redirectU.hostname.toLowerCase());
            if (!isRedirectDnsSafe) {
              return reject(new Error(`Redirect host '${redirectU.hostname}' resolved to private IP.`));
            }
          } catch {
            return reject(new Error("Invalid redirect location"));
          }
          return fetchHttp(nextLoc, headers, maxHops - 1).then(resolve).catch(reject);
        }

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
          if (data.length > 3000000) res.destroy(); // 3MB limit
        });

        res.on("end", () => {
          resolve({ status: res.statusCode || 200, data, headers: res.headers });
        });
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
    } catch (e) {
      reject(e);
    }
  });
}

@Injectable()
export class AutopilotDetectorService {
  private readonly logger = new Logger(AutopilotDetectorService.name);

  /**
   * Scrapes metadata for a specific Instagram shortcode (reel or post)
   */
  async scrapeInstagramPost(shortcode: string, authorHandle = ""): Promise<DetectedMedia> {
    const postUrl = `https://www.instagram.com/reel/${shortcode}/`;
    try {
      const res = await fetchHttp(postUrl);
      const html = res.data;

      const getMeta = (prop: string) => {
        const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["'](?:og:)?${prop}["'][^>]+content=["']([^"']*)["']`, "i"));
        return m ? m[1] : null;
      };

      let title = getMeta("title") || getMeta("description") || `Instagram Reel (${shortcode})`;
      title = cleanUnicode(title);

      const image = getMeta("image") || getMeta("image:src");

      return {
        platform: "INSTAGRAM",
        mediaKey: shortcode,
        url: postUrl,
        title,
        author: authorHandle ? `@${authorHandle}` : (getMeta("site_name") || "Instagram"),
        publishedAt: new Date().toISOString(),
        thumbnailUrl: image ? `/api/v1/packages/autopilot/proxy-image?url=${encodeURIComponent(image)}` : "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
        rawImage: image || undefined,
        isLiveDetected: true,
        mediaType: "REEL",
      };
    } catch (e: any) {
      this.logger.warn(`Failed to scrape Instagram post ${shortcode}: ${e.message}`);
      return {
        platform: "INSTAGRAM",
        mediaKey: shortcode,
        url: postUrl,
        title: `Instagram Reel (${shortcode})`,
        author: authorHandle ? `@${authorHandle}` : "Instagram",
        publishedAt: new Date().toISOString(),
        thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
        isLiveDetected: true,
        mediaType: "REEL",
      };
    }
  }

  /**
   * Real Instagram Auto-Detector from Profile Handle or URL
   * Chronologically sorts media by pk descending to bypass pinned posts
   */
  async detectRealInstagram(handleOrUrl: string): Promise<DetectedMedia> {
    const input = handleOrUrl.trim();

    // Direct reel or post URL
    if (input.includes("instagram.com/reel/") || input.includes("instagram.com/p/")) {
      const shortcodeMatch = input.match(/instagram\.com\/(?:reel|p)\/([a-zA-Z0-9_-]+)/);
      const shortcode = shortcodeMatch ? shortcodeMatch[1] : null;
      if (shortcode) {
        return this.scrapeInstagramPost(shortcode);
      }
    }

    const cleanHandle = input.replace(/^@/, "").replace(/https?:\/\/(?:www\.)?instagram\.com\//, "").replace(/\/$/, "");
    const profileUrl = `https://www.instagram.com/${cleanHandle}/`;

    const res = await fetchHttp(profileUrl, {
      "User-Agent": "facebookexternalhit/1.1 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });
    const html = res.data;

    // Extract Polaris media nodes
    const nodePattern =
      /\{"node":\{"__typename":"([^"]+)","__isXIGPolarisMedia":"[^"]*","pk":"([0-9]+)","code":"([a-zA-Z0-9_-]+)"[^{}]*?"accessibility_caption":"([^"]*)"[^{}]*?"caption":\{"text":"([^"]*)"\}[^{}]*?"display_uri":"([^"]+)"/g;

    let m: RegExpExecArray | null;
    const nodes: Array<{
      typename: string;
      pk: bigint;
      shortcode: string;
      accessibility_caption: string;
      caption: string;
      displayUri: string;
    }> = [];

    while ((m = nodePattern.exec(html)) !== null) {
      const rawUri = m[6].replace(/\\\//g, "/").replace(/\\u0026/g, "&");
      nodes.push({
        typename: m[1],
        pk: BigInt(m[2]),
        shortcode: m[3],
        accessibility_caption: cleanUnicode(m[4]),
        caption: cleanUnicode(m[5]),
        displayUri: rawUri,
      });
    }

    if (nodes.length > 0) {
      // Sort chronologically by pk descending (highest pk = newest upload, ignores pinned posts!)
      nodes.sort((a, b) => (b.pk > a.pk ? 1 : -1));

      const newestReel = nodes.find((n) => n.typename === "XIGPolarisVideoMedia") || nodes[0];
      const proxyThumbnail = `/api/v1/packages/autopilot/proxy-image?url=${encodeURIComponent(newestReel.displayUri)}`;

      return {
        platform: "INSTAGRAM",
        mediaKey: newestReel.shortcode,
        url: `https://www.instagram.com/reel/${newestReel.shortcode}/`,
        title: newestReel.caption || newestReel.accessibility_caption || `Instagram Reel (${newestReel.shortcode})`,
        author: `@${cleanHandle}`,
        publishedAt: newestReel.accessibility_caption || new Date().toISOString(),
        thumbnailUrl: proxyThumbnail,
        rawImage: newestReel.displayUri,
        isLiveDetected: true,
        mediaType: newestReel.typename === "XIGPolarisVideoMedia" ? "REEL" : "POST",
        recentCodes: nodes.slice(0, 6).map((n) => n.shortcode),
      };
    }

    // Fallback: extract shortcodes from raw markup
    const rawCodes = [
      ...html.matchAll(/"shortcode":"([a-zA-Z0-9_-]+)"/g),
      ...html.matchAll(/\/p\/([a-zA-Z0-9_-]+)/g),
      ...html.matchAll(/\/reel\/([a-zA-Z0-9_-]+)/g),
    ].map((m) => m[1]);

    const uniqueCodes = [...new Set(rawCodes)];

    if (uniqueCodes.length > 0) {
      const chosenCode = uniqueCodes[0];
      const postDetails = await this.scrapeInstagramPost(chosenCode, cleanHandle);
      postDetails.recentCodes = uniqueCodes.slice(0, 5);
      return postDetails;
    }

    // Profile-only fallback
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i);
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/i);

    return {
      platform: "INSTAGRAM",
      mediaKey: `profile_${cleanHandle}`,
      url: profileUrl,
      title: ogTitle ? cleanUnicode(ogTitle[1]) : `Instagram Profile @${cleanHandle}`,
      author: `@${cleanHandle}`,
      publishedAt: new Date().toISOString(),
      thumbnailUrl: ogImage
        ? `/api/v1/packages/autopilot/proxy-image?url=${encodeURIComponent(ogImage[1])}`
        : "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80",
      isLiveDetected: false,
      mediaType: "POST",
      note: "Profile found, no recent public posts exposed.",
    };
  }

  /**
   * Real YouTube Channel / Video / Shorts Auto-Detector
   */
  async detectRealYouTube(handleOrUrl: string): Promise<DetectedMedia> {
    const input = handleOrUrl.trim();

    // Direct video / shorts
    let directVideoId: string | null = null;
    if (input.includes("watch?v=")) {
      const m = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (m) directVideoId = m[1];
    } else if (input.includes("youtu.be/")) {
      const m = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      if (m) directVideoId = m[1];
    } else if (input.includes("/shorts/")) {
      const m = input.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (m) directVideoId = m[1];
    }

    if (directVideoId) {
      try {
        const oembedRes = await fetchHttp(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${directVideoId}&format=json`);
        const data = JSON.parse(oembedRes.data);
        return {
          platform: "YOUTUBE",
          mediaKey: directVideoId,
          url: `https://www.youtube.com/watch?v=${directVideoId}`,
          title: data.title || `YouTube Video (${directVideoId})`,
          author: data.author_name || "YouTube Creator",
          publishedAt: new Date().toISOString(),
          thumbnailUrl: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
          isLiveDetected: true,
          mediaType: input.includes("/shorts/") ? "SHORTS" : "VIDEO",
        };
      } catch {
        return {
          platform: "YOUTUBE",
          mediaKey: directVideoId,
          url: `https://www.youtube.com/watch?v=${directVideoId}`,
          title: `YouTube Video (${directVideoId})`,
          author: "YouTube Creator",
          publishedAt: new Date().toISOString(),
          thumbnailUrl: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
          isLiveDetected: true,
          mediaType: "VIDEO",
        };
      }
    }

    let channelUrl = input;
    if (!channelUrl.startsWith("http")) {
      const cleanHandle = input.replace(/^@/, "");
      channelUrl = `https://www.youtube.com/@${cleanHandle}`;
    }

    let videosTabUrl = channelUrl;
    if (!videosTabUrl.includes("/videos")) {
      videosTabUrl = videosTabUrl.replace(/\/$/, "") + "/videos";
    }

    const res = await fetchHttp(videosTabUrl);
    const html = res.data;

    let channelId: string | null = null;
    const matchId =
      html.match(/"browseId":"(UC[a-zA-Z0-9_-]{22})"/) ||
      html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/) ||
      html.match(/channel\/(UC[a-zA-Z0-9_-]{22})/) ||
      html.match(/<meta itemprop="identifier" content="(UC[a-zA-Z0-9_-]{22})"/);

    if (matchId) {
      channelId = matchId[1];
    }

    if (channelId) {
      try {
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        const rssRes = await fetchHttp(rssUrl);
        const entries = [...rssRes.data.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

        if (entries.length > 0) {
          const firstEntry = entries[0][1];
          const vidIdMatch = firstEntry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
          const titleMatch = firstEntry.match(/<title>([^<]+)<\/title>/);
          const publishedMatch = firstEntry.match(/<published>([^<]+)<\/published>/);
          const authorMatch = firstEntry.match(/<author>\s*<name>([^<]+)<\/name>/);

          if (vidIdMatch) {
            const videoId = vidIdMatch[1];
            const recentVideos = entries
              .slice(0, 5)
              .map((e) => {
                const vm = e[1].match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
                return vm ? vm[1] : null;
              })
              .filter(Boolean) as string[];

            return {
              platform: "YOUTUBE",
              mediaKey: videoId,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              title: titleMatch ? cleanUnicode(titleMatch[1]) : `YouTube Video (${videoId})`,
              author: authorMatch ? cleanUnicode(authorMatch[1]) : "YouTube Creator",
              publishedAt: publishedMatch ? publishedMatch[1] : new Date().toISOString(),
              thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              isLiveDetected: true,
              mediaType: "VIDEO",
              recentCodes: recentVideos,
            };
          }
        }
      } catch {}
    }

    // Fallback: extract latest videoId from channel HTML
    const videoMatches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
    const uniqueVideos = [...new Set(videoMatches)];

    if (uniqueVideos.length > 0) {
      const videoId = uniqueVideos[0];
      const titleMatch = html.match(/"title":\{"runs":\[\{"text":"([^"]+)"\}\]/);

      return {
        platform: "YOUTUBE",
        mediaKey: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: titleMatch ? cleanUnicode(titleMatch[1]) : `YouTube Video (${videoId})`,
        author: input,
        publishedAt: new Date().toISOString(),
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        isLiveDetected: true,
        mediaType: "VIDEO",
        recentCodes: uniqueVideos.slice(0, 5),
      };
    }

    throw new Error(`Could not find latest public video for YouTube channel "${input}"`);
  }

  /**
   * Universal Smart Auto-Detector:
   * Determines platform automatically from input or explicit platform hint
   */
  async autoDetect(input: string, platformHint?: string): Promise<AutopilotPreviewResult> {
    const raw = input.trim();
    let targetPlatform: "INSTAGRAM" | "YOUTUBE" = "INSTAGRAM";

    if (platformHint) {
      const p = platformHint.toUpperCase();
      if (p.includes("YOUTUBE") || p === "YT") targetPlatform = "YOUTUBE";
      else targetPlatform = "INSTAGRAM";
    } else {
      if (raw.includes("youtube.com") || raw.includes("youtu.be")) {
        targetPlatform = "YOUTUBE";
      } else if (raw.includes("instagram.com")) {
        targetPlatform = "INSTAGRAM";
      } else {
        // Default to Instagram for typical creator handles (e.g. @areion._)
        targetPlatform = "INSTAGRAM";
      }
    }

    let cleanHandle = raw;
    if (cleanHandle.startsWith("http")) {
      try {
        const u = new URL(cleanHandle);
        const parts = u.pathname.split("/").filter(Boolean);
        cleanHandle = parts[0] || raw;
      } catch {}
    }
    cleanHandle = cleanHandle.replace(/^@/, "").replace(/\/$/, "");

    let media: DetectedMedia | null = null;
    let detectedHandle = `@${cleanHandle}`;
    let avatarUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80";

    const enableInstagramScraping = process.env.ENABLE_INSTAGRAM_SCRAPING === "true";
    try {
      if (targetPlatform === "INSTAGRAM") {
        const isDirectPost = raw.includes("instagram.com/reel/") || raw.includes("instagram.com/p/");
        if (isDirectPost || enableInstagramScraping) {
          media = await this.detectRealInstagram(raw);
          detectedHandle = media.author || `@${cleanHandle}`;
          if (media.thumbnailUrl) {
            avatarUrl = media.thumbnailUrl;
          }
        } else {
          // Instagram automated scraping stays OFF per AV1 rule until approved credentials exist; stays on paste-link
          media = null;
        }
      } else {
        media = await this.detectRealYouTube(raw);
        detectedHandle = media.author || `@${cleanHandle}`;
        if (media.thumbnailUrl) {
          avatarUrl = media.thumbnailUrl;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Autopilot live detection encountered error for ${raw}: ${err.message}`);
      // Fallback response with synthetic placeholder so preview never crashes
      media = {
        platform: targetPlatform,
        mediaKey: `post_${Date.now()}`,
        url: targetPlatform === "INSTAGRAM" ? `https://www.instagram.com/${cleanHandle}/` : `https://www.youtube.com/@${cleanHandle}`,
        title: `Latest Upload by @${cleanHandle}`,
        author: `@${cleanHandle}`,
        publishedAt: new Date().toISOString(),
        thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
        isLiveDetected: false,
        mediaType: targetPlatform === "INSTAGRAM" ? "REEL" : "VIDEO",
      };
    }

    return {
      profile: {
        platform: targetPlatform,
        handle: detectedHandle,
        displayName: cleanHandle,
        avatarUrl,
      },
      latestMedia: media,
    };
  }
}

