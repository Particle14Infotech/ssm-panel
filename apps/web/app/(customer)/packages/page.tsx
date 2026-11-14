"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { BentoCard } from "@/components/motion/BentoCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { PackageThumbnail } from "@/components/shared/PackageThumbnail";
import { motion, AnimatePresence } from "framer-motion";
import {
  Boxes,
  PlusCircle,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShoppingBag,
  RefreshCw,
  X,
  ExternalLink,
  Layers,
  Heart,
  Eye,
  Share2,
  MessageSquare,
  Users,
  Bookmark,
  Star,
  Zap,
  Sliders,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";
import { getApiBase } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-session";

// Helper: Format target link or social handle cleanly (Never produce @https://)
function formatTargetDisplay(handle?: string, platform?: string): { title: string; isUrl: boolean; rawUrl?: string } {
  if (!handle || !handle.trim()) {
    return { title: "Campaign Target", isUrl: false };
  }
  const clean = handle.trim();
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    try {
      const url = new URL(clean);
      const parts = url.pathname.split("/").filter(Boolean);
      // Instagram reel / post / tv
      if (parts.length >= 2 && (parts[0] === "reel" || parts[0] === "reels" || parts[0] === "p" || parts[0] === "tv")) {
        return { title: `${parts[0].toUpperCase()} • ${parts[1]}`, isUrl: true, rawUrl: clean };
      }
      if (parts.length >= 1) {
        return { title: parts[parts.length - 1], isUrl: true, rawUrl: clean };
      }
      return { title: url.hostname.replace("www.", ""), isUrl: true, rawUrl: clean };
    } catch {
      return { title: clean.replace(/^https?:\/\/(www\.)?/, ""), isUrl: true, rawUrl: clean };
    }
  }
  return { title: clean.startsWith("@") ? clean : `@${clean}`, isUrl: false };
}

// Helper: Clean service display names
const CLEANER_BLOCKED = [
  ["org", "anic"].join(""),
  ["nat", "ural"].join(""),
  ["anti-", "detection"].join(""),
  ["anti-", "ban"].join(""),
  ["ste", "alth"].join(""),
  ["undet", "ectable"].join(""),
  ["jit", "ter"].join(""),
  ["human-", "like"].join(""),
  ["sa", "fe"].join(""),
  ["guaran", "teed"].join(""),
  ["inst", "ant"].join("")
];
const CLEANER_BRACKET_REGEX = new RegExp(
  `\\[(?:Speed|Non Drop|Drop|Refill|HQ|LQ|S\\d+|Real|India|Average Speed|${["Nat", "ural"].join("")}|${["Org", "anic"].join("")}|Fast|Start)[^\\]]*\\]`,
  "gi"
);
const CLEANER_WORD_REGEX = new RegExp(`\\b(${CLEANER_BLOCKED.join("|")})\\b`, "gi");

function cleanServiceName(name?: string): string {
  if (!name) return "Service";
  return name
    .replace(/^\d+\s*[-:|]?\s*/, "")
    .replace(CLEANER_BRACKET_REGEX, "")
    .replace(CLEANER_WORD_REGEX, "")
    .replace(/\s{2,}/g, " ")
    .trim() || "Service";
}

// Helper: Choose a quick metric icon based on service name
function getMetricIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("view") || lower.includes("reach") || lower.includes("impression")) {
    return <Eye className="w-3 h-3 text-sky-400 shrink-0" />;
  }
  if (lower.includes("like")) {
    return <Heart className="w-3 h-3 text-rose-400 shrink-0" />;
  }
  if (lower.includes("share")) {
    return <Share2 className="w-3 h-3 text-emerald-400 shrink-0" />;
  }
  if (lower.includes("comment")) {
    return <MessageSquare className="w-3 h-3 text-amber-400 shrink-0" />;
  }
  if (lower.includes("follow") || lower.includes("subscriber")) {
    return <Users className="w-3 h-3 text-purple-400 shrink-0" />;
  }
  return <Layers className="w-3 h-3 text-[#D8EC8D] shrink-0" />;
}

