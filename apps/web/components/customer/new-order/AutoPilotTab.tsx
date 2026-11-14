"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { LinkAutoSuggest } from "./LinkAutoSuggest";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Bot,
  Radio,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  Heart,
  Share2,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck,
  Play,
  Check,
  ExternalLink,
  Flame,
  Crown,
  ClipboardPaste,
  X,
  HelpCircle,
  RotateCcw,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";
import { getApiBase } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-session";

function getSafeImageUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80";
  }
  const url = rawUrl.trim();
  if (url.startsWith("/api/v1/packages/autopilot/proxy-image")) {
    return url.replace("/api/v1/packages/autopilot/proxy-image", "/api/v1/link-preview/proxy-image");
  }
  if (url.startsWith("/api/v1/link-preview/proxy-image")) {
    return url;
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return `/api/v1/link-preview/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

type SupportedAutopilotPlatform = "INSTAGRAM" | "YOUTUBE" | "TIKTOK" | "TELEGRAM" | "TWITTER";

interface DetectedMedia {
  platform: SupportedAutopilotPlatform;
  mediaKey: string;
  url: string;
  title: string;
  author: string;
  publishedAt: string;
  thumbnailUrl: string;
  mediaType: string;
  isLiveDetected: boolean;
}

interface DetectedProfile {
  platform: SupportedAutopilotPlatform;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  followerCount?: string;
}

interface PlatformOption {
  id: SupportedAutopilotPlatform;
  key: string;
  label: string;
  description: string;
  contentLabel: string;
  placeholder: string;
}

const PLATFORMS: PlatformOption[] = [
  {
    id: "INSTAGRAM",
    key: "instagram",
    label: "Instagram",
    description: "Auto-detects new Reels, Posts & IGTV",
    contentLabel: "Instagram Reels & Posts",
    placeholder: "Enter @handle or Reel URL (e.g. @your_brand)",
  },
  {
    id: "YOUTUBE",
    key: "youtube",
    label: "YouTube",
    description: "Auto-detects new Videos & Shorts",
    contentLabel: "YouTube Channel & Shorts",
    placeholder: "Enter @channel, URL or Video (e.g. @your_channel)",
  },
  {
    id: "TIKTOK",
    key: "tiktok",
    label: "TikTok",
    description: "Auto-detects new TikTok Videos",
    contentLabel: "TikTok Profile & Videos",
    placeholder: "Enter @handle or TikTok URL (e.g. @your_page)",
  },
  {
    id: "TELEGRAM",
    key: "telegram",
    label: "Telegram",
    description: "Auto-detects new Public Channel Posts",
    contentLabel: "Telegram Public Channel",
    placeholder: "Enter public @channel or t.me link (e.g. @your_channel)",
  },
  {
    id: "TWITTER",
    key: "x_twitter",
    label: "X",
    description: "Auto-detects new Posts & Media",
    contentLabel: "X / Twitter Profile & Posts",
    placeholder: "Enter @handle or post link (e.g. @your_account)",
  },
];

interface GrowthPreset {
  id: string;
  name: string;
  badge: string;
  isRecommended?: boolean;
  pricePerSlot: number;
  description: string;
  runsCount: number;
  durationHours: number;
  pacingSummary: string;
  metrics: {
    views: number;
    likes: number;
    shares: number;
    comments: number;
  };
  icon: any;
  themeClasses: {
    activeBorder: string;
    badge: string;
    iconBg: string;
  };
}

const PRESETS: GrowthPreset[] = [
  {
    id: "starter_boost",
    name: "Starter Boost",
    badge: "Daily Velocity",
    pricePerSlot: 99,
    description: "Designed for daily consistency and early engagement signals.",
    runsCount: 4,
    durationHours: 12,
    pacingSummary: "4 waves over 12 hours",
    metrics: { views: 2500, likes: 150, shares: 40, comments: 20 },
    icon: Flame,
    themeClasses: {
      activeBorder: "border-sky-500 dark:border-sky-400 ring-2 ring-sky-500/40 bg-sky-500/10",
      badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
      iconBg: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
  },
  {
    id: "viral_push",
    name: "Viral Push",
    badge: "Most Popular",
    isRecommended: true,
    pricePerSlot: 299,
    description: "Engineered for algorithmic discovery across Explore, Shorts & Reels.",
    runsCount: 4,
    durationHours: 12,
    pacingSummary: "4 waves over 12 hours",
    metrics: { views: 10000, likes: 600, shares: 150, comments: 50 },
    icon: Sparkles,
    themeClasses: {
      activeBorder: "border-[#D8EC8D] ring-2 ring-[#D8EC8D]/50 bg-[#D8EC8D]/15 shadow-lg",
      badge: "bg-[#D8EC8D]/25 text-emerald-800 dark:text-[#D8EC8D] border-[#D8EC8D]/40 font-bold",
      iconBg: "bg-[#D8EC8D]/25 text-emerald-700 dark:text-[#D8EC8D]",
    },
  },
  {
    id: "mega_brand",
    name: "Mega Brand",
    badge: "Maximum Impact",
    pricePerSlot: 899,
    description: "High-octane delivery for major releases, sponsorships, and campaigns.",
    runsCount: 6,
    durationHours: 24,
    pacingSummary: "6 waves over 24 hours",
    metrics: { views: 50000, likes: 3000, shares: 600, comments: 150 },
    icon: Crown,
    themeClasses: {
      activeBorder: "border-purple-500 dark:border-purple-400 ring-2 ring-purple-500/40 bg-purple-500/10",
      badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
      iconBg: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    },
  },
];

interface AutoPilotTabProps {
  platform?: string;
  services?: any[];
  walletBalance?: number;
  onOrderSuccess?: (result: any) => void;
  prefilledTargetUrl?: string;
}

export function AutoPilotTab({
  platform = "instagram",
  walletBalance = 0,
  onOrderSuccess,
  prefilledTargetUrl = "",
}: AutoPilotTabProps) {
  const { user, refreshData } = useCustomer();

  // Normalize initial platform
  const initialPlatform: SupportedAutopilotPlatform = useMemo(() => {
    const p = (platform || "instagram").toUpperCase();
    if (p.includes("YOUTUBE") || p === "YT") return "YOUTUBE";
    if (p.includes("TIKTOK") || p === "TT") return "TIKTOK";
    if (p.includes("TELEGRAM") || p === "TG") return "TELEGRAM";
    if (p.includes("TWITTER") || p === "X") return "TWITTER";
    return "INSTAGRAM";
  }, [platform]);

  // Booking Form State
  const [handleInput, setHandleInput] = useState<string>(prefilledTargetUrl || "");
  const [selectedPlatform, setSelectedPlatform] = useState<SupportedAutopilotPlatform>(initialPlatform);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("viral_push");
  const [slotCount, setSlotCount] = useState<number>(5);
  const [seedCurrentPost, setSeedCurrentPost] = useState<boolean>(true);

  // Live Auto-Detection State
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [detectedProfile, setDetectedProfile] = useState<DetectedProfile | null>(null);
  const [detectedMedia, setDetectedMedia] = useState<DetectedMedia | null>(null);

  // Purchase State & Modal
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activePlatform = useMemo(() => {
    return PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0];
  }, [selectedPlatform]);

  const selectedPreset = useMemo(() => {
    return PRESETS.find((p) => p.id === selectedPresetId) || PRESETS[1];
  }, [selectedPresetId]);

  const totalCost = useMemo(() => {
    return (selectedPreset.pricePerSlot || 0) * slotCount;
  }, [selectedPreset, slotCount]);

  const currentWalletBalance = Number(user?.balance ?? walletBalance ?? 0);
  const hasSufficientBalance = currentWalletBalance >= totalCost;
  const balanceShortfall = Math.max(0, totalCost - currentWalletBalance);

  // Auto-detect handle on change with debouncing
  useEffect(() => {
    const trimmed = handleInput.trim();
    if (!trimmed || trimmed.length < 2) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setDetectedProfile(null);
      setDetectedMedia(null);
      setDetectionError(null);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      triggerDetect(trimmed, selectedPlatform);
    }, 600);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [handleInput, selectedPlatform]);

  const triggerDetect = async (inputStr: string, platformHint?: string) => {
    const trimmed = inputStr.trim();
    if (!trimmed) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setDetectedProfile(null);
      setDetectedMedia(null);
      setDetectionError(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsDetecting(true);
    setDetectionError(null);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      let res: Response | null = null;
      try {
        res = await fetch(`${apiBase}/packages/autopilot/preview`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            handle: trimmed,
            platform: platformHint || selectedPlatform,
          }),
          signal: controller.signal,
        });
      } catch (networkErr: any) {
        if (networkErr.name === "AbortError") return;
        throw new Error("Unable to reach preview service. Check your connection.");
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `Detection failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data && data.profile) {
        setDetectedProfile(data.profile);
        setDetectedMedia(data.latestMedia || null);
        if (data.profile.platform && data.profile.platform !== selectedPlatform) {
          setSelectedPlatform(data.profile.platform);
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setDetectionError(err.message || "Failed to auto-detect creator account.");
    } finally {
      setIsDetecting(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleInputChange(text.trim());
      }
    } catch {
      // Ignore clipboard read permission failures
    }
  };

  const handleInputChange = (val: string) => {
    setHandleInput(val);
    const low = val.toLowerCase();
    if (low.includes("youtube.com") || low.includes("youtu.be")) {
      setSelectedPlatform("YOUTUBE");
    } else if (low.includes("instagram.com")) {
      setSelectedPlatform("INSTAGRAM");
    } else if (low.includes("tiktok.com")) {
      setSelectedPlatform("TIKTOK");
    } else if (low.includes("t.me") || low.includes("telegram.me")) {
      setSelectedPlatform("TELEGRAM");
    } else if (low.includes("twitter.com") || low.includes("x.com")) {
      setSelectedPlatform("TWITTER");
    }
  };

  const handleOpenConfirmModal = () => {
    if (!handleInput.trim()) {
      setPurchaseError("Please enter a creator handle or content link first.");
      return;
    }

    if (!hasSufficientBalance) {
      setPurchaseError(`Insufficient balance (₹${currentWalletBalance.toFixed(2)}). Need ₹${totalCost.toFixed(2)}.`);
      return;
    }

    setPurchaseError(null);
    setShowConfirmModal(true);
  };

  const handlePurchase = async () => {
    setIsSubmitting(true);
    setPurchaseError(null);
    setPurchaseSuccess(null);

    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const idempotencyKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `auto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const res = await fetch(`${apiBase}/packages/autopilot/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          handle: handleInput.trim(),
          platform: selectedPlatform,
          presetId: selectedPreset.id,
          slotCount,
          seedCurrentPost,
          idempotencyKey,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res && res.ok) {
        setShowConfirmModal(false);
        setPurchaseSuccess(`🚀 Autopilot successfully activated for ${detectedProfile?.handle || handleInput}!`);
        if (refreshData) refreshData();
        if (onOrderSuccess) {
          onOrderSuccess(data);
        }
        return;
      }

      throw new Error(data?.message || "Failed to book Autopilot package.");
    } catch (err: any) {
      setPurchaseError(err.message || "Error activating Autopilot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Hero Strip */}
      <div className="p-4 sm:p-6 rounded-3xl bg-surface border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-[#D8EC8D] border border-emerald-500/25">
              <Bot className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-fg tracking-tight">
              Autopilot Accelerator
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#D8EC8D] text-black">
              Live Web Sync
            </span>
          </div>
          <p className="text-xs text-fg-muted max-w-xl leading-relaxed">
            Hands-off auto-boosting for creators. As soon as you publish a new Reel, Shorts, or Video, our poller detects it within 60s and dispatches staggered drip waves.
          </p>
        </div>

        {/* Feature Highlights Pills */}
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <div className="p-2.5 rounded-2xl bg-surface-raised border border-border text-center">
            <div className="text-[10px] text-fg-muted font-medium">Password-Free</div>
            <div className="text-xs font-bold text-fg">Public URL only</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-surface-raised border border-border text-center">
            <div className="text-[10px] text-fg-muted font-medium">60s Detection</div>
            <div className="text-xs font-bold text-emerald-600 dark:text-[#D8EC8D]">Instant Push</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-surface-raised border border-border text-center">
            <div className="text-[10px] text-fg-muted font-medium">100% Refundable</div>
            <div className="text-xs font-bold text-fg">Unused credited</div>
          </div>
        </div>
      </div>

      {/* Guided Steps Header */}
      <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-surface-raised border border-border text-center text-xs font-semibold">
        <div
          className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 border transition-all ${
            handleInput.trim()
              ? "bg-emerald-500/10 text-emerald-800 dark:text-[#D8EC8D] border-emerald-500/30 font-bold"
              : "bg-surface text-fg border-border shadow-sm font-bold"
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full font-extrabold flex items-center justify-center text-[10px] shrink-0 ${
              handleInput.trim() ? "bg-[#D8EC8D] text-black" : "bg-emerald-500 text-white"
            }`}
          >
            {handleInput.trim() ? "✓" : "1"}
          </span>
          <span className="truncate">1. Target Creator</span>
        </div>
        <div
          className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 border transition-all ${
            selectedPreset ? "bg-surface text-fg border-border shadow-sm font-bold" : "text-fg-muted border-transparent"
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-[#D8EC8D] text-black font-extrabold flex items-center justify-center text-[10px] shrink-0">
            2
          </span>
          <span className="truncate">2. Growth Recipe</span>
        </div>
        <div className="py-2 px-2 rounded-xl bg-surface-raised text-fg-muted flex items-center justify-center gap-1.5 border border-transparent font-medium">
          <span className="w-4 h-4 rounded-full bg-surface border border-border text-fg-muted font-extrabold flex items-center justify-center text-[10px] shrink-0">
            3
          </span>
          <span className="truncate">3. Slots & Review</span>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8">
        {/* Left Column: Creator Handle & Auto-Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-3xl bg-surface border border-border p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-fg flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-emerald-600 dark:text-[#D8EC8D]" />
                <span>Step 1: Choose Platform</span>
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-[#D8EC8D] border border-emerald-500/20 font-semibold">
                5 Supported Platforms
              </span>
            </div>

            {/* Platform Switcher: Clean 5-Platform Cards */}
            <div className="grid grid-cols-5 gap-1.5 p-1 rounded-2xl bg-surface-raised border border-border">
              {PLATFORMS.map((p) => {
                const isSelected = selectedPlatform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlatform(p.id)}
                    className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 sm:px-2.5 rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? "bg-surface text-fg shadow-sm border border-border ring-2 ring-emerald-500/40 dark:ring-[#D8EC8D]/50 font-bold"
                        : "text-fg-muted hover:text-fg hover:bg-surface/50 font-medium"
                    }`}
                    title={p.label}
                  >
                    <PlatformIcon platform={p.key} size={18} />
                    <span className="text-[11px] sm:text-xs truncate">{p.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Platform Description Pill */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 dark:text-[#D8EC8D] bg-emerald-500/10 dark:bg-[#D8EC8D]/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 dark:border-[#D8EC8D]/25">
              <Check className="w-3 h-3 shrink-0 text-emerald-600 dark:text-[#D8EC8D]" />
              <span className="truncate">
                {activePlatform.contentLabel}: {activePlatform.description}
              </span>
            </div>

            {/* Input Box with Paste & Clear */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-fg-muted">
                <span>Creator Handle or Profile Link</span>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="text-[11px] text-emerald-700 dark:text-[#D8EC8D] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardPaste className="w-3 h-3" />
                  Paste
                </button>
              </div>

              <div className="relative">
                <LinkAutoSuggest
                  value={handleInput}
                  onChange={(val) => handleInputChange(val)}
                  platform={selectedPlatform.toLowerCase()}
                  placeholder={activePlatform.placeholder}
                />

                <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
                  {handleInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setHandleInput("");
                        setDetectedProfile(null);
                        setDetectedMedia(null);
                        setDetectionError(null);
                      }}
                      className="p-1 rounded-lg text-fg-muted hover:text-fg transition-colors"
                      title="Clear input"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {isDetecting ? (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-[#D8EC8D] text-[10px] font-bold">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Syncing...</span>
                    </div>
                  ) : detectedProfile ? (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-[#D8EC8D] text-[10px] font-bold border border-emerald-500/25">
                      <Check className="w-3 h-3" />
                      <span>Live</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {detectionError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{detectionError}</span>
              </div>
            )}

            {/* Live Profile Card */}
            {detectedProfile && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-surface-raised border border-border p-4 space-y-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-border shrink-0 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getSafeImageUrl(detectedProfile.avatarUrl)}
                      alt={detectedProfile.handle}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80";
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-fg text-sm truncate">{detectedProfile.handle}</span>
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#D8EC8D] shrink-0" />
                    </div>
                    {detectedProfile.displayName &&
                      detectedProfile.displayName.toLowerCase() !==
                        detectedProfile.handle.replace(/^@/, "").toLowerCase() && (
                        <div className="text-xs font-semibold text-fg-muted truncate">
                          {detectedProfile.displayName}
                        </div>
                      )}
                    <div className="text-xs text-fg-muted flex items-center gap-2 mt-0.5">
                      <span>{detectedProfile.followerCount || `${activePlatform.label} Profile`}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Live Synced
                      </span>
                    </div>
                  </div>
                </div>

                {/* Latest Upload Box & Seed Selection */}
                {detectedMedia && (
                  <div className="pt-3 border-t border-border space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-fg-muted font-medium flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-[#D8EC8D]" />
                        Latest Upload Detected:
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">
                        Auto-Matched
                      </span>
                    </div>

                    <div className="flex gap-3 bg-surface p-3 rounded-xl border border-border shadow-sm">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-raised shrink-0 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getSafeImageUrl(detectedMedia.thumbnailUrl)}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                          <Play className="w-4 h-4 text-white fill-white/80" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-xs font-bold text-fg line-clamp-2 leading-snug">
                          {detectedMedia.title}
                        </div>
                        <div className="text-[11px] text-fg-muted flex items-center gap-1">
                          <span>Media Key:</span>
                          <span className="text-fg font-mono text-[10px] truncate">{detectedMedia.mediaKey}</span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Seed Mode Toggle Cards */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] text-fg-muted font-semibold">When should boosting start?</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSeedCurrentPost(true)}
                          className={`p-3 rounded-xl text-left border transition-all ${
                            seedCurrentPost
                              ? "bg-emerald-500/10 border-emerald-500/40 dark:border-[#D8EC8D]/50 ring-1 ring-emerald-500/30"
                              : "bg-surface border-border hover:border-fg/20"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs text-fg">
                            <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-[#D8EC8D]" />
                            <span>Start Now on Latest</span>
                          </div>
                          <p className="text-[10px] text-fg-muted mt-1 leading-snug">
                            Slot #1 boosts this video immediately; remaining slots wait for next uploads.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSeedCurrentPost(false)}
                          className={`p-3 rounded-xl text-left border transition-all ${
                            !seedCurrentPost
                              ? "bg-emerald-500/10 border-emerald-500/40 dark:border-[#D8EC8D]/50 ring-1 ring-emerald-500/30"
                              : "bg-surface border-border hover:border-fg/20"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs text-fg">
                            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-[#D8EC8D]" />
                            <span>Wait for Next Upload</span>
                          </div>
                          <p className="text-[10px] text-fg-muted mt-1 leading-snug">
                            All {slotCount} slots wait and trigger only when you post brand new content.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Column: Recipe Selection, Slot Count, Pricing & Review (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl bg-surface border border-border p-4 sm:p-6 space-y-6 shadow-sm">
            {/* Step 2: Select Growth Recipe */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-fg flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-[#D8EC8D]" />
                    <span>Step 2: Select Growth Recipe</span>
                  </h2>
                  <p className="text-xs text-fg-muted">
                    Optimized drip algorithms designed to trigger organic algorithmic discoverability.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  const Icon = preset.icon;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`relative p-4 rounded-2xl text-left border transition-all flex flex-col justify-between ${
                        isSelected
                          ? preset.themeClasses.activeBorder
                          : "bg-surface-raised border-border hover:border-fg/20"
                      }`}
                    >
                      {preset.isRecommended && (
                        <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-[#D8EC8D] text-black shadow-sm">
                          Recommended
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className={`p-2 rounded-xl ${preset.themeClasses.iconBg}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${preset.themeClasses.badge}`}
                          >
                            {preset.badge}
                          </span>
                        </div>

                        <div>
                          <div className="font-bold text-sm text-fg">{preset.name}</div>
                          <p className="text-[11px] text-fg-muted line-clamp-2 mt-0.5">
                            {preset.description}
                          </p>
                        </div>

                        {/* Metrics Breakdown */}
                        <div className="space-y-1 pt-1 text-[11px]">
                          <div className="flex justify-between text-fg-muted">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3 text-sky-500" /> Views:
                            </span>
                            <span className="font-bold text-fg">{formatIndianNumber(preset.metrics.views)}</span>
                          </div>
                          <div className="flex justify-between text-fg-muted">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3 text-rose-500" /> Likes:
                            </span>
                            <span className="font-bold text-fg">{formatIndianNumber(preset.metrics.likes)}</span>
                          </div>
                          <div className="flex justify-between text-fg-muted">
                            <span className="flex items-center gap-1">
                              <Share2 className="w-3 h-3 text-emerald-500" /> Shares:
                            </span>
                            <span className="font-bold text-fg">{formatIndianNumber(preset.metrics.shares)}</span>
                          </div>
                          <div className="flex justify-between text-fg-muted">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-500" /> Pacing:
                            </span>
                            <span className="font-semibold text-fg text-[10px]">{preset.pacingSummary}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 mt-2 border-t border-border flex items-baseline justify-between">
                        <span className="text-[10px] text-fg-muted">Per Upload</span>
                        <span className="text-base font-black text-fg">₹{preset.pricePerSlot}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Slot Count Selector */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-bold text-fg flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-emerald-600 dark:text-[#D8EC8D]" />
                  <span>Step 3: Number of Uploads to Auto-Boost</span>
                </h2>
                <span className="text-xs font-bold text-emerald-600 dark:text-[#D8EC8D]">
                  {slotCount} Posts
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[3, 5, 10, 15, 20].map((count) => {
                  const isSelected = slotCount === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setSlotCount(count)}
                      className={`py-2 px-3 rounded-xl text-center border font-bold text-xs transition-all ${
                        isSelected
                          ? "bg-[#D8EC8D] text-black border-[#D8EC8D] shadow-sm font-extrabold"
                          : "bg-surface-raised border-border text-fg-muted hover:text-fg hover:border-fg/20"
                      }`}
                    >
                      {count} Posts
                    </button>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-surface-raised border border-border flex items-center justify-between text-xs">
                <span className="text-fg-muted">Estimated Total Reach:</span>
                <span className="font-bold text-fg">
                  {formatIndianNumber(selectedPreset.metrics.views * slotCount)} views •{" "}
                  {formatIndianNumber(selectedPreset.metrics.likes * slotCount)} likes
                </span>
              </div>
            </div>

            {/* Pricing & Activation Action Bar */}
            <div className="p-5 rounded-2xl bg-surface-raised border border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-fg-muted">Total Autopilot Investment:</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-fg flex items-baseline gap-2">
                    ₹{formatIndianNumber(totalCost)}
                    <span className="text-xs font-normal text-fg-muted">
                      (₹{selectedPreset.pricePerSlot} × {slotCount} uploads)
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-[11px] text-fg-muted">Your Wallet Balance</div>
                  <div
                    className={`text-sm sm:text-base font-extrabold ${
                      hasSufficientBalance
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    ₹{formatIndianNumber(currentWalletBalance)}
                  </div>
                </div>
              </div>

              {purchaseError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{purchaseError}</span>
                </div>
              )}

              {purchaseSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{purchaseSuccess}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                {hasSufficientBalance ? (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleOpenConfirmModal}
                    className="flex-1 py-3.5 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md bg-[#D8EC8D] text-black hover:brightness-105 active:scale-[0.99] cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-current text-black" />
                    <span>Review & Confirm Autopilot (₹{formatIndianNumber(totalCost)})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <Link
                    href={`/wallet?amount=${balanceShortfall}&redirect=/new-order?tab=autopilot`}
                    className="flex-1 py-3.5 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer"
                  >
                    <span>Top Up ₹{formatIndianNumber(balanceShortfall)} to Wallet & Review</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Review & Confirm Autopilot Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg rounded-3xl bg-surface border border-border p-6 space-y-5 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#D8EC8D]/20 text-emerald-800 dark:text-[#D8EC8D] flex items-center justify-center border border-[#D8EC8D]/40">
                    <Zap className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-fg">Confirm Autopilot Subscription</h4>
                    <p className="text-xs text-fg-muted">Review package details before wallet deduction</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="p-1 rounded-lg text-fg-muted hover:text-fg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Creator Card */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-surface-raised border border-border">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-border shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getSafeImageUrl(detectedProfile?.avatarUrl)}
                    alt={detectedProfile?.handle || handleInput}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300";
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-fg text-sm truncate">{detectedProfile?.handle || handleInput}</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#D8EC8D] shrink-0" />
                  </div>
                  <div className="text-xs text-fg-muted truncate">
                    {detectedProfile?.displayName &&
                    detectedProfile.displayName.toLowerCase() !==
                      (detectedProfile.handle || handleInput).replace(/^@/, "").toLowerCase()
                      ? `${detectedProfile.displayName} • `
                      : ""}
                    {detectedProfile?.followerCount || `${activePlatform.label} Profile`}
                  </div>
                </div>
              </div>

              {/* Plan & Allocation Breakdown */}
              <div className="p-4 rounded-2xl bg-surface-raised border border-border space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-fg-muted">Growth Recipe:</span>
                  <span className="font-bold text-fg">
                    {selectedPreset.name} (₹{selectedPreset.pricePerSlot} / upload)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-fg-muted">Reserved Uploads:</span>
                  <span className="font-bold text-fg">{slotCount} Posts</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-fg-muted">Drip Schedule:</span>
                  <span className="font-medium text-fg-muted">{selectedPreset.pacingSummary}</span>
                </div>
                <div className="flex justify-between items-start pt-2 border-t border-border">
                  <span className="text-fg-muted">Boosting Target:</span>
                  <span className="font-semibold text-fg text-right max-w-[240px]">
                    {seedCurrentPost && detectedMedia
                      ? "Slot #1 starts on latest detected video; remaining slots wait for new uploads"
                      : `All ${slotCount} slots wait and trigger only on your new uploads`}
                  </span>
                </div>
              </div>

              {/* Financial Wallet Summary */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-fg-muted">Current Wallet Balance:</span>
                  <span className="font-bold text-fg">₹{formatIndianNumber(currentWalletBalance)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-fg-muted font-medium">Autopilot Total ({slotCount} slots):</span>
                  <span className="font-extrabold text-emerald-800 dark:text-[#D8EC8D] text-sm">
                    - ₹{formatIndianNumber(totalCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-emerald-500/20">
                  <span className="text-fg font-semibold">Remaining Wallet Balance:</span>
                  <span className="font-extrabold text-fg text-sm">
                    ₹{formatIndianNumber(Math.max(0, currentWalletBalance - totalCost))}
                  </span>
                </div>
              </div>

              {/* Refund Guarantee */}
              <div className="flex items-center gap-2 text-[11px] text-fg-muted bg-surface-raised p-2.5 rounded-xl border border-border">
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-[#D8EC8D] shrink-0" />
                <span>
                  <strong>100% Refundable</strong>: Cancel anytime to refund unconsumed slots back to your wallet immediately.
                </span>
              </div>

              {purchaseError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                  {purchaseError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-surface-raised hover:bg-surface border border-border text-fg text-xs font-semibold transition-all cursor-pointer"
                >
                  Modify / Edit
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handlePurchase}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#D8EC8D] hover:brightness-105 text-black text-xs font-extrabold tracking-wide uppercase transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Activating...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>Confirm & Pay ₹{formatIndianNumber(totalCost)}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
