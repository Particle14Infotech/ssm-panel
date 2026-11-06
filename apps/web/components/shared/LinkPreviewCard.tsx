"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  parseTargetUrl,
  validateServiceLinkCompatibility,
  ParsedLinkResult,
  LinkPlatform,
} from "@smm/contracts";
import { getApiBase } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-session";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import {
  ExternalLink,
  AlertTriangle,
  Loader2,
  Layers,
} from "lucide-react";

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

export interface LinkPreviewCardProps {
  url: string;
  selectedPlatform?: string;
  serviceTypeOrMetric?: string;
  className?: string;
  onValidationChange?: (result: { isValid: boolean; error?: string }) => void;
  onPreviewChange?: (preview: PreviewData | null) => void;
  initialData?: {
    platform?: string;
    kind?: string;
    title?: string;
    authorName?: string;
    thumbnailUrl?: string | null;
    status?: "OK" | "NOT_FOUND" | "UNAVAILABLE";
    metrics?: LinkEngagementMetrics;
  } | null;
}

type CardState =
  | "idle"
  | "checking"
  | "ready"
  | "local-only"
  | "wrong-platform"
  | "wrong-type"
  | "unsupported";

interface PreviewData {
  platform: string;
  kind: string;
  title?: string;
  authorName?: string;
  thumbnailUrl?: string | null;
  status: "OK" | "NOT_FOUND" | "UNAVAILABLE";
  requestId?: string;
  slideIndex?: number;
  isCarousel?: boolean;
  metrics?: LinkEngagementMetrics;
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({
  url,
  selectedPlatform,
  serviceTypeOrMetric,
  className = "",
  onValidationChange,
  onPreviewChange,
  initialData,
}) => {
  const [state, setState] = useState<CardState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [parsedInfo, setParsedInfo] = useState<ParsedLinkResult | null>(null);
  const [imgError, setImgError] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    onPreviewChange?.(preview);
  }, [preview, onPreviewChange]);

  useEffect(() => {
    setImgError(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const trimmed = (url || "").trim();
    if (!trimmed) {
      setState("idle");
      setErrorMessage("");
      setPreview(null);
      setParsedInfo(null);
      onValidationChange?.({ isValid: false });
      return;
    }

    // Step 1: Local WHATWG parse and type checks
    const parsed = parseTargetUrl(trimmed);
    setParsedInfo(parsed);

    if (!parsed.isValid) {
      setState("unsupported");
      const err = parsed.error || "Please enter a valid link";
      setErrorMessage(err);
      onValidationChange?.({ isValid: false, error: err });
      return;
    }

    // Step 2: Compatibility checks (platform & service metric)
    const compat = validateServiceLinkCompatibility(
      parsed,
      selectedPlatform || "",
      serviceTypeOrMetric || ""
    );

    if (!compat.isCompatible) {
      if (
        selectedPlatform &&
        parsed.platform.toUpperCase() !== selectedPlatform.toUpperCase()
      ) {
        setState("wrong-platform");
      } else {
        setState("wrong-type");
      }
      const err = compat.error || "Link does not match the chosen service";
      setErrorMessage(err);
      onValidationChange?.({ isValid: false, error: err });
      return;
    }

    onValidationChange?.({ isValid: true });

    // Client-side optimization: YouTube thumbnail derived immediately from mediaId
    let immediateThumb: string | null = null;
    if (parsed.platform === "YOUTUBE" && parsed.mediaId) {
      immediateThumb = `https://i.ytimg.com/vi/${parsed.mediaId}/hqdefault.jpg`;
    }

    if (initialData) {
      setPreview({
        platform: initialData.platform || parsed.platform,
        kind: initialData.kind || parsed.kind,
        title: initialData.title,
        authorName: initialData.authorName,
        thumbnailUrl: initialData.thumbnailUrl ?? immediateThumb,
        status: initialData.status || "OK",
        metrics: initialData.metrics,
      });
      setState(initialData.status === "OK" ? "ready" : "local-only");
      return;
    }

    setState("checking");
    if (immediateThumb) {
      setPreview({
        platform: parsed.platform,
        kind: parsed.kind,
        thumbnailUrl: immediateThumb,
        status: "OK",
      });
    }

    // Step 3: Debounce 350ms before server preview request
    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const queryParams = new URLSearchParams({
          platform: parsed.platform.toLowerCase(),
          id: parsed.mediaId || "",
          url: parsed.canonicalUrl || trimmed,
        });

        const res = await fetch(
          `${getApiBase()}/link-preview?${queryParams.toString()}`,
          {
            signal: controller.signal,
            headers,
            credentials: "include",
          }
        );

        if (!res.ok) {
          let reqId: string | undefined;
          try {
            const errJson = await res.json();
            reqId = errJson?.requestId;
          } catch {
            // ignore non-json
          }

          setPreview({
            platform: parsed.platform,
            kind: parsed.kind,
            thumbnailUrl: immediateThumb,
            status: "UNAVAILABLE",
            requestId: reqId,
          });
          setState("local-only");
          return;
        }

        const data = await res.json();
        let finalThumb = data.thumbnailUrl || immediateThumb;
        if (finalThumb && finalThumb.startsWith("/")) {
          finalThumb = `${getApiBase()}${finalThumb.replace(/^\/api\/v1/, "")}`;
        }

        setPreview({
          platform: data.platform || parsed.platform,
          kind: data.kind || parsed.kind,
          title: data.title,
          authorName: data.authorName,
          thumbnailUrl: finalThumb,
          status: data.status || "OK",
          slideIndex: data.slideIndex ?? parsed.slideIndex,
          isCarousel: data.isCarousel ?? parsed.isCarousel,
          metrics: data.metrics,
        });

        if (data.status === "OK") {
          setState("ready");
        } else {
          setState("local-only");
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setPreview({
          platform: parsed.platform,
          kind: parsed.kind,
          thumbnailUrl: immediateThumb,
          status: "UNAVAILABLE",
        });
        setState("local-only");
      }
    }, 350);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [url, selectedPlatform, serviceTypeOrMetric, initialData, onValidationChange]);

  if (state === "idle") {
    return null;
  }

  // Blocking field error: Unsupported link or shortened link
  if (state === "unsupported") {
    return (
      <div
        className={`mt-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs flex items-center gap-2.5 transition-all ${className}`}
        role="alert"
        aria-live="polite"
      >
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="font-medium">{errorMessage}</span>
      </div>
    );
  }

  // Blocking field error: Wrong platform
  if (state === "wrong-platform") {
    return (
      <div
        className={`mt-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2.5 transition-all ${className}`}
        role="alert"
        aria-live="polite"
      >
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <div>
          <span className="font-semibold block mb-0.5">Platform Mismatch</span>
          <span>{errorMessage}</span>
        </div>
      </div>
    );
  }

  // Blocking field error: Wrong link type for the chosen service
  if (state === "wrong-type") {
    return (
      <div
        className={`mt-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs flex items-center gap-2.5 transition-all ${className}`}
        role="alert"
        aria-live="polite"
      >
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <div>
          <span className="font-semibold block mb-0.5">Link Type Conflict</span>
          <span>{errorMessage}</span>
        </div>
      </div>
    );
  }

  // Fixed-height skeleton during checking (min-h-[88px], prevents CLS layout shift)
  if (state === "checking" && !preview?.thumbnailUrl) {
    return (
      <div
        className={`mt-2 min-h-[88px] p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] flex items-center gap-3.5 animate-pulse transition-all ${className}`}
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="Checking link preview"
      >
        <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-white/10 shrink-0 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-3.5 w-1/3 bg-slate-200 dark:bg-white/10 rounded-md" />
          <div className="h-3 w-3/4 bg-slate-200 dark:bg-white/10 rounded-md" />
          <div className="h-2.5 w-1/2 bg-slate-100 dark:bg-white/5 rounded-md" />
        </div>
      </div>
    );
  }

  const rawPlatform = preview?.platform || parsedInfo?.platform || "INSTAGRAM";
  const platformStr = String(rawPlatform).toLowerCase();
  const activeKind = preview?.kind || parsedInfo?.kind || "POST";
  const canonicalUrl = parsedInfo?.canonicalUrl || url;
  const thumbnail = !imgError && preview?.thumbnailUrl ? preview.thumbnailUrl : null;
  const isCarousel = activeKind === "CAROUSEL" || Boolean(preview?.isCarousel) || Boolean(parsedInfo?.isCarousel);
  const slideIndex = preview?.slideIndex ?? parsedInfo?.slideIndex;

  // Local-only fallback card (no thumbnail / platform disabled / Instagram tokenless)
  if (state === "local-only" || !thumbnail) {
    return (
      <div
        className={`mt-2 min-h-[88px] p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] flex items-center justify-between gap-3 transition-all ${className}`}
        aria-live="polite"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-14 h-14 rounded-xl bg-slate-200/80 dark:bg-white/[0.06] border border-slate-300 dark:border-white/10 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
            <PlatformIcon platform={platformStr as any} size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[11px] font-semibold text-[#65771c] dark:text-[#D8EC8D] tracking-wide uppercase">
                Link recognised
              </span>
              {isCarousel ? (
                <>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Carousel / Photo Dump
                  </span>
                  {slideIndex && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-[#D8EC8D]/15 text-[#65771c] dark:text-[#D8EC8D]">
                      Slide {slideIndex}
                    </span>
                  )}
                </>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-slate-200 dark:bg-white/10 text-fg-2 uppercase">
                  {activeKind}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-sm sm:max-w-md">
              Preview is not available for this link. You can still place the order.
            </p>
            {preview?.requestId && (
              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                Ref: {preview.requestId}
              </span>
            )}
          </div>
        </div>

        {canonicalUrl && (
          <a
            href={canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-medium text-fg flex items-center gap-1.5 shrink-0 transition-all"
            title="Open link in new tab"
          >
            <span>Open link</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        )}
      </div>
    );
  }

  // Ready state: Rich media preview card with platform insights
  return (
    <div
      className={`mt-2 p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] flex items-center justify-between gap-3 transition-all ${className}`}
      aria-live="polite"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-black/20 shrink-0 border border-slate-300/60 dark:border-white/10">
          <img
            src={thumbnail}
            alt={preview?.title ? `Preview of ${preview.title}` : "Link preview thumbnail"}
            referrerPolicy="no-referrer"
            loading="lazy"
            width={64}
            height={64}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-1 left-1 p-1 rounded-md bg-black/60 backdrop-blur-xs text-white">
            <PlatformIcon platform={platformStr as any} size={11} />
          </div>
        </div>

        <div className="min-w-0 space-y-0.5 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold text-[#65771c] dark:text-[#D8EC8D] tracking-wide uppercase">
              Preview
            </span>
            {isCarousel ? (
              <>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase flex items-center gap-1">
                  <Layers className="w-2.5 h-2.5" />
                  Carousel
                </span>
                {slideIndex && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-[#D8EC8D]/15 text-[#65771c] dark:text-[#D8EC8D]">
                    Slide {slideIndex}
                  </span>
                )}
              </>
            ) : (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono bg-slate-200 dark:bg-white/10 text-fg-2 uppercase">
                {activeKind}
              </span>
            )}
            {preview?.authorName && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px] sm:max-w-[200px]">
                by <strong className="text-fg-2 font-medium">{preview.authorName}</strong>
              </span>
            )}
          </div>

          <h4
            className="text-xs font-semibold text-fg line-clamp-1 break-words"
            title={preview?.title || ""}
          >
            {preview?.title || "Target Link"}
          </h4>

          {/* Platform-Specific Metrics Insights Chips */}
          {preview?.metrics && Object.keys(preview.metrics).length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {/* Views */}
              {preview.metrics.views && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-500 border border-sky-500/20"
                  title={preview.metrics.rawViews ? `${preview.metrics.rawViews} views` : `${preview.metrics.views} views`}
                >
                  👁️ {preview.metrics.views.toLowerCase().includes("hidden") ? (
                    <span className="italic font-normal">Hidden by User</span>
                  ) : (
                    <span>{preview.metrics.views} Views</span>
                  )}
                </span>
              )}

              {/* Likes / Reactions */}
              {(preview.metrics.likes || preview.metrics.reactions) && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  ❤️ {preview.metrics.likes || preview.metrics.reactions} {preview.metrics.reactions ? "Reactions" : "Likes"}
                </span>
              )}

              {/* Comments / Replies */}
              {preview.metrics.comments && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  💬 {preview.metrics.comments}
                </span>
              )}

              {/* Shares / Retweets */}
              {(preview.metrics.shares || preview.metrics.retweets) && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  🔁 {preview.metrics.shares || preview.metrics.retweets}
                </span>
              )}

              {/* Followers / Subscribers */}
              {(preview.metrics.followers || preview.metrics.subscribers) && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {preview.metrics.subscribers ? "⭐" : "👥"} {preview.metrics.followers || preview.metrics.subscribers} {preview.metrics.subscribers ? "Subs" : "Followers"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {canonicalUrl && (
        <a
          href={canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-medium text-fg flex items-center gap-1 shrink-0 transition-all shadow-xs"
          title="Open link in new tab"
        >
          <span className="hidden sm:inline">Open</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </a>
      )}
    </div>
  );
};