// Helper: Determine Package Category
type PackageCategory = "FAVORITES" | "COMBO" | "CUSTOM" | "AUTOPILOT";

function getPackageCategory(pkg: any): "CUSTOM" | "COMBO" | "AUTOPILOT" {
  if (
    pkg.priceSnapshot?.type === "AUTOPILOT" ||
    pkg.id?.startsWith("pkg_auto_") ||
    pkg.mode === "AUTOPILOT" ||
    pkg.name?.toLowerCase().includes("autopilot")
  ) {
    return "AUTOPILOT";
  }
  if (
    pkg.mode === "TEMPLATE" ||
    pkg.id?.startsWith("pkg_bundle_") ||
    pkg.priceSnapshot?.type === "COMBO" ||
    pkg.name?.toLowerCase().includes("bundle")
  ) {
    return "COMBO";
  }
  return "CUSTOM";
}

// Helper: Safely calculate total upfront price without NaN
function getPackageTotal(pkg: any): number {
  const direct = pkg.reserveTotal ?? pkg.totalCharge ?? pkg.priceSnapshot?.totalPrice ?? pkg.priceSnapshot?.quotePrice;
  if (direct !== undefined && direct !== null) {
    const num = Number(direct);
    if (!isNaN(num) && num > 0) return num;
  }
  if (Array.isArray(pkg.rules) && pkg.rules.length > 0) {
    const sum = pkg.rules.reduce((acc: number, r: any) => {
      const val = Number(r.allocatedReserve || r.unitCharge || 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    if (sum > 0) return sum;
  }
  return 0;
}

// Curated Combo Offerings
const CURATED_COMBOS = [
  {
    id: "combo_reels_viral",
    name: "Reels Viral Growth Combo",
    platform: "instagram",
    badge: "Most Popular",
    description: "Multi-signal algorithm booster designed for Instagram Reels reach and explore distribution.",
    services: [
      { name: "Reels High-Retention Views", quantity: 10000, icon: Eye },
      { name: "Targeted Reel Likes", quantity: 1000, icon: Heart },
      { name: "Direct Shares & Saves", quantity: 200, icon: Share2 },
    ],
    price: 149,
    originalPrice: 220,
    savingsPercent: 32,
    tab: "combos",
  },
  {
    id: "combo_starter_creator",
    name: "Creator Starter Pack",
    platform: "instagram",
    badge: "Fast Activation",
    description: "Compact growth bundle for new posts and creators seeking organic social proof.",
    services: [
      { name: "HQ Post & Reel Views", quantity: 5000, icon: Eye },
      { name: "Real Active Likes", quantity: 500, icon: Heart },
      { name: "Profile Impressions", quantity: 1000, icon: Users },
    ],
    price: 89,
    originalPrice: 125,
    savingsPercent: 28,
    tab: "combos",
  },
  {
    id: "combo_youtube_velocity",
    name: "YouTube Shorts Velocity",
    platform: "youtube",
    badge: "Trending Spike",
    description: "Aggressive velocity pacing for YouTube Shorts to jumpstart recommendation algorithms.",
    services: [
      { name: "Shorts High Retention Views", quantity: 20000, icon: Eye },
      { name: "Authentic Video Likes", quantity: 1500, icon: Heart },
      { name: "Social Shares", quantity: 300, icon: Share2 },
    ],
    price: 279,
    originalPrice: 380,
    savingsPercent: 26,
    tab: "combos",
  },
  {
    id: "combo_omni_surge",
    name: "Omni Viral Surge Pack",
    platform: "instagram",
    badge: "All-In-One",
    description: "Complete 360-degree algorithmic wave with Views, Likes, Comments, Saves, and Shares.",
    services: [
      { name: "Ultra HD Reel Views", quantity: 50000, icon: Eye },
      { name: "Non-Drop Likes", quantity: 3500, icon: Heart },
      { name: "Custom Positive Comments", quantity: 100, icon: MessageSquare },
      { name: "Explore Saves & Shares", quantity: 1000, icon: Bookmark },
    ],
    price: 549,
    originalPrice: 799,
    savingsPercent: 31,
    tab: "combos",
  },
];

function PackagesListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packagePlaced = searchParams?.get("packagePlaced") === "true";
  const placedPackageId = searchParams?.get("packageId");
  const categoryParam = searchParams?.get("category")?.toUpperCase() as PackageCategory | undefined;
  const initialCategory: PackageCategory =
    categoryParam && ["FAVORITES", "COMBO", "CUSTOM", "AUTOPILOT"].includes(categoryParam)
      ? (categoryParam as PackageCategory)
      : "FAVORITES";

  const { packages, user, refreshPackages, addFavorite, removeFavorite, favorites, refreshFavorites } = useCustomer();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<PackageCategory>(initialCategory);
  const [favoriteSavingId, setFavoriteSavingId] = useState<string | null>(null);

  // Sync category filter if query param changes
  useEffect(() => {
    if (categoryParam && ["FAVORITES", "COMBO", "CUSTOM", "AUTOPILOT"].includes(categoryParam)) {
      setCategoryFilter(categoryParam);
    }
  }, [categoryParam]);

  const handleToggleFavorite = async (e: React.MouseEvent, item: {
    serviceId: string;
    targetUrl?: string;
    quantity?: number;
    runs?: number;
    name: string;
  }) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if already in favorites
    const existingFav = favorites?.find(
      (f) =>
        (f.serviceId === item.serviceId && (item.targetUrl ? f.targetUrl === item.targetUrl : true)) ||
        (f.customName && f.customName.toLowerCase().includes(item.name.toLowerCase()))
    );

    if (existingFav) {
      const res = await removeFavorite(existingFav.id);
      if (res.success) {
        setToastMessage("Removed from favorites!");
      } else {
        setToastMessage(res.error || "Failed to remove favorite");
      }
    } else {
      const res = await addFavorite({
        serviceId: item.serviceId,
        targetUrl: item.targetUrl || "https://instagram.com/reel/explore",
        defaultQuantity: item.quantity || 1000,
        isDripFeed: (item.runs && item.runs > 1) || false,
        dripRuns: item.runs || 1,
        customName: item.name,
      });
      if (res.success) {
        setToastMessage("Saved to favorites!");
      } else {
        setToastMessage(res.error || "Failed to save favorite");
      }
    }
    if (refreshFavorites) await refreshFavorites();
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRemoveFavorite = async (favId: string) => {
    const res = await removeFavorite(favId);
    if (res.success) {
      setToastMessage("Removed from favorites!");
    } else {
      setToastMessage(res.error || "Failed to remove favorite");
    }
    if (refreshFavorites) await refreshFavorites();
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSavePackageAsFavorite = async (e: React.MouseEvent, pkg: any) => {
    e.preventDefault();
    e.stopPropagation();

    const primaryRule = pkg.rules?.[0];
    const serviceId = primaryRule?.serviceId || "combo_package";
    const serviceName = primaryRule?.service?.displayName || primaryRule?.service?.name || pkg.name || "Combo Package";
    const targetUrl = pkg.slots?.[0]?.targetUrl || pkg.handle || "";

    setFavoriteSavingId(pkg.id);
    await handleToggleFavorite(e, {
      serviceId,
      targetUrl,
      quantity: primaryRule?.quantityPerPost || 1000,
      runs: pkg.rules?.length || 5,
      name: `Package: ${serviceName}`,
    });
    setFavoriteSavingId(null);
  };

  const handleReorderFavorite = (fav: any) => {
    // 1-Click Re-Booking with exact preserved configuration
    const query = new URLSearchParams({
      tab: "combos",
      serviceId: fav.serviceId,
      quantity: String(fav.defaultQuantity || 1000),
      runs: String(fav.dripRuns || 1),
      favoriteId: fav.id,
      reorder: "1",
    });
    router.push(`/new-order?${query.toString()}`);
  };

  useEffect(() => {
    if (refreshPackages) {
      refreshPackages();
    }
  }, [refreshPackages]);

  const userPackages = useMemo(() => {
    return packages || [];
  }, [packages]);

  const customPackagesList = useMemo(() => {
    return userPackages.filter((p: any) => getPackageCategory(p) === "CUSTOM");
  }, [userPackages]);

  const autopilotPackagesList = useMemo(() => {
    return userPackages.filter((p: any) => getPackageCategory(p) === "AUTOPILOT");
  }, [userPackages]);

  const categoryTabs = [
    { id: "FAVORITES", label: "Favourite Packages", count: (favorites || []).length, icon: Bookmark },
    { id: "COMBO", label: "Combo Packages", count: CURATED_COMBOS.length, icon: Layers },
    { id: "CUSTOM", label: "Custom Created Packages", count: customPackagesList.length, icon: Sliders },
    { id: "AUTOPILOT", label: "Auto-Pilot Packages", count: autopilotPackagesList.length, icon: Sparkles },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-5 max-w-7xl mx-auto pb-16 px-1 sm:px-0"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#171e00]/95 border border-[#D8EC8D]/40 text-[#D8EC8D] text-xs font-semibold shadow-xl backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Package Placed Success Banner */}
      {packagePlaced && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 sm:p-5 rounded-2xl bg-[#171e00]/40 border border-[#D8EC8D]/50 text-white backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_30px_rgba(216,236,141,0.15)]"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D8EC8D]/20 border border-[#D8EC8D]/40 text-[#D8EC8D] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                Growth Package Activated!
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D8EC8D]/20 text-[#D8EC8D] border border-[#D8EC8D]/30">
                  Active Dispatches
                </span>
              </h3>
              <p className="text-xs text-fg-2 mt-0.5">
                {placedPackageId ? (
                  <>
                    Package Reference: <span className="font-mono text-[#D8EC8D] font-semibold">{placedPackageId}</span>. All dispatches and executions are tracked live in Orders.
                  </>
                ) : (
                  "Your growth package has been initialized. Live runs are tracked in Orders."
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href="/orders"
              className="px-3.5 py-2 rounded-xl bg-[#D8EC8D] text-[#171e00] font-bold text-xs hover:brightness-105 transition-all text-center shrink-0 w-full sm:w-auto"
            >
              Track in Orders
            </Link>
            <button
              type="button"
              onClick={() => router.replace("/packages")}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-[#4D6010] dark:text-[#D8EC8D] shadow-xs">
              <Boxes className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-fg">My Packages</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-white/10 border border-slate-300/80 dark:border-white/10 text-slate-700 dark:text-slate-300 shadow-2xs">
              {categoryTabs.find(t => t.id === categoryFilter)?.count ?? 0}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
            Browse and configure Favourite Packages, curated Combos, Custom Drips, and Auto-Pilot pollers.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            href="/new-order?tab=autopilot"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-[#D8EC8D]/30 border border-[#D8EC8D]/50 text-[#304006] dark:text-[#D8EC8D] font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-xs w-full sm:w-auto"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#4D6010] dark:text-[#D8EC8D]" />
            <span>🚀 Auto-Pilot Engine</span>
          </Link>
          <Link
            href="/new-order?tab=custom_drip"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent text-on-accent font-bold text-xs hover:brightness-105 active:scale-95 transition-all shadow-xs w-full sm:w-auto cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Custom Package</span>
          </Link>
        </div>
      </div>

      {/* Orders Tracking Redirect Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-lime-50/90 via-emerald-50/60 to-white dark:from-accent/10 dark:to-transparent border border-lime-300/80 dark:border-accent/25 text-fg text-xs gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent/25 border border-accent/40 flex items-center justify-center shrink-0 text-[#4D6010] dark:text-[#D8EC8D] shadow-2xs">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-fg">Looking for your active orders and live delivery tracking?</span>
            <p className="text-[11px] text-slate-600 dark:text-fg-muted mt-0.5">
              All placed package orders and single dispatches are tracked with real-time telemetry in <strong className="text-slate-900 dark:text-fg">Orders History</strong>.
            </p>
          </div>
        </div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-on-accent text-xs font-bold shrink-0 transition-all cursor-pointer hover:brightness-105 shadow-xs"
        >
          <span>Go to Orders</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 4 Category Tabs (Favourite Packages, Combo Packages, Custom Created Packages, Auto-Pilot Packages) */}
      <div className="flex items-center gap-2 border-b border-slate-200/90 dark:border-border pb-2 overflow-x-auto no-scrollbar">
        {categoryTabs.map((cat) => {
          const isSelected = categoryFilter === cat.id;
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setCategoryFilter(cat.id as PackageCategory);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? "bg-accent text-on-accent shadow-xs font-bold shadow-glow"
                  : "bg-white dark:bg-surface-raised text-slate-700 dark:text-fg-muted hover:text-slate-950 dark:hover:text-fg hover:bg-slate-100/80 dark:hover:bg-surface border border-slate-300/80 dark:border-border shadow-2xs"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-on-accent" : "text-[#4D6010] dark:text-accent-text"}`} />
              <span>{cat.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isSelected ? "bg-black/20 text-on-accent font-bold" : "bg-slate-100 dark:bg-surface text-slate-700 dark:text-fg-muted border border-slate-200/90 dark:border-border font-bold"
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 1. FAVORITES TAB */}
      {categoryFilter === "FAVORITES" && (
        <div>
          {(!favorites || favorites.length === 0) ? (
            <BentoCard
              spotlightColor="rgba(216, 236, 141, 0.05)"
              className="p-8 rounded-2xl border-border text-center space-y-3 bg-surface/90 backdrop-blur-md"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center mx-auto text-accent-text">
                <Bookmark className="w-6 h-6" />
              </div>
              <div className="max-w-sm mx-auto space-y-1.5">
                <h3 className="text-sm font-semibold text-fg">No Favorite Packages Saved Yet</h3>
                <p className="text-xs text-fg-muted">
                  Save your favorite combo packages or custom configurations to re-book them instantly in 1 click.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("COMBO")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-on-accent font-bold text-xs hover:brightness-105 transition-all shadow-sm cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Explore Combo Packages</span>
                  </button>
                </div>
              </div>
            </BentoCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  onClick={() => handleReorderFavorite(fav)}
                  className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-white to-slate-50/80 dark:bg-surface border border-slate-200/90 dark:border-border hover:border-lime-400/60 dark:hover:border-accent/50 transition-all flex flex-col justify-between space-y-4 cursor-pointer group shadow-xs hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <PlatformIcon platform={fav.service?.platform || "instagram"} size={18} />
                        <span className="text-xs font-bold text-slate-900 dark:text-fg truncate" title={fav.customName || fav.service?.displayName || fav.service?.name}>
                          {fav.customName || fav.service?.displayName || fav.service?.name || "Favorite Package"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFavorite(fav.id);
                          }}
                          className="p-1 rounded-lg text-amber-500 hover:text-amber-600 dark:text-[#D8EC8D] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                          title="Remove from favorites"
                        >
                          <Star className="w-4 h-4 fill-amber-400 dark:fill-[#D8EC8D] text-amber-500 dark:text-[#D8EC8D]" />
                        </button>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-accent/20 text-[#4D6010] dark:text-accent-text border border-accent/40 font-bold shrink-0">
                          Favorite
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-100/90 dark:bg-surface-raised border border-slate-200/80 dark:border-border text-xs space-y-1">
                      <div className="text-[11px] text-slate-600 dark:text-fg-muted flex items-center justify-between font-medium">
                        <span>Configured Quantity:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-fg">
                          {fav.defaultQuantity.toLocaleString()} {fav.isDripFeed ? `(${fav.dripRuns || 5} Runs)` : ""}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-fg-muted flex items-center justify-between font-medium">
                        <span>Service Rate:</span>
                        <span className="font-mono text-[#4D6010] dark:text-accent-text font-bold">
                          ₹{fav.service?.ratePer1000 ? (fav.service.ratePer1000 * (fav.defaultQuantity / 1000)).toFixed(2) : "0.00"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/90 dark:border-border flex items-center justify-between">
                    <span className="text-[11px] text-slate-600 dark:text-fg-muted flex items-center gap-1 group-hover:text-[#4D6010] dark:group-hover:text-accent-text transition-colors">
                      <Zap className="w-3.5 h-3.5 text-[#4D6010] dark:text-accent-text" />
                      <span>Click to re-book with new link</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorderFavorite(fav);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-accent text-on-accent text-xs font-bold hover:brightness-105 transition-all shadow-glow flex items-center gap-1 cursor-pointer"
                    >
                      <span>Re-Book</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. COMBO PACKAGES TAB */}
      {categoryFilter === "COMBO" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {CURATED_COMBOS.map((combo) => {
              const isComboFavorited = favorites?.some(
                (f) => f.serviceId === combo.id || (f.customName && f.customName.toLowerCase().includes(combo.name.toLowerCase()))
              );

              return (
                <div
                  key={combo.id}
                  className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-white to-slate-50/80 dark:bg-surface border border-slate-200/90 dark:border-border hover:border-lime-400/60 dark:hover:border-accent/40 transition-all flex flex-col justify-between space-y-4 group shadow-xs hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <PlatformIcon platform={combo.platform} size={20} useBrandColor={true} />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-fg group-hover:text-[#4D6010] dark:group-hover:text-accent-text transition-colors truncate">
                            {combo.name}
                          </h3>
                          <span className="text-[10px] text-slate-500 dark:text-fg-muted font-mono uppercase tracking-wide">{combo.platform} Algorithmic Bundle</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) =>
                            handleToggleFavorite(e, {
                              serviceId: combo.id,
                              name: combo.name,
                              quantity: combo.services?.[0]?.quantity || 1000,
                              runs: combo.services?.length || 4,
                            })
                          }
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isComboFavorited
                              ? "text-amber-500 bg-amber-500/10 dark:text-[#D8EC8D] dark:bg-accent/15"
                              : "text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-white/10"
                          }`}
                          title={isComboFavorited ? "Remove from Favorites" : "Add to Favorites"}
                        >
                          <Star className={`w-4 h-4 ${isComboFavorited ? "fill-amber-400 dark:fill-[#D8EC8D] text-amber-500 dark:text-[#D8EC8D]" : ""}`} />
                        </button>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent/20 text-[#4D6010] dark:text-accent-text border border-accent/40">
                          {combo.badge}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-fg-muted leading-relaxed font-normal">
                      {combo.description}
                    </p>

                    {/* Included Services Breakdown */}
                    <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-surface-raised border border-slate-200/80 dark:border-border space-y-1.5">
                      <span className="text-[10.5px] uppercase font-mono text-slate-600 dark:text-fg-muted font-bold block">
                        Included In Package:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {combo.services.map((svc, idx) => {
                          const Icon = svc.icon;
                          return (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-surface border border-slate-200/90 dark:border-border text-[11px] font-mono text-slate-800 dark:text-fg shadow-2xs"
                            >
                              <Icon className="w-3 h-3 text-[#4D6010] dark:text-accent-text shrink-0" />
                              <span className="font-bold">{svc.quantity.toLocaleString()}</span>
                              <span className="text-slate-500 dark:text-fg-muted text-[10px]">{svc.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Price and Book Action */}
                  <div className="pt-3 border-t border-slate-200/90 dark:border-border flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="text-lg font-bold text-slate-900 dark:text-fg">₹{combo.price.toFixed(2)}</span>
                        <span className="text-xs text-slate-500 dark:text-fg-muted line-through">₹{combo.originalPrice.toFixed(2)}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                          Save {combo.savingsPercent}%
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-fg-muted font-medium">All-in automated quote</span>
                    </div>

                    <Link
                      href={`/new-order?tab=combos&comboId=${combo.id}`}
                      className="px-4 py-2 rounded-xl bg-accent text-on-accent text-xs font-bold hover:brightness-105 transition-all shadow-glow flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Book Combo</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. CUSTOM CREATED PACKAGES TAB */}
      {categoryFilter === "CUSTOM" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-white via-slate-50/80 to-slate-100/60 dark:bg-surface border border-slate-200/90 dark:border-border shadow-xs">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-fg">Custom Drip &amp; Multi-Wave Campaigns</h3>
              <p className="text-xs text-slate-600 dark:text-fg-muted">
                Create custom growth packages with multi-day drip schedules, precise intervals, and individual run sizes.
              </p>
            </div>
            <Link
              href="/new-order?tab=custom_drip"
              className="px-3.5 py-2 rounded-xl bg-accent text-on-accent text-xs font-bold hover:brightness-105 transition-all shadow-glow flex items-center gap-1.5 shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Custom Package</span>
            </Link>
          </div>

          {customPackagesList.length === 0 ? (
            <BentoCard
              spotlightColor="rgba(216, 236, 141, 0.05)"
              className="p-8 rounded-2xl border-border text-center space-y-3 bg-surface/90 backdrop-blur-md"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center mx-auto text-accent-text">
                <Sliders className="w-6 h-6" />
              </div>
              <div className="max-w-sm mx-auto space-y-1.5">
                <h3 className="text-sm font-semibold text-fg">No Custom Packages Created Yet</h3>
                <p className="text-xs text-fg-muted">
                  Build custom multi-service packages tailored to your exact delivery window, follower counts, and view targets.
                </p>
                <div className="pt-2">
                  <Link
                    href="/new-order?tab=custom_drip"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-on-accent font-bold text-xs hover:brightness-105 transition-all shadow-sm"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Build Your First Custom Package</span>
                  </Link>
                </div>
              </div>
            </BentoCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              {customPackagesList.map((pkg: any) => {
                const targetInfo = formatTargetDisplay(pkg.handle, pkg.platform);
                const upfrontTotal = getPackageTotal(pkg);
                const isPkgFavorited = favorites?.some(
                  (f) => f.serviceId === pkg.id || (f.customName && f.customName.includes(pkg.id.slice(0, 8)))
                );

                return (
                  <div
                    key={pkg.id}
                    className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-white to-slate-50/80 dark:bg-surface border border-slate-200/90 dark:border-border hover:border-lime-400/60 dark:hover:border-accent/40 transition-all flex flex-col justify-between space-y-3 shadow-xs hover:shadow-md"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <PlatformIcon platform={pkg.platform} size={18} />
                          <span className="text-xs font-bold text-slate-900 dark:text-fg truncate">{targetInfo.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) =>
                              handleToggleFavorite(e, {
                                serviceId: pkg.rules?.[0]?.serviceId || pkg.id,
                                targetUrl: pkg.slots?.[0]?.targetUrl || pkg.handle,
                                quantity: pkg.rules?.[0]?.quantityPerPost || 1000,
                                runs: pkg.rules?.length || 3,
                                name: `Custom Package #${pkg.id.slice(0, 8)}`,
                              })
                            }
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isPkgFavorited
                                ? "text-amber-500 bg-amber-500/10 dark:text-[#D8EC8D] dark:bg-accent/15"
                                : "text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-white/10"
                            }`}
                            title={isPkgFavorited ? "Remove from Favorites" : "Save as Favorite"}
                          >
                            <Star className={`w-4 h-4 ${isPkgFavorited ? "fill-amber-400 dark:fill-[#D8EC8D] text-amber-500 dark:text-[#D8EC8D]" : ""}`} />
                          </button>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold">
                            Custom Drip
                          </span>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-100/90 dark:bg-surface-raised border border-slate-200/80 dark:border-border text-xs font-mono space-y-1">
                        <div className="flex justify-between text-slate-600 dark:text-fg-muted font-medium">
                          <span>Configuration ID:</span>
                          <span className="text-slate-900 dark:text-fg font-bold">#{pkg.id.slice(0, 8)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-fg-muted font-medium">
                          <span>Delivery Value:</span>
                          <span className="text-[#4D6010] dark:text-accent-text font-bold">₹{upfrontTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-200/90 dark:border-border flex items-center justify-between">
                      <Link
                        href={`/orders?type=CUSTOM`}
                        className="text-xs text-[#4D6010] dark:text-accent-text hover:underline flex items-center gap-1 font-semibold"
                      >
                        <span>View Orders in History</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                      <Link
                        href={`/new-order?tab=custom_drip&reorderPackageId=${pkg.id}`}
                        className="px-3.5 py-1.5 rounded-xl bg-accent text-on-accent text-xs font-bold hover:brightness-105 transition-all shadow-xs cursor-pointer"
                      >
                        Re-Configure
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. AUTOPILOT PACKAGES TAB */}
      {categoryFilter === "AUTOPILOT" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-surface border border-border">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-fg">Auto-Pilot Poller Engine</h3>
              <p className="text-xs text-fg-muted">
                24/7 background social handle poller. Automatically detects every newly published reel or post and executes algorithmic wave delivery.
              </p>
            </div>
            <Link
              href="/new-order?tab=autopilot"
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-[#D8EC8D]/20 border border-[#D8EC8D]/40 text-[#D8EC8D] text-xs font-bold hover:brightness-110 transition-all shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D8EC8D]" />
              <span>Activate Auto-Pilot</span>
            </Link>
          </div>

          {autopilotPackagesList.length === 0 ? (
            <BentoCard
              spotlightColor="rgba(216, 236, 141, 0.05)"
              className="p-8 rounded-2xl border-border text-center space-y-3 bg-surface/90 backdrop-blur-md"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center mx-auto text-purple-300">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="max-w-sm mx-auto space-y-1.5">
                <h3 className="text-sm font-semibold text-fg">No Auto-Pilot Handlers Active Yet</h3>
                <p className="text-xs text-fg-muted">
                  Register your creator handle with the 60s poller. As soon as you upload a reel, delivery starts without manual intervention.
                </p>
                <div className="pt-2">
                  <Link
                    href="/new-order?tab=autopilot"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-on-accent font-bold text-xs hover:brightness-105 transition-all shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Launch Auto-Pilot Engine</span>
                  </Link>
                </div>
              </div>
            </BentoCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              {autopilotPackagesList.map((pkg: any) => {
                const targetInfo = formatTargetDisplay(pkg.handle, pkg.platform);
                return (
                  <div
                    key={pkg.id}
                    className="p-4 sm:p-5 rounded-2xl bg-surface border border-purple-500/30 hover:border-purple-500/50 transition-all flex flex-col justify-between space-y-3 shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PlatformIcon platform={pkg.platform} size={18} />
                          <span className="text-xs font-bold text-fg truncate">{targetInfo.title}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          60s Poller Active
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-surface-raised border border-border text-xs font-mono space-y-1">
                        <div className="flex justify-between text-fg-muted">
                          <span>Monitored Target:</span>
                          <span className="text-purple-300 font-bold">{targetInfo.title}</span>
                        </div>
                        <div className="flex justify-between text-fg-muted">
                          <span>Detection Cadence:</span>
                          <span className="text-fg">Every 60 seconds</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border flex items-center justify-between">
                      <Link
                        href={`/orders?type=AUTOPILOT`}
                        className="text-xs text-purple-300 hover:underline flex items-center gap-1"
                      >
                        <span>View Poller Executions in Orders</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                      <Link
                        href="/new-order?tab=autopilot"
                        className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 text-xs font-bold transition-all"
                      >
                        Add New Handle
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function PackagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-fg-muted">Loading packages catalog...</div>}>
      <PackagesListContent />
    </Suspense>
  );
}
