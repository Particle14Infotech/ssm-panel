"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion, useReducedMotion, useSpring } from "framer-motion";
import { BorderBeam } from "./BorderBeam";

export interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  enableTilt?: boolean;
  enableBorderBeam?: boolean;
  beamDuration?: number;
  highlight?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * BentoCard - Signature Bento Box Card inspired by Code & Chill.
 * Adheres strictly to canonical SMM palette:
 * - Electric Lime: #d8ec8d
 * - Olive Lime: #bccf74
 * - Surfaces: #1c1b1b / #201f1f
 * - Hairline borders: rgba(255, 255, 255, 0.08)
 */
export function BentoCard({
  children,
  className = "",
  spotlightColor = "rgba(216, 236, 141, 0.09)",
  enableTilt = false,
  enableBorderBeam = false,
  beamDuration = 8,
  highlight = false,
  onClick,
  style,
}: BentoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Tilt physics
  const rotateX = useSpring(0, { stiffness: 400, damping: 25 });
  const rotateY = useSpring(0, { stiffness: 400, damping: 25 });

  useEffect(() => {
    setIsTouch("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isTouch || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setPosition({ x, y });

      if (enableTilt && !shouldReduceMotion) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const maxTilt = 4;
        const rX = -((y - centerY) / centerY) * maxTilt;
        const rY = ((x - centerX) / centerX) * maxTilt;
        rotateX.set(rX);
        rotateY.set(rY);
      }
    },
    [isTouch, enableTilt, shouldReduceMotion, rotateX, rotateY]
  );

  const handleMouseEnter = useCallback(() => {
    if (!isTouch) setIsHovered(true);
  }, [isTouch]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setPosition(null);
    if (enableTilt) {
      rotateX.set(0);
      rotateY.set(0);
    }
  }, [enableTilt, rotateX, rotateY]);

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        ...(enableTilt && !shouldReduceMotion
          ? { rotateX, rotateY, transformStyle: "preserve-3d" as const }
          : {}),
        ...style,
      }}
      whileHover={!shouldReduceMotion ? { y: -3 } : undefined}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`group relative overflow-hidden rounded-3xl bg-[#1c1b1b]/85 backdrop-blur-2xl border transition-all duration-300 ${
        highlight
          ? "border-[#d8ec8d]/35 shadow-[0_12px_40px_-10px_rgba(216,236,141,0.12)]"
          : "border-white/[0.08] hover:border-[#d8ec8d]/30 hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.85)]"
      } ${className}`}
    >
      {/* 1. Animated Border Beam for highlighted cards */}
      {enableBorderBeam && (
        <BorderBeam
          duration={beamDuration}
          colorFrom="#d8ec8d"
          colorTo="#bccf74"
          borderWidth={1.5}
        />
      )}

      {/* 2. Cursor-Tracking Spotlight */}
      {!isTouch && !shouldReduceMotion && isHovered && position && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
          style={{
            background: `radial-gradient(380px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
          }}
        />
      )}

      {/* 3. Subtle ambient inner top hairline shine */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent z-10" />

      {/* 4. Highlight corner ambient glow */}
      {highlight && (
        <div className="pointer-events-none absolute -top-16 -right-16 w-44 h-44 rounded-full bg-[#d8ec8d]/10 blur-3xl z-0" />
      )}

      {/* 5. Card Content Layer */}
      <div className="relative z-10 h-full flex flex-col">{children}</div>
    </motion.div>
  );
}
