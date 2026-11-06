export type LinkPreviewPlatform =
  | "YOUTUBE"
  | "TIKTOK"
  | "INSTAGRAM"
  | "X_TWITTER"
  | "TELEGRAM"
  | "FACEBOOK"
  | "SPOTIFY"
  | "UNKNOWN";

export type LinkPreviewKind =
  | "REEL"
  | "POST"
  | "CAROUSEL"
  | "VIDEO"
  | "SHORT"
  | "STATUS"
  | "PROFILE"
  | "UNKNOWN";

export type LinkPreviewStatus = "OK" | "NOT_FOUND" | "UNAVAILABLE";

export interface LinkEngagementMetrics {
  views?: string;
  rawViews?: string;
  likes?: string;
  reactions?: string;
  comments?: string;
  shares?: string;
  retweets?: string;
  followers?: string;
  subscribers?: string;
  countsDisabled?: boolean;
}

export interface LinkPreviewDto {
  platform: LinkPreviewPlatform;
  kind: LinkPreviewKind;
  mediaId: string | null;
  canonicalUrl: string | null;
  title: string | null;
  authorName: string | null;
  description?: string | null;
  thumbnailUrl: string | null;
  status: LinkPreviewStatus;
  slideIndex?: number;
  isCarousel?: boolean;
  metrics?: LinkEngagementMetrics;
}

export interface LinkPreviewMetrics {
  totalRequests: number;
  cacheHits: number;
  upstreamCalls: number;
  errors: number;
  status429s: number;
  unavailableByPlatform: Record<string, number>;
  latenciesMs: number[];
}

