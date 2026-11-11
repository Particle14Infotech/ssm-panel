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
}

interface PlatformOption {
  id: SupportedAutopilotPlatform;
  key: string;
  label: string;
  description: string;
  contentLabel: string;
  placeholder: string;
  defaultSample: string;
  samples: Array<{ handle: string; label: string }>;
}

const PLATFORMS: PlatformOption[] = [
  {
    id: "INSTAGRAM",
    key: "instagram",
    label: "Instagram",
    description: "Auto-detects new Reels, Posts & IGTV",
    contentLabel: "Instagram Reels & Posts",
    placeholder: "Enter @handle or Reel URL",
    defaultSample: "@areion._",
    samples: [
      { handle: "@areion._", label: "@areion._" },
      { handle: "@cristiano", label: "@cristiano" },
    ],
  },
  {
    id: "YOUTUBE",
    key: "youtube",
    label: "YouTube",
    description: "Auto-detects new Videos & Shorts",
    contentLabel: "YouTube Channel & Shorts",
    placeholder: "Enter @channel, URL or Video",
    defaultSample: "@mkbhd",
    samples: [
      { handle: "@mkbhd", label: "@mkbhd" },
      { handle: "@MrBeast", label: "@MrBeast" },
    ],
  },
  {
    id: "TIKTOK",
    key: "tiktok",
    label: "TikTok",
    description: "Auto-detects new TikTok Videos",
    contentLabel: "TikTok Profile & Videos",
    placeholder: "Enter @handle or TikTok URL",
    defaultSample: "@tiktok",
    samples: [
      { handle: "@tiktok", label: "@tiktok" },
      { handle: "@khaby.lame", label: "@khaby.lame" },
    ],
  },
  {
    id: "TELEGRAM",
    key: "telegram",
    label: "Telegram",
    description: "Auto-detects new Public Channel Posts",
    contentLabel: "Telegram Public Channel",
    placeholder: "Enter public @channel or t.me link",
    defaultSample: "@durov",
    samples: [
      { handle: "@durov", label: "@durov" },
      { handle: "@telegram", label: "@telegram" },
    ],
  },
  {
    id: "TWITTER",
    key: "x_twitter",
    label: "X",
    description: "Auto-detects new Posts & Media",
    contentLabel: "X / Twitter Profile & Posts",
    placeholder: "Enter @handle or post link",
    defaultSample: "@elonmusk",
    samples: [
      { handle: "@elonmusk", label: "@elonmusk" },
      { handle: "@sama", label: "@sama" },
    ],
  },
];

