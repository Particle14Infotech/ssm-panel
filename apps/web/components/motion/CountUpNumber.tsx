"use client";

import React, { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";
import { useMotionPreference } from "./useMotionPreference";

interface CountUpNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function CountUpNumber({
  value,
  duration = 1.6,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}: CountUpNumberProps) {
  const { reduced } = useMotionPreference();
  const [displayValue, setDisplayValue] = useState(reduced ? value : 0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (reduced) {
      setDisplayValue(value);
      return;
    }

    if (isInView && !hasAnimated.current) {
      hasAnimated.current = true;
      const startTime = performance.now();
      const endValue = value;

      const updateCount = (currentTime: number) => {
        const elapsed = (currentTime - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        // Easing out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = easeOut * endValue;

        setDisplayValue(current);

        if (progress < 1) {
          requestAnimationFrame(updateCount);
        } else {
          setDisplayValue(endValue);
        }
      };

      requestAnimationFrame(updateCount);
    }
  }, [isInView, value, duration, reduced]);

  const formatted = decimals > 0
    ? displayValue.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.floor(displayValue).toLocaleString("en-US");

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
