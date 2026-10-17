"use client";

import React from "react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { landingContent } from "@/content/landing";

export function SocialProofSection() {
  const platforms = landingContent.platforms;

  return (
    <section className="w-full py-8 border-y border-white/[0.08] bg-white/[0.01] overflow-hidden relative">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-6 overflow-x-auto scrollbar-none py-1">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] flex-shrink-0 hover:border-white/[0.14] transition-colors"
            >
              <PlatformIcon platform={platform.id} size={20} />
              <span className="text-sm font-medium text-white/90">
                {platform.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
