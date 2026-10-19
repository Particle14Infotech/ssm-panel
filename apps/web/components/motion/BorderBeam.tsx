"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface BorderBeamProps {
  className?: string;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
  reverse?: boolean;
}

/**
 * BorderBeam - signature Code & Chill animated border tracer.
 * Uses hardware-accelerated rotation strictly with the pre-decided design system palette.
 * Default colors: #d8ec8d (Primary Lime) and #bccf74 (Primary Dim).
 */
export function BorderBeam({
  className = "",
  duration = 8,
  colorFrom = "#d8ec8d",
  colorTo = "#bccf74",
  borderWidth = 1.5,
  reverse = false,
}: BorderBeamProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <motion.div
        animate={{ rotate: reverse ? -360 : 360 }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
        className="absolute -inset-[150%] opacity-85"
        style={{
          background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 270deg, ${colorTo} 320deg, ${colorFrom} 360deg)`,
        }}
      />
      {/* Inner surface mask preserving card opacity */}
      <div
        className="absolute rounded-[inherit] bg-[#1a1919]/95 backdrop-blur-xl"
        style={{
          inset: `${borderWidth}px`,
        }}
      />
    </div>
  );
}
