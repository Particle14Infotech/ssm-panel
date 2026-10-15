"use client";

import React from "react";
import { motion } from "framer-motion";
import { landingContent } from "@/content/landing";
import { TiltCard } from "@/components/motion/TiltCard";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

const OfficialPlatformIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "instagram":
      return (
        <svg className="w-4 h-4 rounded-[4px] shrink-0" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFDC80" />
              <stop offset="25%" stopColor="#FCAF45" />
              <stop offset="50%" stopColor="#F77737" />
              <stop offset="75%" stopColor="#FD1D1D" />
              <stop offset="85%" stopColor="#E1306C" />
              <stop offset="100%" stopColor="#833AB4" />
            </linearGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
          <rect x="5.5" y="5.5" width="13" height="13" rx="4" stroke="white" strokeWidth="1.8" fill="none" />
          <circle cx="12" cy="12" r="3.2" stroke="white" strokeWidth="1.8" fill="none" />
          <circle cx="15.8" cy="8.2" r="0.9" fill="white" />
        </svg>
      );
    case "youtube":
      return (
        <svg className="w-4 h-4 rounded-[4px] shrink-0" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#FF0000" />
          <path d="M10 8.5L16 12L10 15.5V8.5Z" fill="white" />
        </svg>
      );
    case "tiktok":
      return (
        <svg className="w-4 h-4 rounded-[4px] shrink-0" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#050505" />
          <path
            d="M12.5 5.5v8.2a2.8 2.8 0 1 1-2.8-2.8c.3 0 .6.05.9.15v-2.2a5 5 0 1 0 4.1 4.9V9.1a5.6 5.6 0 0 0 3.3 1.1V8a3.5 3.5 0 0 1-3.3-2.5h-2.2z"
            fill="white"
          />
          <path
            d="M12.2 5.5v8.2a2.8 2.8 0 0 1-2.5-2.8c.3 0 .6.05.9.15v-2.2a5 5 0 0 0-1.2 3.1 5 5 0 0 0 5 4.9V9.1a5.6 5.6 0 0 0 3.3 1.1V8.5a3.5 3.5 0 0 1-3.3-2.5h-2.2z"
            fill="#00F2FE"
            opacity="0.6"
          />
        </svg>
      );
    case "telegram":
      return (
        <svg className="w-4 h-4 rounded-[4px] shrink-0" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#24A1DE" />
          <path
            d="M6.5 11.8l9.5-4.1c.6-.2 1.1.1.9.8l-1.6 7.6c-.1.6-.5.7-1 .4l-2.7-2-1.3 1.3c-.1.1-.3.3-.6.3l.2-2.8 5-4.5c.2-.2 0-.3-.3-.1l-6.2 3.9-2.7-.8c-.6-.2-.6-.6.1-.8z"
            fill="white"
          />
        </svg>
      );
    case "x":
      return (
        <svg className="w-4 h-4 rounded-[4px] shrink-0" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#000000" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <path
            d="M15.8 6.5h1.9l-4.2 4.8 4.9 6.2h-3.8l-3-3.9-3.4 3.9H6.3l4.5-5.1L6.1 6.5H10l2.7 3.6 3.1-3.6zm-.7 9.8h1.1L9 7.6H7.8l7.3 8.7z"
            fill="white"
          />
        </svg>
      );
    case "spotify":
      return (
        <svg className="w-4 h-4 rounded-[4px] shrink-0" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#1DB954" />
          <path
            d="M16.5 14.8c-.2.3-.5.4-.8.2-2.2-1.3-4.9-1.6-8.1-.9-.3.1-.6-.1-.7-.4-.1-.3.1-.6.4-.7 3.5-.8 6.5-.4 9 1 .3.2.4.5.2.8zm1.2-2.6c-.2.3-.7.4-1 .2-2.5-1.5-6.3-2-9.2-1.1-.4.1-.8-.1-.9-.5-.1-.4.1-.8.5-.9 3.4-1 7.6-.5 10.4 1.3.4.2.5.7.2 1zm.1-2.7C14.8 7.8 9.8 7.6 7 8.5c-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.2-1 8.7-.7 12.1 1.3.4.2.5.7.3 1.1-.2.4-.7.5-1.1.3z"
            fill="white"
          />
        </svg>
      );
    case "discord":
      return (
        <svg className="w-4 h-4 rounded-[4px] shrink-0" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#5865F2" />
          <path
            d="M16.8 7.5a11.5 11.5 0 0 0-2.8-.9.1.1 0 0 0-.1.1c-.1.2-.3.5-.4.8a10.8 10.8 0 0 0-3 0c-.1-.3-.3-.6-.5-.8a.1.1 0 0 0-.1-.1c-1 .3-2 .6-2.8.9a.1.1 0 0 0 0 .1c-1.8 2.7-2.3 5.4-2.1 8a.1.1 0 0 0 0 .1c1.2.9 2.4 1.4 3.5 1.8a.1.1 0 0 0 .1 0c.3-.4.5-.8.8-1.2a.1.1 0 0 0-.1-.1c-.4-.2-.8-.4-1.2-.6a.1.1 0 0 1 0-.2c.1-.1.2-.1.3-.2a7.7 7.7 0 0 0 6.8 0c.1.1.2.1.3.2a.1.1 0 0 1 0 .2c-.4.2-.8.4-1.2.6a.1.1 0 0 0-.1.1c.3.4.5.8.8 1.2a.1.1 0 0 0 .1 0c1.2-.4 2.3-.9 3.5-1.8a.1.1 0 0 0 0-.1c.3-3.1-.6-5.7-2.1-8a.1.1 0 0 0 0-.1zM9.5 14.2c-.7 0-1.2-.6-1.2-1.4 0-.8.5-1.4 1.2-1.4.7 0 1.2.6 1.2 1.4 0 .8-.5 1.4-1.2 1.4zm5 0c-.7 0-1.2-.6-1.2-1.4 0-.8.5-1.4 1.2-1.4.7 0 1.2.6 1.2 1.4 0 .8-.5 1.4-1.2 1.4z"
            fill="white"
          />
        </svg>
      );
    default:
      return null;
  }
};