function getSafeImageUrl(url?: string | null): string {
  if (!url) return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300";
  if (url.startsWith("/api/") || url.startsWith("data:")) return url;
  if (url.includes("ytimg.com") || url.includes("images.unsplash.com")) return url;
  return `/api/v1/packages/autopilot/proxy-image?url=${encodeURIComponent(url)}`;
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
  const [selectedPlatform, setSelectedPlatform] = useState<SupportedAutopilotPlatform>("INSTAGRAM");
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
  const [syncingPackageId, setSyncingPackageId] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activePlatform = useMemo(() => {
    return PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0];
  }, [selectedPlatform]);

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
      let res: Response | null = null;
      try {
        res = await fetch(`${apiBase}/packages/autopilot/preview`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ handle: inputStr, platform: platformHint }),
        });
      } catch (networkErr) {
        // Handled below by fallback
      }

      if (res && res.ok) {
        const data = await res.json();
        setDetectedProfile(data.profile);
        setDetectedMedia(data.latestMedia);
        if (data.profile?.platform) {
          setSelectedPlatform(data.profile.platform);
        }
        return;
      }

      // In local dev or simulation mode, provide instant verified creator preview
      if (process.env.NEXT_PUBLIC_SIMULATE_UPSTREAM_ORDERS === "true" || process.env.NODE_ENV !== "production") {
        const clean = inputStr.replace(/^@/, "").trim() || "creator";
        const targetPlat = platformHint || selectedPlatform;
        const simProfile = {
          handle: `@${clean}`,
          displayName: clean.charAt(0).toUpperCase() + clean.slice(1),
          avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
          platform: targetPlat,
          followers: 142500,
          verified: true,
        };
        const simMedia = {
          id: `media_${clean}_${Date.now()}`,
          url: targetPlat === "YOUTUBE" ? `https://youtube.com/watch?v=dQw4w9WgXcQ` : `https://instagram.com/reel/C7xY9z0A`,
          thumbnailUrl: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80`,
          caption: `Latest drop from @${clean}! Auto-boost armed and waiting for new uploads.`,
          publishedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
          platform: targetPlat,
        };
        setDetectedProfile(simProfile);
        setDetectedMedia(simMedia);
        return;
      }

      throw new Error("Could not detect public profile or recent uploads.");
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
      let res: Response | null = null;
      try {
        res = await fetch(`${apiBase}/packages/autopilot/list`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      } catch (networkErr) {
        // Handled below by fallback
      }

      if (res && res.ok) {
        const data = await res.json();
        setAutopilotPackages(data);
        return;
      }

      // If backend has no subscriptions yet or offline in dev, show verified sample subscription
      if (process.env.NEXT_PUBLIC_SIMULATE_UPSTREAM_ORDERS === "true" || process.env.NODE_ENV !== "production") {
        setAutopilotPackages((prev) => {
          if (prev.length > 0) return prev;
          return [
            {
              id: "pkg_auto_demo_01",
              platform: "INSTAGRAM",
              handle: "@areion._",
              status: "ACTIVE",
              reserveTotal: 1495,
              createdAt: new Date(Date.now() - 86400000).toISOString(),
              allocationSnapshot: {
                presetName: "Viral Push",
                runsCount: 4,
                durationHours: 12,
                metrics: { views: 10000, likes: 600, shares: 150, comments: 50 },
              },
              slots: [
                {
                  id: "slot_01_done",
                  slotNumber: 1,
                  status: "COMPLETED",
                  targetUrl: "https://instagram.com/reel/C6mKL89",
                  startedAt: new Date(Date.now() - 72000000).toISOString(),
                  completedAt: new Date(Date.now() - 28800000).toISOString(),
                  executions: [
                    { id: "e1", seq: 1, quantity: 2500, executeAt: "10:00 AM", status: "COMPLETED", rule: { kind: "VIEWS", service: { name: "Explore Views", kind: "VIEWS" } } },
                    { id: "e2", seq: 2, quantity: 2500, executeAt: "01:00 PM", status: "COMPLETED", rule: { kind: "VIEWS", service: { name: "Explore Views", kind: "VIEWS" } } },
                    { id: "e3", seq: 3, quantity: 2500, executeAt: "04:00 PM", status: "COMPLETED", rule: { kind: "VIEWS", service: { name: "Explore Views", kind: "VIEWS" } } },
                    { id: "e4", seq: 4, quantity: 2500, executeAt: "07:00 PM", status: "COMPLETED", rule: { kind: "VIEWS", service: { name: "Explore Views", kind: "VIEWS" } } },
                  ],
                },
                {
                  id: "slot_02_active",
                  slotNumber: 2,
                  status: "ACTIVE",
                  targetUrl: "https://instagram.com/reel/C7xY9z0",
                  startedAt: new Date(Date.now() - 14400000).toISOString(),
                  executions: [
                    { id: "e5", seq: 1, quantity: 2500, executeAt: "02:00 PM", status: "COMPLETED", rule: { kind: "VIEWS", service: { name: "Explore Views", kind: "VIEWS" } } },
                    { id: "e6", seq: 2, quantity: 2500, executeAt: "05:00 PM", status: "DELIVERING", rule: { kind: "VIEWS", service: { name: "Explore Views", kind: "VIEWS" } } },
                    { id: "e7", seq: 3, quantity: 2500, executeAt: "08:00 PM", status: "SCHEDULED", rule: { kind: "VIEWS", service: { name: "Explore Views", kind: "VIEWS" } } },
                    { id: "e8", seq: 4, quantity: 2500, executeAt: "11:00 PM", status: "SCHEDULED", rule: { kind: "VIEWS", service: { name: "Explore Views", kind: "VIEWS" } } },
                  ],
                },
                { id: "slot_03_avail", slotNumber: 3, status: "AVAILABLE" },
                { id: "slot_04_avail", slotNumber: 4, status: "AVAILABLE" },
                { id: "slot_05_avail", slotNumber: 5, status: "AVAILABLE" },
              ],
            },
          ];
        });
        return;
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

      let res: Response | null = null;
      try {
        res = await fetch(`${apiBase}/packages/autopilot/purchase`, {
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
      } catch (networkErr) {
        // Fallback handled below
      }

      if (res && res.ok) {
        setPurchaseSuccess(`🚀 Autopilot successfully activated for ${detectedProfile?.handle || handleInput}!`);
        showToast(`Autopilot activated for ${slotCount} uploads!`);
        if (refreshData) refreshData();
        fetchPackages();
        return;
      }

      // Simulation fallback for demo / test mode
      if (process.env.NEXT_PUBLIC_SIMULATE_UPSTREAM_ORDERS === "true" || process.env.NODE_ENV !== "production") {
        const newPkg: AutopilotPackage = {
          id: `pkg_auto_${Date.now()}`,
          platform: selectedPlatform,
          handle: detectedProfile?.handle || handleInput,
          status: "ACTIVE",
          reserveTotal: totalPrice,
          createdAt: new Date().toISOString(),
          allocationSnapshot: {
            presetName: selectedPreset.name,
            runsCount: selectedPreset.runsCount,
            durationHours: selectedPreset.durationHours,
            metrics: selectedPreset.metrics,
          },
          slots: Array.from({ length: slotCount }, (_, idx) => ({
            id: `slot_${Date.now()}_${idx + 1}`,
            slotNumber: idx + 1,
            status: idx === 0 && seedCurrentPost ? "ACTIVE" : "AVAILABLE",
            targetUrl: idx === 0 && seedCurrentPost ? (detectedMedia?.url || "https://instagram.com/reel/demo") : null,
            startedAt: idx === 0 && seedCurrentPost ? new Date().toISOString() : null,
            executions: idx === 0 && seedCurrentPost ? [
              {
                id: `exec_1`,
                seq: 1,
                quantity: Math.round(selectedPreset.metrics.views / selectedPreset.runsCount),
                executeAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "DELIVERING",
                rule: { kind: "VIEWS", service: { name: "High-Retention Views", kind: "VIEWS" } },
              },
              {
                id: `exec_2`,
                seq: 2,
                quantity: Math.round(selectedPreset.metrics.views / selectedPreset.runsCount),
                executeAt: new Date(Date.now() + 3 * 3600000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                status: "SCHEDULED",
                rule: { kind: "VIEWS", service: { name: "High-Retention Views", kind: "VIEWS" } },
              },
            ] : [],
          })),
        };
        setAutopilotPackages((prev) => [newPkg, ...prev]);
        setPurchaseSuccess(`🚀 Autopilot successfully activated for ${detectedProfile?.handle || handleInput}!`);
        showToast(`Autopilot activated for ${slotCount} uploads!`);
        if (refreshData) refreshData();
        return;
      }

      throw new Error("Failed to book Autopilot package.");
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
      let res: Response | null = null;
      try {
        res = await fetch(`${apiBase}/packages/${cancelModalPackage.id}/cancel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      } catch (networkErr) {
        // Fallback handled below
      }

      if (res && res.ok) {
        const data = await res.json();
        const refundAmount = data.refundedAmount || data.refund || "Remaining";
        showToast(`Subscription cancelled. Refund of ₹${refundAmount} returned to your wallet!`);
        setCancelModalPackage(null);
        if (refreshData) refreshData();
        fetchPackages();
        return;
      }

      // Simulation fallback for demo / test mode
      if (process.env.NEXT_PUBLIC_SIMULATE_UPSTREAM_ORDERS === "true" || process.env.NODE_ENV !== "production") {
        setAutopilotPackages((prev) =>
          prev.map((p) => (p.id === cancelModalPackage.id ? { ...p, status: "CANCELLED" } : p))
        );
        showToast(`Subscription cancelled! 100% of unused reserve refunded to your wallet.`);
        setCancelModalPackage(null);
        if (refreshData) refreshData();
        return;
      }

      throw new Error("Failed to cancel subscription.");
    } catch (err: any) {
      setCancelError(err.message || "Failed to cancel package");
    } finally {
      setIsCancelling(false);
    }
  };

  // On-demand feed sync handler
  const handleSyncFeed = async (packageId: string) => {
    setSyncingPackageId(packageId);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      let res: Response | null = null;
      try {
        res = await fetch(`${apiBase}/packages/autopilot/${packageId}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      } catch (networkErr) {
        // Fallback handled below
      }

      if (res && res.ok) {
        const data = await res.json();
        showToast(data.message || "Feed check complete!");
        fetchPackages();
        if (refreshData) refreshData();
        return;
      }

      // Simulation fallback for demo / test mode
      if (process.env.NEXT_PUBLIC_SIMULATE_UPSTREAM_ORDERS === "true" || process.env.NODE_ENV !== "production") {
        await new Promise((r) => setTimeout(r, 600));
        showToast("Poller verified creator feed: all slots synchronized!");
        return;
      }

      throw new Error("Failed to sync feed.");
    } catch (err: any) {
      showToast(err.message || "Failed to sync feed.");
    } finally {
      setSyncingPackageId(null);
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
    <div className="space-y-4 sm:space-y-8 max-w-6xl mx-auto pb-24 px-2 sm:px-6 text-fg">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-surface border border-[#D8EC8D] text-fg text-xs font-bold shadow-2xl backdrop-blur-xl"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 dark:text-[#D8EC8D]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleek, Compact Header Banner (Space-Optimized, Theme-Aware, No Duplicate Balance) */}
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-surface border border-border shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 dark:bg-[#D8EC8D]/15 text-emerald-600 dark:text-[#D8EC8D] flex items-center justify-center shrink-0 border border-emerald-500/20 dark:border-[#D8EC8D]/30">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-fg tracking-tight">Autopilot Accelerator</h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live 60s Sync
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-fg-muted truncate">
              Auto-boosts new uploads instantly • 100% unused slots refundable
            </p>
          </div>
        </div>
      </div>

      {/* 3-Point Micro-Trust Bar: Responsive single row on mobile, 3 cards on desktop */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3 p-1 sm:p-0 rounded-xl sm:rounded-none bg-surface/40 sm:bg-transparent border sm:border-0 border-border text-xs">
        <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2.5 py-1.5 sm:p-3 sm:rounded-2xl sm:bg-surface sm:border sm:border-border sm:shadow-2xs text-center sm:text-left">
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-[#D8EC8D] shrink-0" />
          <div>
            <div className="font-bold text-[10px] sm:text-xs text-fg">Password-Free</div>
            <div className="hidden sm:block text-[11px] text-fg-muted">Public link or @handle only</div>
          </div>
        </div>
        <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2.5 py-1.5 sm:p-3 sm:rounded-2xl sm:bg-surface sm:border sm:border-border sm:shadow-2xs text-center sm:text-left">
          <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-[#D8EC8D] shrink-0" />
          <div>
            <div className="font-bold text-[10px] sm:text-xs text-fg">60s Auto-Detect</div>
            <div className="hidden sm:block text-[11px] text-fg-muted">Instant trigger on publish</div>
          </div>
        </div>
        <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2.5 py-1.5 sm:p-3 sm:rounded-2xl sm:bg-surface sm:border sm:border-border sm:shadow-2xs text-center sm:text-left">
          <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-[#D8EC8D] shrink-0" />
          <div>
            <div className="font-bold text-[10px] sm:text-xs text-fg">100% Refundable</div>
            <div className="hidden sm:block text-[11px] text-fg-muted">Unconsumed posts credited</div>
          </div>
        </div>
      </div>

      {/* Guided Steps Header (Hidden on Mobile to save space, visible on Desktop) */}
      <div className="hidden sm:grid grid-cols-3 gap-2 p-1 rounded-2xl bg-surface-raised border border-border text-center text-xs font-semibold">
        <div className="py-2 px-2 rounded-xl bg-surface text-fg flex items-center justify-center gap-1.5 border border-border shadow-sm font-bold">
          <span className="w-4 h-4 rounded-full bg-[#D8EC8D] text-black font-extrabold flex items-center justify-center text-[10px] shrink-0">1</span>
          <span>Target Handle</span>
        </div>
        <div className="py-2 px-2 rounded-xl text-fg-muted flex items-center justify-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-surface border border-border text-fg-muted font-extrabold flex items-center justify-center text-[10px] shrink-0">2</span>
          <span>Growth Recipe</span>
        </div>
        <div className="py-2 px-2 rounded-xl text-fg-muted flex items-center justify-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-surface border border-border text-fg-muted font-extrabold flex items-center justify-center text-[10px] shrink-0">3</span>
          <span>Activate Slots</span>
        </div>
      </div>

      {/* Booking Form Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8">
        {/* Left Column: Handle & Auto-Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-3xl bg-surface border border-border p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <h2 className="text-sm sm:text-base font-bold text-fg flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-emerald-600 dark:text-[#D8EC8D]" />
                <span>Step 1: Choose Platform</span>
              </h2>
              {/* Platform Switcher - ICONS ONLY (No platform names) */}
              <div className="grid grid-cols-5 gap-1 bg-surface-raised p-1 rounded-2xl border border-border w-full sm:w-auto sm:flex sm:items-center">
                {PLATFORMS.map((p) => {
                  const isSelected = selectedPlatform === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlatform(p.id);
                        setHandleInput(p.defaultSample);
                      }}
                      title={p.label}
                      aria-label={p.label}
                      className={`h-10 sm:h-9 px-2 sm:px-2.5 rounded-xl transition-all flex items-center justify-center ${isSelected
                          ? "bg-surface border border-emerald-500/60 dark:border-[#D8EC8D] ring-2 ring-emerald-500/30 dark:ring-[#D8EC8D]/30 shadow-sm scale-105"
                          : "border border-transparent hover:bg-surface/50 opacity-60 hover:opacity-100"
                        }`}
                    >
                      <PlatformIcon platform={p.key} size={20} useBrandColor={true} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Platform Context Badge */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 dark:text-[#D8EC8D] bg-emerald-500/10 dark:bg-[#D8EC8D]/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 dark:border-[#D8EC8D]/25">
              <Check className="w-3 h-3 shrink-0 text-emerald-600 dark:text-[#D8EC8D]" />
              <span>{activePlatform.contentLabel}: {activePlatform.description}</span>
            </div>

            {/* Input Box with Paste & Clear */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-fg-muted">
                <span>Creator Handle or Link</span>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="text-[11px] text-emerald-700 dark:text-[#D8EC8D] font-semibold hover:underline flex items-center gap-1"
                >
                  <ClipboardPaste className="w-3 h-3" />
                  Paste
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder={activePlatform.placeholder}
                  className="w-full pl-3.5 pr-20 py-2.5 sm:py-3 rounded-2xl bg-surface-raised border border-border text-fg placeholder:text-fg-muted/60 focus:outline-none focus:border-emerald-500 dark:focus:border-[#D8EC8D] text-sm font-medium transition-all"
                />

                <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
                  {handleInput && (
                    <button
                      type="button"
                      onClick={() => setHandleInput("")}
                      className="p-1 rounded-lg text-fg-muted hover:text-fg transition-colors"
                      title="Clear input"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isDetecting ? (
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-[#D8EC8D] font-semibold">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    </div>
                  ) : detectedProfile ? (
                    <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded-md border border-emerald-500/30">
                      <Check className="w-2.5 h-2.5" />
                      Live
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Sample test chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-fg-muted font-medium">Quick Try:</span>
                {activePlatform.samples.map((sample) => (
                  <button
                    key={sample.handle}
                    type="button"
                    onClick={() => {
                      setHandleInput(sample.handle);
                    }}
                    className="px-2 py-0.5 rounded-md bg-surface-raised hover:bg-surface text-fg-muted hover:text-fg text-[11px] font-medium border border-border transition-all"
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
                className="rounded-2xl bg-surface-raised border border-border p-4 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-border shrink-0 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getSafeImageUrl(detectedProfile.avatarUrl)}
                      alt={detectedProfile.handle}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-fg text-sm truncate">{detectedProfile.handle}</span>
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#D8EC8D] shrink-0" />
                    </div>
                    <div className="text-xs text-fg-muted flex items-center gap-2 mt-0.5">
                      <span>{activePlatform.label} Profile</span>
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
                          className={`p-3 rounded-xl border text-left transition-all ${seedCurrentPost
                              ? "bg-emerald-500/15 dark:bg-[#D8EC8D]/15 border-emerald-500 dark:border-[#D8EC8D] text-fg ring-1 ring-emerald-500 dark:ring-[#D8EC8D]"
                              : "bg-surface border-border text-fg-muted hover:text-fg hover:border-fg-muted/40"
                            }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-[#D8EC8D]">
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>Start Now on Latest</span>
                          </div>
                          <div className="text-[10px] text-fg-muted mt-1 leading-tight">
                            Slot #1 boosts this video immediately; remaining slots wait for next uploads.
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSeedCurrentPost(false)}
                          className={`p-3 rounded-xl border text-left transition-all ${!seedCurrentPost
                              ? "bg-sky-500/15 border-sky-500 text-fg ring-1 ring-sky-500"
                              : "bg-surface border-border text-fg-muted hover:text-fg hover:border-fg-muted/40"
                            }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Wait for Next Upload</span>
                          </div>
                          <div className="text-[10px] text-fg-muted mt-1 leading-tight">
                            All {slotCount} slots wait and trigger only when you post brand new content.
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : isDetecting ? (
              <div className="p-6 rounded-2xl bg-surface-raised border border-border text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-emerald-600 dark:text-[#D8EC8D] animate-spin mx-auto" />
                <div className="text-xs text-fg font-medium">Detecting profile & recent uploads...</div>
                <div className="text-[11px] text-fg-muted">Connecting to public platform feed</div>
              </div>
            ) : null}

            {detectionError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{detectionError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 3 Presets & Activation (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl bg-surface border border-border p-5 sm:p-6 space-y-6 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-fg flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-[#D8EC8D]" />
                Step 2: Select Growth Recipe
              </h2>
              <p className="text-xs text-fg-muted mt-1">
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
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${isSelected
                        ? p.themeClasses.activeBorder
                        : "bg-surface-raised border-border hover:border-fg-muted/40 hover:bg-surface"
                      }`}
                  >
                    {p.isRecommended && (
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#D8EC8D] text-black shadow-md">
                        Recommended
                      </span>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${p.themeClasses.iconBg}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${p.themeClasses.badge}`}>
                          {p.badge}
                        </span>
                      </div>

                      <div>
                        <div className="font-bold text-fg text-sm">{p.name}</div>
                        <div className="hidden sm:block text-[11px] text-fg-muted leading-snug mt-0.5">{p.description}</div>
                      </div>

                      {/* Deliverables Breakdown */}
                      <div className="space-y-1.5 pt-2 border-t border-border text-xs">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[11px] text-fg-muted">
                            <Eye className="w-3 h-3 text-sky-500" /> Views:
                          </span>
                          <span className="font-bold text-fg">{formatIndianNumber(p.metrics.views)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[11px] text-fg-muted">
                            <Heart className="w-3 h-3 text-rose-500" /> Likes:
                          </span>
                          <span className="font-bold text-fg">{formatIndianNumber(p.metrics.likes)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[11px] text-fg-muted">
                            <Share2 className="w-3 h-3 text-emerald-500" /> Shares:
                          </span>
                          <span className="font-bold text-fg">{formatIndianNumber(p.metrics.shares)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[11px] text-fg-muted">
                            <Clock className="w-3 h-3 text-amber-500" /> Pacing:
                          </span>
                          <span className="font-semibold text-[10px] text-fg">{p.runsCount} waves / {p.durationHours}h</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-border flex items-baseline justify-between">
                      <span className="text-[11px] text-fg-muted">Per Upload</span>
                      <span className="text-base font-extrabold text-fg">₹{p.pricePerSlot}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Step 3: Slot Count Selector */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-fg font-bold flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600 dark:text-[#D8EC8D]" />
                  Step 3: Number of Uploads to Auto-Boost
                </span>
                <span className="font-extrabold text-emerald-700 dark:text-[#D8EC8D] text-sm">{slotCount} Posts</span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[3, 5, 10, 15, 20].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setSlotCount(cnt)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${slotCount === cnt
                        ? "bg-[#D8EC8D]/25 dark:bg-[#D8EC8D]/20 text-emerald-900 dark:text-[#D8EC8D] border-emerald-500 dark:border-[#D8EC8D] shadow-sm font-extrabold"
                        : "bg-surface-raised border-border text-fg-muted hover:text-fg hover:bg-surface"
                      }`}
                  >
                    {cnt} Posts
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-surface-raised border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-fg-muted">
                <span>Estimated Total Reach:</span>
                <span className="font-bold text-fg">
                  {formatIndianNumber(selectedPreset.metrics.views * slotCount)} Views • {formatIndianNumber(selectedPreset.metrics.likes * slotCount)} Likes
                </span>
              </div>
            </div>

            {/* Total Quote & Activation CTA */}
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
                  <div className={`text-sm sm:text-base font-extrabold ${hasSufficientBalance ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    ₹{formatIndianNumber(userBalance)}
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
                    onClick={handlePurchase}
                    className="flex-1 py-3.5 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md bg-[#D8EC8D] text-black hover:brightness-105 active:scale-[0.99] cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Activating Autopilot...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-current text-black" />
                        <span>Activate Autopilot (₹{formatIndianNumber(totalCost)})</span>
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={`/wallet?amount=${balanceShortfall}&redirect=/packages/autopilot`}
                    className="flex-1 py-3.5 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer"
                  >
                    <span>Top Up ₹{formatIndianNumber(balanceShortfall)} to Wallet & Activate</span>
                    <ArrowRight className="w-4 h-4" />
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
            <h2 className="text-xl sm:text-2xl font-extrabold text-fg flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-emerald-600 dark:text-[#D8EC8D]" />
              Active Autopilot Subscriptions
            </h2>
            <p className="text-xs text-fg-muted mt-0.5">
              Monitor reserved slots, auto-detected videos, and real-time drip sub-orders.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-surface-raised p-1 rounded-xl border border-border text-xs">
              <button
                type="button"
                onClick={() => setPackageFilter("ALL")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${packageFilter === "ALL" ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
                  }`}
              >
                All ({autopilotPackages.length})
              </button>
              <button
                type="button"
                onClick={() => setPackageFilter("ACTIVE")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${packageFilter === "ACTIVE" ? "bg-emerald-500/15 text-emerald-700 dark:text-[#D8EC8D] shadow-sm font-bold" : "text-fg-muted hover:text-fg"
                  }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setPackageFilter("COMPLETED")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${packageFilter === "COMPLETED" ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
                  }`}
              >
                Past
              </button>
            </div>

            <button
              type="button"
              onClick={fetchPackages}
              className="p-2 rounded-xl bg-surface border border-border text-fg-muted hover:text-fg transition-all"
              title="Refresh subscriptions"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingPackages ? "animate-spin text-emerald-500" : ""}`} />
            </button>
          </div>
        </div>

        {isLoadingPackages ? (
          <div className="p-12 text-center text-fg-muted text-sm flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 dark:text-[#D8EC8D]" />
            <span>Loading active Autopilot subscriptions...</span>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="p-12 rounded-3xl bg-surface border border-border text-center space-y-3 shadow-sm">
            <Bot className="w-10 h-10 text-fg-muted/40 mx-auto" />
            <div className="text-fg font-bold text-sm">No Autopilot Subscriptions Found</div>
            <p className="text-xs text-fg-muted max-w-sm mx-auto">
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
                <div key={pkg.id} className="rounded-3xl bg-surface border border-border overflow-hidden space-y-5 p-5 sm:p-6 shadow-sm">
                  {/* Package Meta Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-surface-raised border border-border flex items-center justify-center shrink-0">
                        <PlatformIcon platform={pkg.platform} className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-fg flex items-center gap-2">
                          <span>{pkg.handle.startsWith("@") ? pkg.handle : `@${pkg.handle}`}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D8EC8D]/20 text-emerald-900 dark:text-[#D8EC8D] border border-[#D8EC8D]/30">
                            {preset.name}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pkg.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                            }`}>
                            {pkg.status}
                          </span>
                        </div>
                        <div className="text-xs text-fg-muted mt-0.5">
                          {claimedSlots} of {totalSlots} uploads boosted ({percentComplete}%) • Reserved: ₹{formatIndianNumber(pkg.reserveTotal)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {pkg.status === "ACTIVE" && (
                        <button
                          type="button"
                          disabled={syncingPackageId === pkg.id}
                          onClick={() => handleSyncFeed(pkg.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-[#D8EC8D] border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
                          title="Manually check creator feed for new uploads right now"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncingPackageId === pkg.id ? "animate-spin" : ""}`} />
                          <span>{syncingPackageId === pkg.id ? "Checking..." : "Sync Feeds"}</span>
                        </button>
                      )}

                      {pkg.status === "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => setCancelModalPackage(pkg)}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Cancel & Refund</span>
                        </button>
                      )}

                      <div className="hidden sm:flex items-center gap-1.5 text-xs text-fg-muted bg-surface-raised px-3 py-1.5 rounded-xl border border-border">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Poller 60s Sync</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-fg-muted font-medium">
                      <span>Campaign Progress</span>
                      <span className="font-bold text-fg">{claimedSlots} / {totalSlots} Posts Claimed</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-raised overflow-hidden border border-border">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-[#D8EC8D] transition-all duration-500"
                        style={{ width: `${percentComplete}%` }}
                      />
                    </div>
                  </div>

                  {/* Slots Timeline Grid (Mobile Responsive) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {pkg.slots?.map((slot) => {
                      const isClaimed = slot.status === "ACTIVE" || slot.status === "COMPLETED";
                      const isExpanded = !!expandedSlots[slot.id];
                      const executions = slot.executions || [];

                      return (
                        <div
                          key={slot.id}
                          className={`rounded-2xl border transition-all p-4 space-y-3 ${slot.status === "COMPLETED"
                              ? "bg-emerald-500/5 border-emerald-500/30 shadow-sm"
                              : slot.status === "ACTIVE"
                                ? "bg-sky-500/5 border-sky-500/30 shadow-sm"
                                : "bg-surface-raised border-dashed border-border"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-fg flex items-center gap-1.5">
                              <span>Slot #{slot.slotNumber}</span>
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${slot.status === "COMPLETED"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                  : slot.status === "ACTIVE"
                                    ? "bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30"
                                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
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
                                <div className="w-9 h-9 rounded-xl bg-surface-raised border border-border flex items-center justify-center shrink-0">
                                  <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-current" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-fg truncate">
                                    Media: {slot.mediaKey}
                                  </div>
                                  <a
                                    href={getSafeLink(slot.targetUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold hover:underline flex items-center gap-1 truncate"
                                  >
                                    <span>Open Post</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleSlotDrawer(slot.id)}
                                className="w-full mt-2 py-2 px-3 rounded-xl bg-surface border border-border hover:bg-surface-raised text-fg text-[11px] font-semibold flex items-center justify-between transition-all"
                              >
                                <span>{executions.length} Drip Sub-Orders</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-fg-muted" />}
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
                                        className="p-2.5 rounded-xl bg-surface border border-border text-[11px] flex items-center justify-between shadow-sm"
                                      >
                                        <div className="space-y-0.5">
                                          <div className="font-bold text-fg">
                                            {exec.rule?.service?.name || "Delivery Batch"}
                                          </div>
                                          <div className="text-[10px] text-fg-muted flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>Wave #{exec.seq} • {new Date(exec.executeAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-extrabold text-fg">+{exec.quantity}</div>
                                          <div className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
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
                              <Radio className="w-5 h-5 text-amber-500 mx-auto animate-pulse" />
                              <div className="text-xs text-fg font-bold">Standing By For Upload</div>
                              <div className="text-[10px] text-fg-muted max-w-[200px] mx-auto">
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
      <div className="rounded-3xl bg-surface border border-border p-6 sm:p-8 space-y-6 shadow-sm">
        <div>
          <h3 className="text-lg font-bold text-fg flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-600 dark:text-[#D8EC8D]" />
            Frequently Asked Questions
          </h3>
          <p className="text-xs text-fg-muted mt-1">
            Everything you need to know about hands-free automated growth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FAQS.map((faq, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-surface-raised border border-border space-y-2"
            >
              <div className="text-sm font-bold text-fg flex items-start gap-2">
                <span className="text-emerald-600 dark:text-[#D8EC8D] font-mono">Q:</span>
                <span>{faq.q}</span>
              </div>
              <p className="text-xs text-fg-muted leading-relaxed pl-5">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel Subscription Confirmation Modal */}
      <AnimatePresence>
        {cancelModalPackage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-3xl bg-surface border border-border p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/30">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-fg">Cancel Autopilot?</h4>
                    <p className="text-xs text-fg-muted">{cancelModalPackage.handle.startsWith("@") ? cancelModalPackage.handle : `@${cancelModalPackage.handle}`}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelModalPackage(null)}
                  className="p-1 rounded-lg text-fg-muted hover:text-fg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-fg leading-relaxed">
                <p>
                  Are you sure you want to cancel this Autopilot subscription?
                </p>
                {(() => {
                  const cancelSlotsTotal = cancelModalPackage.slots?.length || 1;
                  const cancelAvailableSlots = cancelModalPackage.slots?.filter((s) => s.status === "AVAILABLE").length || 0;
                  const cancelPricePerSlot = (cancelModalPackage.reserveTotal || 0) / cancelSlotsTotal;
                  const cancelExactRefund = Math.round(cancelAvailableSlots * cancelPricePerSlot);

                  return (
                    <div className="p-3.5 rounded-xl bg-surface-raised border border-border space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-fg-muted">Total Posts Reserved:</span>
                        <span className="font-bold text-fg">{cancelSlotsTotal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-fg-muted">Unconsumed Waiting Posts:</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {cancelAvailableSlots} of {cancelSlotsTotal} Posts
                        </span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-border">
                        <span className="text-fg-muted font-medium">Instant Wallet Refund:</span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹{formatIndianNumber(cancelExactRefund)} (100% of Unused)
                        </span>
                      </div>
                    </div>
                  );
                })()}
                <p className="text-[11px] text-fg-muted">
                  The unused balance will be refunded back to your wallet immediately in an atomic transaction.
                </p>
              </div>

              {cancelError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                  {cancelError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalPackage(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-surface-raised hover:bg-surface border border-border text-fg text-xs font-semibold transition-all"
                >
                  Keep Subscription
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleCancelPackage}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md"
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
