"use client";

import React from "react";
import Image from "next/image";
import { useMotionPreference } from "../motion/useMotionPreference";

export type CrownSlotId = "hero" | "steps" | "services" | "payments" | "cta";

export interface CrownSlotProps {
  id: CrownSlotId;
  className?: string;
  showPosterFallback?: boolean;
}

export function CrownSlot({
  id,
  className = "",
  showPosterFallback = false,
}: CrownSlotProps) {
  const { reduced, canRender3D } = useMotionPreference();
  const isPosterNeeded = showPosterFallback || reduced || !canRender3D;

  return (
    <div
      id={`crown-slot-${id}`}
      data-crown-slot={id}
      className={`relative flex items-center justify-center pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {/* Fallback transparent poster: rendered only if 3D is disabled or reduced motion is active */}
      {isPosterNeeded && (
        <div className="relative w-full h-full flex items-center justify-center">
          <Image
            src="/brand/crown-royal@2x.webp"
            alt=""
            width={160}
            height={160}
            className="w-full h-full object-contain pointer-events-none select-none"
            priority={id === "hero"}
          />
        </div>
      )}
    </div>
  );
}
