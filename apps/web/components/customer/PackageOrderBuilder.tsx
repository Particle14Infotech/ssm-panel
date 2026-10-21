"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { GlassCard } from "@/components/shared/GlassCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
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
  Layers,
  Sparkles,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";
import { PackageQuoteResponse } from "@smm/contracts";

const SUPPORTED_PLATFORMS = [
  { id: "instagram", name: "Instagram", placeholder: "e.g. travel_chronicles" },
  { id: "tiktok", name: "TikTok", placeholder: "e.g. dailyvlogs" },
  { id: "youtube", name: "YouTube", placeholder: "e.g. techreviewshub" },
  { id: "facebook", name: "Facebook", placeholder: "e.g. foodiespage" },
  { id: "x", name: "X (Twitter)", placeholder: "e.g. marketupdates" },
  { id: "telegram", name: "Telegram", placeholder: "e.g. dailydeals" },
];

export function PackageOrderBuilder() {
  const router = useRouter();
  const { user, services, purchasePackage } = useCustomer();

  // State: Platform & Handle
  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");
  const [handle, setHandle] = useState<string>("");

  // State: Package Duration
  const [durationDays, setDurationDays] = useState<number>(30);

  // State: Per-service workflows & per-post customization
  const [likesEnabled, setLikesEnabled] = useState<boolean>(true);
  const [likesPerPost, setLikesPerPost] = useState<number>(500);
  const [likesWindow, setLikesWindow] = useState<number>(180); // minutes

  const [viewsEnabled, setViewsEnabled] = useState<boolean>(true);
  const [viewsPerPost, setViewsPerPost] = useState<number>(1000);
  const [viewsWindow, setViewsWindow] = useState<number>(180); // minutes

  const [followersEnabled, setFollowersEnabled] = useState<boolean>(true);
  const [followersTotalQty, setFollowersTotalQty] = useState<number>(3000);
  const [followersInterval, setFollowersInterval] = useState<number>(24); // hours

  const [maxPostsToProcess, setMaxPostsToProcess] = useState<number>(20);

  // Quote & Execution State
  const [quote, setQuote] = useState<PackageQuoteResponse | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [consentRulesUnderstood, setConsentRulesUnderstood] = useState<boolean>(false);

  // Catalog service resolution for selected platform
  // Rule: Exclude Highlights, stories, and Threads from package eligible list
  const platformServices = useMemo(() => {
    return services.filter((s) => {
      const isPlatform =
        (s.platform?.toLowerCase() || "").includes(selectedPlatform) ||
        (selectedPlatform === "x" && (s.platform?.toLowerCase() || "").includes("twitter"));
      if (!isPlatform) return false;
      if (s.status && s.status !== "ACTIVE") return false;

      const lowerName = (s.displayName || s.name || "").toLowerCase();
      const lowerCat = (s.categoryName || "").toLowerCase();

      // Exclude Highlights, stories, and Threads
      if (
        lowerName.includes("highlight") ||
        lowerCat.includes("highlight") ||
        lowerName.includes("stor") ||
        lowerCat.includes("stor") ||
        lowerName.includes("thread") ||
        lowerCat.includes("thread")
      ) {
        return false;
      }
      return true;
    });
  }, [services, selectedPlatform]);

  const likeService = useMemo(() => {
    return (
      platformServices.find(
        (s) =>
          s.name.toLowerCase().includes("like") ||
          (s.displayName && s.displayName.toLowerCase().includes("like"))
      ) || platformServices[0]
    );
  }, [platformServices]);

  const viewService = useMemo(() => {
    return (
      platformServices.find(
        (s) =>
          s.name.toLowerCase().includes("view") ||
          s.name.toLowerCase().includes("reel") ||
          (s.displayName && s.displayName.toLowerCase().includes("view"))
      ) ||
      platformServices[1] ||
      platformServices[0]
    );
  }, [platformServices]);

  const followerService = useMemo(() => {
    return (
      platformServices.find(
        (s) =>
          s.name.toLowerCase().includes("follower") ||
          s.name.toLowerCase().includes("subscriber") ||
          s.name.toLowerCase().includes("member")
      ) ||
      platformServices[2] ||
      platformServices[0]
    );
  }, [platformServices]);

  // Compute Quote Server-Side
  const computeQuote = useCallback(async () => {
    const cleanHandle = handle.trim().replace(/^@/, "");
    if (!cleanHandle) {
      setQuote(null);
      setErrorMessage(null);
      setErrorRequestId(null);
      return;
    }

    setCalculating(true);
    setErrorMessage(null);
    setErrorRequestId(null);

    const postRules: any[] = [];
    if (likesEnabled && likeService) {
      postRules.push({
        serviceId: likeService.id,
        maxPosts: maxPostsToProcess,
        maxQtyPerPost: likesPerPost,
        defaultWindowMin: likesWindow,
      });
    }

    if (viewsEnabled && viewService) {
      postRules.push({
        serviceId: viewService.id,
        maxPosts: maxPostsToProcess,
        maxQtyPerPost: viewsPerPost,
        defaultWindowMin: viewsWindow,
      });
    }

    const payload: any = {
      platform: selectedPlatform,
      handle: cleanHandle,
      durationDays,
      postRules: postRules.length > 0 ? postRules : undefined,
    };

    if (followersEnabled && followerService) {
      payload.followersDrip = {
        serviceId: followerService.id,
        quantity: followersTotalQty,
        days: durationDays,
        intervalHours: followersInterval,
      };
    }

    try {
      const envUrl = process.env.NEXT_PUBLIC_API_URL || "https://smm-production-bca7.up.railway.app";
      const apiBase = envUrl.endsWith("/api/v1") ? envUrl : envUrl.replace(/\/+$/, "") + "/api/v1";

      const res = await fetch(`${apiBase}/packages/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setQuote(data);
        setErrorMessage(null);
        setErrorRequestId(null);
      } else {
        setQuote(null);
        setErrorMessage(data.message || "Unable to calculate quote.");
        setErrorRequestId(data.requestId || res.headers.get("x-request-id") || null);
      }
    } catch {
      setQuote(null);
      setErrorMessage("Network connection error while computing quote.");
      setErrorRequestId(null);
    } finally {
      setCalculating(false);
    }
  }, [
    handle,
    selectedPlatform,
    durationDays,
    likesEnabled,
    likeService,
    maxPostsToProcess,
    likesPerPost,
    likesWindow,
    viewsEnabled,
    viewService,
    viewsPerPost,
    viewsWindow,
    followersEnabled,
    followerService,
    followersTotalQty,
    followersInterval,
  ]);

  useEffect(() => {
    const timer = setTimeout(computeQuote, 350);
    return () => clearTimeout(timer);
  }, [computeQuote]);

  // Handle Purchase Submission
  const handlePurchase = async () => {
    const cleanHandle = handle.trim().replace(/^@/, "");
    if (!cleanHandle) return;
    if (!consentRulesUnderstood) {
      setErrorMessage("Please acknowledge and accept the delivery terms and rules before proceeding.");
      return;
    }

    setPurchasing(true);
    setErrorMessage(null);

    const postRules: any[] = [];
    if (likesEnabled && likeService) {
      postRules.push({
        serviceId: likeService.id,
        maxPosts: maxPostsToProcess,
        maxQtyPerPost: likesPerPost,
        defaultWindowMin: likesWindow,
      });
    }

    if (viewsEnabled && viewService) {
      postRules.push({
        serviceId: viewService.id,
        maxPosts: maxPostsToProcess,
        maxQtyPerPost: viewsPerPost,
        defaultWindowMin: viewsWindow,
      });
    }

    const payload: any = {
      platform: selectedPlatform,
      handle: cleanHandle,
      durationDays,
      consentRulesUnderstood: true,
      idempotencyKey: `pkg_pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      postRules: postRules.length > 0 ? postRules : undefined,
    };

    if (followersEnabled && followerService) {
      payload.followersDrip = {
        serviceId: followerService.id,
        quantity: followersTotalQty,
        days: durationDays,
        intervalHours: followersInterval,
      };
    }

    const res = await purchasePackage(payload);
    setPurchasing(false);

    if (res.success && res.package) {
      setConfirmModalOpen(false);
      router.push(`/packages/${res.package.id}`);
    } else {
      setErrorMessage(res.error || "Failed to purchase package.");
    }
  };

  const currentPlatformInfo = useMemo(() => {
    return SUPPORTED_PLATFORMS.find((p) => p.id === selectedPlatform) || SUPPORTED_PLATFORMS[0];
  }, [selectedPlatform]);

  const hasSufficientBalance = user.balance >= (quote?.totalCharge || 0);
  const isLargeTotal = (quote?.totalCharge || 0) > 50000;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* 1. Header & Platform Selection */}
      <GlassCard className="p-6 md:p-8 rounded-3xl border-white/10 space-y-6 bg-white/[0.02]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold text-[#D8EC8D] tracking-wider uppercase">
                Step 1
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Select Target Platform</h2>
            <p className="text-sm text-slate-400">
              Configure scheduled growth bundles and per-post triggers for your account.
            </p>
          </div>
        </div>

        {/* Platform Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {SUPPORTED_PLATFORMS.map((plat) => {
            const isSelected = selectedPlatform === plat.id;
            return (
              <button
                key={plat.id}
                type="button"
                onClick={() => setSelectedPlatform(plat.id)}
                className={`p-3.5 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center border ${
                  isSelected
                    ? "bg-[#D8EC8D]/15 border-[#D8EC8D] text-white shadow-sm"
                    : "bg-white/[0.03] border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.06] hover:border-white/15"
                }`}
              >
                <PlatformIcon platform={plat.id} size={22} />
                <span className="text-xs font-semibold">{plat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Handle Input with Disclaimer */}
        <div className="pt-2 border-t border-white/5 space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            Account Handle <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 font-mono text-sm">
              @
            </div>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/^@/, "").trim())}
              placeholder={currentPlatformInfo.placeholder}
              className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#D8EC8D] transition-colors font-mono"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/[0.02] border border-white/5 px-3 py-2 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <span>We do not verify account ownership. Delivery is fulfilled to the specified handle.</span>
          </div>
        </div>
      </GlassCard>

      {/* Empty State when no handle entered */}
      {!handle.trim() ? (
        <GlassCard className="p-10 rounded-3xl border-white/10 text-center space-y-3 bg-white/[0.01]">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
            <Boxes className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">Add your handle to configure your package</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Enter your platform username above to customize per-post triggers, delivery windows, and followers schedule.
          </p>
        </GlassCard>
      ) : (
        <>
          {/* 2. Package Configuration & Workflows */}
          <GlassCard className="p-6 md:p-8 rounded-3xl border-white/10 space-y-6 bg-white/[0.02]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-semibold text-[#D8EC8D] tracking-wider uppercase">
                  Step 2
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Configure Delivery Services</h2>
              <p className="text-sm text-slate-400">
                Set per-post quantities, execution delivery windows, and followers drip duration.
              </p>
            </div>

            {/* Duration Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Package Lifespan (Days)</label>
              <div className="grid grid-cols-4 gap-2">
                {[7, 14, 30, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDurationDays(d)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                      durationDays === d
                        ? "bg-[#D8EC8D]/15 border-[#D8EC8D] text-white"
                        : "bg-white/[0.02] border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    {d} Days
                  </button>
                ))}
              </div>
            </div>

            {/* Post Triggers: Max Posts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Max Post Triggers Allowed</span>
                <span className="font-mono text-[#D8EC8D] font-bold">{maxPostsToProcess} Posts</span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={maxPostsToProcess}
                onChange={(e) => setMaxPostsToProcess(parseInt(e.target.value, 10))}
                className="w-full accent-[#D8EC8D]"
              />
            </div>

            {/* Per-Post Workflows */}
            <div className="space-y-4 pt-2">
              {/* Likes Rule */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="likesEnabled"
                      checked={likesEnabled}
                      onChange={(e) => setLikesEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#D8EC8D] rounded"
                    />
                    <label htmlFor="likesEnabled" className="text-sm font-semibold text-white cursor-pointer">
                      Post Likes / Reactions
                    </label>
                  </div>
                  {likeService && (
                    <span className="text-xs font-mono text-slate-400">
                      ₹{Number(likeService.ratePer1000).toFixed(2)} / 1,000
                    </span>
                  )}
                </div>

                {likesEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7 pt-2 border-t border-white/5 text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-400">Quantity per Post</label>
                      <input
                        type="number"
                        min={likeService?.minQty || 10}
                        max={likeService?.maxQty || 50000}
                        step={50}
                        value={likesPerPost}
                        onChange={(e) => setLikesPerPost(parseInt(e.target.value, 10) || 50)}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-400">Delivery Window (Minutes)</label>
                      <select
                        value={likesWindow}
                        onChange={(e) => setLikesWindow(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 rounded-xl bg-[#1e2315] border border-white/10 text-white font-mono"
                      >
                        <option value={60}>60 mins (1 hour)</option>
                        <option value={120}>120 mins (2 hours)</option>
                        <option value={180}>180 mins (3 hours)</option>
                        <option value={360}>360 mins (6 hours)</option>
                        <option value={720}>720 mins (12 hours)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Views Rule */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="viewsEnabled"
                      checked={viewsEnabled}
                      onChange={(e) => setViewsEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#D8EC8D] rounded"
                    />
                    <label htmlFor="viewsEnabled" className="text-sm font-semibold text-white cursor-pointer">
                      Post Video / Reel Views
                    </label>
                  </div>
                  {viewService && (
                    <span className="text-xs font-mono text-slate-400">
                      ₹{Number(viewService.ratePer1000).toFixed(2)} / 1,000
                    </span>
                  )}
                </div>

                {viewsEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7 pt-2 border-t border-white/5 text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-400">Quantity per Post</label>
                      <input
                        type="number"
                        min={viewService?.minQty || 100}
                        max={viewService?.maxQty || 100000}
                        step={100}
                        value={viewsPerPost}
                        onChange={(e) => setViewsPerPost(parseInt(e.target.value, 10) || 100)}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-400">Delivery Window (Minutes)</label>
                      <select
                        value={viewsWindow}
                        onChange={(e) => setViewsWindow(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 rounded-xl bg-[#1e2315] border border-white/10 text-white font-mono"
                      >
                        <option value={60}>60 mins (1 hour)</option>
                        <option value={120}>120 mins (2 hours)</option>
                        <option value={180}>180 mins (3 hours)</option>
                        <option value={360}>360 mins (6 hours)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Followers Drip Rule */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="followersEnabled"
                      checked={followersEnabled}
                      onChange={(e) => setFollowersEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#D8EC8D] rounded"
                    />
                    <label htmlFor="followersEnabled" className="text-sm font-semibold text-white cursor-pointer">
                      Followers / Subscribers Time-Interval Drip
                    </label>
                  </div>
                  {followerService && (
                    <span className="text-xs font-mono text-slate-400">
                      ₹{Number(followerService.ratePer1000).toFixed(2)} / 1,000
                    </span>
                  )}
                </div>

                {followersEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7 pt-2 border-t border-white/5 text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-400">Total Followers across {durationDays} Days</label>
                      <input
                        type="number"
                        min={followerService?.minQty || 100}
                        max={followerService?.maxQty || 100000}
                        step={100}
                        value={followersTotalQty}
                        onChange={(e) => setFollowersTotalQty(parseInt(e.target.value, 10) || 100)}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-400">Drip Run Interval</label>
                      <select
                        value={followersInterval}
                        onChange={(e) => setFollowersInterval(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 rounded-xl bg-[#1e2315] border border-white/10 text-white font-mono"
                      >
                        <option value={6}>Every 6 Hours</option>
                        <option value={12}>Every 12 Hours</option>
                        <option value={24}>Every 24 Hours (Daily)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Error Banner with Request ID and Retry Button (Never show raw internal errors) */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Unable to calculate quote.</span>
                </div>
                <div className="text-rose-400/80">
                  {errorMessage}
                  {errorRequestId && (
                    <span className="font-mono ml-2 text-[11px] text-rose-300">
                      (Request ID: {errorRequestId})
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={computeQuote}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold transition-all self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* 3. Honest Quote Breakdown & Purchase */}
          {quote && (
            <GlassCard className="p-6 md:p-8 rounded-3xl border-white/10 space-y-6 bg-white/[0.02]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-semibold text-[#D8EC8D] tracking-wider uppercase">
                    Step 3
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Review Package Quote</h2>
                <p className="text-sm text-slate-400">
                  Itemized pricing showing rate per 1,000, quantity, max posts, and total reserve.
                </p>
              </div>

              {/* Itemized Table */}
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-white/5 border-b border-white/10 text-slate-400">
                    <tr>
                      <th className="p-3 font-semibold">Service</th>
                      <th className="p-3 font-semibold text-right">Rate / 1,000</th>
                      <th className="p-3 font-semibold text-right">Quantity</th>
                      <th className="p-3 font-semibold text-right">Max Posts</th>
                      <th className="p-3 font-semibold text-right">Line Reserve</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {quote.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 font-sans font-medium text-white">{item.serviceName}</td>
                        <td className="p-3 text-right">₹{item.ratePer1000.toFixed(2)}</td>
                        <td className="p-3 text-right">
                          {formatIndianNumber(item.quantityPerPost || item.totalQuantity)}
                        </td>
                        <td className="p-3 text-right">{item.maxPosts || 1}</td>
                        <td className="p-3 text-right font-bold text-[#D8EC8D]">
                          ₹{item.charge.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Warnings if any */}
              {quote.warnings && quote.warnings.length > 0 && (
                <div className="space-y-1">
                  {quote.warnings.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Large Total Sanity Warning */}
              {isLargeTotal && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    High volume allocation: this package reserve exceeds ₹50,000. Unused balance is refunded upon package expiry or cancellation.
                  </span>
                </div>
              )}

              {/* Total & Disclaimer */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-300">Total Upfront Reserve</span>
                  <span className="text-2xl font-bold font-mono text-[#D8EC8D]">
                    ₹{quote.totalCharge.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  {quote.disclaimer || "Maximum total; unused is refunded at the end"}
                </div>
              </div>

              {/* Required Consent Checkbox */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <input
                  type="checkbox"
                  id="consentRules"
                  checked={consentRulesUnderstood}
                  onChange={(e) => setConsentRulesUnderstood(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#D8EC8D] rounded"
                />
                <label htmlFor="consentRules" className="text-xs text-slate-300 cursor-pointer leading-relaxed">
                  I understand and accept that platform rules, delivery timing, and delivery risks apply to this package. We do not verify account ownership.
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="text-xs text-slate-400 font-mono">
                  Wallet Balance:{" "}
                  <span className={hasSufficientBalance ? "text-white" : "text-rose-400 font-bold"}>
                    ₹{user.balance.toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!consentRulesUnderstood || !hasSufficientBalance || calculating || purchasing}
                  onClick={() => setConfirmModalOpen(true)}
                  className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                    consentRulesUnderstood && hasSufficientBalance && !purchasing
                      ? "bg-[#D8EC8D] text-[#131313] hover:brightness-105"
                      : "bg-white/10 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <span>{purchasing ? "Creating Package..." : "Purchase Growth Package"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </GlassCard>
          )}

          {/* Confirmation Modal */}
          {confirmModalOpen && quote && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="w-full max-w-lg p-6 rounded-3xl bg-[#191e12] border border-white/10 space-y-6 shadow-2xl">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Confirm Package Purchase</h3>
                  <p className="text-xs text-slate-400">
                    A reserve of ₹{quote.totalCharge.toFixed(2)} will be debited from your wallet.
                  </p>
                </div>

                <div className="space-y-2 p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Target Handle:</span>
                    <span className="text-white">@{handle} ({selectedPlatform})</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Lifespan:</span>
                    <span className="text-white">{durationDays} Days</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Max Posts:</span>
                    <span className="text-white">{maxPostsToProcess} Posts</span>
                  </div>
                  <div className="flex justify-between text-[#D8EC8D] pt-2 border-t border-white/5 font-bold">
                    <span>Total Upfront:</span>
                    <span>₹{quote.totalCharge.toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 italic">
                  Maximum total; unused is refunded at the end. We do not verify account ownership.
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    disabled={purchasing}
                    onClick={() => setConfirmModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={purchasing}
                    onClick={handlePurchase}
                    className="px-6 py-2.5 rounded-xl bg-[#D8EC8D] text-[#131313] text-xs font-bold hover:brightness-105"
                  >
                    {purchasing ? "Debiting & Creating..." : "Confirm & Pay"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
