"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motionTokens } from "./motion-config";

export interface SplitHeadingProps {
  as?: "h1" | "h2" | "h3" | "h4";
  children: React.ReactNode;
  className?: string;
  accent?: string;
  delay?: number;
  isLcp?: boolean;
}

export function SplitHeading({
  as: Tag = "h2",
  children,
  className = "",
  accent,
  delay = 0,
  isLcp = false,
}: SplitHeadingProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isHydrated, setIsHydrated] = useState(false);
  const [forceVisible, setForceVisible] = useState(isLcp);
  const headingRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsHydrated(true);

    if (isLcp || shouldReduceMotion) {
      setForceVisible(true);
      return;
    }

    // Fail-safe timer: forces the final state ~1.5s after mount or if observer/animation stalls
    const timer = setTimeout(() => {
      setForceVisible(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isLcp, shouldReduceMotion]);

  // If text is not a simple string, render directly with accent
  const text = typeof children === "string" ? children : "";

  // FAIL-SAFE: Before hydration, for LCP, or if reduced motion is requested, render standard visible DOM
  if (!isHydrated || shouldReduceMotion || isLcp || forceVisible) {
    return (
      <Tag
        ref={headingRef as any}
        className={`${className} opacity-100 transform-none`}
        style={{
          paddingBlock: "0.18em",
          marginBlock: "-0.18em",
        }}
      >
        <span>{children}</span>
        {accent && <span className="text-[#d8ec8d]"> {accent}</span>}
      </Tag>
    );
  }

  // Smooth heading-level reveal keeping real text nodes and normal spaces
  // No inline-block word hacks that break word spacing and wrap
  return (
    <Tag
      ref={headingRef as any}
      className={className}
      style={{
        paddingBlock: "0.18em",
        marginBlock: "-0.18em",
      }}
    >
      <span className="block overflow-hidden py-[0.18em] -my-[0.18em]">
        <motion.span
          initial={{ y: "105%", opacity: 0 }}
          whileInView={{ y: "0%", opacity: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          onViewportEnter={() => {
            // Fail-safe timer starting when element enters view
            setTimeout(() => setForceVisible(true), 1500);
          }}
          transition={{
            duration: motionTokens.duration,
            delay,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block w-full"
        >
          <span>{text}</span>
          {accent && <span className="text-[#d8ec8d]"> {accent}</span>}
        </motion.span>
      </span>
    </Tag>
  );
}
