"use client";

import React from "react";
import { motion } from "framer-motion";
import { fadeUpVariant, staggerContainer } from "@/lib/motion";
import { useMotionPreference } from "./useMotionPreference";

interface RevealOnScrollProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
}

export function RevealOnScroll({
  children,
  className = "",
  delay = 0,
  stagger = false,
}: RevealOnScrollProps) {
  const { reduced } = useMotionPreference();

  return (
    <motion.div
      data-reveal
      variants={stagger ? staggerContainer : fadeUpVariant}
      initial={{
        opacity: 0,
        y: reduced ? 0 : 24,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: reduced ? 0.2 : 0.7,
        ease: reduced ? "easeOut" : [0.22, 1, 0.36, 1],
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
