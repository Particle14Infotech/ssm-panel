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
  X,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";
import { PackageQuoteResponseSchema, type PackageQuoteResponse } from "@smm/contracts";
import { getApiBase } from "@/lib/api-base";

const SUPPORTED_PLATFORMS = [
  { id: "instagram", name: "Instagram", placeholder: "e.g. travel_chronicles" },
  { id: "tiktok", name: "TikTok", placeholder: "e.g. dailyvlogs" },
  { id: "youtube", name: "YouTube", placeholder: "e.g. techreviewshub" },
  { id: "facebook", name: "Facebook", placeholder: "e.g. foodiespage" },
  { id: "x", name: "X (Twitter)", placeholder: "e.g. marketupdates" },
  { id: "telegram", name: "Telegram", placeholder: "e.g. dailydeals" },
];

const SCHEDULE_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const PACKAGE_PRESETS = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Scheduled followers and post engagement",
    durationDays: 30,
    followers: true,
    followersTotalQty: 3000,
    intervalHours: 24,
    likes: true,
    likesPerPost: 500,
    views: true,
    viewsPerPost: 1000,
    maxPosts: 20,
  },
  {
    id: "scheduled",
    label: "Scheduled delivery",
    description: "Followers schedule only",
    durationDays: 30,
    followers: true,
    followersTotalQty: 3000,
    intervalHours: 24,
    likes: false,
    likesPerPost: 500,
    views: false,
    viewsPerPost: 1000,
    maxPosts: 20,
  },
  {
    id: "post-engagement",
    label: "Post engagement",
    description: "Likes and views for new posts",
    durationDays: 30,
    followers: false,
    followersTotalQty: 3000,
    intervalHours: 24,
    likes: true,
    likesPerPost: 500,
    views: true,
    viewsPerPost: 1000,
    maxPosts: 20,
  },
  {
    id: "light",
    label: "Light",
    description: "Smaller quantities over 14 days",
    durationDays: 14,
    followers: true,
    followersTotalQty: 1000,
    intervalHours: 24,
    likes: true,
    likesPerPost: 250,
    views: true,
    viewsPerPost: 500,
    maxPosts: 10,
  },
] as const;

type PackagePreset = (typeof PACKAGE_PRESETS)[number];

