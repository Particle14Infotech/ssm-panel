"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motionTokens } from "./motion-config";

export interface RevealGroupProps {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}

export function RevealGroup({
  children,
  className = "",
  stagger = motionTokens.stagger,
  delay = 0,
}: RevealGroupProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={motionTokens.viewport}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: shouldReduceMotion ? 0.02 : stagger,
            delayChildren: delay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className = "",
  y = motionTokens.distance,
}: {
  children: React.ReactNode;
  className?: string;
  y?: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={{
        hidden: {
          opacity: 0,
          y: shouldReduceMotion ? 0 : y,
        },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: shouldReduceMotion ? motionTokens.reduced.duration : motionTokens.duration,
            ease: shouldReduceMotion ? motionTokens.reduced.ease : motionTokens.ease,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
