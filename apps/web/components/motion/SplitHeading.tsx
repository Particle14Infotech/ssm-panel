"use client";

import React from "react";
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

  // If text is a simple string, we can split into words or lines
  const text = typeof children === "string" ? children : "";

  if (shouldReduceMotion || !text) {
    return (
      <Tag className={className}>
        {children}
        {accent && <span className="text-[#d8ec8d]"> {accent}</span>}
      </Tag>
    );
  }

  const words = text.split(" ");

  return (
    <Tag className={className}>
      <motion.span
        initial={isLcp ? "visible" : "hidden"}
        whileInView="visible"
        viewport={motionTokens.viewport}
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: 0.045,
              delayChildren: delay,
            },
          },
        }}
        className="inline-block"
      >
        {words.map((word, i) => (
          <React.Fragment key={i}>
            <span className="inline-block overflow-hidden align-top mr-[0.25em] last:mr-0">
              <motion.span
                variants={{
                  hidden: {
                    y: "115%",
                    opacity: isLcp ? 1 : 0,
                  },
                  visible: {
                    y: "0%",
                    opacity: 1,
                    transition: {
                      duration: motionTokens.duration,
                      ease: motionTokens.ease,
                    },
                  },
                }}
                className="inline-block"
              >
                {word}
              </motion.span>
            </span>
            {i < words.length - 1 && " "}
          </React.Fragment>
        ))}
        {accent && (
          <>
            {" "}
            <span className="inline-block overflow-hidden align-top text-[#d8ec8d]">
              <motion.span
                variants={{
                  hidden: {
                    y: "115%",
                  opacity: isLcp ? 1 : 0,
                },
                visible: {
                  y: "0%",
                  opacity: 1,
                  transition: {
                    duration: motionTokens.duration,
                    ease: motionTokens.ease,
                  },
                },
              }}
              className="inline-block"
            >
              {accent}
            </motion.span>
          </span>
          </>
        )}
      </motion.span>
    </Tag>
  );
}
