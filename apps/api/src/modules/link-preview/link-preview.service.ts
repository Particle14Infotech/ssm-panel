import {
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { SMMCacheService } from "../../common/cache.service";
import { FeatureFlagsService, FeatureFlagKey, DEFAULT_FEATURE_FLAGS } from "../settings/flags.service";
import {
  parseTargetUrl,
  ParsedLinkResult,
  LinkPlatform,
  LinkKind,
} from "@smm/contracts";
import {
  LinkPreviewDto,
  LinkPreviewMetrics,
  LinkPreviewStatus,
  LinkPreviewKind,
  LinkEngagementMetrics,
} from "./link-preview.interface";
import { UpstreamCircuitBreaker } from "./link-preview.circuit-breaker";
import * as http from "http";
import * as https from "https";
import { URL } from "url";
import { FastifyReply } from "fastify";

export type UpstreamFetcher = (url: string) => Promise<{
  status: number;
  headers: Record<string, string>;
  body: string;
}>;

function toPreviewKind(kind: LinkKind): LinkPreviewKind {
  if (kind === "CHANNEL") return "PROFILE";
  return kind;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/`/g, "&#x60;");
}

function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength);
}

function formatCount(num: any): string | null {
  if (num === null || num === undefined) return null;
  const n = typeof num === "string" ? parseFloat(num.replace(/,/g, "")) : num;
  if (isNaN(n)) return String(num);
  if (n >= 1000000000) return (n / 1000000000).toFixed(2).replace(/\.00$/, "") + "B";
  if (n >= 1000000) return (n / 1000000).toFixed(2).replace(/\.00$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("en-US");
}

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return "";
      }
    })
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

const ALLOWED_THUMBNAIL_DOMAINS = [
  "i.ytimg.com",
  "img.youtube.com",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "ttwstatic.com",
  "cdninstagram.com",
  "fbcdn.net",
  "facebook.com",
  "instagram.com",
  "telegram.org",
  "t.me",
  "twimg.com",
  "x.com",
  "spotifycdn.com",
  "scdn.co",
];

function isThumbnailHostAllowed(rawUrl: string | null): boolean {
  if (!rawUrl) return false;
  if (rawUrl.startsWith("/api/v1/link-preview/proxy-image") || rawUrl.startsWith("/api/link-preview/proxy-image")) return true;
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    for (const d of ALLOWED_THUMBNAIL_DOMAINS) {
      if (host === d || host.endsWith("." + d)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

interface PageMetaResult {
  image: string | null;
  title: string | null;
  desc: string | null;
  siteName: string | null;
  rawHtml: string;
}

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);

  // Circuit breakers per upstream
  private readonly breakers: Record<string, UpstreamCircuitBreaker> = {
    YOUTUBE: new UpstreamCircuitBreaker("YOUTUBE"),
    TIKTOK: new UpstreamCircuitBreaker("TIKTOK"),
    INSTAGRAM: new UpstreamCircuitBreaker("INSTAGRAM"),
    FACEBOOK: new UpstreamCircuitBreaker("FACEBOOK"),
    X_TWITTER: new UpstreamCircuitBreaker("X_TWITTER"),
    TELEGRAM: new UpstreamCircuitBreaker("TELEGRAM"),
    SPOTIFY: new UpstreamCircuitBreaker("SPOTIFY"),
  };

  // In-flight request coalescing
  private inFlight = new Map<string, Promise<LinkPreviewDto>>();

  // Metrics tracking
  private metrics: LinkPreviewMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    upstreamCalls: 0,
    errors: 0,
    status429s: 0,
    unavailableByPlatform: {
      YOUTUBE: 0,
      TIKTOK: 0,
      INSTAGRAM: 0,
      FACEBOOK: 0,
      X_TWITTER: 0,
      TELEGRAM: 0,
      SPOTIFY: 0,
    },
    latenciesMs: [],
  };

  private upstreamFetcher: UpstreamFetcher | null = null;

  constructor(
    private readonly cacheService: SMMCacheService,
    private readonly flagsService: FeatureFlagsService
  ) {}

  setUpstreamFetcher(fetcher: UpstreamFetcher | null) {
    this.upstreamFetcher = fetcher;
  }

  getCircuitBreaker(platform: string): UpstreamCircuitBreaker | undefined {
    return this.breakers[platform.toUpperCase()];
  }

  getMetrics(): LinkPreviewMetrics {
    return { ...this.metrics };
  }

  async enforceThrottle(userId: string, clientIp: string): Promise<void> {
    const windowSeconds = 60;
    if (userId) {
      const userKey = `throttle:link_preview:user:${userId}`;
      const res = await this.cacheService.checkRateLimit(userKey, 60, windowSeconds);
      if (!res.allowed) {
        this.metrics.status429s++;
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: "Too Many Requests",
            message: "Too many link preview requests. Please wait a moment.",
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }
    if (clientIp) {
      const ipKey = `throttle:link_preview:ip:${clientIp}`;
      const res = await this.cacheService.checkRateLimit(ipKey, 120, windowSeconds);
      if (!res.allowed) {
        this.metrics.status429s++;
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: "Too Many Requests",
            message: "Too many requests from this IP address. Please wait a moment.",
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }
  }

  async getLinkPreview(
    rawLink: string,
    userId: string,
    clientIp: string,
    isAdmin = false
  ): Promise<LinkPreviewDto> {
    this.metrics.totalRequests++;
    await this.enforceThrottle(userId, clientIp);

    const parsed = parseTargetUrl(rawLink);
    if (!parsed.isValid) {
      throw new BadRequestException(parsed.error || "Invalid link provided");
    }

    const isMasterEnabled = await this.flagsService.isEnabled("link_preview", userId, isAdmin);
    if (!isMasterEnabled) {
      throw new NotFoundException("Link preview feature is not enabled");
    }

    const platFlagKey = `link_preview_${parsed.platform.toLowerCase()}` as FeatureFlagKey;
    const isPlatformFlagConfigured = platFlagKey in DEFAULT_FEATURE_FLAGS;
    const isPlatformEnabled = isPlatformFlagConfigured
      ? await this.flagsService.isEnabled(platFlagKey, userId, isAdmin)
      : true;
    if (isPlatformFlagConfigured && !isPlatformEnabled) {
      throw new NotFoundException(`Link preview for ${parsed.platform} is not enabled`);
    }

    const mediaKey = parsed.mediaId || parsed.authorHandle || "root";
    const cacheKey = `link_preview:${parsed.platform.toLowerCase()}:${mediaKey}`;
    const cached = await this.cacheService.get<{
      data: LinkPreviewDto;
      cachedAt: number;
    }>(cacheKey);

    if (cached) {
      this.metrics.cacheHits++;
      return cached.data;
    }

    return await this.fetchUpstreamCoalesced(parsed);
  }

  private async fetchUpstreamCoalesced(parsed: ParsedLinkResult): Promise<LinkPreviewDto> {
    const mediaKey = parsed.mediaId || parsed.authorHandle || "root";
    const flightKey = `${parsed.platform}:${mediaKey}`;

    if (this.inFlight.has(flightKey)) {
      return await this.inFlight.get(flightKey)!;
    }

    const promise = (async () => {
      const lockKey = `lock:link_preview:${parsed.platform.toLowerCase()}:${mediaKey}`;
      const acquired = await this.cacheService.acquireLock(lockKey, 5);

      if (!acquired) {
        const cacheKey = `link_preview:${parsed.platform.toLowerCase()}:${mediaKey}`;
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const cached = await this.cacheService.get<{ data: LinkPreviewDto }>(cacheKey);
          if (cached?.data) {
            this.metrics.cacheHits++;
            return cached.data;
          }
        }
      }

      try {
        return await this.executeUpstreamFetch(parsed);
      } finally {
        if (acquired) {
          await this.cacheService.releaseLock(lockKey);
        }
      }
    })().finally(() => {
      this.inFlight.delete(flightKey);
    });

    this.inFlight.set(flightKey, promise);
    return await promise;
  }

  private async executeUpstreamFetch(parsed: ParsedLinkResult): Promise<LinkPreviewDto> {
    const platform = parsed.platform;
    const mediaId = parsed.mediaId;
    const previewKind = toPreviewKind(parsed.kind);
    const breaker = this.breakers[platform];

    if (breaker && !breaker.isCallPermitted()) {
      this.logger.warn(`Circuit breaker OPEN for upstream ${platform}. Returning UNAVAILABLE.`);
      this.metrics.unavailableByPlatform[platform] = (this.metrics.unavailableByPlatform[platform] || 0) + 1;
      return {
        platform,
        kind: previewKind,
        mediaId,
        canonicalUrl: parsed.canonicalUrl,
        title: null,
        authorName: null,
        thumbnailUrl: null,
        status: "UNAVAILABLE",
      };
    }

    this.metrics.upstreamCalls++;
    const startTime = Date.now();

    try {
      let resultDto: LinkPreviewDto;

      // 1. INSTAGRAM (Reels, Posts, Profiles)
      if (platform === "INSTAGRAM") {
        resultDto = await this.fetchInstagramPreview(parsed);
      }
      // 2. YOUTUBE (Videos, Shorts, Channels)
      else if (platform === "YOUTUBE") {
        resultDto = await this.fetchYouTubePreview(parsed);
      }
      // 3. TIKTOK (Videos & Profiles)
      else if (platform === "TIKTOK") {
        resultDto = await this.fetchTikTokPreview(parsed);
      }
      // 4. FACEBOOK (Reels, Videos, Posts)
      else if (platform === "FACEBOOK") {
        resultDto = await this.fetchFacebookPreview(parsed);
      }
      // 5. TELEGRAM (Posts & Channels)
      else if (platform === "TELEGRAM") {
        resultDto = await this.fetchTelegramPreview(parsed);
      }
      // 6. X_TWITTER (Tweets & Profiles)
      else if (platform === "X_TWITTER") {
        resultDto = await this.fetchXTwitterPreview(parsed);
      }
      // 7. SPOTIFY (Tracks, Albums, Playlists)
      else if (platform === "SPOTIFY") {
        resultDto = await this.fetchSpotifyPreview(parsed);
      }
      // 8. UNIVERSAL FALLBACK
      else {
        resultDto = await this.fetchUniversalPreview(parsed);
      }

      const latencyMs = Date.now() - startTime;
      this.metrics.latenciesMs.push(latencyMs);
      if (breaker) breaker.recordSuccess();

      const mediaKey = parsed.mediaId || parsed.authorHandle || "root";
      await this.cacheService.set(
        `link_preview:${platform.toLowerCase()}:${mediaKey}`,
        { data: resultDto, cachedAt: Date.now() },
        { ttlSeconds: 86400 }
      );

      return resultDto;
    } catch (err: any) {
      if (breaker) breaker.recordFailure();
      this.metrics.errors++;
      this.metrics.unavailableByPlatform[platform] = (this.metrics.unavailableByPlatform[platform] || 0) + 1;
      this.logger.warn(`Upstream fetch failed for ${platform} ${parsed.canonicalUrl}: ${err.message}`);

      const fallbackDto: LinkPreviewDto = {
        platform,
        kind: previewKind,
        mediaId,
        canonicalUrl: parsed.canonicalUrl,
        title: parsed.authorHandle ? `@${parsed.authorHandle}` : null,
        authorName: parsed.authorHandle || null,
        thumbnailUrl: null,
        status: "UNAVAILABLE",
      };

      const mediaKey = parsed.mediaId || parsed.authorHandle || "root";
      await this.cacheService.set(
        `link_preview:${platform.toLowerCase()}:${mediaKey}`,
        { data: fallbackDto, cachedAt: Date.now() },
        { ttlSeconds: 600 }
      );

      return fallbackDto;
    }
  }

  /**
   * 1. Instagram Preview Resolver
   */
  private async fetchInstagramPreview(parsed: ParsedLinkResult): Promise<LinkPreviewDto> {
    const shortcode = parsed.mediaId;
    const kind = toPreviewKind(parsed.kind);
    const targetUrl = parsed.canonicalUrl || `https://www.instagram.com/reel/${shortcode}/`;

    if (!shortcode) {
      // Profile link
      const handle = parsed.authorHandle || "Instagram User";
      const meta = await this.fetchPageMeta(`https://www.instagram.com/${handle}/`);
      const metrics: LinkEngagementMetrics = {};
      if (meta.desc) {
        const folMatch = meta.desc.match(/([0-9,KMkm.]+)\s*Followers/i);
        if (folMatch) metrics.followers = folMatch[1];
      }
      const rawImg = meta.image;
      const proxyImg = rawImg ? `/api/v1/link-preview/proxy-image?url=${encodeURIComponent(rawImg)}` : null;

      return {
        platform: "INSTAGRAM",
        kind: "PROFILE",
        mediaId: handle,
        canonicalUrl: `https://www.instagram.com/${handle}/`,
        title: `@${handle} on Instagram`,
        authorName: `@${handle}`,
        thumbnailUrl: proxyImg,
        status: proxyImg ? "OK" : "NOT_FOUND",
        metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      };
    }

    // Reel or Post: fetch oEmbed and OpenGraph in parallel
    const [oembedRes, meta] = await Promise.all([
      this.fetchJson(`https://www.instagram.com/api/v1/oembed/?url=https://www.instagram.com/reel/${shortcode}/`),
      this.fetchPageMeta(`https://www.instagram.com/p/${shortcode}/`),
    ]);

    let imgUrl = oembedRes?.data?.thumbnail_url || meta.image || null;
    let oembedData = oembedRes?.data || null;

    if (!imgUrl) {
      const postOembed = await this.fetchJson(`https://www.instagram.com/api/v1/oembed/?url=https://www.instagram.com/p/${shortcode}/`);
      if (postOembed?.data?.thumbnail_url) {
        imgUrl = postOembed.data.thumbnail_url;
        oembedData = postOembed.data;
      }
    }

    if (!imgUrl) {
      const vxMeta = await this.fetchPageMeta(`https://vxinstagram.com/p/${shortcode}`);
      if (vxMeta.image) {
        imgUrl = vxMeta.image;
      }
    }

    const authorName = oembedData?.author_name || parsed.authorHandle || "Instagram Creator";
    const rawTitle = decodeHtmlEntities(meta.title || oembedData?.title || "");
    const rawDesc = decodeHtmlEntities(meta.desc || oembedData?.title || "");

    const metrics: LinkEngagementMetrics = {};
    if (rawDesc) {
      const likesM = rawDesc.match(/([0-9,KMkm.]+)\s*likes?/i);
      const commentsM = rawDesc.match(/([0-9,KMkm.]+)\s*comments?/i);
      const viewsM = rawDesc.match(/([0-9,KMkm.]+)\s*views?/i);
      if (viewsM) metrics.views = viewsM[1];
      if (likesM) metrics.likes = likesM[1];
      if (commentsM) metrics.comments = commentsM[1];
    }

    // Inline Polaris media state in HTML
    if (meta.rawHtml) {
      const jsonLikes = meta.rawHtml.match(/"like_count":\s*([0-9]+)/i);
      const jsonComments = meta.rawHtml.match(/"comment_count":\s*([0-9]+)/i);
      const jsonViews = meta.rawHtml.match(/"(?:video_view_count|video_play_count|play_count|view_count)":\s*([0-9]+)/i);
      const countsDisabled = /"like_and_view_counts_disabled":\s*true/i.test(meta.rawHtml);

      if (!metrics.likes && jsonLikes) {
        metrics.likes = formatCount(jsonLikes[1]) || undefined;
      }
      if (!metrics.comments && jsonComments) {
        metrics.comments = formatCount(jsonComments[1]) || undefined;
      }
      if (!metrics.views && jsonViews) {
        metrics.views = formatCount(jsonViews[1]) || undefined;
      } else if (!metrics.views && countsDisabled) {
        metrics.views = "Hidden by User";
      }
    }

    // Fetch creator follower count
    if (authorName && authorName !== "Instagram Creator") {
      const creatorMeta = await this.fetchPageMeta(`https://www.instagram.com/${authorName}/`);
      if (creatorMeta?.desc) {
        const folMatch = creatorMeta.desc.match(/([0-9,KMkm.]+)\s*Followers/i);
        if (folMatch) metrics.followers = folMatch[1];
      }
    }

    // Clean title: NEVER dump 20 lines of synopsis/keywords!
    let cleanTitle = `Instagram ${kind} (#${shortcode})`;
    let cleanAuthor = authorName.startsWith("@") ? authorName : `@${authorName}`;

    if (rawTitle) {
      const igTitleMatch = rawTitle.match(/^([^:]+)\s+on\s+Instagram:\s*["“]([\s\S]+?)["”]?$/i);
      let captionText = rawTitle;
      if (igTitleMatch) {
        const displayName = igTitleMatch[1].trim();
        if (authorName && authorName !== "Instagram Creator" && authorName !== displayName) {
          cleanAuthor = `${displayName} (@${authorName})`;
        } else {
          cleanAuthor = displayName;
        }
        captionText = igTitleMatch[2].trim();
      }

      const firstLine = captionText.split("\n").map((l) => l.trim()).filter(Boolean)[0];
      if (firstLine && firstLine.length > 2) {
        const headlineWithoutTags = firstLine.replace(/#[A-Za-z0-9_-]+/g, "").trim();
        const finalHeadline = headlineWithoutTags || firstLine;
        cleanTitle = finalHeadline.length > 65 ? finalHeadline.slice(0, 62) + "..." : finalHeadline;
      } else {
        cleanTitle = `Instagram ${kind} by ${cleanAuthor}`;
      }
    }

    let cleanDesc = rawDesc
      .replace(/#[A-Za-z0-9_-]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanDesc.length > 115) {
      cleanDesc = cleanDesc.slice(0, 112) + "...";
    }

    const proxyThumbnail = imgUrl
      ? `/api/v1/link-preview/proxy-image?url=${encodeURIComponent(imgUrl)}`
      : null;

    const isCarousel =
      parsed.isCarousel ||
      kind === "CAROUSEL" ||
      Boolean(
        meta.rawHtml &&
          /"carousel_media"|"edge_sidecar_to_children"|"GraphSidecar"|"photos and videos"/i.test(
            meta.rawHtml
          )
      );
    const effectiveKind = isCarousel ? "CAROUSEL" : kind;

    return {
      platform: "INSTAGRAM",
      kind: effectiveKind as LinkPreviewKind,
      mediaId: shortcode,
      canonicalUrl: targetUrl,
      title: cleanTitle,
      authorName: cleanAuthor,
      description: cleanDesc,
      slideIndex: parsed.slideIndex,
      isCarousel: Boolean(isCarousel),
      metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      thumbnailUrl: proxyThumbnail,
      status: proxyThumbnail ? "OK" : "NOT_FOUND",
    };
  }

  /**
   * 2. YouTube Preview Resolver
   */
  private async fetchYouTubePreview(parsed: ParsedLinkResult): Promise<LinkPreviewDto> {
    const videoId = parsed.mediaId;
    const kind = toPreviewKind(parsed.kind);
    const targetUrl = parsed.canonicalUrl || `https://www.youtube.com/watch?v=${videoId}`;

    if (!videoId) {
      // Channel preview
      const meta = await this.fetchPageMeta(targetUrl);
      const metrics: LinkEngagementMetrics = {};
      if (meta.desc) {
        const subMatch = meta.desc.match(/([0-9,KMkm.]+\s*(?:subscribers|videos))/i);
        if (subMatch) metrics.subscribers = subMatch[1];
      }
      return {
        platform: "YOUTUBE",
        kind: "PROFILE",
        mediaId: parsed.authorHandle,
        canonicalUrl: targetUrl,
        title: meta.title ? meta.title.replace(" - YouTube", "") : targetUrl,
        authorName: meta.title ? meta.title.replace(" - YouTube", "") : "YouTube Channel",
        thumbnailUrl: meta.image,
        status: meta.image ? "OK" : "NOT_FOUND",
        metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      };
    }

    const [oembedRes, views] = await Promise.all([
      this.fetchJson(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`),
      this.fetchYouTubeViewCount(videoId),
    ]);

    const title = oembedRes?.data?.title || `YouTube ${kind}`;
    const authorName = oembedRes?.data?.author_name || "YouTube Creator";
    const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const metrics: LinkEngagementMetrics = {};
    if (views) {
      metrics.views = formatCount(views) || undefined;
      metrics.rawViews = views.toLocaleString("en-US");
    }

    return {
      platform: "YOUTUBE",
      kind,
      mediaId: videoId,
      canonicalUrl: targetUrl,
      title,
      authorName,
      metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      thumbnailUrl: thumb,
      status: "OK",
    };
  }

  /**
   * 3. TikTok Preview Resolver
   */
  private async fetchTikTokPreview(parsed: ParsedLinkResult): Promise<LinkPreviewDto> {
    const targetUrl = parsed.canonicalUrl || `https://www.tiktok.com/@video/video/${parsed.mediaId}`;
    const tikwm = await this.fetchJson(`https://tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`);

    if (tikwm?.data?.code === 0 && tikwm.data.data) {
      const item = tikwm.data.data;
      const cover = item.cover || item.origin_cover;

      const metrics: LinkEngagementMetrics = {};
      if (item.play_count) metrics.views = formatCount(item.play_count) || undefined;
      if (item.digg_count) metrics.likes = formatCount(item.digg_count) || undefined;
      if (item.comment_count) metrics.comments = formatCount(item.comment_count) || undefined;
      if (item.share_count) metrics.shares = formatCount(item.share_count) || undefined;

      return {
        platform: "TIKTOK",
        kind: "VIDEO",
        mediaId: item.id || parsed.mediaId,
        canonicalUrl: targetUrl,
        title: item.title ? item.title.slice(0, 80) : "TikTok Video",
        authorName: item.author?.nickname ? `${item.author.nickname} (@${item.author.unique_id})` : "TikTok Creator",
        description: item.title,
        metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
        thumbnailUrl: cover || null,
        status: cover ? "OK" : "NOT_FOUND",
      };
    }

    // Fallback: oEmbed
    const oembed = await this.fetchJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`);
    const thumb = oembed?.data?.thumbnail_url || null;

    return {
      platform: "TIKTOK",
      kind: toPreviewKind(parsed.kind),
      mediaId: parsed.mediaId,
      canonicalUrl: targetUrl,
      title: oembed?.data?.title ? oembed.data.title.slice(0, 80) : "TikTok Content",
      authorName: oembed?.data?.author_name || "TikTok Creator",
      thumbnailUrl: thumb,
      status: thumb ? "OK" : "NOT_FOUND",
    };
  }

  /**
   * 4. Facebook Preview Resolver
   */
  private async fetchFacebookPreview(parsed: ParsedLinkResult): Promise<LinkPreviewDto> {
    const targetUrl = parsed.canonicalUrl || "";
    const meta = await this.fetchPageMeta(targetUrl);
    const kind = toPreviewKind(parsed.kind);

    const rawTitle = decodeHtmlEntities(meta.title || "");
    const rawDesc = decodeHtmlEntities(meta.desc || "");

    const metrics: LinkEngagementMetrics = {};
    const textToScan = `${rawTitle} ${rawDesc}`;
    const reactMatch = textToScan.match(/([0-9,KMkm.]+)\s*(?:reactions|likes)/i);
    const viewsMatch = textToScan.match(/([0-9,KMkm.]+)\s*views/i);
    const commMatch = textToScan.match(/([0-9,KMkm.]+)\s*comments/i);

    if (viewsMatch) metrics.views = viewsMatch[1];
    if (reactMatch) metrics.reactions = reactMatch[1];
    if (commMatch) metrics.comments = commMatch[1];

    let cleanTitle = `Facebook ${kind}`;
    let authorName = meta.siteName || "Facebook";

    if (rawTitle) {
      const parts = rawTitle.split("|").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1];
        if (lastPart && !lastPart.toLowerCase().includes("facebook")) {
          authorName = lastPart;
        }
        const mainCaption = parts.length > 2 ? parts[1] : (parts[0].match(/reactions|likes/i) ? parts[1] : parts[0]);
        if (mainCaption) {
          const firstLine = mainCaption.split("\n").map((l) => l.trim()).filter(Boolean)[0];
          if (firstLine) {
            const headline = firstLine.replace(/#[A-Za-z0-9_-]+/g, "").trim() || firstLine;
            cleanTitle = headline.length > 65 ? headline.slice(0, 62) + "..." : headline;
          }
        }
      } else {
        const firstLine = rawTitle.split("\n").map((l) => l.trim()).filter(Boolean)[0];
        if (firstLine) {
          const headline = firstLine.replace(/#[A-Za-z0-9_-]+/g, "").trim() || firstLine;
          cleanTitle = headline.length > 65 ? headline.slice(0, 62) + "..." : headline;
        }
      }
    }

    let cleanDesc = (rawDesc || rawTitle).replace(/#[A-Za-z0-9_-]+/g, "").replace(/\s+/g, " ").trim();
    if (cleanDesc.length > 115) {
      cleanDesc = cleanDesc.slice(0, 112) + "...";
    }

    const proxyThumbnail = meta.image
      ? `/api/v1/link-preview/proxy-image?url=${encodeURIComponent(meta.image)}`
      : null;

    return {
      platform: "FACEBOOK",
      kind,
      mediaId: parsed.mediaId,
      canonicalUrl: targetUrl,
      title: cleanTitle,
      authorName,
      description: cleanDesc,
      metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      thumbnailUrl: proxyThumbnail,
      status: proxyThumbnail ? "OK" : "NOT_FOUND",
    };
  }

  /**
   * 5. Telegram Preview Resolver
   */
  private async fetchTelegramPreview(parsed: ParsedLinkResult): Promise<LinkPreviewDto> {
    const targetUrl = parsed.canonicalUrl || "";
    const isPost = parsed.kind === "POST" && parsed.mediaId;
    const channel = parsed.authorHandle || parsed.mediaId || "";

    const [meta, postViews] = await Promise.all([
      this.fetchPageMeta(targetUrl),
      isPost && parsed.authorHandle && parsed.mediaId
        ? this.fetchTelegramPostViews(parsed.authorHandle, parsed.mediaId)
        : Promise.resolve(null),
    ]);

    const metrics: LinkEngagementMetrics = {};
    if (postViews) metrics.views = postViews;
    if (meta.desc) {
      const subMatch = meta.desc.match(/([0-9,KMkm.]+\s*(?:subscribers|members))/i);
      if (subMatch) metrics.subscribers = subMatch[1];
    }

    return {
      platform: "TELEGRAM",
      kind: toPreviewKind(parsed.kind),
      mediaId: parsed.mediaId || channel,
      canonicalUrl: targetUrl,
      title: meta.title || `@${channel}`,
      authorName: meta.title || `@${channel}`,
      description: meta.desc,
      metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
      thumbnailUrl: meta.image,
      status: meta.image ? "OK" : "NOT_FOUND",
    };
  }

  /**
   * 6. X (Twitter) Preview Resolver
   */
  private async fetchXTwitterPreview(parsed: ParsedLinkResult): Promise<LinkPreviewDto> {
    const targetUrl = parsed.canonicalUrl || "";
    const authorHandle = parsed.authorHandle || "x";
    const tweetId = parsed.mediaId;

    if (tweetId) {
      const fxRes = await this.fetchJson(`https://api.fxtwitter.com/${authorHandle}/status/${tweetId}`, {
        "User-Agent": "Twitterbot/1.0",
      });

      if (fxRes?.data?.code === 200 && fxRes.data.tweet) {
        const tw = fxRes.data.tweet;
        const photoUrl = tw.media?.photos?.[0]?.url || tw.media?.all?.[0]?.url || tw.author?.avatar_url;

        const metrics: LinkEngagementMetrics = {};
        if (tw.views) metrics.views = formatCount(tw.views) || undefined;
        if (tw.likes) metrics.likes = formatCount(tw.likes) || undefined;
        if (tw.retweets) metrics.retweets = formatCount(tw.retweets) || undefined;
        if (tw.replies) metrics.comments = formatCount(tw.replies) || undefined;
        if (tw.author?.followers) metrics.followers = formatCount(tw.author.followers) || undefined;

        return {
          platform: "X_TWITTER",
          kind: "STATUS",
          mediaId: tweetId,
          canonicalUrl: targetUrl,
          title: `${tw.author?.name || authorHandle} on X: "${tw.text ? tw.text.slice(0, 80) : ""}"`,
          authorName: `${tw.author?.name || authorHandle} (@${tw.author?.screen_name || authorHandle})`,
          description: tw.text,
          metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
          thumbnailUrl: photoUrl || null,
          status: photoUrl ? "OK" : "NOT_FOUND",
        };
      }
    }

    // Profile or fallback
    const fxUser = await this.fetchJson(`https://api.fxtwitter.com/${authorHandle}`, {
      "User-Agent": "Twitterbot/1.0",
    });

    if (fxUser?.data?.code === 200 && fxUser.data.user) {
      const u = fxUser.data.user;
      const metrics: LinkEngagementMetrics = {};
      if (u.followers) metrics.followers = formatCount(u.followers) || undefined;
      return {
        platform: "X_TWITTER",
        kind: "PROFILE",
        mediaId: authorHandle,
        canonicalUrl: targetUrl,
        title: `${u.name} (@${u.screen_name}) on X`,
        authorName: `${u.name} (@${u.screen_name})`,
        description: u.description,
        thumbnailUrl: u.avatar_url || null,
        metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
        status: u.avatar_url ? "OK" : "NOT_FOUND",
      };
    }

    return {
      platform: "X_TWITTER",
      kind: toPreviewKind(parsed.kind),
      mediaId: tweetId || authorHandle,
      canonicalUrl: targetUrl,
      title: `Post on X`,
      authorName: authorHandle,
      thumbnailUrl: null,
      status: "NOT_FOUND",
    };
  }

  /**
   * 7. Spotify Preview Resolver
   */
  private async fetchSpotifyPreview(parsed: ParsedLinkResult): Promise<LinkPreviewDto> {
    const targetUrl = parsed.canonicalUrl || "";
    const spotifyOembed = await this.fetchJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(targetUrl)}`);

    if (spotifyOembed?.data) {
      const sp = spotifyOembed.data;
      return {
        platform: "SPOTIFY",
        kind: toPreviewKind(parsed.kind),
        mediaId: parsed.mediaId,
        canonicalUrl: targetUrl,
        title: sp.title || "Spotify Audio",
        authorName: sp.provider_name ? `${sp.provider_name} Audio` : "Spotify",
        thumbnailUrl: sp.thumbnail_url || null,
        status: sp.thumbnail_url ? "OK" : "NOT_FOUND",
      };
    }

    return {
      platform: "SPOTIFY",
      kind: toPreviewKind(parsed.kind),
      mediaId: parsed.mediaId,
      canonicalUrl: targetUrl,
      title: "Spotify Music",
      authorName: "Spotify",
      thumbnailUrl: null,
      status: "NOT_FOUND",
    };
  }

  /**
   * 8. Universal OpenGraph Fallback
   */
  private async fetchUniversalPreview(parsed: ParsedLinkResult): Promise<LinkPreviewDto> {
    const targetUrl = parsed.canonicalUrl || "";
    const meta = await this.fetchPageMeta(targetUrl);

    return {
      platform: parsed.platform || "UNKNOWN",
      kind: toPreviewKind(parsed.kind),
      mediaId: parsed.mediaId,
      canonicalUrl: targetUrl,
      title: meta.title || targetUrl,
      authorName: meta.siteName || null,
      description: meta.desc,
      thumbnailUrl: meta.image,
      status: meta.image ? "OK" : "NOT_FOUND",
    };
  }

  /**
   * Helper: follow redirects & extract OpenGraph metadata and raw HTML
   */
  private fetchPageMeta(targetUrl: string, maxHops = 5): Promise<PageMetaResult> {
    return new Promise((resolve) => {
      let resolved = false;
      const safeResolve = (val: PageMetaResult) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(overallTimer);
          resolve(val);
        }
      };

      const overallTimer = setTimeout(() => {
        safeResolve({ image: null, title: null, desc: null, siteName: null, rawHtml: "" });
      }, 5000);

      const doFetch = (url: string, hopsLeft: number) => {
        if (hopsLeft <= 0 || resolved) {
          return safeResolve({ image: null, title: null, desc: null, siteName: null, rawHtml: "" });
        }

        try {
          const u = new URL(url);
          const client = u.protocol === "https:" ? https : http;

          const req = client.get(
            url,
            {
              headers: {
                "User-Agent": "facebookexternalhit/1.1 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
              },
              timeout: 4000,
            },
            (res) => {
              if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                let nextLoc = res.headers.location;
                if (nextLoc.startsWith("/")) {
                  nextLoc = `${u.protocol}//${u.host}${nextLoc}`;
                }
                return doFetch(nextLoc, hopsLeft - 1);
              }

              let html = "";
              res.on("data", (chunk) => {
                html += chunk;
                if (html.length > 950000) {
                  res.destroy();
                }
              });

              const finish = () => {
                const clean = (str: string | undefined | null) => (str ? decodeHtmlEntities(str).trim() : null);

                const ogImg =
                  html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                  html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
                const twImg =
                  html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
                  html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

                const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
                const twTitle = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
                const docTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);

                const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
                const twDesc = html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i);
                const docDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

                const siteName = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);

                safeResolve({
                  image: clean(ogImg?.[1] || twImg?.[1]),
                  title: clean(ogTitle?.[1] || twTitle?.[1] || docTitle?.[1]),
                  desc: clean(ogDesc?.[1] || twDesc?.[1] || docDesc?.[1]),
                  siteName: clean(siteName?.[1]),
                  rawHtml: html,
                });
              };

              res.on("end", finish);
              res.on("close", finish);
            }
          );

          req.on("timeout", () => {
            req.destroy();
            safeResolve({ image: null, title: null, desc: null, siteName: null, rawHtml: "" });
          });
          req.on("error", () => safeResolve({ image: null, title: null, desc: null, siteName: null, rawHtml: "" }));
        } catch {
          safeResolve({ image: null, title: null, desc: null, siteName: null, rawHtml: "" });
        }
      };

      doFetch(targetUrl, maxHops);
    });
  }

  /**
   * Helper: Fetch JSON with timeout
   */
  private fetchJson(url: string, headers: Record<string, string> = {}): Promise<{ status: number; data?: any }> {
    return new Promise((resolve) => {
      let resolved = false;
      const safeResolve = (val: { status: number; data?: any }) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      };

      try {
        const u = new URL(url);
        const mod = u.protocol === "https:" ? https : http;
        const req = mod.get(
          url,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "application/json",
              ...headers,
            },
            timeout: 4000,
          },
          (res) => {
            let d = "";
            res.on("data", (c) => (d += c));
            const onDone = () => {
              try {
                safeResolve({ status: res.statusCode || 200, data: JSON.parse(d) });
              } catch {
                safeResolve({ status: res.statusCode || 500, data: null });
              }
            };
            res.on("end", onDone);
            res.on("close", onDone);
          }
        );
        req.on("timeout", () => {
          req.destroy();
          safeResolve({ status: 504, data: null });
        });
        req.on("error", () => safeResolve({ status: 500, data: null }));
      } catch {
        safeResolve({ status: 500, data: null });
      }
    });
  }

  /**
   * Helper: YouTube view count from HTML ytInitialData
   */
  private fetchYouTubeViewCount(videoId: string): Promise<number | null> {
    return new Promise((resolve) => {
      try {
        const req = https.get(
          `https://www.youtube.com/watch?v=${videoId}`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "text/html",
              "Accept-Language": "en-US,en;q=0.9",
            },
            timeout: 4000,
          },
          (res) => {
            let html = "";
            res.on("data", (c) => {
              html += c;
              if (html.length > 1200000) res.destroy();
            });
            const finish = () => {
              const match = html.match(/"viewCount":\s*"([0-9]+)"/i);
              resolve(match ? parseInt(match[1], 10) : null);
            };
            res.on("end", finish);
            res.on("close", finish);
          }
        );
        req.on("timeout", () => {
          req.destroy();
          resolve(null);
        });
        req.on("error", () => resolve(null));
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Helper: Telegram post views from web widget
   */
  private fetchTelegramPostViews(channel: string, postId: string): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        const req = https.get(
          `https://t.me/s/${channel}/${postId}`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
              Accept: "text/html",
            },
            timeout: 3000,
          },
          (res) => {
            let html = "";
            res.on("data", (c) => (html += c));
            res.on("end", () => {
              const match = html.match(/class="tgme_widget_message_views">([^<]+)<\/span>/i);
              resolve(match ? match[1].trim() : null);
            });
          }
        );
        req.on("timeout", () => {
          req.destroy();
          resolve(null);
        });
        req.on("error", () => resolve(null));
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Proxy image stream safely across both Express (res) and Fastify (reply)
   * Prevents crashes by supporting raw Writable streams and setting headers defensively.
   */
  async pipeImage(imageUrl: string, reply: any, hops = 3): Promise<void> {
    const rawRes = reply?.raw || reply;

    const isHeadersSent = (): boolean => {
      return Boolean(rawRes?.headersSent || reply?.sent || reply?.headersSent);
    };

    const setHeader = (name: string, value: string) => {
      try {
        if (typeof reply?.header === "function") {
          reply.header(name, value);
        } else if (typeof reply?.setHeader === "function") {
          reply.setHeader(name, value);
        } else if (typeof rawRes?.setHeader === "function") {
          rawRes.setHeader(name, value);
        }
      } catch {
        // Ignore if headers already sent
      }
    };

    const sendError = (status: number, message: string) => {
      if (isHeadersSent()) return;
      try {
        if (typeof reply?.status === "function") {
          reply.status(status).send(message);
        } else if (typeof rawRes?.writeHead === "function") {
          rawRes.writeHead(status, { "Content-Type": "text/plain" });
          rawRes.end(message);
        }
      } catch {
        // Ignore
      }
    };

    if (hops <= 0) {
      sendError(502, "Too many image redirects");
      return;
    }

    return new Promise((resolve) => {
      try {
        const u = new URL(imageUrl);
        const mod = u.protocol === "https:" ? https : http;

        const req = mod.get(
          imageUrl,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
              Referer: `${u.protocol}//${u.host}/`,
            },
            timeout: 6000,
          },
          (res) => {
            if (
              res.statusCode &&
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers.location
            ) {
              res.resume();
              let next = res.headers.location;
              if (next.startsWith("/")) next = `${u.protocol}//${u.host}${next}`;
              return this.pipeImage(next, reply, hops - 1).then(resolve);
            }

            if (res.statusCode === 200) {
              setHeader("Content-Type", res.headers["content-type"] || "image/jpeg");
              setHeader("Cache-Control", "public, max-age=86400");
              setHeader("Access-Control-Allow-Origin", "*");

              const target = rawRes;
              if (target && typeof target.write === "function") {
                res.pipe(target);
                res.on("end", resolve);
                res.on("error", () => resolve());
              } else {
                sendError(500, "Internal proxy target invalid");
                resolve();
              }
            } else {
              sendError(res.statusCode || 404, "Image unavailable");
              resolve();
            }
          }
        );

        req.on("timeout", () => {
          req.destroy();
          sendError(504, "Image gateway timeout");
          resolve();
        });

        req.on("error", () => {
          sendError(502, "Image fetch failed");
          resolve();
        });
      } catch {
        sendError(400, "Invalid image URL");
        resolve();
      }
    });
  }
}
