"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { wordRevealContainer, wordRevealChild } from "@/lib/motion";
import { useMotionPreference } from "./useMotionPreference";

interface SplitTextRevealProps {
  text: string;
  className?: string;
  highlightWords?: string[];
  highlightClass?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

export function SplitTextReveal({
  text,
  className = "",
  highlightWords = [],
  highlightClass = "text-[#DBEF90] font-normal",
  as = "h1",
}: SplitTextRevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const { reduced } = useMotionPreference();
  const isReduced = Boolean(reduced || shouldReduceMotion);
  const words = text.split(" ");
  const Tag = as as any;

  if (isReduced) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag className={className}>
      <motion.span
        variants={wordRevealContainer}
        initial="hidden"
        animate="visible"
        className="inline-flex flex-wrap gap-x-[0.28em] gap-y-[0.1em]"
      >
        {words.map((word, i) => {
          const isHighlighted = highlightWords.some((hw) =>
            word.toLowerCase().includes(hw.toLowerCase())
          );
          return (
            <span key={i} className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em]">
              <motion.span
                variants={wordRevealChild}
                className={`inline-block ${isHighlighted ? highlightClass : ""}`}
              >
                {word}
              </motion.span>
            </span>
          );
        })}
      </motion.span>
    </Tag>
  );
}
