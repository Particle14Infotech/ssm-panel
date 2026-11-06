"use client";

import React, { useState, useEffect } from "react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Layers } from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-session";

// Global in-memory cache to prevent redundant HTTP requests across cards
const previewCache = new Map<
  string,
  {
    thumbnailUrl: string;
    isCarousel?: boolean;
    slideIndex?: number;
    title?: string;
  }
>();

function normalizeThumbnailUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) {
    return `${getApiBase()}${trimmed.replace(/^\/api\/v1/, "")}`;
  }
  return trimmed;
}

export interface PackageThumbnailProps {
  pkg: {
    id?: string;
    platform?: string;
    handle?: string;
    priceSnapshot?: any;
    slots?: any[];
    triggers?: any[];
  };
  size?: "sm" | "md" | "lg";
  className?: string;
  showPlatformBadge?: boolean;
}

export const PackageThumbnail: React.FC<PackageThumbnailProps> = ({
  pkg,
  size = "sm",
  className = "",
  showPlatformBadge = true,
}) => {
  const platform = (pkg.platform || "instagram").toLowerCase();
  const snapshotPreview = pkg.priceSnapshot?.preview;

  // Extract target URL from package slots, triggers, or handle
  const targetUrl = React.useMemo(() => {
    // 1. High priority: Check slots for a specific post/reel URL (e.g. slots[0].targetUrl)
    const slotUrl =
      pkg.slots?.find(
        (s) =>
          s?.targetUrl &&
          (s.targetUrl.startsWith("http://") || s.targetUrl.startsWith("https://"))
      )?.targetUrl || pkg.slots?.[0]?.targetUrl;
    if (
      slotUrl &&
      (slotUrl.startsWith("http://") || slotUrl.startsWith("https://"))
    ) {
      return slotUrl.trim();
    }

    // 2. Secondary priority: Check triggers for a targetUrl
    const triggerUrl =
      pkg.triggers?.find(
        (t) =>
          t?.targetUrl &&
          (t.targetUrl.startsWith("http://") || t.targetUrl.startsWith("https://"))
      )?.targetUrl || pkg.triggers?.[0]?.targetUrl;
    if (
      triggerUrl &&
      (triggerUrl.startsWith("http://") || triggerUrl.startsWith("https://"))
    ) {
      return triggerUrl.trim();
    }

    // 3. Third priority: pkg.handle if already a full URL
    if (
      pkg.handle &&
      (pkg.handle.startsWith("http://") || pkg.handle.startsWith("https://"))
    ) {
      return pkg.handle.trim();
    }

    // 4. Fourth priority: Synthesize platform URL from bare handle (e.g. "pk1handle", "@username")
    if (
      pkg.handle &&
      pkg.handle.trim().length > 0 &&
      !pkg.handle.includes(" ")
    ) {
      const cleanHandle = pkg.handle.trim().replace(/^@/, "");
      if (platform === "instagram") return `https://www.instagram.com/${cleanHandle}/`;
      if (platform === "youtube") return `https://www.youtube.com/@${cleanHandle}`;
      if (platform === "facebook") return `https://www.facebook.com/${cleanHandle}`;
      if (platform === "twitter" || platform === "x") return `https://x.com/${cleanHandle}`;
      if (platform === "tiktok") return `https://www.tiktok.com/@${cleanHandle}`;
      if (platform === "telegram") return `https://t.me/${cleanHandle}`;
    }

    return null;
  }, [pkg, platform]);

  const candidateUrl = targetUrl || pkg.handle || "";

  // Initial values from snapshot if available (properly normalized)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    normalizeThumbnailUrl(snapshotPreview?.thumbnailUrl)
  );
  const [isCarousel, setIsCarousel] = useState<boolean>(
    Boolean(
      snapshotPreview?.isCarousel ||
        snapshotPreview?.kind === "CAROUSEL" ||
        (candidateUrl && /[?&]img_index=\d+/i.test(candidateUrl))
    )
  );
  const [slideIndex, setSlideIndex] = useState<number | undefined>(
    snapshotPreview?.slideIndex ||
      (candidateUrl ? Number(candidateUrl.match(/[?&]img_index=(\d+)/i)?.[1]) : undefined)
  );
  const [imgError, setImgError] = useState(false);

  // Check cache or dynamically fetch if no snapshot preview exists
  useEffect(() => {
    if (thumbnailUrl && !imgError) return;
    if (!targetUrl) return;

    if (previewCache.has(targetUrl)) {
      const cached = previewCache.get(targetUrl)!;
      setThumbnailUrl(cached.thumbnailUrl);
      if (cached.isCarousel) setIsCarousel(true);
      if (cached.slideIndex) setSlideIndex(cached.slideIndex);
      return;
    }

    let isMounted = true;
    const fetchPreview = async () => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const queryParams = new URLSearchParams({
          url: targetUrl,
          platform,
        });

        const res = await fetch(`${getApiBase()}/link-preview?${queryParams.toString()}`, {
          headers,
          credentials: "include",
        });

        if (!res.ok) return;
        const data = await res.json();
        if (data && data.thumbnailUrl && isMounted) {
          const resolvedThumb = normalizeThumbnailUrl(data.thumbnailUrl) || data.thumbnailUrl;
          previewCache.set(targetUrl, {
            thumbnailUrl: resolvedThumb,
            isCarousel: Boolean(data.isCarousel || data.kind === "CAROUSEL"),
            slideIndex: data.slideIndex,
            title: data.title,
          });
          setThumbnailUrl(resolvedThumb);
          if (data.isCarousel || data.kind === "CAROUSEL") setIsCarousel(true);
          if (data.slideIndex) setSlideIndex(data.slideIndex);
        }
      } catch {
        // Resilient fallback to platform icon
      }
    };

    fetchPreview();
    return () => {
      isMounted = false;
    };
  }, [targetUrl, platform, thumbnailUrl, imgError]);

  // Size definitions for responsive mobile layout
  const dimensionClasses = {
    sm: "w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl",
    md: "w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl",
    lg: "w-14 h-14 sm:w-16 sm:h-16 min-w-[56px] min-h-[56px] rounded-2xl",
  }[size];

  const iconSizes = {
    sm: 18,
    md: 20,
    lg: 26,
  }[size];

  const badgeIconSizes = {
    sm: 10,
    md: 11,
    lg: 13,
  }[size];

  const showImage = Boolean(thumbnailUrl && !imgError);

  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-white/10 shadow-sm flex items-center justify-center bg-black/40 ${dimensionClasses} ${className}`}
    >
      {showImage ? (
        <>
          <img
            src={thumbnailUrl!}
            alt="Package Media"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />

          {/* Top-Right Mini Carousel Tag */}
          {isCarousel && (
            <div
              className="absolute top-1 right-1 bg-purple-950/85 text-purple-300 border border-purple-500/40 rounded px-1 py-0.5 flex items-center gap-0.5 shadow-sm text-[8px] font-bold"
              title={slideIndex ? `Carousel Slide #${slideIndex}` : "Instagram Carousel / Photo Dump"}
            >
              <Layers className="w-2.5 h-2.5 shrink-0" />
              {slideIndex && <span>#{slideIndex}</span>}
            </div>
          )}

          {/* Bottom-Left / Corner Platform Icon Badge */}
          {showPlatformBadge && (
            <div className="absolute bottom-1 left-1 w-4 h-4 rounded-md bg-black/75 backdrop-blur-sm border border-white/20 flex items-center justify-center p-0.5 shadow">
              <PlatformIcon platform={platform} size={badgeIconSizes} />
            </div>
          )}
        </>
      ) : (
        /* Fallback Platform Gradient Box */
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.07] to-white/[0.02]">
          <PlatformIcon platform={platform} size={iconSizes} />
          {isCarousel && (
            <div
              className="absolute top-1 right-1 bg-purple-950/80 text-purple-300 rounded px-1 py-0.5 flex items-center gap-0.5 text-[8px] font-bold"
              title="Carousel"
            >
              <Layers className="w-2.5 h-2.5" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

