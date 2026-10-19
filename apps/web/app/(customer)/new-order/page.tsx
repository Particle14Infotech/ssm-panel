"use client";

import React, { useState, useEffect, useMemo, useReducer, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import {
  cleanServiceName,
  validateServiceLink,
  calculateCustomerCharge,
} from "@smm/contracts";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Clock,
  Search,
  ChevronDown,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  X,
  Clipboard,
  Info,
  Check,
  ChevronUp,
  Calendar,
  Bookmark,
  Zap,
  Boxes,
} from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CountUpNumber } from "@/components/motion/CountUpNumber";
import { motion, AnimatePresence } from "framer-motion";
import { PackageOrderBuilder } from "@/components/customer/PackageOrderBuilder";

// Helper: Format numbers with Indian numbering system (e.g. 1,00,000)
function formatIndianNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return "0";
  return Number(num).toLocaleString("en-IN");
}

// Helper: Format duration minutes into plain text
function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface FormState {
  selectedPlatform: string;
  selectedServiceId: string;
  targetUrl: string;
  quantity: number;
  isDripFeed: boolean;
  dripRuns: number;
  dripInterval: number;
  comments: string;
}

type FormAction =
  | { type: "SET_PLATFORM"; platform: string }
  | { type: "SET_SERVICE_ID"; serviceId: string }
  | { type: "SET_TARGET_URL"; targetUrl: string }
  | { type: "SET_QUANTITY"; quantity: number }
  | { type: "TOGGLE_DRIP_FEED"; enabled?: boolean }
  | { type: "SET_DRIP_RUNS"; runs: number }
  | { type: "SET_DRIP_INTERVAL"; interval: number }
  | { type: "SET_COMMENTS"; comments: string }
  | { type: "RESET_FORM"; partial?: Partial<FormState> };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_PLATFORM":
      return { ...state, selectedPlatform: action.platform };
    case "SET_SERVICE_ID":
      return { ...state, selectedServiceId: action.serviceId };
    case "SET_TARGET_URL":
      return { ...state, targetUrl: action.targetUrl };
    case "SET_QUANTITY":
      return { ...state, quantity: Math.max(1, action.quantity) };
    case "TOGGLE_DRIP_FEED":
      return { ...state, isDripFeed: action.enabled !== undefined ? action.enabled : !state.isDripFeed };
    case "SET_DRIP_RUNS":
      return { ...state, dripRuns: Math.max(2, action.runs) };
    case "SET_DRIP_INTERVAL":
      return { ...state, dripInterval: Math.max(5, action.interval) };
    case "SET_COMMENTS":
      return { ...state, comments: action.comments };
    case "RESET_FORM":
      return { ...state, ...action.partial };
    default:
      return state;
  }
}

const STORAGE_KEY = "smm_new_order_state";
const LAST_PLATFORM_KEY = "smm_last_platform";

function NewOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialServiceParam = searchParams.get("service") || searchParams.get("serviceId");
  const initialPlatformParam = searchParams.get("platform");

  const { user, services, createOrder, favorites } = useCustomer();

  // Load last platform or query param
  const initialPlatform = initialPlatformParam
    ? initialPlatformParam.toLowerCase()
    : typeof window !== "undefined"
    ? localStorage.getItem(LAST_PLATFORM_KEY) || "instagram"
    : "instagram";

  const [state, dispatch] = useReducer(formReducer, {
    selectedPlatform: initialPlatform,
    selectedServiceId: initialServiceParam || "",
    targetUrl: "",
    quantity: 1000,
    isDripFeed: false,
    dripRuns: 5,
    dripInterval: 60,
    comments: "",
  });

  // UI modal / state
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [comboboxSearch, setComboboxSearch] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successOrder, setSuccessOrder] = useState<any | null>(null);
  const [dripScheduleMode, setDripScheduleMode] = useState<"DAYS" | "CUSTOM">("DAYS");
  const [loadedFromFavorite, setLoadedFromFavorite] = useState<string | null>(null);
  const [orderMode, setOrderMode] = useState<"SINGLE" | "PACKAGE">(
    searchParams.get("tab") === "package" ? "PACKAGE" : "SINGLE"
  );

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "package") {
      setOrderMode("PACKAGE");
    } else if (tab === "single") {
      setOrderMode("SINGLE");
    }
  }, [searchParams]);

  // Restore preserved form state from sessionStorage if returning from Add Funds
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        dispatch({ type: "RESET_FORM", partial: parsed });
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, []);

  // Save platform preference
  useEffect(() => {
    try {
      localStorage.setItem(LAST_PLATFORM_KEY, state.selectedPlatform);
    } catch {}
  }, [state.selectedPlatform]);

  // Deep linking: if initialServiceParam changes
  useEffect(() => {
    if (initialServiceParam) {
      const match = services.find((s) => s.id === initialServiceParam);
      if (match) {
        dispatch({ type: "SET_PLATFORM", platform: match.platform.toLowerCase().replace("x_twitter", "x") });
        dispatch({ type: "SET_SERVICE_ID", serviceId: match.id });
      }
    }
  }, [initialServiceParam, services]);

  // Prefill from Favorite if ?favoriteId=... query parameter is present
  useEffect(() => {
    const favoriteId = searchParams.get("favoriteId");
    if (favoriteId && favorites.length > 0) {
      const fav = favorites.find((f) => f.id === favoriteId);
      if (fav) {
        const matchService = services.find((s) => s.id === fav.serviceId);
        dispatch({
          type: "RESET_FORM",
          partial: {
            selectedPlatform: matchService
              ? matchService.platform.toLowerCase().replace("x_twitter", "x")
              : "instagram",
            selectedServiceId: fav.serviceId,
            targetUrl: fav.targetUrl,
            quantity: fav.defaultQuantity,
            isDripFeed: Boolean(fav.isDripFeed),
            dripRuns: fav.dripRuns || 5,
            dripInterval: fav.dripInterval || 60,
            comments: fav.comments || "",
          },
        });
        setLoadedFromFavorite(fav.customName || matchService?.displayName || matchService?.name || "Saved Favorite");
      }
    }
  }, [searchParams, favorites, services]);

  // Support direct URL prefilling for target and quantity
  useEffect(() => {
    const targetParam = searchParams.get("target");
    const quantityParam = searchParams.get("quantity");
    if (targetParam || quantityParam) {
      const partial: any = {};
      if (targetParam) partial.targetUrl = targetParam;
      if (quantityParam && parseInt(quantityParam, 10)) {
        partial.quantity = parseInt(quantityParam, 10);
      }
      dispatch({ type: "RESET_FORM", partial });
    }
  }, [searchParams]);

  // Compute active platforms and counts
  const platformCounts = useMemo(() => {
    const map = new Map<string, number>();
    services.forEach((s) => {
      if (s.status === "ACTIVE" || !s.status) {
        let p = (s.platform || "general").toLowerCase().replace("x_twitter", "x");
        map.set(p, (map.get(p) || 0) + 1);
      }
    });
    return map;
  }, [services]);

  const platformList = useMemo(() => {
    const canonicalOrder = [
      { id: "instagram", name: "Instagram" },
      { id: "youtube", name: "YouTube" },
      { id: "tiktok", name: "TikTok" },
      { id: "telegram", name: "Telegram" },
      { id: "x", name: "X" },
      { id: "spotify", name: "Spotify" },
      { id: "facebook", name: "Facebook" },
      { id: "more", name: "More" },
    ];

    return canonicalOrder.filter((p) => {
      if (p.id === "more") {
        // Show More if there are platforms outside the top ones
        return true;
      }
      return (platformCounts.get(p.id) || 0) > 0;
    });
  }, [platformCounts]);

  // Filter services for current platform
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const p = (s.platform || "general").toLowerCase().replace("x_twitter", "x");
      if (state.selectedPlatform === "more") {
        return !["instagram", "youtube", "tiktok", "telegram", "x", "spotify", "facebook"].includes(p);
      }
      return p === state.selectedPlatform;
    });
  }, [services, state.selectedPlatform]);

  // Current active service
  const activeService = useMemo(() => {
    return (
      filteredServices.find((s) => s.id === state.selectedServiceId) ||
      services.find((s) => s.id === state.selectedServiceId) ||
      filteredServices[0] ||
      services[0]
    );
  }, [filteredServices, services, state.selectedServiceId]);

  // Auto-select first service of platform if current is not in filtered list
  useEffect(() => {
    if (filteredServices.length > 0 && !filteredServices.some((s) => s.id === state.selectedServiceId)) {
      dispatch({ type: "SET_SERVICE_ID", serviceId: filteredServices[0].id });
    }
  }, [filteredServices, state.selectedServiceId]);

  // Cleaned active service details
  const cleanedNameInfo = useMemo(() => {
    return cleanServiceName(activeService?.displayName || activeService?.name || "");
  }, [activeService]);

  const isNativeDrip = Boolean(activeService?.dripFeedSupported);
  const isCustomComments =
    activeService?.serviceType === "CUSTOM_COMMENTS" ||
    activeService?.serviceType === "COMMENTS" ||
    (activeService?.name || "").toLowerCase().includes("custom comment");
  const isManagedDrip = activeService?.allowManagedDrip !== false && !isCustomComments;
  const isDripSupported = (isNativeDrip || isManagedDrip) && !isCustomComments;

  const minQty = activeService?.minQty || 10;
  const maxQty = activeService?.maxQty || 1000000;
  const minRuns = isManagedDrip && !isNativeDrip ? 2 : (activeService?.dripFeedMinRuns || 2);
  const maxRuns = isManagedDrip && !isNativeDrip ? 30 : (activeService?.dripFeedMaxRuns || 100);
  const minInterval = isManagedDrip && !isNativeDrip ? 30 : (activeService?.dripFeedMinInterval || 5);
  const maxInterval = activeService?.dripFeedMaxInterval || 1440;

  // Custom comments processing
  const commentsList = useMemo(() => {
    if (!isCustomComments) return [];
    return state.comments
      .split("\n")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }, [isCustomComments, state.comments]);

  const hasDuplicateComments = useMemo(() => {
    if (!isCustomComments || commentsList.length === 0) return false;
    return new Set(commentsList).size !== commentsList.length;
  }, [isCustomComments, commentsList]);

  // If custom comments, quantity equals comment count
  useEffect(() => {
    if (isCustomComments) {
      const count = commentsList.length;
      if (count > 0 && count !== state.quantity) {
        dispatch({ type: "SET_QUANTITY", quantity: count });
      }
    }
  }, [isCustomComments, commentsList.length, state.quantity]);

  // Link type determination
  const linkType = useMemo(() => {
    if (activeService?.linkType) return activeService.linkType;
    const lower = (activeService?.name || "").toLowerCase();
    if (lower.includes("follower") || lower.includes("subscriber") || lower.includes("member")) {
      return state.selectedPlatform === "youtube" ? "CHANNEL" : "PROFILE";
    }
    return "POST_OR_REEL";
  }, [activeService, state.selectedPlatform]);

  const linkLabel = useMemo(() => {
    switch (linkType) {
      case "PROFILE":
        return "Profile link";
      case "CHANNEL":
        return "Channel link";
      case "POST_OR_REEL":
        return state.selectedPlatform === "youtube" ? "Video link" : "Post or reel link";
      default:
        return "Link";
    }
  }, [linkType, state.selectedPlatform]);

  const linkPlaceholder = useMemo(() => {
    switch (state.selectedPlatform) {
      case "instagram":
        return linkType === "PROFILE" ? "https://instagram.com/username" : "https://instagram.com/reel/C0xyz...";
      case "youtube":
        return linkType === "CHANNEL" ? "https://youtube.com/@channel" : "https://youtube.com/watch?v=...";
      case "tiktok":
        return linkType === "PROFILE" ? "https://tiktok.com/@username" : "https://tiktok.com/@user/video/...";
      case "x":
        return linkType === "PROFILE" ? "https://x.com/username" : "https://x.com/user/status/...";
      case "telegram":
        return linkType === "CHANNEL" ? "https://t.me/channel" : "https://t.me/channel/123";
      default:
        return "https://...";
    }
  }, [state.selectedPlatform, linkType]);

  // Inline Link Format Validation
  const linkValidation = useMemo(() => {
    if (!state.targetUrl.trim()) {
      return { isValid: false, error: "Link is required" };
    }
    return validateServiceLink(state.targetUrl, state.selectedPlatform, linkType);
  }, [state.targetUrl, state.selectedPlatform, linkType]);

  // Quantity Bounds Validation
  const quantityValid = state.quantity >= minQty && state.quantity <= maxQty;

  // Drip-Feed Bounds Validation
  const effectiveRuns = state.isDripFeed && isDripSupported ? state.dripRuns : 1;
  const runsValid = !state.isDripFeed || (state.dripRuns >= minRuns && state.dripRuns <= maxRuns);
  const intervalValid =
    !state.isDripFeed || (state.dripInterval >= minInterval && state.dripInterval <= maxInterval);

  // Financial calculations using single shared pricing function
  const unitRate = activeService ? activeService.ratePer1000 : 0;
  const chargeCalculation = useMemo(() => {
    return calculateCustomerCharge(
      unitRate,
      state.quantity,
      effectiveRuns,
      0, // Drip surcharge percent (default 0)
      1.0 // Minimum order charge (₹1.00)
    );
  }, [unitRate, state.quantity, effectiveRuns]);

  const totalPrice = chargeCalculation.customerCharge.toNumber();
  const totalUnits = chargeCalculation.totalUnits;
  const remainingBalance = Number((user.balance - totalPrice).toFixed(2));
  const hasSufficientFunds = user.balance >= totalPrice;
  const shortfall = Math.max(0, Number((totalPrice - user.balance).toFixed(2)));

  // Form validity check
  const isFormValid =
    Boolean(activeService) &&
    linkValidation.isValid &&
    quantityValid &&
    runsValid &&
    intervalValid &&
    (!isCustomComments || (commentsList.length >= minQty && commentsList.length <= maxQty));

  // Missing fields checklist
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!state.targetUrl.trim()) {
      errors.push("Enter a link");
    } else if (!linkValidation.isValid && linkValidation.error) {
      errors.push(linkValidation.error);
    }
    if (!quantityValid) {
      errors.push(`Quantity must be ${formatIndianNumber(minQty)} - ${formatIndianNumber(maxQty)}`);
    }
    if (state.isDripFeed && !runsValid) {
      errors.push(`Runs must be between ${minRuns} and ${maxRuns}`);
    }
    if (state.isDripFeed && !intervalValid) {
      errors.push(`Interval must be between ${minInterval} and ${maxInterval} minutes`);
    }
    if (isCustomComments && commentsList.length === 0) {
      errors.push("Enter at least one comment");
    }
    return errors;
  }, [
    state.targetUrl,
    linkValidation,
    quantityValid,
    state.isDripFeed,
    runsValid,
    intervalValid,
    isCustomComments,
    commentsList.length,
    minQty,
    maxQty,
    minRuns,
    maxRuns,
    minInterval,
    maxInterval,
  ]);

  // Paste from clipboard helper
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) dispatch({ type: "SET_TARGET_URL", targetUrl: text.trim() });
    } catch {
      // Clipboard permissions denied
    }
  };

  // Quantity presets: 100, 500, 1,000, 5,000, 10,000 (filtered by min/max)
  const availablePresets = useMemo(() => {
    const list = [100, 500, 1000, 5000, 10000];
    return list.filter((p) => p >= minQty && p <= maxQty);
  }, [minQty, maxQty]);

  // Handle open confirm modal
  const handleInitiateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !hasSufficientFunds) return;
    setConfirmModalOpen(true);
  };

  // Execute order submission
  const handleConfirmOrder = async () => {
    if (!activeService || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);

    const idempotencyKey = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const res = await createOrder({
      serviceId: activeService.id,
      target: state.targetUrl.trim(),
      quantity: state.quantity,
      isDripFeed: state.isDripFeed && isDripSupported,
      runs: state.isDripFeed && isDripSupported ? state.dripRuns : undefined,
      interval: state.isDripFeed && isDripSupported ? state.dripInterval : undefined,
      expectedRate: activeService.ratePer1000,
      comments: isCustomComments ? state.comments : undefined,
      idempotencyKey,
    });

    setSubmitting(false);

    if (res.success) {
      setConfirmModalOpen(false);
      setSuccessOrder({
        orderId: res.orderId,
        serviceName: cleanedNameInfo.displayName,
        target: state.targetUrl.trim(),
        totalPrice,
        quantity: totalUnits,
        isDripFeed: state.isDripFeed,
        runs: state.dripRuns,
      });
    } else {
      setErrorMessage(res.error || "Order dispatch failed. Please try again.");
      setConfirmModalOpen(false);
    }
  };

  // Deep-link to add funds with form state preservation
  const handleAddFundsDeepLink = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
    router.push(`/wallet?amount=${shortfall}`);
  };

  // Reset for another order
  const handlePlaceAnother = () => {
    setSuccessOrder(null);
    dispatch({ type: "SET_TARGET_URL", targetUrl: "" });
    dispatch({ type: "SET_COMMENTS", comments: "" });
  };

  // Filtered Combobox Services grouped by Category
  const groupedComboboxServices = useMemo(() => {
    const q = comboboxSearch.toLowerCase().trim();
    const matched = filteredServices.filter((s) => {
      const name = (s.displayName || s.name || "").toLowerCase();
      const cat = (s.categoryName || "").toLowerCase();
      return name.includes(q) || cat.includes(q);
    });

    const groups: { [cat: string]: typeof filteredServices } = {};
    matched.forEach((s) => {
      const cat = s.categoryName || "General Services";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });

    return groups;
  }, [filteredServices, comboboxSearch]);

  return (
    <div className="w-full max-w-[1180px] mx-auto pb-24 md:pb-12 text-slate-200">
      {/* Page Header: Clean, plain, no duplicate balance chips */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">New order</h1>
        <p className="text-sm text-slate-400 mt-1">Choose a service, add your link and quantity.</p>
      </div>

      {/* Mode Switcher Tabs: Single Order vs Package (Drip-feed) */}
      <div className="flex items-center gap-2 p-1 bg-white/[0.04] border border-white/10 rounded-2xl w-fit mb-8">
        <button
          type="button"
          onClick={() => setOrderMode("SINGLE")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            orderMode === "SINGLE"
              ? "bg-[#D8EC8D] text-[#171e00] shadow-sm font-bold"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Zap className="w-4 h-4" />
          Single Order
        </button>
        <button
          type="button"
          onClick={() => setOrderMode("PACKAGE")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            orderMode === "PACKAGE"
              ? "bg-[#D8EC8D] text-[#171e00] shadow-sm font-bold"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Boxes className="w-4 h-4" />
          Package (Drip-feed)
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-md ${
              orderMode === "PACKAGE"
                ? "bg-[#171e00]/20 text-[#171e00] font-bold"
                : "bg-[#D8EC8D]/15 text-[#D8EC8D]"
            }`}
          >
            Multi-Day
          </span>
        </button>
      </div>

      {orderMode === "PACKAGE" ? (
        <PackageOrderBuilder />
      ) : (
        <>
          {/* Success State Overlay / Modal */}
      <AnimatePresence>
        {successOrder && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="mb-8"
          >
            <GlassCard className="p-6 md:p-8 border-[#D8EC8D]/30 bg-[#191919]/90">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#D8EC8D]/15 text-[#D8EC8D] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-base">Order placed successfully</span>
                      <StatusBadge status="PENDING" />
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Order Reference: <span className="text-[#D8EC8D] font-bold">#{successOrder.orderId}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Link
                    href={`/orders`}
                    className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white text-center transition-colors min-h-[44px] flex items-center justify-center"
                  >
                    View order
                  </Link>
                  <button
                    onClick={handlePlaceAnother}
                    className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold transition-all min-h-[44px] flex items-center justify-center"
                  >
                    Place another order
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Desktop (>= 1100px: left 760px max, right sticky 360px) */}
      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
        {/* LEFT COLUMN: ORDER FORM (max 760px) */}
        <form onSubmit={handleInitiateOrder} className="w-full max-w-[760px] space-y-6">
          {/* Favorite Pre-fill Alert Banner */}
          {loadedFromFavorite && (
            <div className="p-3.5 rounded-xl bg-[#D8EC8D]/10 border border-[#D8EC8D]/30 flex items-center justify-between text-xs text-[#D8EC8D]">
              <div className="flex items-center gap-2.5">
                <Bookmark className="w-4 h-4 shrink-0" />
                <span>
                  Form pre-filled from favorite: <strong>{loadedFromFavorite}</strong>. Review your details and confirm order.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLoadedFromFavorite(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {/* 1. PLATFORM SELECTOR */}
          <section aria-labelledby="platform-heading">
            <h2 id="platform-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              1. Platform
            </h2>
            <div className="relative">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar snap-x">
                {platformList.map((p) => {
                  const isSelected = state.selectedPlatform === p.id;
                  const count = platformCounts.get(p.id) || 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => dispatch({ type: "SET_PLATFORM", platform: p.id })}
                      className={`min-h-[44px] px-4 py-2 rounded-xl border text-sm font-medium flex items-center gap-2.5 shrink-0 transition-all select-none ${
                        isSelected
                          ? "bg-[#D8EC8D]/10 border-[#D8EC8D] text-white"
                          : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white hover:border-white/20"
                      }`}
                    >
                      <PlatformIcon platform={p.id} size={18} />
                      <span>{p.name}</span>
                      {count > 0 && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            isSelected ? "bg-[#D8EC8D]/20 text-[#D8EC8D]" : "bg-white/5 text-slate-500"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 2. SEARCHABLE SERVICE COMBOBOX */}
          <section aria-labelledby="service-heading">
            <h2 id="service-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              2. Service
            </h2>

            {/* Combobox Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setComboboxOpen(!comboboxOpen)}
                className="w-full min-h-[52px] p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 text-left transition-all flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-[#D8EC8D]/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-400 mb-0.5">
                    {activeService?.categoryName || "Catalog Service"}
                  </div>
                  <div className="text-sm font-medium text-white truncate">
                    {cleanedNameInfo.displayName || "Select a service..."}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-[#D8EC8D] font-mono">
                    ₹{Number(unitRate).toFixed(2)}/1k
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${comboboxOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {/* Combobox Dropdown / Search Modal */}
              <AnimatePresence>
                {comboboxOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute z-40 left-0 right-0 mt-2 rounded-2xl bg-[#191919] border border-white/15 shadow-2xl overflow-hidden"
                  >
                    {/* Search input */}
                    <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-white/[0.02]">
                      <Search className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        value={comboboxSearch}
                        onChange={(e) => setComboboxSearch(e.target.value)}
                        placeholder="Search service name, speed, refill..."
                        className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                        autoFocus
                      />
                      {comboboxSearch && (
                        <button onClick={() => setComboboxSearch("")} className="text-slate-400 hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Services list grouped by category */}
                    <div className="max-h-[320px] overflow-y-auto p-2 space-y-3">
                      {Object.keys(groupedComboboxServices).length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          No services match &quot;{comboboxSearch}&quot;
                        </div>
                      ) : (
                        Object.entries(groupedComboboxServices).map(([category, items]) => (
                          <div key={category}>
                            <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              {category}
                            </div>
                            <div className="space-y-1 mt-1">
                              {items.map((svc) => {
                                const isSvcSelected = svc.id === state.selectedServiceId;
                                const cleaned = cleanServiceName(svc.displayName || svc.name);
                                return (
                                  <button
                                    key={svc.id}
                                    type="button"
                                    onClick={() => {
                                      dispatch({ type: "SET_SERVICE_ID", serviceId: svc.id });
                                      setComboboxOpen(false);
                                      setComboboxSearch("");
                                    }}
                                    className={`w-full p-2.5 rounded-xl text-left transition-all flex items-start justify-between gap-3 ${
                                      isSvcSelected
                                        ? "bg-[#D8EC8D]/15 border border-[#D8EC8D]/40 text-white"
                                        : "hover:bg-white/5 text-slate-300"
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-medium text-white truncate">
                                        {cleaned.displayName}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                                        <span>Min: {formatIndianNumber(svc.minQty)}</span>
                                        <span>·</span>
                                        <span>Max: {formatIndianNumber(svc.maxQty)}</span>
                                        {svc.refillable && (
                                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">
                                            Refill
                                          </span>
                                        )}
                                        {svc.cancellable && (
                                          <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 text-[10px]">
                                            Cancel
                                          </span>
                                        )}
                                        {svc.dripFeedSupported && (
                                          <span className="px-1.5 py-0.2 rounded bg-[#D8EC8D]/10 text-[#D8EC8D] text-[10px]">
                                            Drip-feed
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="text-xs font-bold text-[#D8EC8D] font-mono">
                                        ₹{Number(svc.ratePer1000).toFixed(2)}
                                      </div>
                                      <div className="text-[10px] text-slate-500">per 1,000</div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Selected Service Detail Card: 4 Key Facts */}
            {activeService && (
              <GlassCard className="mt-3 p-4 rounded-2xl border-white/5 bg-white/[0.02]">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                  <div>
                    <div className="text-slate-500 text-[11px]">Price / 1,000</div>
                    <div className="font-semibold text-white font-mono mt-0.5">
                      ₹{Number(activeService.ratePer1000).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">Min - Max</div>
                    <div className="font-semibold text-white font-mono mt-0.5">
                      {formatIndianNumber(minQty)} - {formatIndianNumber(maxQty)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">Start / Avg Time</div>
                    <div className="font-semibold text-white mt-0.5">
                      {activeService.avgStartTime || "Instant"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[11px]">Refill & Cancel</div>
                    <div className="font-semibold text-white mt-0.5">
                      {activeService.refillable ? "Refill: Yes" : "Refill: No"} ·{" "}
                      {activeService.cancellable ? "Cancel: Yes" : "Cancel: No"}
                    </div>
                  </div>
                </div>

                {/* Clean Description */}
                {activeService.description && activeService.description.trim() !== "" && (
                  <div className="border-t border-white/5 pt-2.5 text-xs text-slate-400 leading-relaxed">
                    {activeService.description}
                  </div>
                )}
              </GlassCard>
            )}
          </section>

          {/* 3. DYNAMIC DETAILS (LINK & QUANTITY) */}
          <section aria-labelledby="details-heading" className="space-y-4">
            <h2 id="details-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              3. Details
            </h2>

            {/* Link input with dynamic label and paste button */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-white">{linkLabel}</label>
                <span className="text-[11px] text-slate-500">The account must be public.</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={state.targetUrl}
                  onChange={(e) => dispatch({ type: "SET_TARGET_URL", targetUrl: e.target.value })}
                  placeholder={linkPlaceholder}
                  className={`w-full min-h-[48px] px-3.5 py-2.5 pr-20 rounded-xl bg-white/[0.03] border text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                    state.targetUrl && !linkValidation.isValid
                      ? "border-rose-500/50 focus:ring-2 focus:ring-rose-500/20"
                      : "border-white/10 focus:border-[#D8EC8D]/50 focus:ring-2 focus:ring-[#D8EC8D]/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 font-medium transition-colors flex items-center gap-1.5"
                >
                  <Clipboard className="w-3.5 h-3.5 text-slate-400" />
                  <span>Paste</span>
                </button>
              </div>
              {/* Inline format validation error */}
              {state.targetUrl && !linkValidation.isValid && linkValidation.error && (
                <div className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{linkValidation.error}</span>
                </div>
              )}
            </div>

            {/* Quantity or Custom Comments Input */}
            {isCustomComments ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-white">Custom Comments (one per line)</label>
                  <span className="text-xs font-mono text-[#D8EC8D]">
                    {commentsList.length} {commentsList.length === 1 ? "comment" : "comments"}
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={state.comments}
                  onChange={(e) => dispatch({ type: "SET_COMMENTS", comments: e.target.value })}
                  placeholder="Great post!&#10;Awesome content!&#10;Keep it up!"
                  className="w-full p-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#D8EC8D]/50 focus:ring-2 focus:ring-[#D8EC8D]/20"
                />
                {hasDuplicateComments && (
                  <div className="mt-1.5 text-xs text-amber-400 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>Duplicate comments detected. Each line should ideally be unique.</span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-white">
                    {state.isDripFeed && isDripSupported
                      ? dripScheduleMode === "DAYS"
                        ? "Daily Quantity (Followers / Day)"
                        : "Quantity per run"
                      : "Quantity"}
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Min: {formatIndianNumber(minQty)} · Max: {formatIndianNumber(maxQty)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "SET_QUANTITY", quantity: Math.max(minQty, state.quantity - 100) })}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center font-bold text-base transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={state.quantity}
                    onChange={(e) => dispatch({ type: "SET_QUANTITY", quantity: parseInt(e.target.value, 10) || 0 })}
                    min={minQty}
                    max={maxQty}
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-[#D8EC8D]/50 focus:ring-2 focus:ring-[#D8EC8D]/20"
                  />
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "SET_QUANTITY", quantity: Math.min(maxQty, state.quantity + 100) })}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center font-bold text-base transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Preset Chips */}
                {availablePresets.length > 0 && (
                  <div className="flex items-center gap-2 mt-2.5 overflow-x-auto pb-1 no-scrollbar">
                    {availablePresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => dispatch({ type: "SET_QUANTITY", quantity: preset })}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-colors ${
                          state.quantity === preset
                            ? "bg-[#D8EC8D]/20 border-[#D8EC8D] text-white"
                            : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        {formatIndianNumber(preset)}
                      </button>
                    ))}
                  </div>
                )}

                {state.isDripFeed && isDripSupported && dripScheduleMode === "DAYS" && (
                  <div className="mt-2.5 p-2 rounded-xl bg-[#D8EC8D]/10 border border-[#D8EC8D]/20 text-xs font-mono text-[#D8EC8D] flex items-center justify-between">
                    <span>Daily Delivery: {formatIndianNumber(state.quantity)} / day × {state.dripRuns} days</span>
                    <span className="font-bold text-white">{formatIndianNumber(totalUnits)} Total</span>
                  </div>
                )}

                {/* Bounds error */}
                {!quantityValid && (
                  <div className="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Quantity must be between {formatIndianNumber(minQty)} and {formatIndianNumber(maxQty)}.</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 4. DRIP-FEED (Inline row toggle) */}
          <section aria-labelledby="dripfeed-heading">
            <h2 id="dripfeed-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              4. Delivery Options
            </h2>

            {!isDripSupported || isCustomComments ? (
              <div className="py-2.5 px-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-500">
                Deliver gradually (drip-feed): Not available for this service
              </div>
            ) : (
              <GlassCard className="p-4 rounded-2xl border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Deliver gradually (drip-feed)</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Split your order into runs spaced over time.
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={state.isDripFeed}
                    onClick={() => dispatch({ type: "TOGGLE_DRIP_FEED" })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#D8EC8D]/40 ${
                      state.isDripFeed ? "bg-[#D8EC8D]" : "bg-white/20"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#191919] shadow-lg ring-0 transition duration-200 ease-in-out ${
                        state.isDripFeed ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {state.isDripFeed && (
                  <div className="border-t border-white/5 pt-4 space-y-4">
                    {/* Schedule Strategy Mode Selector */}
                    <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.04] border border-white/10 rounded-xl text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setDripScheduleMode("DAYS");
                          dispatch({ type: "SET_DRIP_INTERVAL", interval: 1440 });
                        }}
                        className={`py-2 px-3 rounded-lg font-medium transition-all text-center flex items-center justify-center gap-2 ${
                          dripScheduleMode === "DAYS"
                            ? "bg-[#D8EC8D] text-[#171e00] font-bold shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Spread across days</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDripScheduleMode("CUSTOM");
                          if (state.dripInterval === 1440) {
                            dispatch({ type: "SET_DRIP_INTERVAL", interval: 60 });
                          }
                        }}
                        className={`py-2 px-3 rounded-lg font-medium transition-all text-center flex items-center justify-center gap-2 ${
                          dripScheduleMode === "CUSTOM"
                            ? "bg-[#D8EC8D] text-[#171e00] font-bold shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Custom intervals</span>
                      </button>
                    </div>

                    {dripScheduleMode === "DAYS" ? (
                      /* DAYS MODE: Select how many days to spread growth */
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-medium text-white">How many days to spread growth?</label>
                            <span className="text-[11px] text-[#D8EC8D] font-mono font-semibold">
                              {state.dripRuns} days (~{formatIndianNumber(state.quantity)} / day)
                            </span>
                          </div>

                          {/* Quick Day Presets */}
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2">
                            {[2, 3, 5, 7, 10, 14, 30]
                              .filter((d) => d <= maxRuns)
                              .map((d) => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => {
                                    dispatch({ type: "SET_DRIP_RUNS", runs: d });
                                    dispatch({ type: "SET_DRIP_INTERVAL", interval: 1440 });
                                  }}
                                  className={`min-h-[36px] py-1 px-2 rounded-lg text-xs font-medium border text-center transition-colors ${
                                    state.dripRuns === d && state.dripInterval === 1440
                                      ? "bg-[#D8EC8D]/20 border-[#D8EC8D] text-white font-bold"
                                      : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                                  }`}
                                >
                                  {d} Days
                                </button>
                              ))}
                          </div>

                          {/* Stepper for Days */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                dispatch({ type: "SET_DRIP_RUNS", runs: Math.max(minRuns, state.dripRuns - 1) });
                                dispatch({ type: "SET_DRIP_INTERVAL", interval: 1440 });
                              }}
                              className="min-h-[40px] min-w-[40px] rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-center"
                            >
                              -
                            </button>
                            <div className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-white font-mono text-center flex items-center justify-center gap-1.5">
                              <span className="font-bold text-[#D8EC8D]">{state.dripRuns}</span>
                              <span className="text-slate-400">days (delivered once every 24 hours)</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                dispatch({ type: "SET_DRIP_RUNS", runs: Math.min(maxRuns, state.dripRuns + 1) });
                                dispatch({ type: "SET_DRIP_INTERVAL", interval: 1440 });
                              }}
                              className="min-h-[40px] min-w-[40px] rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* CUSTOM MODE: Number of runs and intervals in minutes/hours */
                      <div className="space-y-4">
                        {/* Runs Input */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-medium text-white">Number of runs</label>
                            <span className="text-[11px] text-slate-500 font-mono">
                              Min: {minRuns} · Max: {maxRuns}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => dispatch({ type: "SET_DRIP_RUNS", runs: Math.max(minRuns, state.dripRuns - 1) })}
                              className="min-h-[40px] min-w-[40px] rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-center"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={state.dripRuns}
                              onChange={(e) => dispatch({ type: "SET_DRIP_RUNS", runs: parseInt(e.target.value, 10) || minRuns })}
                              min={minRuns}
                              max={maxRuns}
                              className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white font-mono text-center focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => dispatch({ type: "SET_DRIP_RUNS", runs: Math.min(maxRuns, state.dripRuns + 1) })}
                              className="min-h-[40px] min-w-[40px] rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Interval Presets + Custom input */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-medium text-white">Interval between runs</label>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {formatDuration(state.dripInterval)}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {[
                              { label: "30 min", mins: 30 },
                              { label: "1 h", mins: 60 },
                              { label: "2 h", mins: 120 },
                              { label: "6 h", mins: 360 },
                              { label: "12 h", mins: 720 },
                              { label: "24 h", mins: 1440 },
                            ].map((preset) => (
                              <button
                                key={preset.mins}
                                type="button"
                                onClick={() => dispatch({ type: "SET_DRIP_INTERVAL", interval: preset.mins })}
                                className={`min-h-[36px] py-1 px-2 rounded-lg text-xs font-medium border text-center transition-colors ${
                                  state.dripInterval === preset.mins
                                    ? "bg-[#D8EC8D]/20 border-[#D8EC8D] text-white"
                                    : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Live Schedule Preview & Mini Timeline */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5 text-xs">
                      {isManagedDrip && !isNativeDrip && (
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed">
                          Runs are sent one after another at the planned times; each run may start a few minutes late.
                        </div>
                      )}
                      
                      <div className="text-slate-300 flex items-center justify-between">
                        <span>
                          {dripScheduleMode === "DAYS" ? (
                            <>Growth Plan: <strong className="text-white">{state.dripRuns} Days</strong></>
                          ) : (
                            <>Every <span className="text-[#D8EC8D] font-semibold">{formatDuration(state.dripInterval)}</span> for <span className="text-[#D8EC8D] font-semibold">{state.dripRuns} runs</span></>
                          )}
                        </span>
                        <span className="text-[#D8EC8D] font-mono font-semibold">
                          {dripScheduleMode === "DAYS" ? `~${formatIndianNumber(state.quantity)} / day` : ""}
                        </span>
                      </div>

                      {/* Per-Run / Per-Day Timeline Preview */}
                      <div className="space-y-1 pt-1 max-h-36 overflow-y-auto no-scrollbar font-mono text-[11px]">
                        {Array.from({ length: Math.min(state.dripRuns, 8) }).map((_, idx) => {
                          const scheduledTime = new Date(Date.now() + idx * state.dripInterval * 60 * 1000);
                          const label = dripScheduleMode === "DAYS"
                            ? (idx === 0 ? "Day 1 (Today)" : idx === 1 ? "Day 2 (Tomorrow)" : `Day ${idx + 1}`)
                            : `Run ${idx + 1}`;
                          return (
                            <div key={idx} className="flex justify-between items-center text-slate-400 py-0.5 border-b border-white/[0.03]">
                              <span className="text-slate-300">{label}: {formatIndianNumber(state.quantity)} units</span>
                              <span className="text-slate-500">
                                {dripScheduleMode === "DAYS" && idx > 0
                                  ? `${scheduledTime.toLocaleDateString([], { month: 'short', day: 'numeric' })} at `
                                  : ""}
                                {scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })}
                        {state.dripRuns > 8 && (
                          <div className="text-[10px] text-slate-500 text-center italic py-0.5">
                            + {state.dripRuns - 8} more {dripScheduleMode === "DAYS" ? "days" : "runs"} scheduled
                          </div>
                        )}
                      </div>

                      <div className="font-mono text-slate-400 flex items-center justify-between text-[11px] pt-1.5 border-t border-white/5">
                        <span>
                          {formatIndianNumber(state.quantity)} {dripScheduleMode === "DAYS" ? "/ day" : "per run"} × {state.dripRuns} {dripScheduleMode === "DAYS" ? "days" : "runs"} ={" "}
                          <strong className="text-white">{formatIndianNumber(totalUnits)} total</strong>
                        </span>
                        <span>
                          Est. finish: {new Date(Date.now() + (state.dripRuns - 1) * state.dripInterval * 60 * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </GlassCard>
            )}
          </section>
        </form>

        {/* RIGHT COLUMN: STICKY SUMMARY (360px on Desktop >= 1100px) */}
        <div className="hidden min-[1100px]:block sticky top-6 w-[360px]">
          <GlassCard className="p-6 rounded-2xl border-white/10 space-y-5 bg-[#191919]/90 backdrop-blur-xl">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Order Summary</h3>

            {/* Service & Link overview */}
            <div className="space-y-3 text-xs">
              <div>
                <div className="text-slate-500 mb-0.5">Service</div>
                <div className="font-medium text-white truncate">{cleanedNameInfo.displayName}</div>
              </div>

              <div>
                <div className="text-slate-500 mb-0.5">Target link</div>
                <div className="font-mono text-slate-300 truncate">
                  {state.targetUrl.trim() || "Not specified"}
                </div>
              </div>

              <div className="flex justify-between items-center py-2 border-y border-white/5 font-mono">
                <span className="text-slate-400">
                  {state.isDripFeed && isDripSupported ? "Total Quantity" : "Quantity"}
                </span>
                <span className="text-white font-semibold">
                  {state.isDripFeed && isDripSupported
                    ? `${formatIndianNumber(state.quantity)} × ${state.dripRuns} = ${formatIndianNumber(totalUnits)}`
                    : formatIndianNumber(totalUnits)}
                </span>
              </div>

              <div className="flex justify-between items-center font-mono">
                <span className="text-slate-400">Rate per 1,000</span>
                <span className="text-slate-300">₹{Number(unitRate).toFixed(2)}</span>
              </div>
            </div>

            {/* Price Total Card with Number Tween */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="text-xs text-slate-400 mb-1">Total charge</div>
              <div className="text-2xl font-bold text-[#D8EC8D] font-mono flex items-center">
                <span>₹</span>
                <CountUpNumber value={totalPrice} decimals={2} duration={0.4} />
              </div>

              <div className="border-t border-white/5 mt-3 pt-3 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Wallet balance</span>
                  <span className="text-white">₹{user.balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Balance after order</span>
                  <span className={hasSufficientFunds ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                    ₹{remainingBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Validation Checklist if invalid */}
            {!isFormValid && validationErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 text-xs text-amber-400/90">
                <div className="font-semibold text-slate-300 mb-1">Before you order:</div>
                {validationErrors.map((err, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Insufficient Balance Shortfall Alert */}
            {!hasSufficientFunds && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-2">
                <div className="text-xs text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Short by ₹{shortfall.toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddFundsDeepLink}
                  className="w-full py-2.5 px-3 rounded-lg btn-primary-gradient text-[#171e00] font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add ₹{shortfall.toFixed(2)}</span>
                </button>
              </div>
            )}

            {/* Submit Action Button */}
            <button
              type="button"
              onClick={handleInitiateOrder}
              disabled={!isFormValid || !hasSufficientFunds || submitting}
              className="w-full py-3.5 px-6 rounded-xl btn-primary-gradient text-[#171e00] font-bold text-sm shadow-lg hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
            >
              <span>Place order - ₹{totalPrice.toFixed(2)}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Plain policy guarantee */}
            <div className="text-[11px] text-slate-500 space-y-1.5 pt-1 leading-relaxed">
              <div className="flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>If an order is cancelled or only partly delivered, the unused amount returns to your wallet.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>Your order is sent for delivery right after you confirm.</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM BAR (< 1100px) */}
      <div className="min-[1100px]:hidden fixed bottom-0 left-0 right-0 z-30 p-3 bg-[#191919]/95 border-t border-white/10 backdrop-blur-xl">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] text-slate-400">Total Price</div>
            <div className="text-lg font-bold text-[#D8EC8D] font-mono">₹{totalPrice.toFixed(2)}</div>
          </div>

          <div className="flex items-center gap-2">
            {!hasSufficientFunds ? (
              <button
                type="button"
                onClick={handleAddFundsDeepLink}
                className="py-2.5 px-4 rounded-xl btn-primary-gradient text-[#171e00] font-bold text-xs min-h-[44px] flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add ₹{shortfall.toFixed(2)}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleInitiateOrder}
                disabled={!isFormValid || submitting}
                className="py-2.5 px-5 rounded-xl btn-primary-gradient text-[#171e00] font-bold text-xs min-h-[44px] flex items-center gap-1.5 disabled:opacity-40"
              >
                <span>Place order</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRM ORDER SHEET MODAL */}
      <AnimatePresence>
        {confirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-[#191919] border border-white/15 p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Confirm your order</h3>
                <button onClick={() => setConfirmModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs bg-white/[0.02] p-4 rounded-xl border border-white/5">
                <div>
                  <span className="text-slate-500 block mb-0.5">Service</span>
                  <span className="text-white font-medium">{cleanedNameInfo.displayName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Target link</span>
                  <span className="font-mono text-slate-300 break-all">{state.targetUrl}</span>
                </div>
                <div className="flex justify-between py-1.5 border-t border-white/5">
                  <span className="text-slate-500">Plan</span>
                  <span className="text-white font-mono">
                    {state.isDripFeed && isDripSupported
                      ? `${formatIndianNumber(state.quantity)} × ${state.dripRuns} runs (every ${formatDuration(state.dripInterval)})`
                      : `${formatIndianNumber(totalUnits)} units`}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-t border-white/5">
                  <span className="text-slate-500">Total charge</span>
                  <span className="text-[#D8EC8D] font-bold font-mono">₹{totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-t border-white/5">
                  <span className="text-slate-500">Balance after order</span>
                  <span className="text-emerald-400 font-mono">₹{remainingBalance.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(false)}
                  className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={submitting}
                  className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <span>Confirm order</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )}
</div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[400px] flex items-center justify-center text-slate-400 font-mono text-xs">
          Loading order console...
        </div>
      }
    >
      <NewOrderContent />
    </Suspense>
  );
}
