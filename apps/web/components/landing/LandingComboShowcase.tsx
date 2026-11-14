"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { CrownSlot } from "@/components/three/CrownSlot";
import {
  Sparkles,
  Heart,
  Eye,
  MessageCircle,
  Repeat,
  Bookmark,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";

interface ShowcasePackage {
  id: string;
  name: string;
  platform: string; // instagram, youtube, tiktok, telegram, facebook, x
  serviceKind: string; // all, likes, views, comments, shares, saves, engagement
  badge: string;
  badgeType: "popular" | "best" | "algo" | "pro";
  description: string;
  deliveryTime: string;
  items: { icon: string; label: string; count: string }[];
  startingPrice: number;
}

const SHOWCASE_PACKAGES: ShowcasePackage[] = [
  // Instagram
  {
    id: "ig-starter-eng",
    name: "Starter Instagram Engagement",
    platform: "instagram",
    serviceKind: "engagement",
    badge: "MOST POPULAR",
    badgeType: "popular",
    description: "Ideal for new creators & emerging brands building initial algorithmic trust.",
    deliveryTime: "Starts in 60 mins",
    items: [
      { icon: "👀", label: "Reel Views", count: "2,500" },
      { icon: "❤️", label: "High Quality Likes", count: "250" },
      { icon: "💬", label: "Real Comments", count: "25" },
    ],
    startingPrice: 199,
  },
  {
    id: "ig-growth-eng",
    name: "Growth Instagram Engagement",
    platform: "instagram",
    serviceKind: "engagement",
    badge: "HOT ALGORITHM",
    badgeType: "algo",
    description: "Designed for explore discovery with synchronized multi-metric velocity.",
    deliveryTime: "Paced over 12 hours",
    items: [
      { icon: "👀", label: "Reel Views", count: "10,000" },
      { icon: "❤️", label: "HQ Likes", count: "800" },
      { icon: "💬", label: "Custom Comments", count: "60" },
      { icon: "🔁", label: "Shares & Reposts", count: "200" },
    ],
    startingPrice: 399,
  },
  {
    id: "ig-popular-eng",
    name: "Popular Instagram Authority",
    platform: "instagram",
    serviceKind: "engagement",
    badge: "BEST OPTION",
    badgeType: "best",
    description: "Aggressive viral push tailored for sponsored posts, launches & trending reels.",
    deliveryTime: "24-48h Smart Waves",
    items: [
      { icon: "👀", label: "Reel Views", count: "25,000" },
      { icon: "❤️", label: "HQ Likes", count: "2,000" },
      { icon: "💬", label: "Active Comments", count: "150" },
      { icon: "🔖", label: "Saves & Bookmarks", count: "400" },
    ],
    startingPrice: 699,
  },
  {
    id: "ig-pro-eng",
    name: "Pro Instagram Scale Wave",
    platform: "instagram",
    serviceKind: "engagement",
    badge: "MAX IMPACT",
    badgeType: "pro",
    description: "Top-tier profile authority combo for maximum organic explore retention.",
    deliveryTime: "Multi-Day Drip",
    items: [
      { icon: "👀", label: "Reel Views", count: "50,000" },
      { icon: "❤️", label: "Premium Likes", count: "4,000" },
      { icon: "💬", label: "Verified-style Comments", count: "300" },
      { icon: "🔁", label: "Reach & Impressions", count: "5,000" },
    ],
    startingPrice: 999,
  },
  {
    id: "ig-likes-power",
    name: "Non-Drop Likes Momentum",
    platform: "instagram",
    serviceKind: "likes",
    badge: "INSTANT DISPATCH",
    badgeType: "popular",
    description: "High retention authentic likes delivered with natural organic flow rate.",
    deliveryTime: "Starts in 15m",
    items: [
      { icon: "❤️", label: "Non-Drop Likes", count: "5,000" },
      { icon: "📊", label: "Post Impressions", count: "10,000" },
    ],
    startingPrice: 149,
  },
  {
    id: "ig-views-blast",
    name: "Viral Reels Views Blast",
    platform: "instagram",
    serviceKind: "views",
    badge: "HIGH RETENTION",
    badgeType: "algo",
    description: "High watch-time views engineered to push reels directly into explore.",
    deliveryTime: "Starts in 10m",
    items: [
      { icon: "👀", label: "High-Retention Views", count: "20,000" },
      { icon: "⚡", label: "Explore Velocity", count: "Max Speed" },
    ],
    startingPrice: 99,
  },
  {
    id: "ig-comments-discussion",
    name: "Contextual Comments & Discussion",
    platform: "instagram",
    serviceKind: "comments",
    badge: "REAL ACCOUNTS",
    badgeType: "pro",
    description: "Relevant engaging comments designed to encourage user debate.",
    deliveryTime: "Scheduled Delivery",
    items: [
      { icon: "💬", label: "Custom Written Comments", count: "100" },
      { icon: "❤️", label: "Comment Likes", count: "500" },
    ],
    startingPrice: 249,
  },
  {
    id: "ig-shares-signals",
    name: "Algorithm Signal: Shares & Saves",
    platform: "instagram",
    serviceKind: "shares",
    badge: "ALGO TRIGGER",
    badgeType: "best",
    description: "Boost the two most critical ranking metrics for the modern Instagram algorithm.",
    deliveryTime: "Direct Clearance",
    items: [
      { icon: "🔁", label: "Post Shares", count: "1,500" },
      { icon: "🔖", label: "Post Saves", count: "1,500" },
    ],
    startingPrice: 179,
  },

  // YouTube
  {
    id: "yt-growth-combo",
    name: "YouTube Authority Accelerator",
    platform: "youtube",
    serviceKind: "engagement",
    badge: "RANKING BOOSTER",
    badgeType: "best",
    description: "High-retention views combined with organic likes to establish search dominance.",
    deliveryTime: "Natural Pacing",
    items: [
      { icon: "👀", label: "High Watch Time Views", count: "5,000" },
      { icon: "👍", label: "HQ Video Likes", count: "500" },
      { icon: "💬", label: "Relevant Comments", count: "30" },
    ],
    startingPrice: 499,
  },
  {
    id: "yt-shorts-power",
    name: "YouTube Shorts Viral Ignition",
    platform: "youtube",
    serviceKind: "views",
    badge: "SHORTS EXPLOSION",
    badgeType: "popular",
    description: "Instant start views optimized for the YouTube Shorts recommendation feed.",
    deliveryTime: "Starts in 5 mins",
    items: [
      { icon: "👀", label: "Shorts Views", count: "15,000" },
      { icon: "👍", label: "Shorts Likes", count: "800" },
    ],
    startingPrice: 299,
  },

  // TikTok
  {
    id: "tt-fyp-booster",
    name: "TikTok FYP Catalyst Bundle",
    platform: "tiktok",
    serviceKind: "engagement",
    badge: "FYP PUSH",
    badgeType: "popular",
    description: "High-retention TikTok video views, likes and favorites tuned for FYP ranking.",
    deliveryTime: "Instant Dispatch",
    items: [
      { icon: "👀", label: "FYP Video Views", count: "10,000" },
      { icon: "❤️", label: "TikTok Likes", count: "1,000" },
      { icon: "🔖", label: "Favorites & Saves", count: "300" },
    ],
    startingPrice: 249,
  },

  // Telegram
  {
    id: "tg-channel-booster",
    name: "Telegram Channel Authority Pack",
    platform: "telegram",
    serviceKind: "engagement",
    badge: "COMMUNITY BOOST",
    badgeType: "best",
    description: "Boost channel member count and last 10 posts view counts simultaneously.",
    deliveryTime: "Instant Clearance",
    items: [
      { icon: "👥", label: "Channel Subscribers", count: "1,000" },
      { icon: "👀", label: "Post Views (Last 10)", count: "5,000 each" },
    ],
    startingPrice: 349,
  },
];

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: "📷" },
  { id: "youtube", label: "YouTube", icon: "▶️" },
  { id: "tiktok", label: "TikTok", icon: "🎵" },
  { id: "telegram", label: "Telegram", icon: "✈️" },
  { id: "facebook", label: "Facebook", icon: "📘" },
  { id: "x", label: "X", icon: "✖️" },
];