const MARQUEE_ITEMS = [
  { name: "Instagram Reels", type: "instagram", stat: "12.4M/mo" },
  { name: "YouTube 4K Views", type: "youtube", stat: "4.8M/mo" },
  { name: "TikTok FYP Sync", type: "tiktok", stat: "18.2M/mo" },
  { name: "Telegram Group Shards", type: "telegram", stat: "3.5M/mo" },
  { name: "X Verified Impressions", type: "x", stat: "9.1M/mo" },
  { name: "Spotify Streams", type: "spotify", stat: "2.3M/mo" },
  { name: "Discord Growth", type: "discord", stat: "1.1M/mo" },
];

export function SocialProofSection() {
  return (
    <section className="w-full py-16 bg-transparent border-y border-white/[0.06] relative overflow-hidden">
      {/* Infinite Marquee Platform Strip (Pauses on hover) */}
      <div className="w-full mb-12 overflow-hidden border-b border-white/[0.06] pb-8">
        <div className="flex w-max items-center gap-6 animate-[marquee_25s_linear_infinite] hover:[animation-play-state:paused]">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-zinc-950/70 backdrop-blur-md border border-white/[0.08] text-white shadow-lg shrink-0 hover:border-[#D8EC8D]/50 hover:bg-zinc-900/80 transition-all cursor-default"
            >
              <OfficialPlatformIcon type={item.type} />
              <span className="text-xs font-semibold">{item.name}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-[#D8EC8D] border border-[#D8EC8D]/20">
                {item.stat}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealOnScroll className="text-center mb-10">
          <p className="text-xs uppercase tracking-widest font-mono text-[#DBEF90]">
            VERIFIED REVIEWS
          </p>
          <h2 className="text-xl md:text-2xl font-light text-white mt-1">
            {landingContent.socialProof.headline}
          </h2>
        </RevealOnScroll>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {landingContent.socialProof.testimonials.map((item, idx) => (
            <RevealOnScroll key={idx} delay={idx * 0.1}>
              <TiltCard
                maxTilt={4}
                glowColor="rgba(219, 239, 144, 0.2)"
                className="h-full bg-gradient-to-b from-white/[0.08] to-white/[0.02] bg-zinc-950/45 backdrop-blur-2xl p-8 rounded-3xl border border-white/[0.14] hover:border-white/[0.28] hover:bg-zinc-950/55 flex flex-col justify-between shadow-[0_24px_50px_rgba(0,0,0,0.6)] transition-all duration-300"
              >
                <p className="text-sm md:text-base text-zinc-100 italic leading-relaxed mb-6 font-light">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
                  <div>
                    <div className="text-sm font-semibold text-white">{item.author}</div>
                    <div className="text-xs text-zinc-300">
                      {item.role} • {item.company}
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-white/[0.08] text-xs font-mono text-[#DBEF90] border border-white/10 backdrop-blur-md">
                    {item.metric}
                  </div>
                </div>
              </TiltCard>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
