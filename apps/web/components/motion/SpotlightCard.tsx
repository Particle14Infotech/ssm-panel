"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useReducedMotion, useInView } from "framer-motion";

export interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(216, 236, 141, 0.08)",
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const isInView = useInView(cardRef, { once: false, amount: 0.3 });

  useEffect(() => {
    setIsTouch("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouch || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, [isTouch]);

  const handleMouseEnter = useCallback(() => {
    if (!isTouch) setIsHovered(true);
  }, [isTouch]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setPosition(null);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.03] transition-colors hover:border-white/[0.18] active:scale-[0.99] transition-transform ${className}`}
    >
      {/* 1. Desktop cursor-tracking spotlight */}
      {!isTouch && !shouldReduceMotion && isHovered && position && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            background: `radial-gradient(350px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
          }}
        />
      )}

      {/* 2. Touch device auto-drifting highlight when card is in view */}
      {isTouch && !shouldReduceMotion && isInView && (
        <div
          className="pointer-events-none absolute -inset-px opacity-40 animate-pulse transition-opacity duration-1000"
          style={{
            background: `radial-gradient(280px circle at 50% 30%, ${spotlightColor}, transparent 75%)`,
          }}
        />
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
}