const SERVICE_PILLS = [
  { id: "all", label: "All", icon: <Sparkles className="w-3 h-3" /> },
  { id: "likes", label: "Likes", icon: <Heart className="w-3 h-3" /> },
  { id: "views", label: "Views", icon: <Eye className="w-3 h-3" /> },
  { id: "comments", label: "Comments", icon: <MessageCircle className="w-3 h-3" /> },
  { id: "shares", label: "Shares", icon: <Repeat className="w-3 h-3" /> },
  { id: "saves", label: "Saves", icon: <Bookmark className="w-3 h-3" /> },
  { id: "engagement", label: "Engagement", icon: <TrendingUp className="w-3 h-3" /> },
];

export function LandingComboShowcase() {
  const [activePlatform, setActivePlatform] = useState<string>("instagram");
  const [activeServiceKind, setActiveServiceKind] = useState<string>("all");

  const filteredPackages = useMemo(() => {
    return SHOWCASE_PACKAGES.filter((pkg) => {
      const matchPlatform = pkg.platform === activePlatform;
      const matchKind = activeServiceKind === "all" || pkg.serviceKind === activeServiceKind;
      return matchPlatform && matchKind;
    });
  }, [activePlatform, activeServiceKind]);

  const getBadgeStyle = (type: ShowcasePackage["badgeType"]) => {
    switch (type) {
      case "popular":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30";
      case "algo":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30";
      case "best":
        return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border-cyan-500/30";
      case "pro":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30";
      default:
        return "bg-accent/10 text-accent-text border-accent/30";
    }
  };

  return (
    <section id="pricing" className="w-full py-12 sm:py-16 bg-transparent relative">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Section Header with CrownSlot on right */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="max-w-2xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-3">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              <span className="text-xs font-semibold text-accent-text uppercase tracking-wider">
                Curated Growth Bundles
              </span>
            </div>
            <h2 className="text-[clamp(26px,3.4vw,42px)] font-bold text-fg tracking-[-0.02em] leading-tight mb-2">
              Bestselling Packages & Combos
            </h2>
            <p className="text-sm sm:text-base text-fg-muted font-normal leading-relaxed">
              Multi-metric momentum bundles engineered for real algorithmic impact. All packages run with automated
              dispatch and non-drop refill protection.
            </p>
          </div>

          {/* EXACTLY ONE CrownSlot for Services Showcase Section - Undisturbed 3D integration */}
          <div className="hidden lg:flex items-center justify-end">
            <CrownSlot id="services" className="w-24 h-24 pointer-events-none" />
          </div>
        </div>

        {/* 1. Platform Selector Tabs - Fully theme aware */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none pb-2 mb-5">
          {PLATFORMS.map((plat) => {
            const isSelected = activePlatform === plat.id;
            return (
              <button
                key={plat.id}
                type="button"
                onClick={() => setActivePlatform(plat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap select-none border ${
                  isSelected
                    ? "bg-[#D8EC8D] text-[#171e00] border-[#D8EC8D] shadow-[0_0_18px_rgba(216,236,141,0.35)] scale-[1.02]"
                    : "bg-surface/80 dark:bg-white/[0.04] hover:bg-surface-raised dark:hover:bg-white/[0.08] text-fg-muted hover:text-fg border-border backdrop-blur-md"
                }`}
              >
                <span>{plat.icon}</span>
                <span>{plat.label}</span>
              </button>
            );
          })}
        </div>

        {/* 2. Service Category Filter Pills (All, Likes, Views, Comments, etc.) */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 mb-7 border-b border-border pt-1">
          {SERVICE_PILLS.map((pill) => {
            const isSelected = activeServiceKind === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setActiveServiceKind(pill.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap select-none ${
                  isSelected
                    ? "bg-fg text-bg shadow-sm font-bold"
                    : "text-fg-muted hover:text-fg hover:bg-surface-raised dark:hover:bg-white/[0.04]"
                }`}
              >
                {pill.icon}
                <span>{pill.label}</span>
              </button>
            );
          })}
        </div>

        {/* 3. Package Cards Grid - High Contrast in both Dark and Light mode */}
        {filteredPackages.length === 0 ? (
          <div className="p-10 text-center rounded-3xl bg-surface/80 dark:bg-white/[0.03] border border-border">
            <p className="text-sm text-fg-muted">
              No packages found under this filter. View all services in the full order panel.
            </p>
            <Link
              href={`/new-order?tab=single&platform=${activePlatform}`}
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-[#D8EC8D] text-[#171e00] font-bold text-xs shadow-xs"
            >
              Browse Single Services <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="group flex flex-col justify-between p-5 rounded-3xl bg-surface/90 dark:bg-white/[0.03] hover:bg-surface-raised/90 dark:hover:bg-white/[0.06] border border-border hover:border-[#D8EC8D]/50 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-xl hover:-translate-y-1 relative overflow-hidden"
              >
                {/* Top Badge */}
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${getBadgeStyle(
                      pkg.badgeType
                    )}`}
                  >
                    {pkg.badge}
                  </span>
                  <span className="text-[11px] text-fg-muted font-medium">{pkg.deliveryTime}</span>
                </div>

                {/* Title & Description */}
                <div className="mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-fg group-hover:text-[#D8EC8D] transition-colors leading-snug mb-1.5">
                    {pkg.name}
                  </h3>
                  <p className="text-xs text-fg-muted font-normal leading-relaxed line-clamp-2">
                    {pkg.description}
                  </p>
                </div>

                {/* Items Inclusions List */}
                <div className="space-y-1.5 py-2.5 px-3 rounded-2xl bg-surface-raised/70 dark:bg-white/[0.04] border border-border mb-4">
                  {pkg.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-fg-2 flex items-center gap-1.5">
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </span>
                      <span className="font-bold text-fg font-mono">{item.count}</span>
                    </div>
                  ))}
                </div>

                {/* Bottom Pricing & CTA */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-fg-muted font-medium">
                      From
                    </span>
                    <span className="text-xl font-extrabold text-fg font-mono">
                      ₹{formatIndianNumber(pkg.startingPrice)}
                    </span>
                  </div>

                  <Link
                    href={`/new-order?tab=combos&platform=${pkg.platform}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D8EC8D] hover:bg-[#cbe27a] text-[#171e00] font-bold text-xs transition-all shadow-[0_0_12px_rgba(216,236,141,0.25)] hover:scale-105 active:scale-95"
                  >
                    <span>Order Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Banner with Guarantee */}
        <div className="mt-8 p-4 rounded-2xl bg-surface/80 dark:bg-white/[0.03] border border-border flex flex-wrap items-center justify-between gap-3 text-xs text-fg-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>30-Day Auto Refill Protection enabled on all combo packages.</span>
          </div>
          <Link
            href="/new-order?tab=combos"
            className="text-accent-text hover:underline font-bold inline-flex items-center gap-1"
          >
            <span>View all 50+ Combo Bundles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
