"use client";

import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motionTokens } from "./motion-config";

export interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}

export function Reveal({
  children,
  className = "",
  delay = 0,
  y = motionTokens.distance,
}: RevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isHydrated, setIsHydrated] = useState(false);
  const [forceVisible, setForceVisible] = useState(false);

  useEffect(() => {
    setIsHydrated(true);

    if (shouldReduceMotion) {
      setForceVisible(true);
      return;
    }

    // Fail-safe: ensure subtitle / content is never left hidden if observer fails
    const timer = setTimeout(() => {
      setForceVisible(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [shouldReduceMotion]);

  if (!isHydrated || shouldReduceMotion || forceVisible) {
    return (
      <div className={`${className} opacity-100 transform-none`}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
        y,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      onViewportEnter={() => {
        setTimeout(() => setForceVisible(true), 1500);
      }}
      viewport={motionTokens.viewport}
      transition={{
        duration: motionTokens.duration,
        ease: motionTokens.ease,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
