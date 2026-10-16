"use client";

import React from "react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { PaymentIcon } from "@/components/shared/PaymentIcon";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

const SUPPORTED_PLATFORMS = [
  { id: "instagram", name: "Instagram", tag: "Reels & Engagement" },
  { id: "youtube", name: "YouTube", tag: "Watch Time & Subs" },
  { id: "tiktok", name: "TikTok", tag: "Sound & Paced Views" },
  { id: "telegram", name: "Telegram", tag: "Channel Members" },
  { id: "x_twitter", name: "X", tag: "Impressions & Retweets" },
  { id: "facebook", name: "Facebook", tag: "Page Followers" },
  { id: "spotify", name: "Spotify", tag: "Streams & Saves" },
  { id: "linkedin", name: "LinkedIn", tag: "Professional Reach" },
];

const PAYMENT_METHODS = [
  { id: "upi", name: "UPI Direct", tag: "Instant Credit" },
  { id: "gpay", name: "Google Pay", tag: "Zero Fee" },
  { id: "phonepe", name: "PhonePe", tag: "Verified Ingress" },
  { id: "paytm", name: "Paytm", tag: "Wallet & UPI" },
  { id: "visa", name: "Visa", tag: "Debit & Credit" },
  { id: "mastercard", name: "Mastercard", tag: "Global Cards" },
  { id: "rupay", name: "RuPay", tag: "Domestic Cards" },
  { id: "netbanking", name: "Netbanking", tag: "50+ Indian Banks" },
];

export function SocialProofSection() {
  return (
    <section className="w-full py-16 bg-transparent border-y border-white/[0.06] relative overflow-hidden">
      {/* Infinite Marquee Platform Strip (Pauses on hover) */}
      <div className="w-full mb-12 overflow-hidden border-b border-white/[0.06] pb-8">
        <div className="flex w-max items-center gap-4 animate-[marquee_30s_linear_infinite] hover:[animation-play-state:paused]">
          {[...SUPPORTED_PLATFORMS, ...SUPPORTED_PLATFORMS, ...SUPPORTED_PLATFORMS].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#070B16]/80 backdrop-blur-md border border-white/[0.08] text-white shadow-md shrink-0 hover:border-blue-500/50 hover:bg-[#070B16] transition-all cursor-default"
            >
              <PlatformIcon platform={item.id} size={18} />
              <span className="text-xs font-medium text-white">{item.name}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {item.tag}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <RevealOnScroll className="text-center mb-10">
          <p className="text-xs uppercase tracking-widest font-mono text-blue-400 font-medium">
            SUPPORTED ECOSYSTEM
          </p>
          <h2 className="text-2xl md:text-3xl font-light text-white mt-1">
            Real Ingress Across Major Platforms & Verified Payment Rails
          </h2>
          <p className="text-slate-400 text-sm mt-2 max-w-xl mx-auto font-light">
            Every platform is dispatched via authorized provider endpoints. Deposits are credited instantly in INR with zero hidden fees.
          </p>
        </RevealOnScroll>

        {/* Payment Methods Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
          {PAYMENT_METHODS.map((pm, idx) => (
            <RevealOnScroll key={pm.id} delay={idx * 0.05}>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md hover:border-blue-500/30 transition-all flex items-center gap-3">
                <PaymentIcon method={pm.id} size={24} />
                <div>
                  <div className="text-sm font-medium text-white">{pm.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{pm.tag}</div>
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
