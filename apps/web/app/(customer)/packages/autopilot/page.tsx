"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
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
  MessageSquare,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Play,
  Layers,
  Check,
  ExternalLink,
  Flame,
  Award,
  Crown,
  ClipboardPaste,
  X,
  HelpCircle,
  RotateCcw,
  CheckCircle,
  Info,
  TrendingUp,
  SlidersHorizontal,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";
import { getApiBase } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-session";

function getSafeLink(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") return "#";
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }
  return "#";
}

interface DetectedMedia {
  platform: "INSTAGRAM" | "YOUTUBE";
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
  platform: "INSTAGRAM" | "YOUTUBE";
  handle: string;
  displayName?: string;
  avatarUrl?: string;
}

interface AutopilotPackageSlot {
  id: string;
  slotNumber: number;
  status: "AVAILABLE" | "ACTIVE" | "COMPLETED";
  mediaKey?: string | null;
  targetUrl?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  executions?: Array<{
    id: string;
    seq: number;
    quantity: number;
    executeAt: string;
    status: string;
    rule?: {
      kind: string;
      service?: { name: string; kind: string };
    };
    order?: { id: string; status: string; quantity: number };
  }>;
}

interface AutopilotPackage {
  id: string;
  platform: string;
  handle: string;
  status: string;
  reserveTotal: number;
  createdAt: string;
  priceSnapshot?: any;
  allocationSnapshot?: any;
  slots: AutopilotPackageSlot[];
}

const PRESETS = [
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
    color: "from-sky-500/15 via-blue-600/10 to-transparent border-sky-500/30",
    badgeBg: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    glow: "shadow-[0_0_25px_rgba(56,189,248,0.1)]",
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
    color: "from-[#D8EC8D]/20 via-emerald-600/15 to-transparent border-[#D8EC8D]/40 shadow-[0_0_35px_rgba(216,236,141,0.18)]",
    badgeBg: "bg-[#D8EC8D]/20 text-[#D8EC8D] border-[#D8EC8D]/35",
    glow: "shadow-[0_0_30px_rgba(216,236,141,0.2)]",
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
    color: "from-purple-500/15 via-indigo-600/10 to-transparent border-purple-500/30",
    badgeBg: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    glow: "shadow-[0_0_25px_rgba(168,85,247,0.1)]",
  },
];

const SAMPLE_HANDLES = [
  { platform: "INSTAGRAM" as const, handle: "@areion._", label: "@areion._ (IG)" },
  { platform: "INSTAGRAM" as const, handle: "@cristiano", label: "@cristiano (IG)" },
  { platform: "YOUTUBE" as const, handle: "@mkbhd", label: "@mkbhd (YT)" },
  { platform: "YOUTUBE" as const, handle: "@MrBeast", label: "@MrBeast (YT)" },
];

const FAQS = [
  {
    q: "How fast does Autopilot detect when I post a new Reel or Video?",
    a: "Our poller syncs directly with official platform feeds every 60 to 120 seconds. As soon as your upload is indexed, Autopilot claims the next reserved slot and dispatches Batch #1 immediately.",
  },
  {
    q: "What if I post multiple videos in the same day?",
    a: "No problem at all! Each new upload claims its own distinct slot automatically. If you post 2 Reels today, Slot #1 and Slot #2 will each execute their own staggered 12-hour drip schedules in parallel without conflict.",
  },
  {
    q: "Can I cancel my subscription and get a refund for unused slots?",
    a: "Yes, 100%! You can click 'Cancel Subscription' on any active Autopilot package at any time. Any unconsumed slots are immediately credited back to your wallet balance to the exact rupee.",
  },
  {
    q: "Do I need to provide passwords or account login access?",
    a: "Never! Autopilot only requires your public creator handle or channel link. We never ask for passwords, API keys, or private permissions.",
  },
];

