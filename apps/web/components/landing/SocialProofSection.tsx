"use client";

import React from "react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { landingContent } from "@/content/landing";

export function SocialProofSection() {
  const platforms = landingContent.platforms;

  return (
    <section className="w-full py-6 border-y border-border bg-surface-glass overflow-hidden relative select-none">
      {/* Soft edge gradient fade masks */}
      <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />

      <div className="w-full overflow-hidden">
        <div className="animate-continuous-marquee flex items-center gap-4 sm:gap-6">
          {/* Primary set */}
          {platforms.map((platform) => (
            <div
              key={`primary-${platform.id}`}
              className="flex items-center gap-2.5 px-3.5 sm:px-4 py-2 rounded-xl bg-white/[0.03] border border-border flex-shrink-0 hover:border-accent/40 hover:bg-white/[0.06] transition-all cursor-default"
            >
              <PlatformIcon platform={platform.id} size={18} />
              <span className="text-xs sm:text-sm font-medium text-fg">
                {platform.name}
              </span>
            </div>
          ))}

          {/* Seamless duplicate set for continuous loop */}
          {platforms.map((platform) => (
            <div
              key={`dup1-${platform.id}`}
              aria-hidden="true"
              className="flex items-center gap-2.5 px-3.5 sm:px-4 py-2 rounded-xl bg-white/[0.03] border border-border flex-shrink-0 hover:border-accent/40 hover:bg-white/[0.06] transition-all cursor-default"
            >
              <PlatformIcon platform={platform.id} size={18} />
              <span className="text-xs sm:text-sm font-medium text-fg">
                {platform.name}
              </span>
            </div>
          ))}

          {/* Triplicate set ensuring ultra-wide desktop seamlessness */}
          {platforms.map((platform) => (
            <div
              key={`dup2-${platform.id}`}
              aria-hidden="true"
              className="flex items-center gap-2.5 px-3.5 sm:px-4 py-2 rounded-xl bg-white/[0.03] border border-border flex-shrink-0 hover:border-accent/40 hover:bg-white/[0.06] transition-all cursor-default"
            >
              <PlatformIcon platform={platform.id} size={18} />
              <span className="text-xs sm:text-sm font-medium text-fg">
                {platform.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
