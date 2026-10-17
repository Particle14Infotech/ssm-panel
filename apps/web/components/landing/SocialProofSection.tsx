"use client";

import React, { useState } from "react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { landingContent } from "@/content/landing";
import { motion, useReducedMotion } from "framer-motion";

export function SocialProofSection() {
  const platforms = landingContent.platforms;
  const shouldReduceMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section className="w-full py-7 border-y border-white/[0.08] bg-[#161616]/40 overflow-hidden relative">
      {/* Soft edge gradient fade masks */}
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#131313] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#131313] to-transparent z-10 pointer-events-none" />

      <div
        className="max-w-[1200px] mx-auto px-4 overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          animate={
            shouldReduceMotion || isHovered
              ? { x: 0 }
              : { x: ["0%", "-50%"] }
          }
          transition={{
            repeat: Infinity,
            ease: "linear",
            duration: 28,
          }}
          className="flex items-center gap-6 w-max"
        >
          {/* Primary set */}
          {platforms.map((platform) => (
            <div
              key={`primary-${platform.id}`}
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] flex-shrink-0 hover:border-white/[0.18] hover:bg-white/[0.04] transition-all cursor-default"
            >
              <PlatformIcon platform={platform.id} size={20} />
              <span className="text-sm font-medium text-white/90">
                {platform.name}
              </span>
            </div>
          ))}

          {/* Seamless duplicate set for continuous loop */}
          {platforms.map((platform) => (
            <div
              key={`dup-${platform.id}`}
              aria-hidden="true"
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] flex-shrink-0 hover:border-white/[0.18] hover:bg-white/[0.04] transition-all cursor-default"
            >
              <PlatformIcon platform={platform.id} size={20} />
              <span className="text-sm font-medium text-white/90">
                {platform.name}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
