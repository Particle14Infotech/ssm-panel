"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export interface BrandLogoProps {
  variant?: "icon" | "full" | "combined";
  size?: number;
  className?: string;
  withLink?: boolean;
  href?: string;
  showPulse?: boolean;
}

export function BrandLogo({
  variant = "combined",
  size = 32,
  className = "",
  withLink = false,
  href = "/",
  showPulse = true,
}: BrandLogoProps) {
  // 1. FULL HORIZONTAL LOGO (1024x245 aspect ~4.18:1)
  if (variant === "full") {
    const fullHeight = size;
    const fullWidth = Math.round(size * 4.18);
    const content = (
      <Image
        src="/brand/logo-full.png"
        alt={`${BRAND_NAME} Official Logo`}
        width={fullWidth}
        height={fullHeight}
        priority
        className={`object-contain shrink-0 ${className}`}
      />
    );

    if (withLink) {
      return (
        <Link href={href} className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8EC8D] rounded-lg">
          {content}
        </Link>
      );
    }
    return content;
  }

  // 2. ICON ONLY (1:1 aspect)
  if (variant === "icon") {
    const content = (
      <Image
        src="/brand/logo-icon.png"
        alt={`${BRAND_NAME} Icon`}
        width={size}
        height={size}
        priority
        className={`rounded-xl object-contain shrink-0 shadow-sm ${className}`}
      />
    );

    if (withLink) {
      return (
        <Link href={href} className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8EC8D] rounded-xl">
          {content}
        </Link>
      );
    }
    return content;
  }

  // 3. COMBINED: ICON + TYPOGRAPHY WITH ACCENT
  const content = (
    <div className={`flex items-center gap-2.5 shrink-0 ${className}`}>
      <Image
        src="/brand/logo-icon.png"
        alt={`${BRAND_NAME} Icon`}
        width={size}
        height={size}
        priority
        className="rounded-xl object-contain shrink-0 shadow-sm group-hover:scale-105 transition-transform"
      />
      <div className="flex items-center gap-1.5">
        <span className="font-heading font-bold text-base sm:text-lg tracking-wider text-white uppercase">
          {BRAND_NAME}
        </span>
        {showPulse && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#D8EC8D] animate-pulse shrink-0" />
        )}
      </div>
    </div>
  );

  if (withLink) {
    return (
      <Link href={href} className="group inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8EC8D] rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}
