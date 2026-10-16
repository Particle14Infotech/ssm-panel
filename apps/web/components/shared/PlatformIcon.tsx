import React from "react";
import { Layers, Globe } from "lucide-react";

export type SupportedPlatform =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "telegram"
  | "x_twitter"
  | "x"
  | "twitter"
  | "facebook"
  | "spotify"
  | "linkedin"
  | "twitch"
  | "threads"
  | "all"
  | "general"
  | string;

export interface PlatformIconProps {
  platform: SupportedPlatform;
  size?: number | string;
  className?: string;
  useBrandColor?: boolean;
}

export function PlatformIcon({
  platform,
  size = 20,
  className = "",
  useBrandColor = true,
}: PlatformIconProps) {
  const normalizedKey = (platform || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, "_");

  const dim = typeof size === "number" ? `${size}px` : size;

  // 1. INSTAGRAM — Official gradient rounded icon with camera glyph
  if (normalizedKey === "instagram") {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        width={dim}
        height={dim}
        className={`shrink-0 ${className}`}
        aria-label="Instagram"
      >
        <title>Instagram</title>
        <defs>
          <radialGradient id="ig-rg" cx="20%" cy="105%" r="130%">
            <stop offset="0%" stopColor="#ffda77" />
            <stop offset="15%" stopColor="#fca944" />
            <stop offset="35%" stopColor="#f35336" />
            <stop offset="60%" stopColor="#d3228b" />
            <stop offset="90%" stopColor="#7a22ff" />
          </radialGradient>
        </defs>
        {useBrandColor ? (
          <>
            <rect width="24" height="24" rx="6" fill="url(#ig-rg)" />
            <rect
              x="5"
              y="5"
              width="14"
              height="14"
              rx="4"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.8"
            />
            <circle cx="12" cy="12" r="3.2" fill="none" stroke="#ffffff" strokeWidth="1.8" />
            <circle cx="15.8" cy="8.2" r="1" fill="#ffffff" />
          </>
        ) : (
          <path
            fill="currentColor"
            d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
          />
        )}
      </svg>
    );
  }

  // 2. YOUTUBE — Official Red rounded badge with crisp white play button
  if (normalizedKey === "youtube") {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        width={dim}
        height={dim}
        className={`shrink-0 ${className}`}
        aria-label="YouTube"
      >
        <title>YouTube</title>
        {useBrandColor ? (
          <>
            <rect width="24" height="24" rx="5" fill="#FF0000" />
            <polygon points="9.5,7 16.5,12 9.5,17" fill="#FFFFFF" />
          </>
        ) : (
          <path
            fill="currentColor"
            d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
          />
        )}
      </svg>
    );
  }

  // 3. TIKTOK — Official chromatic 3D musical note on dark badge
  if (normalizedKey === "tiktok") {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        width={dim}
        height={dim}
        className={`shrink-0 ${className}`}
        aria-label="TikTok"
      >
        <title>TikTok</title>
        {useBrandColor ? (
          <>
            <rect width="24" height="24" rx="5" fill="#010101" stroke="#252525" strokeWidth="0.8" />
            {/* Cyan Offset */}
            <path
              d="M13.2 4.2c.9 1.1 2.2 1.8 3.6 1.9v2.6c-1.4-.1-2.7-.6-3.6-1.5v5.8c0 2.4-2 4.4-4.4 4.4-2.1 0-3.9-1.5-4.3-3.6.4.2.9.3 1.4.3 2 0 3.6-1.6 3.6-3.6V4.2h3.7z"
              fill="#25F4EE"
              opacity="0.85"
            />
            {/* Magenta/Red Offset */}
            <path
              d="M12.6 4.6c.9 1.1 2.2 1.8 3.6 1.9v2.6c-1.4-.1-2.7-.6-3.6-1.5v5.8c0 2.4-2 4.4-4.4 4.4-2.4 0-4.4-2-4.4-4.4 0-2.3 1.8-4.2 4.1-4.4v2.7c-1 .2-1.7 1-1.7 2 0 1.1.9 2 2 2s2-.9 2-2V4.6h2.4z"
              fill="#FE2C55"
              opacity="0.85"
            />
            {/* Main White Note */}
            <path
              d="M12.8 4.4c.9 1.1 2.2 1.8 3.6 1.9v2.6c-1.4-.1-2.7-.6-3.6-1.5v5.8c0 2.4-2 4.4-4.4 4.4-2.4 0-4.4-2-4.4-4.4 0-2.3 1.8-4.2 4.1-4.4v2.7c-1 .2-1.7 1-1.7 2 0 1.1.9 2 2 2s2-.9 2-2V4.4h2.4z"
              fill="#FFFFFF"
            />
          </>
        ) : (
          <path
            fill="currentColor"
            d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
          />
        )}
      </svg>
    );
  }

  // 4. TELEGRAM — Official sky blue circle with crisp white paper airplane
  if (normalizedKey === "telegram") {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        width={dim}
        height={dim}
        className={`shrink-0 ${className}`}
        aria-label="Telegram"
      >
        <title>Telegram</title>
        {useBrandColor ? (
          <>
            <circle cx="12" cy="12" r="12" fill="#229ED9" />
            <path
              d="M5.4 11.8l11.7-4.5c.5-.2 1.1.2.9.8l-2 9.4c-.1.7-.8 1-1.4.6l-3.3-2.4-1.6 1.5c-.2.2-.5.1-.5-.2v-2.7l6.8-6.1c.3-.3-.1-.6-.4-.4L7.5 13.5l-2.1-.7c-.6-.2-.6-1 0-1z"
              fill="#FFFFFF"
            />
          </>
        ) : (
          <path
            fill="currentColor"
            d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
          />
        )}
      </svg>
    );
  }

  // 5. X / TWITTER — Official crisp white modern X logo on dark background
  if (
    normalizedKey === "x" ||
    normalizedKey === "twitter" ||
    normalizedKey === "x_twitter"
  ) {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        width={dim}
        height={dim}
        className={`shrink-0 ${className}`}
        aria-label="X (Twitter)"
      >
        <title>X</title>
        {useBrandColor ? (
          <>
            <rect width="24" height="24" rx="5" fill="#000000" stroke="#252525" strokeWidth="0.8" />
            <path
              d="M14.234 10.162 21 2h-1.602l-5.871 6.825L8.854 2H3.444l7.091 10.32L3.444 21h1.603l6.199-7.207L16.208 21h5.41l-7.384-10.838zm-2.194 2.551-.718-1.028L5.62 3.654h2.461l4.614 6.602.719 1.028 6.002 8.587h-2.461z"
              fill="#FFFFFF"
            />
          </>
        ) : (
          <path
            fill="currentColor"
            d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"
          />
        )}
      </svg>
    );
  }

  // 6. SPOTIFY — Official Spotify green circle with black curved sound waves
  if (normalizedKey === "spotify") {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        width={dim}
        height={dim}
        className={`shrink-0 ${className}`}
        aria-label="Spotify"
      >
        <title>Spotify</title>
        {useBrandColor ? (
          <>
            <circle cx="12" cy="12" r="12" fill="#1ED760" />
            <path
              d="M17.5 17.3c-.2.4-.7.5-1 .2-2.8-1.7-6.4-2.1-10.6-1.1-.4.1-.8-.2-.9-.5-.1-.4.2-.8.5-.9 4.6-1 8.5-.6 11.6 1.3.4.2.5.7.4 1zm1.5-3.3c-.3.4-.8.6-1.3.3-3.2-2-8.2-2.6-11.9-1.4-.5.1-1-.1-1.1-.6-.1-.5.1-1 .6-1.1 4.3-1.3 9.7-.6 13.4 1.6.4.2.5.8.3 1.2zm.1-3.4C15.2 8.4 8.8 8.2 5.2 9.3c-.6.2-1.2-.2-1.4-.7-.2-.6.2-1.2.7-1.4 4.3-1.3 11.3-1 15.7 1.6.5.3.7 1 .4 1.6-.3.4-1 .6-1.5.2z"
              fill="#121212"
            />
          </>
        ) : (
          <path
            fill="currentColor"
            d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.3.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
          />
        )}
      </svg>
    );
  }

  // 7. FACEBOOK — Official blue circle with white 'f'
  if (normalizedKey === "facebook") {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        width={dim}
        height={dim}
        className={`shrink-0 ${className}`}
        aria-label="Facebook"
      >
        <title>Facebook</title>
        {useBrandColor ? (
          <>
            <circle cx="12" cy="12" r="12" fill="#1877F2" />
            <path
              d="M13.5 19v-6.5h2.2l.3-2.5h-2.5V8.4c0-.7.2-1.2 1.3-1.2h1.4V5c-.2 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6V10H8.5v2.5h2.1V19h2.9z"
              fill="#FFFFFF"
            />
          </>
        ) : (
          <path
            fill="currentColor"
            d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
          />
        )}
      </svg>
    );
  }

  // 8. LINKEDIN — Official blue rounded square with white 'in'
  if (normalizedKey === "linkedin") {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        width={dim}
        height={dim}
        className={`shrink-0 ${className}`}
        aria-label="LinkedIn"
      >
        <title>LinkedIn</title>
        {useBrandColor ? (
          <>
            <rect width="24" height="24" rx="5" fill="#0A66C2" />
            <path
              d="M6.5 9h2.8v9H6.5V9zm1.4-4.5c.9 0 1.6.7 1.6 1.6s-.7 1.6-1.6 1.6-1.6-.7-1.6-1.6.7-1.6 1.6-1.6zM11 9h2.7v1.2h.1c.4-.7 1.3-1.4 2.6-1.4 2.8 0 3.3 1.8 3.3 4.2V18h-2.8v-4c0-1 0-2.2-1.3-2.2-1.4 0-1.6 1-1.6 2.1V18H11V9z"
              fill="#FFFFFF"
            />
          </>
        ) : (
          <path
            fill="currentColor"
            d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
          />
        )}
      </svg>
    );
  }

  // 9. ALL / GENERAL / OTHER SERVICES
  if (normalizedKey === "all" || normalizedKey === "general") {
    return (
      <span
        style={{ width: dim, height: dim }}
        className={`inline-flex items-center justify-center rounded-md bg-white/10 text-white shrink-0 ${className}`}
      >
        <Layers className="w-3.5 h-3.5 text-[#D8EC8D]" />
      </span>
    );
  }

  // Fallback badge with clean typography
  return (
    <span
      style={{
        fontSize: typeof size === "number" ? Math.max(9, size * 0.45) : "10px",
        minWidth: dim,
        height: dim,
      }}
      className={`inline-flex items-center justify-center font-mono font-bold px-1.5 rounded-md bg-white/10 text-[#D8EC8D] border border-white/10 shrink-0 ${className}`}
    >
      {platform ? platform.slice(0, 3).toUpperCase() : "SMM"}
    </span>
  );
}