export default function AutopilotPage() {
  const router = useRouter();
  const { user, refreshData } = useCustomer();

  // Booking Form State
  const [handleInput, setHandleInput] = useState("@areion._");
  const [selectedPlatform, setSelectedPlatform] = useState<"INSTAGRAM" | "YOUTUBE">("INSTAGRAM");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("viral_push");
  const [slotCount, setSlotCount] = useState<number>(5);
  const [seedCurrentPost, setSeedCurrentPost] = useState<boolean>(true);

  // Live Auto-Detection State
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [detectedProfile, setDetectedProfile] = useState<DetectedProfile | null>(null);
  const [detectedMedia, setDetectedMedia] = useState<DetectedMedia | null>(null);

  // Purchase & Packages List State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const [autopilotPackages, setAutopilotPackages] = useState<AutopilotPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState<boolean>(true);
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});
  const [packageFilter, setPackageFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL");

  // Cancel & Refund Modal State
  const [cancelModalPackage, setCancelModalPackage] = useState<AutopilotPackage | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const selectedPreset = useMemo(() => {
    return PRESETS.find((p) => p.id === selectedPresetId) || PRESETS[1];
  }, [selectedPresetId]);

  const totalCost = useMemo(() => {
    return (selectedPreset.pricePerSlot || 0) * slotCount;
  }, [selectedPreset, slotCount]);

  const userBalance = Number(user?.balance || 0);
  const hasSufficientBalance = userBalance >= totalCost;
  const balanceShortfall = Math.max(0, totalCost - userBalance);

  // Auto-detect handle on change with debouncing
  useEffect(() => {
    if (!handleInput || handleInput.trim().length < 2) {
      setDetectedProfile(null);
      setDetectedMedia(null);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      triggerDetect(handleInput, selectedPlatform);
    }, 600);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [handleInput, selectedPlatform]);

  const triggerDetect = async (inputStr: string, platformHint?: string) => {
    setIsDetecting(true);
    setDetectionError(null);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/packages/autopilot/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ handle: inputStr, platform: platformHint }),
      });

      if (!res.ok) {
        throw new Error("Could not detect public profile or recent uploads.");
      }

      const data = await res.json();
      setDetectedProfile(data.profile);
      setDetectedMedia(data.latestMedia);
      if (data.profile?.platform) {
        setSelectedPlatform(data.profile.platform);
      }
    } catch (err: any) {
      setDetectionError(err.message || "Failed to auto-detect handle");
    } finally {
      setIsDetecting(false);
    }
  };

  // Fetch active Autopilot packages
  const fetchPackages = async () => {
    setIsLoadingPackages(true);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/packages/autopilot/list`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAutopilotPackages(data);
      }
    } catch (e) {
      console.error("Failed to load autopilot packages:", e);
    } finally {
      setIsLoadingPackages(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Paste from clipboard handler
  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setHandleInput(text.trim());
          showToast("Pasted handle from clipboard!");
        }
      }
    } catch (err) {
      console.warn("Clipboard access denied or unavailable:", err);
    }
  };

  // Purchase Autopilot
  const handlePurchase = async () => {
    if (!hasSufficientBalance) {
      setPurchaseError(`Insufficient balance (₹${userBalance.toFixed(2)}). Need ₹${totalCost.toFixed(2)}.`);
      return;
    }

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
          handle: handleInput,
          platform: selectedPlatform,
          presetId: selectedPreset.id,
          slotCount,
          seedCurrentPost,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to book Autopilot package.");
      }

      setPurchaseSuccess(`🚀 Autopilot successfully activated for ${detectedProfile?.handle || handleInput}!`);
      showToast(`Autopilot activated for ${slotCount} future uploads!`);
      if (refreshData) refreshData();
      fetchPackages();
    } catch (err: any) {
      setPurchaseError(err.message || "Error activating Autopilot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel & Refund package handler
  const handleCancelPackage = async () => {
    if (!cancelModalPackage) return;
    setIsCancelling(true);
    setCancelError(null);

    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/packages/${cancelModalPackage.id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to cancel subscription.");
      }

      const refundAmount = data.refundedAmount || data.refund || "Remaining";
      showToast(`Subscription cancelled. Refund of ₹${refundAmount} returned to your wallet!`);
      setCancelModalPackage(null);
      if (refreshData) refreshData();
      fetchPackages();
    } catch (err: any) {
      setCancelError(err.message || "Failed to cancel package");
    } finally {
      setIsCancelling(false);
    }
  };

  const toggleSlotDrawer = (slotId: string) => {
    setExpandedSlots((prev) => ({
      ...prev,
      [slotId]: !prev[slotId],
    }));
  };

  // Filtered packages
  const filteredPackages = useMemo(() => {
    if (packageFilter === "ALL") return autopilotPackages;
    if (packageFilter === "ACTIVE") {
      return autopilotPackages.filter((p) => p.status === "ACTIVE");
    }
    return autopilotPackages.filter((p) => p.status === "COMPLETED" || p.status === "CANCELLED");
  }, [autopilotPackages, packageFilter]);

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-24 px-3 sm:px-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#121609]/95 border border-[#D8EC8D]/50 text-[#D8EC8D] text-xs font-bold shadow-2xl backdrop-blur-xl"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 text-[#D8EC8D]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner / Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#121417] via-[#161a22] to-[#121417] border border-white/10 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D8EC8D]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D8EC8D]/15 border border-[#D8EC8D]/30 text-[#D8EC8D] text-xs font-semibold">
              <Bot className="w-4 h-4" />
              <span>Zero-Friction Autopilot</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Hands-Free Content Accelerator
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              No manual ordering or link copying required. Simply connect your social handle, choose your target velocity, and our background engine automatically boosts every new upload the moment it goes live.
            </p>

            {/* Quick Feature Badges */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium bg-white/[0.04] px-3 py-1 rounded-lg border border-white/5">
                <Check className="w-3.5 h-3.5 text-[#D8EC8D]" /> 60s Detection Speed
              </span>
              <span className="flex items-center gap-1.5 text-slate-300 font-medium bg-white/[0.04] px-3 py-1 rounded-lg border border-white/5">
                <Check className="w-3.5 h-3.5 text-[#D8EC8D]" /> Safe Staggered Drip
              </span>
              <span className="flex items-center gap-1.5 text-slate-300 font-medium bg-white/[0.04] px-3 py-1 rounded-lg border border-white/5">
                <Check className="w-3.5 h-3.5 text-[#D8EC8D]" /> 100% Unused Slots Refundable
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <div className="flex items-center gap-3 bg-white/[0.04] border border-white/10 p-3.5 rounded-2xl backdrop-blur-md">
              <div className="w-10 h-10 rounded-xl bg-[#D8EC8D]/15 flex items-center justify-center text-[#D8EC8D]">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">Autonomous Poller</div>
                <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Active Background Sync
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-400">
              <span>Your Wallet Balance:</span>
              <span className="font-bold text-emerald-400 ml-2">₹{formatIndianNumber(userBalance)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Guided Steps Header */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 p-1.5 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs font-medium">
        <div className="py-2 px-3 rounded-xl bg-white/[0.04] text-white flex items-center justify-center gap-2 border border-white/10 font-bold">
          <span className="w-5 h-5 rounded-full bg-[#D8EC8D] text-black font-extrabold flex items-center justify-center text-[10px]">1</span>
          <span className="truncate">Enter Handle</span>
        </div>
        <div className="py-2 px-3 rounded-xl text-slate-400 flex items-center justify-center gap-2">
          <span className="w-5 h-5 rounded-full bg-white/10 text-slate-300 font-extrabold flex items-center justify-center text-[10px]">2</span>
          <span className="truncate">Choose Recipe</span>
        </div>
        <div className="py-2 px-3 rounded-xl text-slate-400 flex items-center justify-center gap-2">
          <span className="w-5 h-5 rounded-full bg-white/10 text-slate-300 font-extrabold flex items-center justify-center text-[10px]">3</span>
          <span className="truncate">Activate Slots</span>
        </div>
      </div>

      {/* Booking Form Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Handle & Auto-Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl bg-surface border border-border p-6 space-y-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#D8EC8D]" />
                Step 1: Target Creator
              </h2>
              {/* Platform Switcher */}
              <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setSelectedPlatform("INSTAGRAM")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                    selectedPlatform === "INSTAGRAM"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <PlatformIcon platform="INSTAGRAM" className="w-3.5 h-3.5" />
                  Instagram
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlatform("YOUTUBE")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                    selectedPlatform === "YOUTUBE"
                      ? "bg-red-500/20 text-red-300 border border-red-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <PlatformIcon platform="YOUTUBE" className="w-3.5 h-3.5" />
                  YouTube
                </button>
              </div>
            </div>

            {/* Input Box with Paste & Clear */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 flex items-center justify-between">
                <span>Enter Public Creator Handle or Channel URL</span>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="text-[11px] text-[#D8EC8D] hover:underline flex items-center gap-1"
                >
                  <ClipboardPaste className="w-3 h-3" />
                  Paste
                </button>
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder={selectedPlatform === "INSTAGRAM" ? "@handle or https://instagram.com/handle" : "@channel or https://youtube.com/@channel"}
                  className="w-full pl-4 pr-24 py-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#D8EC8D]/50 text-sm font-medium transition-all shadow-inner"
                />

                <div className="absolute right-3 top-3 flex items-center gap-2">
                  {handleInput && (
                    <button
                      type="button"
                      onClick={() => setHandleInput("")}
                      className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
                      title="Clear input"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isDetecting ? (
                    <div className="flex items-center gap-1.5 text-xs text-[#D8EC8D]">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-[10px]">Scanning...</span>
                    </div>
                  ) : detectedProfile ? (
                    <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <Check className="w-3 h-3" />
                      Live
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Sample test chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 mr-1">Quick Try:</span>
                {SAMPLE_HANDLES.filter((s) => s.platform === selectedPlatform).map((sample) => (
                  <button
                    key={sample.handle}
                    type="button"
                    onClick={() => {
                      setSelectedPlatform(sample.platform);
                      setHandleInput(sample.handle);
                    }}
                    className="px-2 py-0.5 rounded-md bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white text-[11px] border border-white/5 transition-all"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Detected Profile Preview Card */}
            {detectedProfile ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white/[0.02] border border-white/10 p-4 space-y-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 border border-white/10 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={detectedProfile.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300"}
                      alt={detectedProfile.handle}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-sm truncate">{detectedProfile.handle}</span>
                      <ShieldCheck className="w-4 h-4 text-[#D8EC8D] shrink-0" />
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{selectedPlatform === "INSTAGRAM" ? "Instagram Profile" : "YouTube Channel"}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-600" />
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Live Synced
                      </span>
                    </div>
                  </div>
                </div>

                {/* Latest Upload Box & Seed Selection */}
                {detectedMedia && (
                  <div className="pt-3 border-t border-white/5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 text-[#D8EC8D]" />
                        Latest Upload Detected:
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                        Auto-Matched
                      </span>
                    </div>

                    <div className="flex gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 shrink-0 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={detectedMedia.thumbnailUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <Play className="w-4 h-4 text-white fill-white/80" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-xs font-semibold text-white line-clamp-2 leading-snug">
                          {detectedMedia.title}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <span>Media Key:</span>
                          <span className="text-slate-200 font-mono text-[10px] truncate">{detectedMedia.mediaKey}</span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Seed Mode Toggle Cards */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] text-slate-400 font-medium">When should boosting start?</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSeedCurrentPost(true)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            seedCurrentPost
                              ? "bg-[#D8EC8D]/10 border-[#D8EC8D]/40 text-white"
                              : "bg-white/[0.02] border-white/5 text-slate-400 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#D8EC8D]">
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>Start Now on Latest</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                            Slot #1 boosts this video immediately; remaining slots wait for next uploads.
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSeedCurrentPost(false)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            !seedCurrentPost
                              ? "bg-sky-500/10 border-sky-500/40 text-white"
                              : "bg-white/[0.02] border-white/5 text-slate-400 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Wait for Next Upload</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                            All {slotCount} slots wait and trigger only when you post brand new content.
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : isDetecting ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-[#D8EC8D] animate-spin mx-auto" />
                <div className="text-xs text-white font-medium">Detecting profile & recent uploads...</div>
                <div className="text-[11px] text-slate-500">Connecting to public platform feed</div>
              </div>
            ) : null}

            {detectionError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{detectionError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 3 Presets & Activation (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl bg-surface border border-border p-6 space-y-6 shadow-lg">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D8EC8D]" />
                Step 2: Select Growth Recipe
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Optimized drip algorithms designed to trigger organic algorithmic discoverability.
              </p>
            </div>

            {/* 3 Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PRESETS.map((p) => {
                const isSelected = selectedPresetId === p.id;
                const IconComponent = p.icon;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPresetId(p.id)}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? `bg-gradient-to-b ${p.color} ring-2 ring-[#D8EC8D] ${p.glow}`
                        : "bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04]"
                    }`}
                  >
                    {p.isRecommended && (
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#D8EC8D] text-black shadow-md">
                        Recommended
                      </span>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                          <IconComponent className="w-4 h-4 text-white" />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${p.badgeBg}`}>
                          {p.badge}
                        </span>
                      </div>

                      <div>
                        <div className="font-bold text-white text-sm">{p.name}</div>
                        <div className="text-[11px] text-slate-400 leading-snug mt-1">{p.description}</div>
                      </div>

                      {/* Deliverables Breakdown */}
                      <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Eye className="w-3 h-3 text-sky-400" /> Views:
                          </span>
                          <span className="font-bold text-white">{formatIndianNumber(p.metrics.views)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Heart className="w-3 h-3 text-rose-400" /> Likes:
                          </span>
                          <span className="font-bold text-white">{formatIndianNumber(p.metrics.likes)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Share2 className="w-3 h-3 text-emerald-400" /> Shares:
                          </span>
                          <span className="font-bold text-white">{formatIndianNumber(p.metrics.shares)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="w-3 h-3 text-amber-400" /> Pacing:
                          </span>
                          <span className="font-medium text-[10px] text-slate-300">{p.runsCount} waves / {p.durationHours}h</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-white/5 flex items-baseline justify-between">
                      <span className="text-[11px] text-slate-400">Per Upload</span>
                      <span className="text-base font-extrabold text-white">₹{p.pricePerSlot}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Step 3: Slot Count Selector */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#D8EC8D]" />
                  Step 3: Number of Uploads to Auto-Boost
                </span>
                <span className="font-bold text-[#D8EC8D] text-sm">{slotCount} Posts</span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[3, 5, 10, 15, 20].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setSlotCount(cnt)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                      slotCount === cnt
                        ? "bg-[#D8EC8D]/20 text-[#D8EC8D] border-[#D8EC8D]/50 shadow-sm"
                        : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    {cnt} Posts
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-slate-400">
                <span>Estimated Total Reach:</span>
                <span className="font-bold text-white">
                  {formatIndianNumber(selectedPreset.metrics.views * slotCount)} Views • {formatIndianNumber(selectedPreset.metrics.likes * slotCount)} Likes
                </span>
              </div>
            </div>

            {/* Total Quote & Activation CTA */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-400">Total Autopilot Investment:</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white flex items-baseline gap-2">
                    ₹{formatIndianNumber(totalCost)}
                    <span className="text-xs font-normal text-slate-400">
                      (₹{selectedPreset.pricePerSlot} × {slotCount} uploads)
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-[11px] text-slate-400">Your Wallet Balance</div>
                  <div className={`text-sm sm:text-base font-extrabold ${hasSufficientBalance ? "text-emerald-400" : "text-rose-400"}`}>
                    ₹{formatIndianNumber(userBalance)}
                  </div>
                </div>
              </div>

              {purchaseError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{purchaseError}</span>
                </div>
              )}

              {purchaseSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{purchaseSuccess}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="button"
                  disabled={isSubmitting || !hasSufficientBalance}
                  onClick={handlePurchase}
                  className={`flex-1 py-3.5 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl ${
                    hasSufficientBalance
                      ? "bg-[#D8EC8D] text-black hover:brightness-105 active:scale-[0.99] cursor-pointer"
                      : "bg-white/10 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Activating Autopilot...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Activate Autopilot (₹{formatIndianNumber(totalCost)})</span>
                    </>
                  )}
                </button>

                {!hasSufficientBalance && (
                  <Link
                    href="/wallet"
                    className="py-3.5 px-5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs text-center transition-all border border-emerald-500/30 flex items-center justify-center gap-1.5"
                  >
                    <span>Top up ₹{formatIndianNumber(balanceShortfall)}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Autopilot Packages & Real-Time Slots Dashboard */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-[#D8EC8D]" />
              Active Autopilot Subscriptions
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitor reserved slots, auto-detected videos, and real-time drip sub-orders.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setPackageFilter("ALL")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  packageFilter === "ALL" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                All ({autopilotPackages.length})
              </button>
              <button
                type="button"
                onClick={() => setPackageFilter("ACTIVE")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  packageFilter === "ACTIVE" ? "bg-[#D8EC8D]/20 text-[#D8EC8D]" : "text-slate-400 hover:text-white"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setPackageFilter("COMPLETED")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  packageFilter === "COMPLETED" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Past
              </button>
            </div>

            <button
              type="button"
              onClick={fetchPackages}
              className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all"
              title="Refresh subscriptions"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingPackages ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {isLoadingPackages ? (
          <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#D8EC8D]" />
            <span>Loading active Autopilot subscriptions...</span>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="p-12 rounded-3xl bg-surface border border-border text-center space-y-3">
            <Bot className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-white font-bold text-sm">No Autopilot Subscriptions Found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Configure your handle above and activate your first Autopilot package to automate your next uploads.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredPackages.map((pkg) => {
              const alloc = pkg.allocationSnapshot || {};
              const preset = alloc.preset || PRESETS[1];
              const totalSlots = pkg.slots?.length || 0;
              const claimedSlots = pkg.slots?.filter((s) => s.status !== "AVAILABLE").length || 0;
              const percentComplete = totalSlots > 0 ? Math.round((claimedSlots / totalSlots) * 100) : 0;

              return (
                <div key={pkg.id} className="rounded-3xl bg-surface border border-border overflow-hidden space-y-5 p-6 shadow-md">
                  {/* Package Meta Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <PlatformIcon platform={pkg.platform} className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>@{pkg.handle}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D8EC8D]/15 text-[#D8EC8D] border border-[#D8EC8D]/30">
                            {preset.name}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            pkg.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                          }`}>
                            {pkg.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {claimedSlots} of {totalSlots} uploads boosted ({percentComplete}%) • Reserved: ₹{formatIndianNumber(pkg.reserveTotal)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {pkg.status === "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => setCancelModalPackage(pkg)}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Cancel & Refund</span>
                        </button>
                      )}

                      <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-white/[0.02] px-3 py-1.5 rounded-xl border border-white/5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Background Poller Active</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400 font-medium">
                      <span>Campaign Progress</span>
                      <span>{claimedSlots} / {totalSlots} Posts Claimed</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-[#D8EC8D] transition-all duration-500"
                        style={{ width: `${percentComplete}%` }}
                      />
                    </div>
                  </div>

                  {/* Slots Timeline Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {pkg.slots?.map((slot) => {
                      const isClaimed = slot.status === "ACTIVE" || slot.status === "COMPLETED";
                      const isExpanded = !!expandedSlots[slot.id];
                      const executions = slot.executions || [];

                      return (
                        <div
                          key={slot.id}
                          className={`rounded-2xl border transition-all p-4 space-y-3 ${
                            isClaimed
                              ? "bg-white/[0.02] border-emerald-500/30 shadow-sm"
                              : "bg-white/[0.01] border-dashed border-white/10"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>Slot #{slot.slotNumber}</span>
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                slot.status === "COMPLETED"
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : slot.status === "ACTIVE"
                                  ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {slot.status === "COMPLETED"
                                ? "Delivered"
                                : slot.status === "ACTIVE"
                                ? "Boosting Now"
                                : "Awaiting Upload"}
                            </span>
                          </div>

                          {isClaimed ? (
                            <div className="space-y-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                  <Play className="w-4 h-4 text-white fill-white" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold text-white truncate">
                                    Media: {slot.mediaKey}
                                  </div>
                                  <a
                                    href={getSafeLink(slot.targetUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 truncate"
                                  >
                                    <span>Open Post</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleSlotDrawer(slot.id)}
                                className="w-full mt-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-semibold flex items-center justify-between transition-all"
                              >
                                <span>{executions.length} Drip Sub-Orders</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                              </button>

                              {/* Expandable Drip Drawer */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="pt-2 space-y-1.5 overflow-hidden"
                                  >
                                    {executions.map((exec) => (
                                      <div
                                        key={exec.id}
                                        className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-[11px] flex items-center justify-between"
                                      >
                                        <div className="space-y-0.5">
                                          <div className="font-semibold text-slate-200">
                                            {exec.rule?.service?.name || "Delivery Batch"}
                                          </div>
                                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>Wave #{exec.seq} • {new Date(exec.executeAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-bold text-white">+{exec.quantity}</div>
                                          <div className="text-[9px] uppercase font-bold text-emerald-400">
                                            {exec.status}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ) : (
                            <div className="py-4 text-center space-y-2">
                              <Radio className="w-5 h-5 text-amber-400/80 mx-auto animate-pulse" />
                              <div className="text-xs text-slate-300 font-semibold">Standing By For Upload</div>
                              <div className="text-[10px] text-slate-500 max-w-[200px] mx-auto">
                                Automatically claims & starts within 60s when you publish next
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Customer Confidence & FAQ Section */}
      <div className="rounded-3xl bg-surface border border-border p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#D8EC8D]" />
            Frequently Asked Questions
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Everything you need to know about hands-free automated growth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FAQS.map((faq, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2"
            >
              <div className="text-sm font-bold text-white flex items-start gap-2">
                <span className="text-[#D8EC8D] font-mono">Q:</span>
                <span>{faq.q}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pl-5">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel Subscription Confirmation Modal */}
      <AnimatePresence>
        {cancelModalPackage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-3xl bg-[#161a22] border border-white/10 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Cancel Autopilot?</h4>
                    <p className="text-xs text-slate-400">@{cancelModalPackage.handle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelModalPackage(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <p>
                  Are you sure you want to cancel this Autopilot subscription?
                </p>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Slots:</span>
                    <span className="font-bold text-white">{cancelModalPackage.slots?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Unused Waiting Slots:</span>
                    <span className="font-bold text-amber-400">
                      {cancelModalPackage.slots?.filter((s) => s.status === "AVAILABLE").length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-white/5">
                    <span className="text-slate-400">Estimated Refund:</span>
                    <span className="font-bold text-emerald-400">100% of Unused Reserve</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  The unused balance will be refunded back to your wallet immediately in an atomic transaction.
                </p>
              </div>

              {cancelError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {cancelError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalPackage(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold transition-all"
                >
                  Keep Subscription
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleCancelPackage}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg"
                >
                  {isCancelling ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Refunding...</span>
                    </>
                  ) : (
                    <span>Confirm & Refund</span>
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