export function PackageOrderBuilder() {
  const router = useRouter();
  const { user, services, purchasePackage } = useCustomer();

  // State: Platform & Handle
  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");
  const [handle, setHandle] = useState<string>("");

  // State: Package Duration
  const [durationDays, setDurationDays] = useState<number>(30);
  const [timezone, setTimezone] = useState<string>("UTC");

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
  const [selectedLikeServiceId, setSelectedLikeServiceId] = useState<string>("");
  const [selectedViewServiceId, setSelectedViewServiceId] = useState<string>("");
  const [selectedFollowerServiceId, setSelectedFollowerServiceId] = useState<string>("");

  // Quote & Execution State
  const [quote, setQuote] = useState<PackageQuoteResponse | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [consentRulesUnderstood, setConsentRulesUnderstood] = useState<boolean>(false);
  const [balanceHintDismissed, setBalanceHintDismissed] = useState<boolean>(false);

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      setTimezone("UTC");
    }
  }, []);

  // Catalog service resolution for selected platform
  // Rule: Exclude Highlights, stories, and Threads from package eligible list
  const platformServices = useMemo(() => {
    return services.filter((s) => {
      const servicePlatform = s.platform?.toLowerCase() || "";
      const isPlatform =
        servicePlatform === "all" ||
        servicePlatform.includes(selectedPlatform) ||
        (selectedPlatform === "x" && servicePlatform.includes("twitter"));
      if (!isPlatform) return false;
      if (s.status && s.status !== "ACTIVE") return false;
      if (s.packageEligible === false) return false;

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

  const isLikeService = useCallback(
    (service: (typeof services)[number]) =>
      service.serviceType === "LIKES" ||
      service.name.toLowerCase().includes("like") ||
      (service.displayName || "").toLowerCase().includes("like"),
    [],
  );
  const isViewService = useCallback(
    (service: (typeof services)[number]) =>
      service.serviceType === "VIEWS" ||
      service.name.toLowerCase().includes("view") ||
      service.name.toLowerCase().includes("reel") ||
      (service.displayName || "").toLowerCase().includes("view") ||
      (service.displayName || "").toLowerCase().includes("reel"),
    [],
  );
  const isFollowerService = useCallback(
    (service: (typeof services)[number]) =>
      service.serviceType === "FOLLOWERS" ||
      service.serviceType === "SUBSCRIBERS" ||
      service.name.toLowerCase().includes("follower") ||
      service.name.toLowerCase().includes("subscriber") ||
      service.name.toLowerCase().includes("member") ||
      (service.displayName || "").toLowerCase().includes("follower") ||
      (service.displayName || "").toLowerCase().includes("subscriber") ||
      (service.displayName || "").toLowerCase().includes("member"),
    [],
  );

  const likeService = useMemo(() => {
    const candidates = platformServices.filter(isLikeService);
    return (
      candidates.find((service) => service.id === selectedLikeServiceId) ||
      candidates[0]
    );
  }, [isLikeService, platformServices, selectedLikeServiceId]);

  const viewService = useMemo(() => {
    const candidates = platformServices.filter(isViewService);
    return (
      candidates.find((service) => service.id === selectedViewServiceId) ||
      candidates[0]
    );
  }, [isViewService, platformServices, selectedViewServiceId]);

  const followerService = useMemo(() => {
    const candidates = platformServices.filter(isFollowerService);
    return (
      candidates.find((service) => service.id === selectedFollowerServiceId) ||
      candidates[0]
    );
  }, [isFollowerService, platformServices, selectedFollowerServiceId]);

  const applyPreset = (preset: PackagePreset) => {
    const clampToService = (quantity: number, service?: (typeof services)[number]) =>
      Math.min(
        Number(service?.maxQty || quantity),
        Math.max(Number(service?.minQty || 1), quantity),
      );

    setDurationDays(preset.durationDays);
    setFollowersEnabled(preset.followers);
    setFollowersTotalQty(clampToService(preset.followersTotalQty, followerService));
    setFollowersInterval(preset.intervalHours);
    setLikesEnabled(preset.likes);
    setLikesPerPost(clampToService(preset.likesPerPost, likeService));
    setViewsEnabled(preset.views);
    setViewsPerPost(clampToService(preset.viewsPerPost, viewService));
    setMaxPostsToProcess(preset.maxPosts);
  };

  const scheduleTimezones = useMemo(
    () => [...new Set([...SCHEDULE_TIMEZONES, timezone])].sort((a, b) => {
      if (a === timezone) return -1;
      if (b === timezone) return 1;
      return a.localeCompare(b);
    }),
    [timezone],
  );
  const servicesFor = (matches: (service: (typeof services)[number]) => boolean) =>
    platformServices.filter(matches);
  const serviceOptionLabel = (service: (typeof services)[number]) =>
    `${service.categoryName ? `${service.categoryName} · ` : ""}${service.displayName || service.name}`;

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
      timezone,
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

    let res: Response;
    try {
      const apiBase = getApiBase();
      res = await fetch(`${apiBase}/packages/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setQuote(null);
      setErrorMessage("Network connection error while computing quote.");
      setErrorRequestId(null);
      setCalculating(false);
      return;
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      setQuote(null);
      setErrorMessage("The quote response could not be read. Please refresh the quote.");
      setErrorRequestId(res.headers.get("x-request-id"));
      setCalculating(false);
      return;
    }

    if (!res.ok) {
      setQuote(null);
      setErrorMessage(
        typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
          ? data.message
          : "Unable to calculate quote."
      );
      setErrorRequestId(
        typeof data === "object" && data !== null && "requestId" in data && typeof data.requestId === "string"
          ? data.requestId
          : res.headers.get("x-request-id")
      );
    } else {
      const parsedQuote = PackageQuoteResponseSchema.safeParse(data);
      if (!parsedQuote.success) {
        setQuote(null);
        setErrorMessage("The quote response was incomplete or invalid. Please refresh the quote.");
        setErrorRequestId(res.headers.get("x-request-id"));
      } else {
        setQuote(parsedQuote.data);
        setErrorMessage(null);
        setErrorRequestId(null);
      }
    }
    setCalculating(false);
  }, [
    handle,
    selectedPlatform,
    durationDays,
    timezone,
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
      timezone,
      durationDays,
      consentRulesUnderstood: true,
      idempotencyKey: `pkg_pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      quoteHash: quote?.quoteHash,
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
  const hasScheduleTimeline = Boolean(quote?.timeline?.length);
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

            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-semibold text-slate-300">Start with a preset</h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  Presets set editable defaults. The server validates service eligibility and limits when quoting.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {PACKAGE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-[#D8EC8D]/60 hover:bg-[#D8EC8D]/5"
                  >
                    <span className="block text-xs font-semibold text-white">{preset.label}</span>
                    <span className="mt-1 block text-[10px] text-slate-400">{preset.description}</span>
                  </button>
                ))}
              </div>
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

            <div className="space-y-2">
              <label htmlFor="packageTimezone" className="text-xs font-semibold text-slate-300">
                Schedule timezone
              </label>
              <select
                id="packageTimezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#1e2315] px-3 py-2 text-xs text-white"
              >
                {scheduleTimezones.map((value) => (
                  <option key={value} value={value}>
                    {value.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">
                Choose the timezone for schedule previews and local-time rescheduling. Scheduled instants remain timezone-aware.
              </p>
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
                      checked={likesEnabled && Boolean(likeService)}
                      disabled={!likeService}
                      onChange={(e) => setLikesEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#D8EC8D] rounded"
                    />
                    <label htmlFor="likesEnabled" className={`text-sm font-semibold text-white ${likeService ? "cursor-pointer" : "cursor-not-allowed"}`}>
                      Post Likes / Reactions
                    </label>
                  </div>
                  {likeService && (
                    <span className="text-xs font-mono text-slate-400">
                      ₹{Number(likeService.ratePer1000).toFixed(2)} / 1,000
                    </span>
                  )}
                </div>
                {!likeService && (
                  <p className="pl-7 text-xs text-slate-500">
                    No eligible likes service is available for this platform.
                  </p>
                )}

                {likeService && (
                  <div className="space-y-1 pl-7 text-xs">
                    <label htmlFor="likeService" className="text-slate-400">Service category and service</label>
                    <select
                      id="likeService"
                      value={likeService.id}
                      onChange={(event) => setSelectedLikeServiceId(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#1e2315] px-3 py-2 text-white"
                    >
                      {servicesFor(isLikeService).map((service) => (
                        <option key={service.id} value={service.id}>
                          {serviceOptionLabel(service)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {likesEnabled && likeService && (
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
                      checked={viewsEnabled && Boolean(viewService)}
                      disabled={!viewService}
                      onChange={(e) => setViewsEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#D8EC8D] rounded"
                    />
                    <label htmlFor="viewsEnabled" className={`text-sm font-semibold text-white ${viewService ? "cursor-pointer" : "cursor-not-allowed"}`}>
                      Post Video / Reel Views
                    </label>
                  </div>
                  {viewService && (
                    <span className="text-xs font-mono text-slate-400">
                      ₹{Number(viewService.ratePer1000).toFixed(2)} / 1,000
                    </span>
                  )}
                </div>
                {!viewService && (
                  <p className="pl-7 text-xs text-slate-500">
                    No eligible video or reel views service is available for this platform.
                  </p>
                )}

                {viewService && (
                  <div className="space-y-1 pl-7 text-xs">
                    <label htmlFor="viewService" className="text-slate-400">Service category and service</label>
                    <select
                      id="viewService"
                      value={viewService.id}
                      onChange={(event) => setSelectedViewServiceId(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#1e2315] px-3 py-2 text-white"
                    >
                      {servicesFor(isViewService).map((service) => (
                        <option key={service.id} value={service.id}>
                          {serviceOptionLabel(service)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {viewsEnabled && viewService && (
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

              {/* Quantity Balance Hint (Neutral, dismissible, never auto-adds items) */}
              {likesEnabled && viewsEnabled && likesPerPost > viewsPerPost && !balanceHintDismissed && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>
                      Notice: Likes quantity ({formatIndianNumber(likesPerPost)}) exceeds Views quantity ({formatIndianNumber(viewsPerPost)}) in this order. Posts typically display more views than likes.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBalanceHintDismissed(true)}
                    className="p-1 text-amber-400 hover:text-white rounded hover:bg-white/10 shrink-0"
                    title="Dismiss notice"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Followers Drip Rule */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="followersEnabled"
                      checked={followersEnabled && Boolean(followerService)}
                      disabled={!followerService}
                      onChange={(e) => setFollowersEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#D8EC8D] rounded"
                    />
                    <label htmlFor="followersEnabled" className={`text-sm font-semibold text-white ${followerService ? "cursor-pointer" : "cursor-not-allowed"}`}>
                      Followers / Subscribers Time-Interval Drip
                    </label>
                  </div>
                  {followerService && (
                    <span className="text-xs font-mono text-slate-400">
                      ₹{Number(followerService.ratePer1000).toFixed(2)} / 1,000
                    </span>
                  )}
                </div>
                {!followerService && (
                  <p className="pl-7 text-xs text-slate-500">
                    No eligible followers or subscribers service is available for this platform.
                  </p>
                )}

                {followerService && (
                  <div className="space-y-1 pl-7 text-xs">
                    <label htmlFor="followerService" className="text-slate-400">Service category and service</label>
                    <select
                      id="followerService"
                      value={followerService.id}
                      onChange={(event) => setSelectedFollowerServiceId(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#1e2315] px-3 py-2 text-white"
                    >
                      {servicesFor(isFollowerService).map((service) => (
                        <option key={service.id} value={service.id}>
                          {serviceOptionLabel(service)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {followersEnabled && followerService && (
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

              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Delivery timeline</h3>
                    <p className="text-xs text-slate-400">Scheduled distribution drawn directly from quote timeline ({quote.timezone || timezone}).</p>
                  </div>
                  <Calendar className="w-4 h-4 text-[#D8EC8D] shrink-0" />
                </div>
                {quote.timeline && quote.timeline.length > 0 ? (
                  <div className="p-4 space-y-4">
                    {/* Visual Timeline Distribution Chart (Derived from real quote.timeline) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>Timeline Schedule Chart ({quote.timeline.length} runs)</span>
                        <span>Max per run: {formatIndianNumber(Math.max(...quote.timeline.map((r) => r.quantity), 1))} units</span>
                      </div>
                      <div className="h-28 w-full bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-end gap-1.5 overflow-x-auto">
                        {quote.timeline.map((run, i) => {
                          const maxRunQty = Math.max(...quote.timeline.map((r) => r.quantity), 1);
                          const heightPct = Math.max(12, Math.round((run.quantity / maxRunQty) * 100));
                          const runDate = new Date(run.scheduledAt);
                          const formattedTime = !Number.isNaN(runDate.getTime())
                            ? runDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                            : `#${i + 1}`;
                          return (
                            <div key={i} className="flex-1 min-w-[28px] max-w-[48px] h-full flex flex-col items-center justify-end group relative">
                              <div
                                style={{ height: `${heightPct}%` }}
                                className="w-full bg-[#D8EC8D]/70 hover:bg-[#D8EC8D] rounded-t transition-all cursor-pointer relative"
                              >
                                <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#191919] border border-white/20 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-20 font-mono">
                                  {run.serviceName}: {formatIndianNumber(run.quantity)}
                                </div>
                              </div>
                              <span className="text-[9px] text-slate-400 mt-1 truncate w-full text-center font-mono">
                                {formattedTime}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <ol className="divide-y divide-white/5 max-h-56 overflow-y-auto">
                      {quote.timeline.map((run, index) => {
                        const scheduledAt = new Date(run.scheduledAt);
                        const isValidTime = !Number.isNaN(scheduledAt.getTime());
                        return (
                          <li key={`${run.serviceId}-${run.runIndex}-${index}`} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                            <div className="min-w-0">
                              <p className="text-white truncate">{run.serviceName}</p>
                              <p className="text-slate-400 text-[11px]">
                                {isValidTime
                                  ? scheduledAt.toLocaleString(undefined, { timeZone: quote.timezone || timezone, dateStyle: "medium", timeStyle: "short" })
                                  : "Schedule time unavailable"}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-slate-200 font-mono">{formatIndianNumber(run.quantity)}</p>
                              <p className="text-[#D8EC8D] font-mono">₹{run.chargeShare.toFixed(2)}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ) : (
                  <div className="p-4 text-xs text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    The quote did not include a schedule timeline. Refresh the quote before purchasing.
                  </div>
                )}
              </div>

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
                  {quote.disclaimer || "Maximum total; unused balance is automatically refunded to your wallet upon package completion or cancellation."}
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
                  I understand the platform terms of service and agree to the delivery rules. We do not verify account ownership. Delivery is fulfilled strictly to the public handle and post links provided.
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
                  disabled={!consentRulesUnderstood || !hasSufficientBalance || !hasScheduleTimeline || calculating || purchasing}
                  onClick={() => setConfirmModalOpen(true)}
                  className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                    consentRulesUnderstood && hasSufficientBalance && hasScheduleTimeline && !purchasing
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
                  Maximum total; unused balance is automatically refunded to your wallet upon package completion or cancellation. We do not verify account ownership. Delivery is fulfilled strictly to the public handle and post links provided.
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
