"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import {
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Clock,
  Layers,
  Search,
  ChevronDown,
  Sliders,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Info,
} from "lucide-react";

function NewOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialServiceParam = searchParams.get("serviceId");

  const { user, services, createOrder } = useCustomer();

  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    initialServiceParam || services[0]?.id || "1042"
  );
  const [targetUrl, setTargetUrl] = useState<string>("https://instagram.com/growth.vector");
  const [quantity, setQuantity] = useState<number>(5000);
  const [isDripFeed, setIsDripFeed] = useState<boolean>(false);
  const [dripRuns, setDripRuns] = useState<number>(5);
  const [dripInterval, setDripInterval] = useState<number>(60);
  const [keywords, setKeywords] = useState<string>("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  // Normalize platform matching
  const availableServices = services.filter((s) => {
    const p = s.platform.toLowerCase().replace("_", "");
    const selectedP = selectedPlatform.toLowerCase().replace("_", "");
    const matchesPlatform = p === selectedP || (selectedP === "twitter" && p === "xtwitter");
    const matchesCategory = selectedCategory === "ALL" || s.categoryName === selectedCategory;
    return matchesPlatform && matchesCategory;
  });

  const activeService = services.find((s) => s.id === selectedServiceId) || availableServices[0] || services[0];

  useEffect(() => {
    if (initialServiceParam) {
      const match = services.find((s) => s.id === initialServiceParam);
      if (match) {
        setSelectedPlatform(match.platform.toLowerCase().replace("x_twitter", "twitter"));
        setSelectedServiceId(match.id);
      }
    }
  }, [initialServiceParam, services]);

  // Quantity bounds check
  const unitRate = activeService ? activeService.ratePer1000 : 0;
  const totalPrice = Number(((quantity / 1000) * unitRate).toFixed(2));
  const remainingBalance = Number((user.balance - totalPrice).toFixed(2));
  const hasSufficientFunds = user.balance >= totalPrice;

  const platforms = [
    { id: "instagram", name: "Instagram", icon: "📸" },
    { id: "youtube", name: "YouTube", icon: "▶️" },
    { id: "tiktok", name: "TikTok", icon: "🎵" },
    { id: "telegram", name: "Telegram", icon: "✈️" },
    { id: "twitter", name: "X (Twitter)", icon: "🐦" },
    { id: "spotify", name: "Spotify", icon: "🎧" },
    { id: "linkedin", name: "LinkedIn", icon: "💼" },
  ];

  const categories = Array.from(
    new Set(
      services
        .filter((s) => {
          const p = s.platform.toLowerCase().replace("_", "");
          const selectedP = selectedPlatform.toLowerCase().replace("_", "");
          return p === selectedP || (selectedP === "twitter" && p === "xtwitter");
        })
        .map((s) => s.categoryName)
    )
  );

  const presets = [500, 1000, 5000, 10000, 25000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!targetUrl || targetUrl.trim().length < 5) {
      setErrorMessage("Please provide a valid public target profile or post URL.");
      return;
    }

    if (!activeService) {
      setErrorMessage("Please select an active dispatch service.");
      return;
    }

    setSubmitting(true);
    const result = await createOrder({
      serviceId: activeService.id,
      target: targetUrl.trim(),
      quantity,
      dripFeed: isDripFeed,
      runs: isDripFeed ? dripRuns : undefined,
      interval: isDripFeed ? dripInterval : undefined,
      comments: keywords.trim() ? keywords.trim() : undefined,
    });

    setSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || "Failed to dispatch order. Please check balance or parameters.");
    } else {
      setSuccessOrderId(result.orderId || "ORD-SUCCESS");
    }
  };

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 relative overflow-hidden">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-8 space-y-8 relative z-10">
        {/* Top Header & Telemetry */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-on-surface-variant font-mono">
              <span className="w-2 h-2 rounded-full bg-[#DBEF90] animate-pulse" />
              <span className="uppercase text-[#DBEF90] font-semibold">Algorithmic Gateway</span>
              <span>/</span>
              <span>Node Cluster: Mumbai AP-S1 [High-Velocity]</span>
            </div>

            <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-surface-container-high/60 backdrop-blur-md border border-white/5 text-xs">
              <span className="font-semibold text-[#DBEF90] font-mono">Queue: Instant (0–2m)</span>
              <span className="text-white/20">•</span>
              <span className="text-on-surface-variant">99.8% Node Health</span>
              <span className="text-white/20">•</span>
              <span className="text-white font-mono">1,420 Active Vectors</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-light text-white tracking-tight flex items-baseline gap-2">
                New Dispatch Order
                <span className="text-[#DBEF90] text-3xl font-light leading-none">*</span>
              </h1>
              <p className="text-xs md:text-sm text-on-surface-variant mt-1">
                Direct telemetry gateway for precision engagement distribution and multi-node velocity routing.
              </p>
            </div>

            <div className="hidden xl:flex items-center gap-4 bg-surface-container-low/70 border border-white/10 px-5 py-2.5 rounded-2xl">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-on-surface-variant tracking-wider font-mono">
                  Avg Dispatch Latency
                </span>
                <span className="text-xl font-light text-white font-mono">
                  18.4<span className="text-xs text-[#DBEF90] ml-1">ms</span>
                </span>
              </div>
              <div className="flex items-end gap-1 h-7 pb-1">
                {[10, 16, 22, 14, 20, 26].map((h, idx) => (
                  <span
                    key={idx}
                    className="w-1 bg-[#DBEF90] rounded-full"
                    style={{ height: `${h}px`, opacity: 0.4 + idx * 0.1 }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 5-Step Stepper Strip */}
          <div className="w-full bg-surface-container-low/80 border border-white/10 backdrop-blur-xl rounded-2xl p-2 md:p-3 flex items-center justify-between gap-2 overflow-x-auto text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-high shrink-0 font-medium text-white">
              <span className="w-5 h-5 rounded-full bg-[#DBEF90] text-[#2a3400] text-[10px] font-bold flex items-center justify-center">
                ✓
              </span>
              <span>01 Select Platform</span>
            </div>
            <span className="text-white/20 hidden sm:inline">⟶</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#d8ec8d] text-[#2a3400] shrink-0 font-bold shadow-[0_0_20px_rgba(216,236,141,0.25)]">
              <span className="w-5 h-5 rounded-full bg-[#2a3400] text-[#DBEF90] text-[10px] flex items-center justify-center">
                02
              </span>
              <span>02 Target Vector</span>
            </div>
            <span className="text-white/20 hidden sm:inline">⟶</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-on-surface-variant shrink-0">
              <span className="w-5 h-5 rounded-full bg-surface-container-highest text-on-surface-variant text-[10px] flex items-center justify-center">
                03
              </span>
              <span>03 Volume & Drip</span>
            </div>
            <span className="text-white/20 hidden md:inline">⟶</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-on-surface-variant shrink-0">
              <span className="w-5 h-5 rounded-full bg-surface-container-highest text-on-surface-variant text-[10px] flex items-center justify-center">
                04
              </span>
              <span>04 Review Ledger</span>
            </div>
            <span className="text-white/20 hidden lg:inline">⟶</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-on-surface-variant shrink-0">
              <span className="w-5 h-5 rounded-full bg-surface-container-highest text-on-surface-variant text-[10px] flex items-center justify-center">
                05
              </span>
              <span>05 Dispatch Instant</span>
            </div>
          </div>
        </section>

        {successOrderId && (
          <div className="bg-[#DBEF90]/15 border border-[#DBEF90]/40 rounded-3xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#DBEF90] text-[#2a3400] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Order {successOrderId} Dispatched Successfully!</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  The routing daemon has accepted your target vector. Real-time telemetry is now active on the orders ledger.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setSuccessOrderId(null)}
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold"
              >
                Place Another
              </button>
              <Link
                href="/orders"
                className="px-5 py-2 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110 shadow-lg"
              >
                Track in Orders
              </Link>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-500/15 border border-rose-500/30 rounded-2xl p-4 text-rose-300 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <div className="flex-1">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form Configuration (7 cols) */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 glass-panel rounded-[2rem] p-6 md:p-8 space-y-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-light text-white">Order Parameters</h2>
                  <span className="text-[#DBEF90]">✦</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Configure vector target, allocation limits, and algorithmic delivery specs.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-mono uppercase">
                Zone: AP-S1
              </span>
            </div>

            {/* Platform Selection */}
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold">
                01 • Select Target Platform
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {platforms.map((p) => {
                  const isSelected = selectedPlatform === p.id;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => {
                        setSelectedPlatform(p.id);
                        setSelectedCategory("ALL");
                        const firstForPlatform = services.find((s) => {
                          const pf = s.platform.toLowerCase().replace("_", "");
                          const targetPf = p.id.toLowerCase().replace("_", "");
                          return pf === targetPf || (targetPf === "twitter" && pf === "xtwitter");
                        });
                        if (firstForPlatform) setSelectedServiceId(firstForPlatform.id);
                      }}
                      className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-xs ${
                        isSelected
                          ? "bg-[#d8ec8d] text-[#2a3400] font-bold shadow-[0_0_15px_rgba(219,239,144,0.3)] scale-[1.02]"
                          : "bg-surface-container-high/60 border border-white/5 text-on-surface-variant hover:text-white hover:bg-surface-container-high"
                      }`}
                    >
                      <span className="text-base">{p.icon}</span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category & Service Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold">
                  02 • Service Catalog Item
                </label>
                {categories.length > 1 && (
                  <div className="flex items-center gap-1 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("ALL")}
                      className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all ${
                        selectedCategory === "ALL"
                          ? "bg-white/20 text-white"
                          : "text-on-surface-variant hover:text-white"
                      }`}
                    >
                      All
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all ${
                          selectedCategory === cat
                            ? "bg-white/20 text-white"
                            : "text-on-surface-variant hover:text-white"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full bg-surface-container-highest/80 border border-white/10 focus:border-[#DBEF90] rounded-2xl px-4 py-3.5 text-xs md:text-sm text-white focus:outline-none transition-all appearance-none font-medium cursor-pointer"
                >
                  {availableServices.map((service) => (
                    <option key={service.id} value={service.id} className="bg-[#1c1b1b] text-white">
                      #{service.id} - {service.name} (₹{service.ratePer1000.toFixed(2)} / 1k)
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {activeService && (
                <div className="bg-surface-container-high/40 border border-white/5 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-white">{activeService.name}</div>
                      <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">
                        {activeService.description}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#DBEF90]/15 text-[#DBEF90] text-[10px] font-mono font-bold shrink-0">
                      ₹{activeService.ratePer1000.toFixed(2)} / 1k
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5 text-[11px] font-mono">
                    <div className="bg-white/5 rounded-xl p-2">
                      <span className="text-[10px] text-on-surface-variant block">Min Allocation</span>
                      <span className="text-white font-bold">{activeService.minQty.toLocaleString()}</span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-2">
                      <span className="text-[10px] text-on-surface-variant block">Max Cap</span>
                      <span className="text-white font-bold">{activeService.maxQty.toLocaleString()}</span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-2">
                      <span className="text-[10px] text-on-surface-variant block">Avg Velocity</span>
                      <span className="text-[#DBEF90] font-bold">{activeService.avgProcessingSpeed || "Fast"}</span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-2">
                      <span className="text-[10px] text-on-surface-variant block">Warranty Refill</span>
                      <span className="text-emerald-400 font-bold">
                        {activeService.refillable ? "Guaranteed" : "Non-Drop"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Target URL */}
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold">
                03 • Target Vector Link / Handle
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://instagram.com/your_profile or post link"
                  required
                  className="w-full bg-surface-container-highest/80 border border-white/10 focus:border-[#DBEF90] text-white font-mono text-xs md:text-sm px-4 py-3.5 rounded-2xl focus:outline-none transition-all placeholder:text-white/30"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 flex items-center gap-1 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-[11px] text-on-surface-variant font-mono pl-1">
                ✦ Public profiles/posts only. Do not submit private accounts.
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold">
                  04 • Quantity Allocation
                </label>
                <span className="text-[11px] text-on-surface-variant font-mono">
                  Min: {activeService?.minQty.toLocaleString()} • Max: {activeService?.maxQty.toLocaleString()}
                </span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min={activeService?.minQty || 100}
                  max={activeService?.maxQty || 500000}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-surface-container-highest/80 border border-white/10 focus:border-[#DBEF90] text-white font-mono text-lg md:text-xl font-light px-4 py-3 rounded-2xl focus:outline-none transition-all"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-mono text-xs uppercase">
                  Units
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pt-1">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuantity(preset)}
                    className={`px-3 py-1 rounded-full text-xs font-mono font-semibold transition-all shrink-0 ${
                      quantity === preset
                        ? "bg-[#d8ec8d] text-[#2a3400]"
                        : "bg-surface-container-high text-on-surface-variant hover:text-white hover:bg-white/10"
                    }`}
                  >
                    +{preset.toLocaleString()}
                  </button>
                ))}
                {activeService && (
                  <button
                    type="button"
                    onClick={() => setQuantity(activeService.maxQty)}
                    className="px-3 py-1 rounded-full text-xs font-mono bg-surface-container-high text-on-surface-variant hover:text-white shrink-0"
                  >
                    Max Cap
                  </button>
                )}
              </div>
            </div>

            {/* Advanced Drip-Feed */}
            <div className="bg-surface-container-high/30 border border-white/5 rounded-2xl p-4 space-y-4">
              <button
                type="button"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="w-full flex items-center justify-between text-xs font-semibold text-white"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#DBEF90]" />
                  <span>Advanced Delivery & Drip Scheduling</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-on-surface-variant transition-transform ${
                    isAdvancedOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isAdvancedOpen && (
                <div className="space-y-4 pt-3 border-t border-white/5 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">Drip-Feed Distribution</div>
                      <div className="text-[11px] text-on-surface-variant">
                        Spread total units across multiple intervals to simulate organic growth.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isDripFeed}
                      onChange={(e) => setIsDripFeed(e.target.checked)}
                      className="w-4 h-4 accent-[#DBEF90] rounded cursor-pointer"
                    />
                  </div>

                  {isDripFeed && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-[10px] text-on-surface-variant font-mono uppercase">Runs / Waves</label>
                        <input
                          type="number"
                          min={2}
                          max={100}
                          value={dripRuns}
                          onChange={(e) => setDripRuns(Number(e.target.value))}
                          className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-on-surface-variant font-mono uppercase">Interval (Minutes)</label>
                        <input
                          type="number"
                          min={10}
                          max={1440}
                          value={dripInterval}
                          onChange={(e) => setDripInterval(Number(e.target.value))}
                          className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono mt-1"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] text-on-surface-variant font-mono uppercase">
                      Target Niche Keywords / Custom Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="e.g. ai, web3, luxury, tech, mumbai"
                      className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono mt-1 placeholder:text-white/30 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Right Column: Sticky Summary */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-4">
            <div className="glass-panel liquid-glass rounded-[2rem] p-6 md:p-8 space-y-6 relative overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-[#DBEF90]/10 blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-light text-white">Dispatch Summary</h3>
                  <span className="text-[#DBEF90]">*</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DBEF90]/10 border border-[#DBEF90]/20 text-[#DBEF90] text-[10px] font-mono font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DBEF90] animate-ping" />
                  <span>Real-Time Quote</span>
                </div>
              </div>

              <div className="bg-surface-container-high/60 border border-white/5 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#DBEF90]/15 flex items-center justify-center text-lg shrink-0">
                  {platforms.find((p) => p.id === selectedPlatform)?.icon || "✦"}
                </div>
                <div className="truncate">
                  <div className="text-[10px] text-on-surface-variant uppercase font-mono tracking-wider">
                    Target Vector
                  </div>
                  <div className="text-xs font-semibold text-white truncate">
                    {activeService?.name}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono tracking-widest text-on-surface-variant">
                  Total Investment Required
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extralight text-white font-mono tracking-tight">
                    ₹{totalPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-mono text-[#DBEF90]">INR NET</span>
                </div>
                <div className="text-[11px] text-on-surface-variant font-mono">
                  ₹{unitRate.toFixed(2)} / 1k × {quantity.toLocaleString()} units
                </div>
              </div>

              <div className="bg-surface-container-high/40 border border-white/5 rounded-2xl p-4 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Current Wallet Balance</span>
                  <span className="text-white font-semibold">₹{user.balance.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-rose-300">
                  <span>Order Deduction</span>
                  <span>- ₹{totalPrice.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                  <span className="font-semibold text-white">Projected Balance</span>
                  <span
                    className={`font-bold ${
                      hasSufficientFunds ? "text-[#DBEF90]" : "text-rose-400 font-bold"
                    }`}
                  >
                    ₹{remainingBalance.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Algorithmic non-drop protection enabled</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#DBEF90] shrink-0" />
                  <span>Fulfillment start: {activeService?.avgStartTime || "Instant"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    Auto-refill warranty: {activeService?.refillable ? "30 Days Guarantee" : "Non-Drop"}
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {hasSufficientFunds ? (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full py-3.5 px-6 rounded-full bg-[#d8ec8d] text-[#2a3400] hover:brightness-110 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(219,239,144,0.3)] disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Dispatching to Cluster...</span>
                      </>
                    ) : (
                      <>
                        <span>Execute Instant Dispatch (Confirm)</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2" data-testid="insufficient-funds-alert">
                    <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Insufficient balance. Top up to continue.</span>
                    </div>
                    <Link
                      href="/app/wallet"
                      className="w-full py-3 px-6 rounded-full bg-white text-[#131313] hover:bg-white/90 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                      <span>Add Funds to Wallet</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center text-[#DBEF90] font-mono text-xs">
          ✦ Initializing Algorithmic Terminal...
        </div>
      }
    >
      <NewOrderContent />
    </Suspense>
  );
}
