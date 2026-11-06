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

  // Initial values from snapshot if available
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    snapshotPreview?.thumbnailUrl || null
  );
  const [isCarousel, setIsCarousel] = useState<boolean>(
    Boolean(
      snapshotPreview?.isCarousel ||
        (snapshotPreview?.kind === "CAROUSEL") ||
        (pkg.handle && /[?&]img_index=\d+/i.test(pkg.handle))
    )
  );
  const [slideIndex, setSlideIndex] = useState<number | undefined>(
    snapshotPreview?.slideIndex ||
      (pkg.handle ? Number(pkg.handle.match(/[?&]img_index=(\d+)/i)?.[1]) : undefined)
  );
  const [imgError, setImgError] = useState(false);

  // Extract target URL from package handle or slots/triggers
  const targetUrl = React.useMemo(() => {
    if (pkg.handle && (pkg.handle.startsWith("http://") || pkg.handle.startsWith("https://"))) {
      return pkg.handle.trim();
    }
    const slotUrl = pkg.slots?.[0]?.targetUrl;
    if (slotUrl && (slotUrl.startsWith("http://") || slotUrl.startsWith("https://"))) {
      return slotUrl.trim();
    }
    const triggerUrl = pkg.triggers?.[0]?.targetUrl;
    if (triggerUrl && (triggerUrl.startsWith("http://") || triggerUrl.startsWith("https://"))) {
      return triggerUrl.trim();
    }
    return null;
  }, [pkg]);

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
          let resolvedThumb = data.thumbnailUrl;
          if (resolvedThumb.startsWith("/")) {
            resolvedThumb = `${getApiBase()}${resolvedThumb.replace(/^\/api\/v1/, "")}`;
          }
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
