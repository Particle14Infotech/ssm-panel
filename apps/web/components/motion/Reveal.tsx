"use client";

import React from "react";
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

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: shouldReduceMotion ? 0 : y,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={motionTokens.viewport}
      transition={{
        duration: shouldReduceMotion ? motionTokens.reduced.duration : motionTokens.duration,
        ease: shouldReduceMotion ? motionTokens.reduced.ease : motionTokens.ease,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
