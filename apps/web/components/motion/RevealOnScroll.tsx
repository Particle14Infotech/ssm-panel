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

  if (reduced) {
    return (
      <div data-reveal className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      data-reveal
      variants={stagger ? staggerContainer : fadeUpVariant}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
