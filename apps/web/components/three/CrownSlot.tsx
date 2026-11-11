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
}: CrownSlotProps) {
  return (
    <div
      id={`crown-slot-${id}`}
      data-crown-slot={id}
      className={`relative flex items-center justify-center pointer-events-none select-none ${className}`}
      aria-hidden="true"
    />
  );
}
