"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { GlassCard } from "@/components/shared/GlassCard";
import { getApiBase } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-session";
import { STANDARD_DELIVERY_WINDOW_PRESETS, DeliveryWindowConfig } from "@smm/contracts";
import { LinkPreviewCard } from "@/components/shared/LinkPreviewCard";
import { LinkAutoSuggest } from "./LinkAutoSuggest";
import { SmartServiceSuggestions } from "./SmartServiceSuggestions";
import { ServiceDropdownSelect, GenericSelect } from "./CustomDropdownSelect";
import {
  Heart,
  Eye,
  Share2,
  Users,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  PlusCircle,
  ExternalLink,
  Sliders,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  Clipboard,
  Info,
  Check,
  X,
} from "lucide-react";

interface CustomDripTabProps {
  platform: string;
  services: any[];
  durationChips?: number[];
  walletBalance: number;
  onOrderSuccess: (result: any) => void;
  prefilledTargetUrl?: string;
}

interface CardState {
  enabled: boolean;
  serviceId: string;
  quantity: number;
  intervalHours?: number;
}

interface CommentsCardState extends CardState {
  commentsText: string;
}

export function CustomDripTab({
  platform,
  services,
  durationChips = [1, 3, 5, 7, 10, 14, 21, 30, 45, 60],
  walletBalance,
  onOrderSuccess,
  prefilledTargetUrl = "",
}: CustomDripTabProps) {
  // Mobile wizard step (1: Links & Targeting, 2: Services, 3: Schedule & Confirmation)
  const [mobileStep, setMobileStep] = useState<number>(1);

  // Link inputs
  const [profileUrl, setProfileUrl] = useState<string>("");
  const [targetUrl, setTargetUrl] = useState<string>(prefilledTargetUrl);
  const [targetPreview, setTargetPreview] = useState<any | null>(null);
  const [profilePreview, setProfilePreview] = useState<any | null>(null);

  // Targeting Area (if geo services exist)
  const [geoCountry, setGeoCountry] = useState<string>("ALL");
  const [geoRegion, setGeoRegion] = useState<string>("ALL");

  // Duration
  const [durationDays, setDurationDays] = useState<number>(7);
  const [extraHours, setExtraHours] = useState<number>(0);

  // Delivery Window Scheduling State (SRS section 50 - Deterministic Window Pacing)
  const [windowPreset, setWindowPreset] = useState<"ANY_TIME" | "DAYTIME" | "EVENING" | "CUSTOM">("ANY_TIME");
  const [customStartHour, setCustomStartHour] = useState<number>(9);
  const [customStartMin, setCustomStartMin] = useState<number>(0);
  const [customEndHour, setCustomEndHour] = useState<number>(21);
  const [customEndMin, setCustomEndMin] = useState<number>(0);
  const [customDaysOfWeek, setCustomDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [timezone, setTimezone] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
    } catch {
      return "Asia/Kolkata";
    }
  });
  const [quoteRequestId, setQuoteRequestId] = useState<string | null>(null);

  // Sync prefilledTargetUrl when it changes or is cleared
  useEffect(() => {
    if (prefilledTargetUrl !== undefined) {
      setTargetUrl(prefilledTargetUrl);
      if (!prefilledTargetUrl) {
        setTargetPreview(null);
      }
    }
  }, [prefilledTargetUrl]);

  // Additional Platform Services State
  interface AdditionalDripService {
    id: string;
    serviceId: string;
    quantity: number;
    intervalHours?: number;
  }
  const [additionalServices, setAdditionalServices] = useState<AdditionalDripService[]>([]);
  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState<string>("");
  const [catalogSearch, setCatalogSearch] = useState<string>("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>("ALL");
  const [catalogQuantity, setCatalogQuantity] = useState<number>(1000);
  const [showCatalogSection, setShowCatalogSection] = useState<boolean>(false);
  const [pacingStrategy, setPacingStrategy] = useState<"ORGANIC_RANDOM" | "UNIFORM">("ORGANIC_RANDOM");

  const deliveryWindowConfig: DeliveryWindowConfig = useMemo(() => {
    if (windowPreset === "ANY_TIME") {
      return { timezone, ranges: [] };
    }
    if (windowPreset === "DAYTIME") {
      return { timezone, ranges: [{ startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 }] };
    }
    if (windowPreset === "EVENING") {
      return { timezone, ranges: [{ startHour: 17, startMinute: 0, endHour: 23, endMinute: 0 }] };
    }
    return {
      timezone,
      ranges: [{ startHour: customStartHour, startMinute: customStartMin, endHour: customEndHour, endMinute: customEndMin }],
      daysOfWeek: customDaysOfWeek.length < 7 ? customDaysOfWeek : undefined,
    };
  }, [windowPreset, timezone, customStartHour, customStartMin, customEndHour, customEndMin, customDaysOfWeek]);

  // Available services grouped by Kind
  const likesServices = useMemo(
    () => services.filter((s) => s.kind === "LIKES" || s.name?.toLowerCase().includes("like")),
    [services]
  );
  const viewsServices = useMemo(
    () => services.filter((s) => s.kind === "VIEWS" || s.name?.toLowerCase().includes("view")),
    [services]
  );
  const sharesServices = useMemo(
    () => services.filter((s) => s.kind === "SHARES" || s.kind === "REACH" || s.name?.toLowerCase().includes("share")),
    [services]
  );
  const followersServices = useMemo(
    () =>
      services.filter(
        (s) =>
          (s.kind === "FOLLOWERS" || s.kind === "SUBSCRIBERS" || s.name?.toLowerCase().includes("follower")) &&
          !s.name?.toLowerCase().includes("power likes")
      ),
    [services]
  );
  const commentsServices = useMemo(
    () =>
      services.filter(
        (s) =>
          s.kind === "COMMENTS" ||
          s.serviceType === "CUSTOM_COMMENTS" ||
          s.serviceType === "COMMENTS" ||
          s.name?.toLowerCase().includes("comment") ||
          s.categoryName?.toLowerCase().includes("comment") ||
          s.name?.toLowerCase().includes("chat")
      ),
    [services]
  );

  // 5 Metric Cards State
  const [likesCard, setLikesCard] = useState<CardState>({
    enabled: true,
    serviceId: likesServices[0]?.id || "",
    quantity: 500,
  });

  const [viewsCard, setViewsCard] = useState<CardState>({
    enabled: true,
    serviceId: viewsServices[0]?.id || "",
    quantity: 1000,
  });

  const [sharesCard, setSharesCard] = useState<CardState>({
    enabled: false,
    serviceId: sharesServices[0]?.id || "",
    quantity: 1500,
  });

  const [followersCard, setFollowersCard] = useState<CardState>({
    enabled: true,
    serviceId: followersServices[0]?.id || "",
    quantity: 3000,
    intervalHours: 24,
  });

  const [commentsCard, setCommentsCard] = useState<CommentsCardState>({
    enabled: false,
    serviceId: commentsServices[0]?.id || "",
    quantity: 10,
    commentsText: "",
  });

  // Sample comments pool for Custom Package
  const sampleCommentsList = [
    "Great content, keep it up! 🔥",
    "Super informative and well explained 👏",
    "Loved this post! Saving it for later ❤️",
    "Quality production as always! 🚀",
    "Totally agree with this point 💯",
    "Awesome share, very insightful 🙌",
    "Top notch work! ⭐",
    "Really needed to see this today ✨",
  ];

  const dripCommentsLines = useMemo(() => {
    return commentsCard.commentsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }, [commentsCard.commentsText]);

  const hasDuplicateDripComments = useMemo(() => {
    if (dripCommentsLines.length === 0) return false;
    return new Set(dripCommentsLines).size !== dripCommentsLines.length;
  }, [dripCommentsLines]);

  const hasUrlInDripComments = useMemo(() => {
    if (dripCommentsLines.length === 0) return false;
    const urlPattern = /(https?:\/\/|www\.|\.com|\.net|\.org|\.io|\.me)/i;
    return dripCommentsLines.some((l) => urlPattern.test(l));
  }, [dripCommentsLines]);

  const handleAddSampleCommentsToDrip = (count = 5) => {
    const existing = commentsCard.commentsText ? commentsCard.commentsText.split("\n").map((l) => l.trim()).filter(Boolean) : [];
    const available = sampleCommentsList.filter((c) => !existing.includes(c));
    const pool = available.length > 0 ? available : sampleCommentsList;
    const toAdd = pool.slice(0, count);
    const newText = [...existing, ...toAdd].join("\n");
    const linesCount = newText.split("\n").map((l) => l.trim()).filter(Boolean).length;
    setCommentsCard((p) => ({
      ...p,
      enabled: true,
      commentsText: newText,
      quantity: linesCount,
    }));
  };

  const handleCleanDripComments = () => {
    const cleaned = Array.from(
      new Set(
        commentsCard.commentsText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      )
    ).join("\n");
    const linesCount = cleaned.split("\n").map((l) => l.trim()).filter(Boolean).length;
    setCommentsCard((p) => ({
      ...p,
      commentsText: cleaned,
      quantity: Math.max(linesCount, 1),
    }));
  };

  // Set initial service selections when services list loads
  useEffect(() => {
    setLikesCard((prev) => (likesServices.length > 0 && !prev.serviceId ? { ...prev, serviceId: likesServices[0].id } : prev));
    setViewsCard((prev) => (viewsServices.length > 0 && !prev.serviceId ? { ...prev, serviceId: viewsServices[0].id } : prev));
    setSharesCard((prev) => (sharesServices.length > 0 && !prev.serviceId ? { ...prev, serviceId: sharesServices[0].id } : prev));
    setFollowersCard((prev) => (followersServices.length > 0 && !prev.serviceId ? { ...prev, serviceId: followersServices[0].id } : prev));
    setCommentsCard((prev) => (commentsServices.length > 0 && !prev.serviceId ? { ...prev, serviceId: commentsServices[0].id } : prev));
  }, [likesServices, viewsServices, sharesServices, followersServices, commentsServices]);

  // Quote State
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteStale, setQuoteStale] = useState<boolean>(false);

  // Order Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState<boolean>(false);

  // Active items array to quote
  const activeItems = useMemo(() => {
    const items: Array<{
      serviceId: string;
      quantity: number;
      intervalHours?: number;
      customComments?: string[];
    }> = [];
    if (likesCard.enabled && likesCard.serviceId && Number(likesCard.quantity) > 0) {
      items.push({ serviceId: likesCard.serviceId, quantity: Number(likesCard.quantity) });
    }
    if (viewsCard.enabled && viewsCard.serviceId && Number(viewsCard.quantity) > 0) {
      items.push({ serviceId: viewsCard.serviceId, quantity: Number(viewsCard.quantity) });
    }
    if (sharesCard.enabled && sharesCard.serviceId && Number(sharesCard.quantity) > 0) {
      items.push({ serviceId: sharesCard.serviceId, quantity: Number(sharesCard.quantity) });
    }
    if (followersCard.enabled && followersCard.serviceId && Number(followersCard.quantity) > 0) {
      items.push({
        serviceId: followersCard.serviceId,
        quantity: Number(followersCard.quantity),
        intervalHours: followersCard.intervalHours || 24,
      });
    }
    if (commentsCard.enabled && commentsCard.serviceId) {
      const lines = commentsCard.commentsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const qty = lines.length > 0 ? lines.length : Number(commentsCard.quantity || 10);
      if (qty > 0) {
        items.push({
          serviceId: commentsCard.serviceId,
          quantity: qty,
          intervalHours: 24,
          customComments: lines.length > 0 ? lines : undefined,
        });
      }
    }
    for (const add of additionalServices) {
      if (add.serviceId && Number(add.quantity) > 0) {
        items.push({
          serviceId: add.serviceId,
          quantity: Number(add.quantity),
          intervalHours: add.intervalHours || 24,
        });
      }
    }
    return items;
  }, [likesCard, viewsCard, sharesCard, followersCard, commentsCard, additionalServices]);

  // Fetch Quote from Backend
  const fetchQuote = useCallback(async () => {
    if (activeItems.length === 0) {
      setQuoteData(null);
      setQuoteError("Please enable at least one service with a quantity.");
      return;
    }

    const hasFollowers = followersCard.enabled;
    const hasMedia = likesCard.enabled || viewsCard.enabled || sharesCard.enabled || commentsCard.enabled;

    if (hasFollowers && !profileUrl.trim() && !targetUrl.trim()) {
      setQuoteError("Please provide a Profile Link for follower services.");
      return;
    }

    if (hasMedia && !targetUrl.trim() && !profileUrl.trim()) {
      setQuoteError("Please provide a Post/Reel Link for engagement services.");
      return;
    }

    // Validate minimum and maximum quantities client-side before dispatching network request
    for (const item of activeItems) {
      const s = services.find((srv) => srv.id === item.serviceId);
      if (s?.minQty && item.quantity < s.minQty) {
        setQuoteError(`${s.displayName || s.name}: Minimum quantity is ${s.minQty.toLocaleString()} (you entered ${item.quantity.toLocaleString()}).`);
        setQuoteData(null);
        return;
      }
      if (s?.maxQty && item.quantity > s.maxQty) {
        setQuoteError(`${s.displayName || s.name}: Maximum quantity is ${s.maxQty.toLocaleString()} (you entered ${item.quantity.toLocaleString()}).`);
        setQuoteData(null);
        return;
      }
    }

    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/packages/custom-campaign/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          platform: platform || "instagram",
          profileUrl: profileUrl.trim() || undefined,
          targetUrl: targetUrl.trim() || undefined,
          durationDays,
          extraHours,
          timezone,
          deliveryWindow: deliveryWindowConfig,
          services: activeItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch quotation.");
      }

      setQuoteData(data);
      setQuoteStale(false);
    } catch (err: any) {
      setQuoteRequestId(err.requestId || "req_" + Date.now().toString(36));
      setQuoteError(err.message || "Quotation error");
    } finally {
      setQuoteLoading(false);
    }
  }, [activeItems, services, platform, profileUrl, targetUrl, durationDays, extraHours, deliveryWindowConfig, timezone, followersCard.enabled, likesCard.enabled, viewsCard.enabled, sharesCard.enabled, commentsCard.enabled]);

  // Debounced quote fetch on configuration changes
  useEffect(() => {
    setQuoteStale(true);
    const timer = setTimeout(() => {
      fetchQuote();
    }, 450);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  // Handle Order Submit
  const handleOrderSubmit = async () => {
    if (quoteStale || quoteLoading) {
      setOrderError("Configuration is updating. Please wait a moment.");
      return;
    }
    if (!quoteData?.quoteHash) {
      setOrderError("Please fetch a valid quote before submitting.");
      return;
    }
    if (!consentChecked) {
      setOrderError("Please accept the terms of service and schedule acknowledgment.");
      return;
    }
    if (walletBalance < quoteData.totalCharge) {
      setOrderError("Insufficient wallet balance. Please add funds to proceed.");
      return;
    }

    setIsSubmitting(true);
    setOrderError(null);

    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/packages/custom-campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          platform: platform || "instagram",
          profileUrl: profileUrl.trim() || undefined,
          targetUrl: targetUrl.trim() || undefined,
          durationDays,
          extraHours,
          timezone,
          deliveryWindow: deliveryWindowConfig,
          quoteHash: quoteData.quoteHash,
          services: activeItems,
          preview: (targetPreview || profilePreview) ? {
            thumbnailUrl: (targetPreview || profilePreview)?.thumbnailUrl,
            title: (targetPreview || profilePreview)?.title,
            authorName: (targetPreview || profilePreview)?.authorName,
            kind: (targetPreview || profilePreview)?.kind,
            isCarousel: (targetPreview || profilePreview)?.isCarousel,
            slideIndex: (targetPreview || profilePreview)?.slideIndex,
          } : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create custom campaign.");
      }

      // Reset links and previews upon successful campaign dispatch
      setProfileUrl("");
      setTargetUrl("");
      setProfilePreview(null);
      setTargetPreview(null);

      onOrderSuccess(data);
    } catch (err: any) {
      setOrderError(err.message || "Order creation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Currency Formatter (INR via Intl as per Rule 4)
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(val);
  };

  // Find service helper
  const findService = (id: string) => services.find((s) => s.id === id);

  const platformCategories = useMemo(() => {
    const cats = new Set<string>();
    services.forEach((s) => {
      const cat = s.categoryName || s.category?.name;
      if (cat) cats.add(cat);
    });
    return Array.from(cats);
  }, [services]);

  const filteredCatalogServices = useMemo(() => {
    return services.filter((s) => {
      if (s.status && s.status !== "ACTIVE") return false;
      if (s.isDeleted) return false;
      if (catalogCategoryFilter !== "ALL") {
        const cat = s.categoryName || s.category?.name || "";
        if (cat !== catalogCategoryFilter) return false;
      }
      if (catalogSearch.trim()) {
        const q = catalogSearch.toLowerCase().trim();
        const name = (s.displayName || s.name || "").toLowerCase();
        const cat = (s.categoryName || s.category?.name || "").toLowerCase();
        if (!name.includes(q) && !cat.includes(q) && !s.id.includes(q)) return false;
      }
      return true;
    });
  }, [services, catalogCategoryFilter, catalogSearch]);

  return (
    <div className="space-y-6">
      {/* Mobile 3-Step Wizard Header */}
      <div className="lg:hidden flex items-center justify-between p-3 rounded-xl bg-white/5 border border-border text-xs">
        <button
          type="button"
          onClick={() => setMobileStep(1)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
            mobileStep === 1
              ? "bg-[#D8EC8D] text-black font-bold"
              : "text-slate-400"
          }`}
        >
          <span>1. Links</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <button
          type="button"
          onClick={() => setMobileStep(2)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
            mobileStep === 2
              ? "bg-[#D8EC8D] text-black font-bold"
              : "text-slate-400"
          }`}
        >
          <span>2. Services</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <button
          type="button"
          onClick={() => setMobileStep(3)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
            mobileStep === 3
              ? "bg-[#D8EC8D] text-black font-bold"
              : "text-slate-400"
          }`}
        >
          <span>3. Schedule</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Left Content: Links & 4 Metric Cards */}
        <div
          className={`lg:col-span-8 space-y-6 ${
            mobileStep === 3 ? "hidden lg:block" : "block"
          }`}
        >
          {/* Section: URL Inputs & Targeting */}
          <div
            className={`space-y-4 ${
              mobileStep === 2 ? "hidden lg:block" : "block"
            }`}
          >
            <GlassCard className="p-5 border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-fg uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#D8EC8D]" />
                  Campaign Configuration
                </h3>
                <div className="flex items-center gap-2">
                  {(profileUrl || targetUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileUrl("");
                        setTargetUrl("");
                        setProfilePreview(null);
                        setTargetPreview(null);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors flex items-center gap-1"
                      title="Clear profile and post URLs"
                    >
                      <X className="w-3 h-3" />
                      <span>Reset Links</span>
                    </button>
                  )}
                  <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                    Multi-Service Drip Setup
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Profile URL Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-fg-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#D8EC8D]" />
                    Profile URL (for Followers)
                  </label>
                  <LinkAutoSuggest
                    value={profileUrl}
                    onChange={setProfileUrl}
                    platform={platform}
                    placeholder="https://instagram.com/username"
                  />
                  <p className="text-[10px] text-slate-500">
                    Used for followers and profile engagement dispatches.
                  </p>
                  <LinkPreviewCard
                    url={profileUrl}
                    selectedPlatform={platform}
                    serviceTypeOrMetric="PROFILE"
                    onPreviewChange={setProfilePreview}
                  />
                </div>

                {/* Post / Reel URL Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-fg-2 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-[#D8EC8D]" />
                    Reel / Post URL (for Views, Likes & Reach)
                  </label>
                  <LinkAutoSuggest
                    value={targetUrl}
                    onChange={setTargetUrl}
                    platform={platform}
                    placeholder="https://instagram.com/reel/C8xyz123"
                  />
                  <p className="text-[10px] text-slate-500">
                    Target post or reel for views, likes, and share metrics.
                  </p>
                  <LinkPreviewCard
                    url={targetUrl}
                    selectedPlatform={platform}
                    serviceTypeOrMetric="POST"
                    onPreviewChange={setTargetPreview}
                  />
                  <SmartServiceSuggestions
                    targetUrl={targetUrl}
                    services={services}
                    onSelectService={(svc) => {
                      const kind = (svc.kind || "").toUpperCase();
                      const name = (svc.name || "").toLowerCase();
                      if (kind === "VIEWS" || name.includes("view")) {
                        setViewsCard((p) => ({ ...p, enabled: true, serviceId: svc.id }));
                      } else if (kind === "LIKES" || name.includes("like")) {
                        setLikesCard((p) => ({ ...p, enabled: true, serviceId: svc.id }));
                      } else if (kind === "SHARES" || kind === "REACH" || name.includes("share") || name.includes("save")) {
                        setSharesCard((p) => ({ ...p, enabled: true, serviceId: svc.id }));
                      } else if (kind === "FOLLOWERS" || name.includes("follower")) {
                        setFollowersCard((p) => ({ ...p, enabled: true, serviceId: svc.id }));
                      } else {
                        setAdditionalServices((prev) => [
                          ...prev.filter((item) => item.serviceId !== svc.id),
                          { id: `rec-${Date.now()}`, serviceId: svc.id, quantity: svc.minQuantity || 1000 },
                        ]);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Geo-Targeting Selectors */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex flex-wrap items-center gap-4 text-xs">
                <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                  Target Area:
                </span>
                <div className="flex items-center gap-2">
                  <GenericSelect
                    options={[
                      { value: "ALL", label: "Country: Worldwide (Default)" },
                      { value: "IN", label: "Country: India (IN)" },
                      { value: "US", label: "Country: United States (US)" },
                    ]}
                    value={geoCountry}
                    onChange={(val) => setGeoCountry(String(val))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <GenericSelect
                    options={[
                      { value: "ALL", label: "Region: Global" },
                      { value: "ASIA", label: "Region: Asia" },
                      { value: "NORTH_AMERICA", label: "Region: North America" },
                    ]}
                    value={geoRegion}
                    onChange={(val) => setGeoRegion(String(val))}
                  />
                </div>
              </div>

              {/* Mobile Advance Button */}
              <div className="lg:hidden pt-2">
                <button
                  type="button"
                  onClick={() => setMobileStep(2)}
                  className="w-full py-2 rounded-xl bg-[#D8EC8D] text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(216,236,141,0.2)]"
                >
                  Configure Services
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </GlassCard>
          </div>

          {/* Section: 4 Metric Cards Grid */}
          <div
            className={`space-y-4 ${
              mobileStep === 1 ? "hidden lg:block" : "block"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Select Services for Drip Campaign
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                {activeItems.length} active service(s)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Post Likes / Reactions */}
              <div
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  likesCard.enabled
                    ? "bg-white dark:bg-[#131313]/90 border-slate-300 dark:border-[#D8EC8D]/50 shadow-sm dark:shadow-[0_0_20px_rgba(216,236,141,0.08)]"
                    : "bg-slate-50 dark:bg-[#121417]/50 border-slate-200/80 dark:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={likesCard.enabled}
                      onChange={(e) =>
                        setLikesCard((p) => ({ ...p, enabled: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-[#D8EC8D] bg-slate-100 dark:bg-black/40 border-slate-300 dark:border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#D8EC8D]"
                    />
                    <span className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${likesCard.enabled ? "text-fg" : "text-fg-muted"}`}>
                      <Heart className={`w-3.5 h-3.5 transition-colors ${likesCard.enabled ? "text-[#D8EC8D]" : "text-slate-400"}`} />
                      Post Likes / Reactions
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        likesCard.enabled
                          ? "bg-[#D8EC8D]/15 text-[#171e00] dark:text-[#D8EC8D] border-[#D8EC8D]/30"
                          : "bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10"
                      }`}
                    >
                      {likesCard.enabled ? "Active" : "Disabled"}
                    </span>
                    {likesCard.serviceId && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 text-[#171e00] dark:text-[#D8EC8D] border border-accent/20">
                        {formatCurrency(Number(findService(likesCard.serviceId)?.ratePer1000 || 0))} / 1k
                      </span>
                    )}
                  </div>
                </div>

                <div className={`space-y-3 pt-3 border-t border-slate-200/60 dark:border-white/5 transition-opacity ${likesCard.enabled ? "opacity-100" : "opacity-60"}`}>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Service
                    </label>
                    <ServiceDropdownSelect
                      services={likesServices}
                      selectedServiceId={likesCard.serviceId}
                      onSelect={(svcId) =>
                        setLikesCard((p) => ({ ...p, enabled: true, serviceId: svcId }))
                      }
                      disabled={!likesCard.enabled}
                      formatCurrency={formatCurrency}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span className="uppercase tracking-wider font-semibold">Quantity</span>
                      <span className="font-mono">
                        Min: {findService(likesCard.serviceId)?.minQty || 100} | Max: {findService(likesCard.serviceId)?.maxQty || 10000}
                      </span>
                    </div>
                    <input
                      type="number"
                      value={likesCard.quantity || ""}
                      placeholder={String(findService(likesCard.serviceId)?.minQty || 100)}
                      onChange={(e) =>
                        setLikesCard((p) => ({ ...p, enabled: true, quantity: Math.max(0, parseInt(e.target.value) || 0) }))
                      }
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-[#181818] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-[#D8EC8D]/60 transition-colors"
                    />
                    {likesCard.enabled && Number(likesCard.quantity) > 0 && Number(likesCard.quantity) < (findService(likesCard.serviceId)?.minQty || 1) && (
                      <p className="text-[10px] text-amber-500 font-medium mt-1">
                        ⚠️ Minimum quantity is {(findService(likesCard.serviceId)?.minQty || 1).toLocaleString()}
                      </p>
                    )}
                    {likesCard.enabled && (!likesCard.quantity || Number(likesCard.quantity) === 0) && (
                      <p className="text-[10px] text-amber-500 font-medium mt-1">
                        ⚠️ Please enter quantity (Min: {(findService(likesCard.serviceId)?.minQty || 100).toLocaleString()})
                      </p>
                    )}
                    <div className="flex gap-1.5 mt-2">
                      {[250, 500, 1000, 2500].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setLikesCard((p) => ({ ...p, enabled: true, quantity: preset }))}
                          className={`flex-1 py-1 rounded text-[10px] font-mono transition-colors ${
                            likesCard.quantity === preset && likesCard.enabled
                              ? "bg-[#D8EC8D] text-black font-bold"
                              : "bg-slate-200/70 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          +{preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Post Video / Reel Views */}
              <div
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  viewsCard.enabled
                    ? "bg-white dark:bg-[#131313]/90 border-slate-300 dark:border-[#D8EC8D]/50 shadow-sm dark:shadow-[0_0_20px_rgba(216,236,141,0.08)]"
                    : "bg-slate-50 dark:bg-[#121417]/50 border-slate-200/80 dark:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={viewsCard.enabled}
                      onChange={(e) =>
                        setViewsCard((p) => ({ ...p, enabled: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-[#D8EC8D] bg-slate-100 dark:bg-black/40 border-slate-300 dark:border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#D8EC8D]"
                    />
                    <span className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${viewsCard.enabled ? "text-fg" : "text-fg-muted"}`}>
                      <Eye className={`w-3.5 h-3.5 transition-colors ${viewsCard.enabled ? "text-[#D8EC8D]" : "text-slate-400"}`} />
                      Post Video / Reel Views
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        viewsCard.enabled
                          ? "bg-[#D8EC8D]/15 text-[#171e00] dark:text-[#D8EC8D] border-[#D8EC8D]/30"
                          : "bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10"
                      }`}
                    >
                      {viewsCard.enabled ? "Active" : "Disabled"}
                    </span>
                    {viewsCard.serviceId && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 text-[#171e00] dark:text-[#D8EC8D] border border-accent/20">
                        {formatCurrency(Number(findService(viewsCard.serviceId)?.ratePer1000 || 0))} / 1k
                      </span>
                    )}
                  </div>
                </div>

                <div className={`space-y-3 pt-3 border-t border-slate-200/60 dark:border-white/5 transition-opacity ${viewsCard.enabled ? "opacity-100" : "opacity-60"}`}>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Service
                    </label>
                    <ServiceDropdownSelect
                      services={viewsServices}
                      selectedServiceId={viewsCard.serviceId}
                      onSelect={(svcId) =>
                        setViewsCard((p) => ({ ...p, enabled: true, serviceId: svcId }))
                      }
                      disabled={!viewsCard.enabled}
                      formatCurrency={formatCurrency}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span className="uppercase tracking-wider font-semibold">Quantity</span>
                      <span className="font-mono">
                        Min: {findService(viewsCard.serviceId)?.minQty || 100} | Max: {findService(viewsCard.serviceId)?.maxQty || 50000}
                      </span>
                    </div>
                    <input
                      type="number"
                      value={viewsCard.quantity || ""}
                      placeholder={String(findService(viewsCard.serviceId)?.minQty || 100)}
                      onChange={(e) =>
                        setViewsCard((p) => ({ ...p, enabled: true, quantity: Math.max(0, parseInt(e.target.value) || 0) }))
                      }
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-[#181818] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-[#D8EC8D]/60 transition-colors"
                    />
                    {viewsCard.enabled && Number(viewsCard.quantity) > 0 && Number(viewsCard.quantity) < (findService(viewsCard.serviceId)?.minQty || 1) && (
                      <p className="text-[10px] text-amber-500 font-medium mt-1">
                        ⚠️ Minimum quantity is {(findService(viewsCard.serviceId)?.minQty || 1).toLocaleString()}
                      </p>
                    )}
                    {viewsCard.enabled && (!viewsCard.quantity || Number(viewsCard.quantity) === 0) && (
                      <p className="text-[10px] text-amber-500 font-medium mt-1">
                        ⚠️ Please enter quantity (Min: {(findService(viewsCard.serviceId)?.minQty || 100).toLocaleString()})
                      </p>
                    )}
                    <div className="flex gap-1.5 mt-2">
                      {[500, 1000, 2500, 5000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setViewsCard((p) => ({ ...p, enabled: true, quantity: preset }))}
                          className={`flex-1 py-1 rounded text-[10px] font-mono transition-colors ${
                            viewsCard.quantity === preset && viewsCard.enabled
                              ? "bg-[#D8EC8D] text-black font-bold"
                              : "bg-slate-200/70 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          +{preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Post Reach / Shares */}
              <div
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  sharesCard.enabled
                    ? "bg-white dark:bg-[#131313]/90 border-slate-300 dark:border-[#D8EC8D]/50 shadow-sm dark:shadow-[0_0_20px_rgba(216,236,141,0.08)]"
                    : "bg-slate-50 dark:bg-[#121417]/50 border-slate-200/80 dark:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sharesCard.enabled}
                      onChange={(e) =>
                        setSharesCard((p) => ({ ...p, enabled: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-[#D8EC8D] bg-slate-100 dark:bg-black/40 border-slate-300 dark:border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#D8EC8D]"
                    />
                    <span className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${sharesCard.enabled ? "text-fg" : "text-fg-muted"}`}>
                      <Share2 className={`w-3.5 h-3.5 transition-colors ${sharesCard.enabled ? "text-[#D8EC8D]" : "text-slate-400"}`} />
                      Post Reach / Shares
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        sharesCard.enabled
                          ? "bg-[#D8EC8D]/15 text-[#171e00] dark:text-[#D8EC8D] border-[#D8EC8D]/30"
                          : "bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10"
                      }`}
                    >
                      {sharesCard.enabled ? "Active" : "Disabled"}
                    </span>
                    {sharesCard.serviceId && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 text-[#171e00] dark:text-[#D8EC8D] border border-accent/20">
                        {formatCurrency(Number(findService(sharesCard.serviceId)?.ratePer1000 || 0))} / 1k
                      </span>
                    )}
                  </div>
                </div>

                <div className={`space-y-3 pt-3 border-t border-slate-200/60 dark:border-white/5 transition-opacity ${sharesCard.enabled ? "opacity-100" : "opacity-60"}`}>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Service
                    </label>
                    <ServiceDropdownSelect
                      services={sharesServices}
                      selectedServiceId={sharesCard.serviceId}
                      onSelect={(svcId) =>
                        setSharesCard((p) => ({ ...p, enabled: true, serviceId: svcId }))
                      }
                      disabled={!sharesCard.enabled}
                      formatCurrency={formatCurrency}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span className="uppercase tracking-wider font-semibold">Quantity</span>
                      <span className="font-mono">
                        Min: {findService(sharesCard.serviceId)?.minQty || 100} | Max: {findService(sharesCard.serviceId)?.maxQty || 20000}
                      </span>
                    </div>
                    <input
                      type="number"
                      value={sharesCard.quantity || ""}
                      placeholder={String(findService(sharesCard.serviceId)?.minQty || 100)}
                      onChange={(e) =>
                        setSharesCard((p) => ({ ...p, enabled: true, quantity: Math.max(0, parseInt(e.target.value) || 0) }))
                      }
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-[#181818] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-[#D8EC8D]/60 transition-colors"
                    />
                    {sharesCard.enabled && Number(sharesCard.quantity) > 0 && Number(sharesCard.quantity) < (findService(sharesCard.serviceId)?.minQty || 1) && (
                      <p className="text-[10px] text-amber-500 font-medium mt-1">
                        ⚠️ Minimum quantity is {(findService(sharesCard.serviceId)?.minQty || 1).toLocaleString()}
                      </p>
                    )}
                    {sharesCard.enabled && (!sharesCard.quantity || Number(sharesCard.quantity) === 0) && (
                      <p className="text-[10px] text-amber-500 font-medium mt-1">
                        ⚠️ Please enter quantity (Min: {(findService(sharesCard.serviceId)?.minQty || 100).toLocaleString()})
                      </p>
                    )}
                    <div className="flex gap-1.5 mt-2">
                      {[500, 1000, 1500, 3000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSharesCard((p) => ({ ...p, enabled: true, quantity: preset }))}
                          className={`flex-1 py-1 rounded text-[10px] font-mono transition-colors ${
                            sharesCard.quantity === preset && sharesCard.enabled
                              ? "bg-[#D8EC8D] text-black font-bold"
                              : "bg-slate-200/70 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          +{preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 4: Followers / Subscribers Time-Interval Drip */}
              <div
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  followersCard.enabled
                    ? "bg-white dark:bg-[#131313]/90 border-slate-300 dark:border-[#D8EC8D]/50 shadow-sm dark:shadow-[0_0_20px_rgba(216,236,141,0.08)]"
                    : "bg-slate-50 dark:bg-[#121417]/50 border-slate-200/80 dark:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={followersCard.enabled}
                      onChange={(e) =>
                        setFollowersCard((p) => ({ ...p, enabled: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-[#D8EC8D] bg-slate-100 dark:bg-black/40 border-slate-300 dark:border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#D8EC8D]"
                    />
                    <span className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${followersCard.enabled ? "text-fg" : "text-fg-muted"}`}>
                      <Users className={`w-3.5 h-3.5 transition-colors ${followersCard.enabled ? "text-[#D8EC8D]" : "text-slate-400"}`} />
                      Followers Time-Interval Drip
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        followersCard.enabled
                          ? "bg-[#D8EC8D]/15 text-[#171e00] dark:text-[#D8EC8D] border-[#D8EC8D]/30"
                          : "bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10"
                      }`}
                    >
                      {followersCard.enabled ? "Active" : "Disabled"}
                    </span>
                    {followersCard.serviceId && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 text-[#171e00] dark:text-[#D8EC8D] border border-accent/20">
                        {formatCurrency(Number(findService(followersCard.serviceId)?.ratePer1000 || 0))} / 1k
                      </span>
                    )}
                  </div>
                </div>

                <div className={`space-y-3 pt-3 border-t border-slate-200/60 dark:border-white/5 transition-opacity ${followersCard.enabled ? "opacity-100" : "opacity-60"}`}>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Service
                    </label>
                    <ServiceDropdownSelect
                      services={followersServices}
                      selectedServiceId={followersCard.serviceId}
                      onSelect={(svcId) =>
                        setFollowersCard((p) => ({ ...p, enabled: true, serviceId: svcId }))
                      }
                      disabled={!followersCard.enabled}
                      formatCurrency={formatCurrency}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span className="uppercase tracking-wider font-semibold">
                        Total Followers across {durationDays} Days
                      </span>
                      <span className="font-mono">
                        Min: {findService(followersCard.serviceId)?.minQty || 100} | Max: {findService(followersCard.serviceId)?.maxQty || 50000}
                      </span>
                    </div>
                    <input
                      type="number"
                      value={followersCard.quantity || ""}
                      placeholder={String(findService(followersCard.serviceId)?.minQty || 100)}
                      onChange={(e) =>
                        setFollowersCard((p) => ({ ...p, enabled: true, quantity: Math.max(0, parseInt(e.target.value) || 0) }))
                      }
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-[#181818] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-[#D8EC8D]/60 transition-colors"
                    />
                    {followersCard.enabled && Number(followersCard.quantity) > 0 && Number(followersCard.quantity) < (findService(followersCard.serviceId)?.minQty || 1) && (
                      <p className="text-[10px] text-amber-500 font-medium mt-1">
                        ⚠️ Minimum quantity is {(findService(followersCard.serviceId)?.minQty || 1).toLocaleString()}
                      </p>
                    )}
                    {followersCard.enabled && (!followersCard.quantity || Number(followersCard.quantity) === 0) && (
                      <p className="text-[10px] text-amber-500 font-medium mt-1">
                        ⚠️ Please enter quantity (Min: {(findService(followersCard.serviceId)?.minQty || 100).toLocaleString()})
                      </p>
                    )}
                    <div className="flex gap-1.5 mt-2">
                      {[1000, 2500, 5000, 10000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setFollowersCard((p) => ({ ...p, enabled: true, quantity: preset }))}
                          className={`flex-1 py-1 rounded text-[10px] font-mono transition-colors ${
                            followersCard.quantity === preset && followersCard.enabled
                              ? "bg-[#D8EC8D] text-black font-bold"
                              : "bg-slate-200/70 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          +{preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Drip Run Interval
                    </label>
                    <GenericSelect
                      options={[
                        { value: 24, label: "Every 24 Hours (Daily Pacing)" },
                        { value: 12, label: "Every 12 Hours (Twice Daily)" },
                        { value: 8, label: "Every 8 Hours (3x Daily)" },
                        { value: 6, label: "Every 6 Hours (4x Daily)" },
                      ]}
                      value={followersCard.intervalHours || 24}
                      onChange={(val) =>
                        setFollowersCard((p) => ({
                          ...p,
                          enabled: true,
                          intervalHours: parseInt(val) || 24,
                        }))
                      }
                      className="w-full mt-1"
                      buttonClassName="w-full justify-between py-2"
                    />
                  </div>
                </div>
              </div>

              {/* Card 5: Custom Package Comments / Discussions */}
              <div
                className={`p-4 md:p-5 rounded-2xl border transition-all flex flex-col justify-between md:col-span-2 ${
                  commentsCard.enabled
                    ? "bg-white dark:bg-[#131313]/90 border-slate-300 dark:border-[#D8EC8D]/50 shadow-sm dark:shadow-[0_0_20px_rgba(216,236,141,0.08)]"
                    : "bg-slate-50 dark:bg-[#121417]/50 border-slate-200/80 dark:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={commentsCard.enabled}
                      onChange={(e) =>
                        setCommentsCard((p) => ({ ...p, enabled: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-[#D8EC8D] bg-slate-100 dark:bg-black/40 border-slate-300 dark:border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#D8EC8D]"
                    />
                    <span className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${commentsCard.enabled ? "text-fg" : "text-fg-muted"}`}>
                      <MessageSquare className={`w-3.5 h-3.5 transition-colors ${commentsCard.enabled ? "text-[#D8EC8D]" : "text-slate-400"}`} />
                      Custom Package Comments (Paced Discussions)
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        commentsCard.enabled
                          ? "bg-[#D8EC8D]/15 text-[#171e00] dark:text-[#D8EC8D] border-[#D8EC8D]/30"
                          : "bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10"
                      }`}
                    >
                      {commentsCard.enabled ? "Active" : "Disabled"}
                    </span>
                    {commentsCard.serviceId && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 text-[#171e00] dark:text-[#D8EC8D] border border-accent/20">
                        {formatCurrency(Number(findService(commentsCard.serviceId)?.ratePer1000 || 0))} / 1k
                      </span>
                    )}
                  </div>
                </div>

                <div className={`space-y-3.5 pt-3 border-t border-slate-200/60 dark:border-white/5 transition-opacity ${commentsCard.enabled ? "opacity-100" : "opacity-60"}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        Service
                      </label>
                      <ServiceDropdownSelect
                        services={commentsServices}
                        selectedServiceId={commentsCard.serviceId}
                        onSelect={(svcId) =>
                          setCommentsCard((p) => ({ ...p, enabled: true, serviceId: svcId }))
                        }
                        disabled={!commentsCard.enabled}
                        formatCurrency={formatCurrency}
                        emptyText={`No comment services available for ${platform}`}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span className="uppercase tracking-wider font-semibold">
                          Total Comments across {durationDays} Days
                        </span>
                        <span className="font-mono">
                          Min: {findService(commentsCard.serviceId)?.minQty || 5} | Max: {findService(commentsCard.serviceId)?.maxQty || 5000}
                        </span>
                      </div>
                      <input
                        type="number"
                        value={commentsCard.quantity}
                        onChange={(e) =>
                          setCommentsCard((p) => ({ ...p, enabled: true, quantity: Math.max(0, parseInt(e.target.value) || 0) }))
                        }
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-[#181818] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-[#D8EC8D]/60 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Comments Editor Toolbar */}
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold border ${
                            dripCommentsLines.length >= (findService(commentsCard.serviceId)?.minQty || 1) &&
                            dripCommentsLines.length <= (findService(commentsCard.serviceId)?.maxQty || 5000)
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                          }`}
                        >
                          💬 {dripCommentsLines.length} {dripCommentsLines.length === 1 ? "Line" : "Lines"}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          (~{Math.ceil(dripCommentsLines.length / Math.max(durationDays, 1))} comments/day)
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleAddSampleCommentsToDrip(5)}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-[11px] font-medium transition-colors"
                        >
                          + Add 5 Samples
                        </button>
                        <button
                          type="button"
                          onClick={handleCleanDripComments}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-[11px] font-medium transition-colors"
                        >
                          🧹 Clean & Trim
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const clip = await navigator.clipboard.readText();
                              if (clip) {
                                const existing = commentsCard.commentsText ? commentsCard.commentsText + "\n" : "";
                                const updated = existing + clip.trim();
                                const count = updated.split("\n").map((l) => l.trim()).filter(Boolean).length;
                                setCommentsCard((p) => ({
                                  ...p,
                                  enabled: true,
                                  commentsText: updated,
                                  quantity: count,
                                }));
                              }
                            } catch {}
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-[11px] font-medium transition-colors flex items-center gap-1"
                        >
                          <Clipboard className="w-3 h-3" />
                          <span>Paste</span>
                        </button>
                        {commentsCard.commentsText && (
                          <button
                            type="button"
                            onClick={() =>
                              setCommentsCard((p) => ({ ...p, commentsText: "", quantity: 10 }))
                            }
                            className="px-2 py-1 rounded-lg text-slate-400 hover:text-red-500 text-[11px] font-medium transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="relative">
                      <textarea
                        rows={4}
                        value={commentsCard.commentsText}
                        onChange={(e) => {
                          const val = e.target.value;
                          const count = val.split("\n").map((l) => l.trim()).filter(Boolean).length;
                          setCommentsCard((p) => ({
                            ...p,
                            enabled: true,
                            commentsText: val,
                            quantity: count > 0 ? count : p.quantity,
                          }));
                        }}
                        placeholder={"Enter custom comments (1 per line). They will be spaced across the duration...\nAwesome content! 🔥\nLoved this post! 👏\nSuper helpful and well explained! ❤️"}
                        className="w-full p-3 rounded-xl bg-white dark:bg-[#181818] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-xs font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#D8EC8D]/70 transition-all leading-relaxed min-h-[100px] max-h-[260px] resize-y"
                      />
                      <div className="absolute bottom-2.5 right-3 text-[10px] text-slate-400 pointer-events-none font-mono">
                        1 comment per line
                      </div>
                    </div>

                    {/* Status & Validation Feedback */}
                    <div className="space-y-1 text-xs">
                      {hasDuplicateDripComments && (
                        <p className="text-amber-600 dark:text-amber-400 text-[11px] flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          <span>Duplicate comments detected. Each line will be paced individually.</span>
                        </p>
                      )}
                      {hasUrlInDripComments && (
                        <p className="text-amber-600 dark:text-amber-400 text-[11px] flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Links/URLs detected. Social platforms often filter or flag comments containing URLs.</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Smooth Organic Intra-Day Drip & Safe Random Triggers */}
            <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-[#D8EC8D]/10 to-transparent border border-[#D8EC8D]/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#D8EC8D]" />
                  <span className="text-xs font-bold text-fg">Smooth Intra-Day Drip & Random Safe Triggers</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPacingStrategy("ORGANIC_RANDOM")}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      pacingStrategy === "ORGANIC_RANDOM"
                        ? "bg-[#D8EC8D] text-black shadow-sm"
                        : "bg-surface-raised text-fg-muted hover:text-fg"
                    }`}
                  >
                    🌿 Organic Random (Safe)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPacingStrategy("UNIFORM")}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      pacingStrategy === "UNIFORM"
                        ? "bg-[#D8EC8D] text-black shadow-sm"
                        : "bg-surface-raised text-fg-muted hover:text-fg"
                    }`}
                  >
                    ⏱️ Uniform Paced
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-fg-2 leading-relaxed">
                {pacingStrategy === "ORGANIC_RANDOM"
                  ? "Organic random variance (±15% natural jitter) spreads Followers, Likes & Views dynamically throughout each day to mirror authentic human growth without triggering platform bot detection."
                  : "Uniform delivery distributes batches equally at strict periodic clock intervals throughout the chosen duration."}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-fg-muted font-mono">
                <div className="p-2 rounded-xl bg-surface/60 border border-border flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#D8EC8D] shrink-0" />
                  <span>Followers: Safe daily pacing</span>
                </div>
                <div className="p-2 rounded-xl bg-surface/60 border border-border flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#D8EC8D] shrink-0" />
                  <span>Likes: Natural intra-day curve</span>
                </div>
                <div className="p-2 rounded-xl bg-surface/60 border border-border flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#D8EC8D] shrink-0" />
                  <span>Views: High-retention drip</span>
                </div>
              </div>
            </div>

            {/* All Custom Platform Services Catalog Section */}
            <div className="p-4 md:p-5 rounded-2xl border border-border bg-white dark:bg-[#131313]/90 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-[#D8EC8D]" />
                    All Platform Services ({services.length} available)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Add any active service for {platform} (Saves, Story Views, Impressions, Watch Time, etc.)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCatalogSection(!showCatalogSection)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent/15 text-accent-text border border-accent/30 hover:bg-accent/25 transition-colors flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{showCatalogSection ? "Close Catalog" : "+ Add Other Service"}</span>
                </button>
              </div>

              {/* Added Additional Services List */}
              {additionalServices.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-border">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Added Custom Services ({additionalServices.length})
                  </span>
                  <div className="space-y-2">
                    {additionalServices.map((item) => {
                      const svc = findService(item.serviceId);
                      const rate = Number(svc?.ratePer1000 || 0);
                      const cost = (rate * item.quantity) / 1000;
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-surface-raised border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-fg truncate">
                                {svc?.displayName || svc?.name || "Service #" + item.serviceId}
                              </span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-200 dark:bg-white/5 text-slate-400 font-mono">
                                {svc?.categoryName || "Custom"}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              ₹{rate.toFixed(2)}/1k • Min: {svc?.minQty || 100} • Max: {svc?.maxQty || 50000}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 uppercase">Qty:</span>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setAdditionalServices((prev) =>
                                    prev.map((s) => (s.id === item.id ? { ...s, quantity: val } : s))
                                  );
                                }}
                                className="w-20 px-2 py-1 rounded-lg bg-surface border border-border text-center font-mono text-xs font-bold text-fg focus:outline-none focus:border-[#D8EC8D]"
                              />
                            </div>
                            <span className="font-mono font-bold text-[#D8EC8D] text-xs">
                              ₹{cost.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setAdditionalServices((prev) => prev.filter((s) => s.id !== item.id));
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              title="Remove service"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expandable Catalog Browser */}
              {showCatalogSection && (
                <div className="p-3.5 rounded-xl bg-surface-raised border border-border space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Search services (e.g. saves, reach, impressions, story)..."
                      className="px-3 py-2 rounded-xl bg-surface border border-border text-xs text-fg placeholder:text-slate-500 focus:outline-none focus:border-[#D8EC8D]"
                    />
                    <select
                      value={catalogCategoryFilter}
                      onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-surface border border-border text-xs text-fg focus:outline-none focus:border-[#D8EC8D]"
                    >
                      <option value="ALL">All Categories ({services.length})</option>
                      {platformCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {filteredCatalogServices.slice(0, 30).map((svc) => {
                      const isAdded = additionalServices.some((a) => a.serviceId === svc.id);
                      return (
                        <div
                          key={svc.id}
                          className="p-2.5 rounded-lg bg-surface/60 hover:bg-surface border border-border flex items-center justify-between gap-3 text-xs transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-fg truncate">
                              {svc.displayName || svc.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {svc.categoryName || "Service"} • ₹{Number(svc.ratePer1000 || 0).toFixed(2)}/1k • Min: {svc.minQty || 100}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => {
                              const newId = `add_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                              setAdditionalServices((prev) => [
                                ...prev,
                                {
                                  id: newId,
                                  serviceId: svc.id,
                                  quantity: svc.minQty || 1000,
                                  intervalHours: 24,
                                },
                              ]);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all ${
                              isAdded
                                ? "bg-slate-200/50 dark:bg-white/5 text-slate-500 cursor-not-allowed"
                                : "bg-[#D8EC8D] text-black hover:brightness-105"
                            }`}
                          >
                            {isAdded ? "Added" : "+ Add"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Advance Button */}
            <div className="lg:hidden pt-2">
              <button
                type="button"
                onClick={() => setMobileStep(3)}
                className="w-full py-2.5 rounded-xl bg-[#D8EC8D] text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(216,236,141,0.2)]"
              >
                Review Schedule & Order
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Schedule Preview, Duration Chips, Warnings & Order Summary */}
        <div
          className={`lg:col-span-4 lg:sticky lg:top-24 space-y-4 ${
            mobileStep === 1 || mobileStep === 2 ? "hidden lg:block" : "block"
          }`}
        >
          {/* Glass Card: Schedule & Timeline Preview */}
          <GlassCard className="p-5 border-border space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#D8EC8D]" />
                Delivery Schedule Preview
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 text-accent-text border border-accent/20">
                {durationDays} Days Pacing
              </span>
            </div>

            {/* Visual Dispatch SVG Chart */}
            <div className="h-28 w-full bg-slate-100 dark:bg-black/40 rounded-xl border border-slate-200/80 dark:border-white/5 p-2 relative overflow-hidden flex flex-col justify-end">
              {quoteLoading ? (
                <div className="h-full flex items-center justify-center text-[11px] text-accent-text font-mono animate-pulse">
                  Calculating schedule timeline...
                </div>
              ) : quoteError ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-2 text-amber-500 text-xs">
                  <AlertTriangle className="w-4 h-4 mb-1 text-amber-400" />
                  <span className="font-semibold text-[11px]">Configuration Notice</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{quoteError}</span>
                </div>
              ) : quoteData?.timeline && quoteData.timeline.length > 0 ? (
                <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="limeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D8EC8D" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#D8EC8D" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const points = quoteData.timeline;
                    const getQty = (p: any) =>
                      typeof p.quantity === "number"
                        ? p.quantity
                        : Array.isArray(p.items)
                        ? p.items.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0)
                        : 0;

                    const maxQty = Math.max(...points.map(getQty), 1);
                    const stepX = 300 / Math.max(points.length - 1, 1);
                    const coords = points.map((p: any, idx: number) => {
                      const qty = getQty(p);
                      return {
                        x: idx * stepX,
                        y: 90 - (qty / maxQty) * 70,
                      };
                    });

                    let pathD = `M ${coords[0].x} ${coords[0].y}`;
                    for (let i = 1; i < coords.length; i++) {
                      const prev = coords[i - 1];
                      const curr = coords[i];
                      const cx = (prev.x + curr.x) / 2;
                      pathD += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
                    }

                    const fillD = `${pathD} L ${coords[coords.length - 1].x} 100 L ${coords[0].x} 100 Z`;

                    return (
                      <>
                        <path d={fillD} fill="url(#limeGrad)" />
                        <path d={pathD} fill="none" stroke="#D8EC8D" strokeWidth="2.5" />
                        {coords.map((c: any, i: number) => (
                          <circle key={i} cx={c.x} cy={c.y} r="3" fill="#D8EC8D" />
                        ))}
                      </>
                    );
                  })()}
                </svg>
              ) : (
                <div className="h-full flex items-center justify-center text-[11px] text-slate-500 font-mono">
                  Configuring schedule timeline...
                </div>
              )}
            </div>

            {/* Duration Chips & Slider Selector (1 - 60 Days) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Completion Duration
                </label>
                <span className="text-[10px] font-mono font-bold text-[#D8EC8D] px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                  {durationDays} {durationDays === 1 ? "Day" : "Days"} (Max 60d)
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {(Array.from(new Set([...(durationChips || []), 3, 60])).sort((a, b) => a - b)).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDurationDays(days)}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      durationDays === days
                        ? "bg-[#D8EC8D] text-black border-[#D8EC8D] font-bold shadow-[0_0_10px_rgba(216,236,141,0.2)]"
                        : "bg-slate-100 dark:bg-black/30 border border-border text-slate-700 text-fg-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5"
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>

              {/* Precise Slider + Number input up to 60 days */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Math.min(60, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="flex-1 accent-[#D8EC8D] cursor-pointer h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={durationDays}
                    onChange={(e) => setDurationDays(Math.min(60, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-12 px-2 py-1 rounded-md bg-slate-100 dark:bg-black/40 border border-border text-center font-mono text-xs font-bold text-fg focus:outline-none focus:border-[#D8EC8D]"
                  />
                  <span className="text-[11px] text-slate-400">days</span>
                </div>
              </div>
            </div>

            {/* Delivery Window Selector (D3 UI) */}
            <div className="space-y-2.5 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#D8EC8D]" />
                  Delivery Window
                </label>
                <span className="text-[10px] text-fg-muted font-mono">{timezone}</span>
              </div>

              {/* Window Preset Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { key: "ANY_TIME", label: "Any time (24/7)" },
                  { key: "DAYTIME", label: "Daytime (09:00 - 21:00)" },
                  { key: "EVENING", label: "Evening (17:00 - 23:00)" },
                  { key: "CUSTOM", label: "Custom Window" },
                ].map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setWindowPreset(preset.key as any)}
                    className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border text-left transition-all ${
                      windowPreset === preset.key
                        ? "bg-[#D8EC8D] text-black border-[#D8EC8D] font-bold shadow-[0_0_8px_rgba(216,236,141,0.15)]"
                        : "bg-surface-raised border-border text-fg-muted hover:text-fg hover:bg-surface hover:border-slate-300 dark:hover:border-white/10"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Hours and Days Controls if Custom is selected */}
              {windowPreset === "CUSTOM" && (
                <div className="p-2.5 rounded-xl bg-surface-raised border border-border space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono">From (Local)</span>
                      <div className="mt-0.5">
                        <GenericSelect
                          options={Array.from({ length: 24 }).map((_, h) => ({
                            value: h,
                            label: `${String(h).padStart(2, '0')}:00`,
                          }))}
                          value={customStartHour}
                          onChange={(val) => setCustomStartHour(parseInt(val) || 0)}
                          className="w-full"
                          buttonClassName="w-full justify-between py-1 px-2"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono">To (Local)</span>
                      <div className="mt-0.5">
                        <GenericSelect
                          align="right"
                          options={Array.from({ length: 24 }).map((_, h) => ({
                            value: h,
                            label: `${String(h).padStart(2, '0')}:00`,
                          }))}
                          value={customEndHour}
                          onChange={(val) => {
                            const newEnd = parseInt(val) || 0;
                            setCustomEndHour(newEnd === customStartHour ? (newEnd + 1) % 24 : newEnd);
                          }}
                          className="w-full"
                          buttonClassName="w-full justify-between py-1 px-2"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-mono block mb-1">Active Days</span>
                    <div className="flex justify-between gap-1">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => {
                        const isChecked = customDaysOfWeek.includes(idx);
                        return (
                          <button
                            key={dayName}
                            type="button"
                            aria-label={`Toggle ${dayName}`}
                            aria-pressed={isChecked}
                            onClick={() => {
                              if (isChecked) {
                                if (customDaysOfWeek.length > 1) {
                                  setCustomDaysOfWeek(customDaysOfWeek.filter(d => d !== idx));
                                }
                              } else {
                                setCustomDaysOfWeek([...customDaysOfWeek, idx].sort((a, b) => a - b));
                              }
                            }}
                            className={`flex-1 py-1 text-[10px] font-mono rounded border ${
                              isChecked
                                ? "bg-accent text-on-accent font-bold border-accent shadow-xs"
                                : "bg-surface border-border text-fg-muted"
                            }`}
                          >
                            {dayName[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Timezone Selector */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Timezone</span>
                <GenericSelect
                  align="right"
                  ariaLabel="Select timezone"
                  options={[
                    { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
                    { value: "America/New_York", label: "America/New_York (EST/EDT)" },
                    { value: "Europe/London", label: "Europe/London (GMT/BST)" },
                    { value: "UTC", label: "UTC (Universal Time)" },
                    { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
                    { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
                    { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
                  ]}
                  value={timezone}
                  onChange={(val) => setTimezone(String(val))}
                  buttonClassName="py-1 px-2.5"
                />
              </div>
            </div>

            {/* Extra Hours Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Extra Hours Offset</span>
                <span className="text-accent-text font-bold">+{extraHours} hrs</span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                step="1"
                value={extraHours}
                onChange={(e) => setExtraHours(parseInt(e.target.value) || 0)}
                className="w-full accent-[#D8EC8D] bg-slate-200 dark:bg-black/40 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Slicing & Duration Warning Alert */}
            {(quoteData?.fitsDuration === false || (quoteData?.warnings && quoteData.warnings.length > 0)) && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Schedule Pacing Notice
                </div>
                {quoteData?.fitsDuration === false && (
                  <p className="leading-snug text-amber-200/90 font-medium">
                    Chosen delivery window is narrower than the pacing duration. Final runs will finish at {new Date(quoteData.finishesAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}.
                  </p>
                )}
                {quoteData?.warnings?.map((w: string, idx: number) => (
                  <p key={idx} className="leading-snug text-amber-200/90">
                    {w}
                  </p>
                ))}
              </div>
            )}

            {/* Real Runs Date & Time Timeline */}
            {quoteData?.runs && quoteData.runs.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
                  <span>Planned Batch Schedule</span>
                  <span className="font-mono text-slate-500">{quoteData.runs.length} Runs</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {quoteData.runs.map((r: any) => {
                    const execDate = new Date(r.executeAt);
                    const formattedDate = execDate.toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      timeZone: timezone,
                    });
                    const formattedTime = execDate.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: timezone,
                    });
                    return (
                      <div
                        key={r.seq}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface-raised border border-border text-[11px]"
                      >
                        <span className="font-mono text-fg font-medium">
                          Run #{r.seq}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400">
                            {r.quantity.toLocaleString()} units
                          </span>
                          <span className="font-mono text-accent-text font-semibold">
                            {formattedDate}, {formattedTime}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Campaign Validity & Booking Specification */}
            <div className="p-3 rounded-xl bg-surface-raised border border-border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#D8EC8D]" />
                  Campaign Validity
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#D8EC8D]/15 text-[#D8EC8D] font-bold">
                  {durationDays} {durationDays === 1 ? "Day" : "Days"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-[11px] font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">Booking Date</span>
                  <span className="text-fg font-medium">
                    {new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Valid Through</span>
                  <span className="text-[#D8EC8D] font-medium">
                    {new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
            </div>

            {/* Itemized Line-Items Breakdown */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Price Breakdown
              </label>

              {quoteLoading ? (
                <div className="py-4 text-center text-xs text-slate-400 animate-pulse font-mono">
                  Updating price quote...
                </div>
              ) : quoteError ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1 my-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Configuration Notice</span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">{quoteError}</p>
                </div>
              ) : quoteData?.items && quoteData.items.length > 0 ? (
                <div className="space-y-1.5">
                  {quoteData.items.map((item: any) => (
                    <div
                      key={item.serviceId}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 dark:border-white/5"
                    >
                      <div className="truncate pr-2">
                        <p className="text-fg font-medium truncate">{item.serviceName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {item.quantity.toLocaleString()} units &bull; {item.days}d
                        </p>
                      </div>
                      <span className="text-fg font-mono shrink-0">
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-2 text-sm">
                    <span className="font-bold text-fg-2">Total Amount</span>
                    <span className="font-bold text-accent-text font-mono text-base">
                      {formatCurrency(quoteData.totalCharge)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-2">
                  Select at least one service to view breakdown.
                </div>
              )}
            </div>

            {/* Wallet Balance Verification */}
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Wallet Balance:</span>
              <span
                className={`font-mono font-bold ${
                  walletBalance >= (quoteData?.totalCharge || 0)
                    ? "text-accent-text"
                    : "text-red-400"
                }`}
              >
                {formatCurrency(walletBalance)}
              </span>
            </div>

            {/* Insufficient Funds Recovery */}
            {quoteData && walletBalance < quoteData.totalCharge && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
                <span>Insufficient balance for this campaign.</span>
                <a
                  href="/wallet"
                  className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 font-bold text-red-200"
                >
                  Add Funds
                </a>
              </div>
            )}

            {/* Error Message */}
            {orderError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{orderError}</p>
              </div>
            )}

            {/* Compliance Consent Checkbox */}
            <label className="flex items-start gap-2 pt-1 text-[11px] text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 rounded text-[#D8EC8D] bg-slate-100 dark:bg-black/40 border-slate-300 dark:border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#D8EC8D]"
              />
              <span className="leading-tight">
                I agree to the Terms of Service and acknowledge deterministic schedule dispatches.
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleOrderSubmit}
              disabled={
                isSubmitting ||
                quoteLoading ||
                quoteStale ||
                !quoteData ||
                walletBalance < (quoteData?.totalCharge || 0) ||
                !consentChecked
              }
              className={`w-full py-3 rounded-xl text-black font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                isSubmitting ||
                quoteLoading ||
                !quoteData ||
                walletBalance < (quoteData?.totalCharge || 0) ||
                !consentChecked
                  ? "bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-200/60 dark:border-white/5"
                  : "bg-[#D8EC8D] hover:bg-[#cbe27a] shadow-[0_0_20px_rgba(216,236,141,0.3)] active:scale-[0.99]"
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Campaign...
                </>
              ) : quoteLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating Quote...
                </>
              ) : (
                <>
                  Submit Custom Package Order
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

