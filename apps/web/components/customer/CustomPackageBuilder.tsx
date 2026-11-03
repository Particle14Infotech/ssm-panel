"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { GlassCard } from "@/components/shared/GlassCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatIndianNumber } from "@/lib/numberFormat";
import {
  distributeOrganicPacing,
  type CustomCampaignQuoteInput,
} from "@smm/contracts";
import * as XLSX from "xlsx";
import {
  Boxes,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Wallet,
  CheckCircle2,
  RefreshCw,
  Check,
  Sparkles,
  Link2,
  Upload,
  FileSpreadsheet,
  Trash2,
  Download,
  Info,
  TrendingUp,
  Heart,
  Eye,
  Share2,
  Repeat,
  AtSign,
  MessageSquare,
  Plus,
  Sliders,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ServicePreset {
  id: string;
  name: string;
  category: "views" | "likes" | "shares" | "reposts" | "mentions" | "comments";
  defaultQty: number;
  icon: any;
  description: string;
}

const DEFAULT_METRIC_PRESETS: ServicePreset[] = [
  {
    id: "views",
    name: "Reel / Video Views",
    category: "views",
    defaultQty: 15000,
    icon: Eye,
    description: "High-retention algorithm views to boost reel watch time",
  },
  {
    id: "likes",
    name: "Reel Likes",
    category: "likes",
    defaultQty: 738,
    icon: Heart,
    description: "Real profile post & reel likes to elevate engagement ratio",
  },
  {
    id: "shares",
    name: "Direct Shares",
    category: "shares",
    defaultQty: 60,
    icon: Share2,
    description: "Direct message & story shares to trigger viral algorithm reach",
  },
  {
    id: "reposts",
    name: "Reposts / Saves",
    category: "reposts",
    defaultQty: 26,
    icon: Repeat,
    description: "Bookmarked saves & reposts showing high content value",
  },
  {
    id: "mentions",
    name: "Story / Comment Mentions",
    category: "mentions",
    defaultQty: 10,
    icon: AtSign,
    description: "Targeted account mentions to draw niche audience attention",
  },
  {
    id: "comments",
    name: "Custom Comments",
    category: "comments",
    defaultQty: 20,
    icon: MessageSquare,
    description: "Authentic custom comments tailored to your content",
  },
];

export function CustomPackageBuilder() {
  const router = useRouter();
  const { user, services, createCustomCampaign } = useCustomer();

  // Step 1: Link & Platform
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");
  const [detectedType, setDetectedType] = useState<string | null>(null);

  // Step 2: Selected metrics & quantities
  const [activeMetrics, setActiveMetrics] = useState<Record<string, boolean>>({
    views: true,
    likes: true,
    shares: true,
    reposts: true,
    mentions: true,
    comments: true,
  });

  const [metricQuantities, setMetricQuantities] = useState<Record<string, number>>({
    views: 15000,
    likes: 738,
    shares: 60,
    reposts: 26,
    mentions: 10,
    comments: 15,
  });

  const [selectedServiceOverrides, setSelectedServiceOverrides] = useState<Record<string, string>>({});
  const [targetMentionsText, setTargetMentionsText] = useState("@creator1, @fashion_hub, @reels_daily");

  // Step 3: Custom Comments Dual-Mode
  const [commentsMode, setCommentsMode] = useState<"MANUAL" | "EXCEL">("MANUAL");
  const [manualCommentsText, setManualCommentsText] = useState(
    "Super clean editing! 🔥\nLove this perspective 👏\nWhere is this filmed? Amazing!\nSaved this for later 🙌\nBest reel I've seen today ❤️\nIncredible quality! 🚀\nKeep it up brother 🔥\nPure gold right here 💎\nWatching this on repeat 🔁\n10/10 execution 💯"
  );
  const [excelComments, setExcelComments] = useState<string[]>([]);
  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const [excelParseError, setExcelParseError] = useState<string | null>(null);
  const [showCommentsPreview, setShowCommentsPreview] = useState(false);

  // Step 4: Delivery Schedule (7 to 10 Days)
  const [durationDays, setDurationDays] = useState<number>(7);
  const [pacingStrategy, setPacingStrategy] = useState<"ORGANIC_CURVE" | "EVEN">("ORGANIC_CURVE");
  const [showScheduleDetails, setShowScheduleDetails] = useState(false);

  // Step 5: Submission & Flow
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);

  // Auto-detect platform and media type from Target URL
  useEffect(() => {
    const url = targetUrl.trim().toLowerCase();
    if (!url) {
      setDetectedType(null);
      return;
    }

    if (url.includes("instagram.com")) {
      setSelectedPlatform("instagram");
      if (url.includes("/reel/") || url.includes("/reels/")) {
        setDetectedType("Instagram Reel");
      } else if (url.includes("/p/")) {
        setDetectedType("Instagram Post");
      } else {
        setDetectedType("Instagram Link");
      }
    } else if (url.includes("tiktok.com")) {
      setSelectedPlatform("tiktok");
      setDetectedType("TikTok Video");
    } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
      setSelectedPlatform("youtube");
      if (url.includes("/shorts/")) {
        setDetectedType("YouTube Short");
      } else {
        setDetectedType("YouTube Video");
      }
    } else if (url.includes("facebook.com") || url.includes("fb.watch")) {
      setSelectedPlatform("facebook");
      setDetectedType("Facebook Video / Post");
    } else if (url.includes("twitter.com") || url.includes("x.com")) {
      setSelectedPlatform("x");
      setDetectedType("X (Twitter) Post");
    } else if (url.includes("t.me")) {
      setSelectedPlatform("telegram");
      setDetectedType("Telegram Channel / Post");
    } else {
      setDetectedType(null);
    }
  }, [targetUrl]);

  // Clean comment list
  const activeCommentsList = useMemo(() => {
    if (commentsMode === "EXCEL") {
      return excelComments;
    }
    return manualCommentsText
      .split("\n")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }, [commentsMode, excelComments, manualCommentsText]);

  // Keep comment quantity in sync with actual comments count when comments are active
  useEffect(() => {
    if (activeMetrics.comments && activeCommentsList.length > 0) {
      setMetricQuantities((prev) => ({
        ...prev,
        comments: activeCommentsList.length,
      }));
    }
  }, [activeMetrics.comments, activeCommentsList.length]);

  // Handle Excel/CSV file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelParseError(null);
    setExcelFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const extractedComments: string[] = [];
        for (const row of rawJson) {
          if (Array.isArray(row) && row.length > 0) {
            const cellValue = String(row[0] || "").trim();
            // Skip headers like "Comment" or "Text"
            if (
              cellValue.length > 0 &&
              !cellValue.toLowerCase().startsWith("comment") &&
              !cellValue.toLowerCase().startsWith("text")
            ) {
              extractedComments.push(cellValue);
            }
          }
        }

        if (extractedComments.length === 0) {
          setExcelParseError("No valid comments found in column A. Please check file format.");
          setExcelComments([]);
        } else {
          setExcelComments(extractedComments);
          setMetricQuantities((prev) => ({
            ...prev,
            comments: extractedComments.length,
          }));
        }
      } catch (err: any) {
        setExcelParseError("Failed to parse file: " + (err.message || "Invalid format"));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Download sample excel template
  const downloadSampleExcel = () => {
    const sampleRows = [
      ["Comments (One per row)"],
      ["This is incredible content! 🔥"],
      ["Super helpful, thanks for sharing 🙌"],
      ["Love the editing style here ❤️"],
      ["Where did you learn this? Brilliant!"],
      ["Can't wait for part 2 🚀"],
      ["Bookmark and follow 👍"],
      ["The quality on this reel is insane 👏"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comments");
    XLSX.writeFile(wb, "smm-sample-comments.xlsx");
  };

  // Available catalog services for selected platform
  const platformServices = useMemo(() => {
    return services.filter((s) => {
      const p = (s.platform || "general").toLowerCase();
      const targetP = selectedPlatform.toLowerCase();
      const match =
        p === "all" ||
        p === targetP ||
        (targetP === "x" && (p.includes("twitter") || p.includes("x")));
      return match && s.status === "ACTIVE";
    });
  }, [services, selectedPlatform]);

  // Match the best service for each metric category
  const resolvedServices = useMemo(() => {
    const map: Record<string, any> = {};

    const findService = (keywords: string[], fallbackType?: string) => {
      // Exclude services that belong to other networks (e.g., Threads) when on Instagram
      const filtered = platformServices.filter((s) => {
        const lower = (s.name || "").toLowerCase();
        if (selectedPlatform === "instagram" && lower.includes("threads")) return false;
        return true;
      });

      // Find candidates matching keywords
      const matched = filtered.filter((s) => {
        const name = (s.displayName || s.name || "").toLowerCase();
        const cat = (s.categoryName || "").toLowerCase();
        return keywords.some((k) => name.includes(k) || cat.includes(k));
      });

      if (matched.length > 0) {
        // Sort candidates by lowest minQty first, then lowest ratePer1000
        matched.sort((a, b) => {
          const minA = a.minQty || 10;
          const minB = b.minQty || 10;
          if (minA !== minB) return minA - minB;
          return Number(a.ratePer1000) - Number(b.ratePer1000);
        });
        return matched[0];
      }

      return (
        filtered.find((s) => s.serviceType === fallbackType) ||
        filtered[0] ||
        platformServices[0]
      );
    };

    map.views =
      platformServices.find((s) => s.id === selectedServiceOverrides.views) ||
      findService(["reel view", "reels view", "auto view", "instagram view", "views"], "VIEWS");

    map.likes =
      platformServices.find((s) => s.id === selectedServiceOverrides.likes) ||
      findService(["instagram like", "reel like", "post like", "likes"], "LIKES");

    map.shares =
      platformServices.find((s) => s.id === selectedServiceOverrides.shares) ||
      findService(["instagram share", "shares", "share", "story share"]);

    map.reposts =
      platformServices.find((s) => s.id === selectedServiceOverrides.reposts) ||
      findService(["instagram save", "saves", "save", "repost", "bookmark"]);

    map.mentions =
      platformServices.find((s) => s.id === selectedServiceOverrides.mentions) ||
      findService(["single person", "instagram mention", "mention", "tag"]);

    map.comments =
      platformServices.find((s) => s.id === selectedServiceOverrides.comments) ||
      findService(["instagram custom comments", "custom comment", "comments", "comment"], "CUSTOM_COMMENTS");

    return map;
  }, [platformServices, selectedPlatform, selectedServiceOverrides]);

  // Itemized costs and total calculation
  const itemizedPricing = useMemo(() => {
    let total = 0;
    const items: Array<{
      key: string;
      label: string;
      service: any;
      qty: number;
      ratePer1000: number;
      cost: number;
    }> = [];

    DEFAULT_METRIC_PRESETS.forEach((preset) => {
      if (activeMetrics[preset.id]) {
        const s = resolvedServices[preset.id];
        const qty = metricQuantities[preset.id] || preset.defaultQty;
        const rate = s ? Number(s.ratePer1000) : 50;
        const cost = Math.ceil((qty * rate) / 1000);
        total += cost;

        items.push({
          key: preset.id,
          label: preset.name,
          service: s,
          qty,
          ratePer1000: rate,
          cost,
        });
      }
    });

    return { total, items };
  }, [activeMetrics, metricQuantities, resolvedServices]);

  // Schedule Timeline Breakdown across configured days
  const scheduleTimeline = useMemo(() => {
    const days = durationDays;
    const dailyBreakdowns: Array<{
      day: number;
      metrics: Record<string, number>;
      totalActions: number;
    }> = Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      metrics: {},
      totalActions: 0,
    }));

    itemizedPricing.items.forEach((item) => {
      const pacing = distributeOrganicPacing(item.qty, days, pacingStrategy);
      pacing.forEach((dayQty, dayIndex) => {
        dailyBreakdowns[dayIndex].metrics[item.key] = dayQty;
        dailyBreakdowns[dayIndex].totalActions += dayQty;
      });
    });

    return dailyBreakdowns;
  }, [durationDays, itemizedPricing.items, pacingStrategy]);

  // Balance Check
  const currentBalance = Number(user?.balance || 0);
  const isBalanceSufficient = currentBalance >= itemizedPricing.total;
  const balanceDifference = Math.max(0, itemizedPricing.total - currentBalance);

  // Submit Order
  const handleLaunchPackage = async () => {
    if (!targetUrl.trim()) {
      setErrorMessage("Please enter a target link for your package.");
      return;
    }
    if (itemizedPricing.items.length === 0) {
      setErrorMessage("Please select at least one service to include in your package.");
      return;
    }
    if (!isBalanceSufficient) {
      setErrorMessage(`Insufficient wallet balance. Please add funds (needs ₹${balanceDifference.toFixed(2)} more).`);
      return;
    }

    for (const item of itemizedPricing.items) {
      if (item.service && item.qty < item.service.minQty) {
        setErrorMessage(`${item.label}: Minimum required is ${item.service.minQty} units (you have ${item.qty}).`);
        return;
      }
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const campaignPayload: CustomCampaignQuoteInput = {
        targetUrl: targetUrl.trim(),
        platform: selectedPlatform as any,
        durationDays,
        extraHours: 0,
        pacingStrategy,
        services: itemizedPricing.items.map((item) => ({
          serviceId: item.service?.id || "1042",
          categoryKey: item.key,
          name: item.label,
          quantity: item.qty,
          customComments: item.key === "comments" ? activeCommentsList : undefined,
          targetMentions:
            item.key === "mentions"
              ? targetMentionsText.split(",").map((m) => m.trim()).filter(Boolean)
              : undefined,
        })),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      };

      const result = await createCustomCampaign(campaignPayload);
      if (result.success) {
        setOrderSuccess(result);
        setConfirmModalOpen(false);
      } else {
        setErrorMessage(result.error || "Failed to launch custom package. Please try again.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred while launching package.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Success Notification */}
      {orderSuccess && (
        <GlassCard className="p-6 md:p-8 border-[#D8EC8D]/40 bg-[#171e00]/20">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/20 text-[#D8EC8D] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-fg font-bold text-lg">Custom Campaign Launched!</h3>
                <p className="text-xs text-fg-2 mt-0.5">
                  Package ID: <span className="font-mono text-[#D8EC8D]">#{orderSuccess.packageId?.slice(0, 10)}</span> · Paced over {durationDays} days.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/packages"
                className="px-4 py-2.5 rounded-xl bg-[#D8EC8D] text-[#171e00] font-bold text-xs hover:bg-[#c9e072] transition-colors"
              >
                Track Growth Timeline
              </Link>
              <button
                type="button"
                onClick={() => setOrderSuccess(null)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-fg transition-colors"
              >
                Build Another Package
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Main Grid: Form Left, Summary & Schedule Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Target Link & Platform */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent/15 text-[#D8EC8D] flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h2 className="text-sm font-bold text-fg tracking-wide uppercase">
                  Target Link & Platform
                </h2>
              </div>
              {detectedType && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-accent/15 text-[#D8EC8D] border border-accent/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {detectedType}
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-fg-2 mb-1.5 flex items-center justify-between">
                  <span>Enter Reel, Video, or Post URL</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const clip = await navigator.clipboard.readText();
                        if (clip) setTargetUrl(clip);
                      } catch {}
                    }}
                    className="text-[11px] text-[#D8EC8D] hover:underline"
                  >
                    Paste from clipboard
                  </button>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://www.instagram.com/reel/C8XYZ123..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-border text-fg placeholder-slate-500 text-sm focus:outline-none focus:border-[#D8EC8D] transition-colors"
                  />
                </div>
              </div>

              {/* Platform Selector Pills */}
              <div>
                <div className="text-[11px] font-medium text-slate-400 mb-2">
                  Platform (Auto-detected from link):
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "instagram", name: "Instagram" },
                    { id: "tiktok", name: "TikTok" },
                    { id: "youtube", name: "YouTube" },
                    { id: "facebook", name: "Facebook" },
                    { id: "x", name: "X" },
                  ].map((p) => {
                    const active = selectedPlatform === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlatform(p.id)}
                        title={p.name}
                        aria-label={p.name}
                        className={`flex items-center justify-center p-2.5 sm:p-3 min-w-[42px] min-h-[42px] rounded-xl text-xs font-semibold transition-all ${
                          active
                            ? "bg-[#D8EC8D] text-[#171e00] font-bold shadow-sm"
                            : "bg-white/5 text-fg-2 hover:bg-white/10"
                        }`}
                      >
                        <PlatformIcon platform={p.id} size={20} useBrandColor={active} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Section 2: Custom Multi-Service Selection */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent/15 text-[#D8EC8D] flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h2 className="text-sm font-bold text-fg tracking-wide uppercase">
                  Select Custom Services & Quantities
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                {Object.values(activeMetrics).filter(Boolean).length} of {DEFAULT_METRIC_PRESETS.length} active
              </span>
            </div>

            <div className="space-y-4">
              {DEFAULT_METRIC_PRESETS.map((preset) => {
                const isEnabled = activeMetrics[preset.id];
                const currentQty = metricQuantities[preset.id] || preset.defaultQty;
                const IconComponent = preset.icon;
                const matchedService = resolvedServices[preset.id];

                return (
                  <div
                    key={preset.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isEnabled
                        ? "bg-white/[0.04] border-accent/30"
                        : "bg-white/[0.01] border-slate-200/60 dark:border-white/5 opacity-60 hover:opacity-90"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <label className="mt-0.5 relative flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) =>
                              setActiveMetrics((prev) => ({
                                ...prev,
                                [preset.id]: e.target.checked,
                              }))
                            }
                            className="sr-only"
                          />
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                              isEnabled
                                ? "bg-[#D8EC8D] border-[#D8EC8D] text-[#171e00]"
                                : "border-slate-500 bg-transparent"
                            }`}
                          >
                            {isEnabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </label>

                        <div>
                          <div className="flex items-center gap-2">
                            <IconComponent className="w-4 h-4 text-[#D8EC8D]" />
                            <span className="text-sm font-bold text-fg">
                              {preset.name}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {preset.description}
                          </p>
                          {matchedService && (
                            <div className="text-[10px] text-slate-500 font-mono mt-1">
                              Rate: ₹{Number(matchedService.ratePer1000).toFixed(2)}/1k · {matchedService.displayName || matchedService.name}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quantity Input */}
                      {isEnabled && preset.id !== "comments" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <input
                              type="number"
                              min={matchedService?.minQty || 1}
                              value={currentQty}
                              onChange={(e) =>
                                setMetricQuantities((prev) => ({
                                  ...prev,
                                  [preset.id]: Math.max(1, parseInt(e.target.value, 10) || 0),
                                }))
                              }
                              className={`w-24 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-black/50 border text-fg font-mono text-sm text-right focus:outline-none ${
                                matchedService && currentQty < matchedService.minQty
                                  ? "border-red-500 focus:border-red-400"
                                  : "border-border focus:border-[#D8EC8D]"
                              }`}
                            />
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {formatIndianNumber(currentQty)} units
                            </div>
                            {matchedService && currentQty < matchedService.minQty && (
                              <div className="text-[10px] text-red-400 font-bold mt-0.5">
                                Min: {matchedService.minQty}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mentions Handles Input */}
                    {isEnabled && preset.id === "mentions" && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <label className="text-[11px] font-medium text-fg-2 mb-1 block">
                          Target Mention Accounts (comma-separated):
                        </label>
                        <input
                          type="text"
                          value={targetMentionsText}
                          onChange={(e) => setTargetMentionsText(e.target.value)}
                          placeholder="@account1, @account2, @account3..."
                          className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-black/40 border border-border text-xs text-fg placeholder-slate-500 focus:outline-none focus:border-[#D8EC8D]"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Section 3: Custom Comments Dual-Mode */}
          {activeMetrics.comments && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-accent/15 text-[#D8EC8D] flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h2 className="text-sm font-bold text-fg tracking-wide uppercase">
                    Custom Comments Source
                  </h2>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/15 text-[#D8EC8D]">
                  {activeCommentsList.length} Comments Loaded
                </span>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-black/40 rounded-xl border border-border mb-4">
                <button
                  type="button"
                  onClick={() => setCommentsMode("MANUAL")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    commentsMode === "MANUAL"
                      ? "bg-[#D8EC8D] text-[#171e00] font-bold"
                      : "text-fg-muted hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Line-by-Line Text
                </button>
                <button
                  type="button"
                  onClick={() => setCommentsMode("EXCEL")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    commentsMode === "EXCEL"
                      ? "bg-[#D8EC8D] text-[#171e00] font-bold"
                      : "text-fg-muted hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel / CSV File Upload</span>
                </button>
              </div>

              {commentsMode === "MANUAL" ? (
                <div className="space-y-2">
                  <label className="text-xs text-fg-2 font-medium flex items-center justify-between">
                    <span>Enter one comment per line:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setManualCommentsText(
                          "Incredible video! 🔥\nSo inspiring 🙌\nLoving this vibe ✨\nQuality content as always 👏\nBookmarked for reference ❤️"
                        )
                      }
                      className="text-[11px] text-[#D8EC8D] hover:underline"
                    >
                      Fill sample comments
                    </button>
                  </label>
                  <textarea
                    rows={5}
                    value={manualCommentsText}
                    onChange={(e) => setManualCommentsText(e.target.value)}
                    placeholder="Enter each comment on a new line..."
                    className="w-full p-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-border text-fg text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-[#D8EC8D]"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Total comments: {activeCommentsList.length}</span>
                    <span>Distributed over {durationDays} days</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* File Upload Dropzone */}
                  <div className="p-6 border-2 border-dashed border-border rounded-2xl hover:border-[#D8EC8D]/50 transition-colors text-center relative bg-slate-100 dark:bg-black/20">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-8 h-8 text-[#D8EC8D] mx-auto mb-2" />
                    <div className="text-sm font-semibold text-fg">
                      Drop Excel file here or click to browse
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports .xlsx, .xls, and .csv with comments in Column A
                    </p>
                  </div>

                  {excelParseError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{excelParseError}</span>
                    </div>
                  )}

                  {excelFileName && !excelParseError && (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-border">
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-5 h-5 text-[#D8EC8D]" />
                        <div>
                          <div className="text-xs font-semibold text-fg">{excelFileName}</div>
                          <div className="text-[10px] text-[#D8EC8D]">
                            {excelComments.length} comments successfully parsed
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setExcelFileName(null);
                          setExcelComments([]);
                        }}
                        className="text-slate-400 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Template download & Preview controls */}
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={downloadSampleExcel}
                      className="text-[#D8EC8D] hover:underline flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Sample Excel Template</span>
                    </button>

                    {activeCommentsList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCommentsPreview(!showCommentsPreview)}
                        className="text-fg-2 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 font-medium transition-colors"
                      >
                        <span>{showCommentsPreview ? "Hide" : "Preview"} Parsed Comments</span>
                        {showCommentsPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {showCommentsPreview && (
                    <div className="max-h-40 overflow-y-auto p-3 rounded-xl bg-slate-100 dark:bg-black/60 border border-border space-y-1.5 text-xs text-fg-2 font-mono">
                      {activeCommentsList.map((comm, idx) => (
                        <div key={idx} className="truncate">
                          <span className="text-slate-500 mr-2">{idx + 1}.</span>
                          {comm}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          )}

          {/* Section 4: Scheduled Delivery Distribution */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent/15 text-[#D8EC8D] flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <h2 className="text-sm font-bold text-fg tracking-wide uppercase">
                  Delivery Timeframe & Pacing Schedule
                </h2>
              </div>
              <span className="text-xs text-[#D8EC8D] font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Delivery Paced
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-fg-2">
                    Select Delivery Duration:
                  </label>
                  <span className="text-xs font-mono font-bold text-[#D8EC8D]">
                    {durationDays} {durationDays === 1 ? "Day" : "Days"} Total
                  </span>
                </div>

                {/* Popular Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 mb-3">
                  {[
                    { days: 3, label: "3 Days", tag: "Fast" },
                    { days: 5, label: "5 Days", tag: "Express" },
                    { days: 7, label: "7 Days", tag: "Popular", highlight: true },
                    { days: 10, label: "10 Days", tag: "Optimal", highlight: true },
                    { days: 14, label: "14 Days", tag: "2 Weeks" },
                    { days: 21, label: "21 Days", tag: "3 Weeks" },
                    { days: 30, label: "30 Days", tag: "Month" },
                  ].map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setDurationDays(preset.days)}
                      className={`py-2 px-1.5 rounded-xl text-center border transition-all ${
                        durationDays === preset.days
                          ? "bg-[#D8EC8D] text-[#171e00] border-[#D8EC8D] font-bold shadow-sm"
                          : "bg-white/5 border-border text-fg-2 hover:bg-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight">{preset.label}</div>
                      <div
                        className={`text-[9px] mt-0.5 font-medium ${
                          durationDays === preset.days
                            ? "text-[#171e00]/80"
                            : preset.highlight
                            ? "text-[#D8EC8D]"
                            : "text-slate-400"
                        }`}
                      >
                        {preset.tag}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom Days Slider & Number Input */}
                <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-border space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-fg-2 font-medium flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#D8EC8D]" />
                      <span>Custom Day Slider (1 to 30 Days)</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[11px]">Exact Days:</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={durationDays}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            setDurationDays(Math.max(1, Math.min(30, val)));
                          }
                        }}
                        className="w-16 px-2 py-1 rounded-lg bg-slate-100 dark:bg-black/60 border border-slate-300 dark:border-white/20 text-center font-mono text-xs text-fg font-bold focus:border-[#D8EC8D] focus:outline-none"
                      />
                    </div>
                  </div>

                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={durationDays}
                    onChange={(e) => setDurationDays(parseInt(e.target.value, 10))}
                    className="w-full accent-[#D8EC8D] cursor-pointer h-2 bg-white/10 rounded-lg"
                  />

                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>1 Day (Standard)</span>
                    <span>7 Days (Recommended)</span>
                    <span>10 Days (Extended)</span>
                    <span>20 Days</span>
                    <span>30 Days (Max)</span>
                  </div>

                  {/* Dynamic Safety Speed Advice */}
                  <div className="pt-2 border-t border-border text-[11px] flex items-center gap-2">
                    {durationDays <= 3 ? (
                      <span className="text-warning flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Fast delivery pace — recommended only for time-sensitive launches.</span>
                      </span>
                    ) : durationDays <= 7 ? (
                      <span className="text-[#D8EC8D] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>Recommended balance of rapid visibility and sustained algorithm retention.</span>
                      </span>
                    ) : durationDays <= 14 ? (
                      <span className="text-success flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>Maximum algorithm safety — high viral exploration potential over {durationDays} days.</span>
                      </span>
                    ) : (
                      <span className="text-cyan-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Long-term scheduled drip campaign — continuous engagement spread across {durationDays} days.</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Pacing Curve Strategy */}
              <div>
                <div className="text-xs font-medium text-fg-2 mb-2">
                  Pacing Strategy:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPacingStrategy("ORGANIC_CURVE")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      pacingStrategy === "ORGANIC_CURVE"
                        ? "bg-accent/15 border-[#D8EC8D] text-fg"
                        : "bg-white/5 border-border text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="text-xs font-bold text-fg flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-[#D8EC8D]" />
                      <span>Front-Loaded Viral Curve</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Higher delivery in first 48 hrs, followed by steady daily drip
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPacingStrategy("EVEN")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      pacingStrategy === "EVEN"
                        ? "bg-accent/15 border-[#D8EC8D] text-fg"
                        : "bg-white/5 border-border text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="text-xs font-bold text-fg flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#D8EC8D]" />
                      <span>Even Daily Spread</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Equal quantities delivered each day across the timeframe
                    </div>
                  </button>
                </div>
              </div>

              {/* Informational algorithm notice */}
              <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/20 text-xs text-fg-2 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#D8EC8D] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Pacing over <strong className="text-fg">{durationDays} days</strong> distributes delivery evenly over the chosen schedule.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Order Summary, Interactive Daily Schedule & Checkout (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Order Summary Glass Card */}
          <GlassCard className="p-6 sticky top-20 border-accent/30 shadow-xl">
            <h3 className="text-sm font-bold text-fg tracking-wide uppercase mb-4 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#D8EC8D]" />
              <span>Package Campaign Summary</span>
            </h3>

            {/* Target Link Pill */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-border mb-4">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Target</div>
              <div className="text-xs text-fg font-mono truncate mt-0.5">
                {targetUrl.trim() || "No link entered yet"}
              </div>
              <div className="text-[10px] text-[#D8EC8D] mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Delivered over {durationDays} days</span>
              </div>
            </div>

            {/* Itemized List */}
            <div className="space-y-2.5 pb-4 border-b border-border text-xs">
              {itemizedPricing.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between text-fg-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D8EC8D]" />
                    <span>{item.label}</span>
                    <span className="font-mono text-fg font-bold">
                      ({formatIndianNumber(item.qty)})
                    </span>
                  </div>
                  <span className="font-mono text-fg font-semibold">
                    ₹{item.cost.toFixed(2)}
                  </span>
                </div>
              ))}

              {itemizedPricing.items.length === 0 && (
                <div className="text-slate-500 text-center py-4 text-xs italic">
                  Select at least one service to preview cost
                </div>
              )}
            </div>

            {/* Total Cost */}
            <div className="py-4 border-b border-border flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Total Campaign Reserve:</span>
                <div className="text-2xl font-bold text-fg tracking-tight">
                  ₹{itemizedPricing.total.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Your Wallet Balance:</div>
                <div
                  className={`text-sm font-mono font-bold ${
                    isBalanceSufficient ? "text-[#D8EC8D]" : "text-red-400"
                  }`}
                >
                  ₹{currentBalance.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Insufficient Balance Notice */}
            {!isBalanceSufficient && (
              <div className="my-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Needs ₹{balanceDifference.toFixed(2)} more</span>
                </div>
                <Link
                  href="/wallet"
                  className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 font-bold transition-colors"
                >
                  Add Funds
                </Link>
              </div>
            )}

            {/* Interactive Schedule Forecast Accordion */}
            <div className="my-4">
              <button
                type="button"
                onClick={() => setShowScheduleDetails(!showScheduleDetails)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-fg-2 font-semibold transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#D8EC8D]" />
                  <span>View Day-by-Day Forecast (Days 1–{durationDays})</span>
                </div>
                {showScheduleDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showScheduleDetails && (
                <div className="mt-3 max-h-64 overflow-y-auto space-y-2 p-3 rounded-xl bg-slate-100 dark:bg-black/50 border border-border text-xs">
                  {scheduleTimeline.map((dayData) => (
                    <div
                      key={dayData.day}
                      className="p-2 rounded-lg bg-white/[0.02] border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-[11px]"
                    >
                      <span className="font-bold text-[#D8EC8D]">Day {dayData.day}</span>
                      <div className="flex items-center gap-3 font-mono text-fg-2">
                        {itemizedPricing.items.map((item) => {
                          const qty = dayData.metrics[item.key] || 0;
                          return (
                            <span key={item.key} title={item.label}>
                              {item.key.slice(0, 3)}: <strong className="text-fg">{formatIndianNumber(qty)}</strong>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <button
              type="button"
              disabled={submitting || itemizedPricing.items.length === 0}
              onClick={() => {
                setErrorMessage(null);
                if (!targetUrl.trim()) {
                  setErrorMessage("Please enter a target link for your package.");
                  return;
                }
                for (const item of itemizedPricing.items) {
                  if (item.service && item.qty < item.service.minQty) {
                    setErrorMessage(`${item.label}: Minimum required is ${item.service.minQty} units (you have ${item.qty}).`);
                    return;
                  }
                }
                setConfirmModalOpen(true);
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-[#D8EC8D] text-[#171e00] font-bold text-sm hover:bg-[#cbe370] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Configuring Package...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Review & Launch Custom Package</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </GlassCard>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-[#131313] border border-border shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-fg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#D8EC8D]" />
              <span>Confirm Custom Package</span>
            </h3>

            <p className="text-xs text-fg-2 leading-relaxed">
              You are about to launch a multi-service package paced organically over{" "}
              <strong className="text-fg">{durationDays} days</strong> on:
            </p>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-black/60 border border-border text-xs font-mono text-fg truncate">
              {targetUrl}
            </div>

            <div className="space-y-1.5 p-3 rounded-xl bg-white/5 border border-border text-xs text-fg-2">
              {itemizedPricing.items.map((item) => (
                <div key={item.key} className="flex justify-between">
                  <span>{item.label}:</span>
                  <span className="font-bold text-fg">{formatIndianNumber(item.qty)} units</span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between font-bold text-fg text-sm">
                <span>Total Debit:</span>
                <span className="text-[#D8EC8D]">₹{itemizedPricing.total.toFixed(2)}</span>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-fg transition-colors"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleLaunchPackage}
                className="flex-1 py-2.5 rounded-xl bg-[#D8EC8D] text-[#171e00] font-bold text-xs hover:bg-[#c9e072] transition-colors flex items-center justify-center gap-1.5"
              >
                {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Confirm & Launch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
