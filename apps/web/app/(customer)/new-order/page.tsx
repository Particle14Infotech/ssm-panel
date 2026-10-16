"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Clock,
  Layers,
  Search,
  ChevronDown,
  TrendingUp,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  Wallet,
  Globe,
  Share2,
  Video,
  Send,
  Music,
} from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { FormField } from "@/components/shared/FormField";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { motion } from "framer-motion";

function NewOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialServiceParam = searchParams.get("serviceId");

  const { user, services, createOrder } = useCustomer();

  const [selectedPlatform, setSelectedPlatform] = useState<string>("instagram");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    initialServiceParam || services[0]?.id || ""
  );
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1000);
  const [isDripFeed, setIsDripFeed] = useState<boolean>(false);
  const [dripRuns, setDripRuns] = useState<number>(5);
  const [dripInterval, setDripInterval] = useState<number>(60);
  const [keywords, setKeywords] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  const platforms = [
    { id: "instagram", name: "Instagram" },
    { id: "youtube", name: "YouTube" },
    { id: "tiktok", name: "TikTok" },
    { id: "telegram", name: "Telegram" },
    { id: "twitter", name: "X (Twitter)" },
    { id: "spotify", name: "Spotify" },
    { id: "general", name: "Other Services" },
  ];

  // Filter services by platform & category
  const availableServices = services.filter((s) => {
    const p = (s.platform || "general").toLowerCase().replace("_", "");
    const selectedP = selectedPlatform.toLowerCase().replace("_", "");
    const matchesPlatform = p === selectedP || (selectedP === "twitter" && p === "xtwitter");
    const matchesCategory = selectedCategory === "ALL" || s.categoryName === selectedCategory;
    return matchesPlatform && matchesCategory;
  });

  const activeService =
    services.find((s) => s.id === selectedServiceId) || availableServices[0] || services[0];

  useEffect(() => {
    if (initialServiceParam) {
      const match = services.find((s) => s.id === initialServiceParam);
      if (match) {
        setSelectedPlatform(match.platform.toLowerCase().replace("x_twitter", "twitter"));
        setSelectedServiceId(match.id);
      }
    } else if (availableServices.length > 0 && !services.some((s) => s.id === selectedServiceId)) {
      setSelectedServiceId(availableServices[0].id);
    }
  }, [initialServiceParam, services, selectedPlatform]);

  // Rate and balance math
  const unitRate = activeService ? activeService.ratePer1000 : 0;
  const totalPrice = Number(((quantity / 1000) * unitRate).toFixed(2));
  const remainingBalance = Number((user.balance - totalPrice).toFixed(2));
  const hasSufficientFunds = user.balance >= totalPrice;

  const categories = Array.from(
    new Set(
      services
        .filter((s) => {
          const p = (s.platform || "general").toLowerCase().replace("_", "");
          const selectedP = selectedPlatform.toLowerCase().replace("_", "");
          return p === selectedP || (selectedP === "twitter" && p === "xtwitter");
        })
        .map((s) => s.categoryName)
    )
  );

  const presets = [500, 1000, 2500, 5000, 10000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!targetUrl || targetUrl.trim().length < 3) {
      setErrorMessage("Please provide a valid target URL or username handle.");
      return;
    }

    if (!activeService) {
      setErrorMessage("Please select an active catalog service.");
      return;
    }

    if (quantity < (activeService.minQty || 10) || quantity > (activeService.maxQty || 1000000)) {
      setErrorMessage(`Quantity must be between ${activeService.minQty} and ${activeService.maxQty}.`);
      return;
    }

    if (!hasSufficientFunds) {
      setErrorMessage("Insufficient wallet balance. Please add funds before placing this order.");
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
      setErrorMessage(result.error || "Failed to dispatch order.");
    } else {
      setSuccessOrderId(result.orderId || "ORD-SUCCESS");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-8 pb-16"
    >
      {/* Header Clean (No clutter/beam glow) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-white tracking-tight">New Order</h1>
          <p className="text-xs text-slate-400">
            Configure target links and volume for high-velocity social media services.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl font-mono text-xs">
            <span className="text-slate-400">Balance:</span>
            <span className="text-white font-semibold">₹{user.balance.toFixed(2)}</span>
          </div>
          <Link
            href="/wallet"
            className="px-3.5 py-1.5 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold hover:brightness-105 transition-all shadow-sm"
          >
            + Add Funds
          </Link>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successOrderId && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Order Dispatched Successfully!</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Reference Order <span className="font-mono text-emerald-300 font-semibold">{successOrderId}</span> has been queued for execution.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/orders"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all"
            >
              View in Orders
            </Link>
            <button
              onClick={() => {
                setSuccessOrderId(null);
                setTargetUrl("");
              }}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all"
            >
              Place Another
            </button>
          </div>
        </div>
      )}

      {/* Main 12-col Grid: Form (7 cols) + Live Quote (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Configuration Form (7 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          {/* Step 1: Select Platform with REAL Social Media Logos */}
          <div className="glass-panel p-6 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono block">
              01 • Select Platform
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {platforms.map((plat) => {
                const isSelected = selectedPlatform === plat.id;
                return (
                  <motion.button
                    key={plat.id}
                    type="button"
                    whileHover={{ y: -1.5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedPlatform(plat.id);
                      setSelectedCategory("ALL");
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                      isSelected
                        ? "bg-[#D8EC8D]/15 border-[#D8EC8D] text-white shadow-sm ring-1 ring-[#D8EC8D]/40"
                        : "bg-white/[0.03] border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.07] hover:border-white/20"
                    }`}
                  >
                    <PlatformIcon platform={plat.id} size={20} useBrandColor={true} />
                    <span className="text-xs font-medium truncate">{plat.name}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Category & Service Selection */}
          <div className="glass-panel p-6 space-y-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono block">
              02 • Service Catalog
            </label>

            {categories.length > 0 && (
              <FormField label="Category Filter">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                >
                  <option value="ALL" className="bg-[#131313]">All Categories ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-[#131313]">
                      {c}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField label="Choose Service" required>
              <select
                value={activeService?.id || ""}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-sans"
              >
                {availableServices.length === 0 ? (
                  <option value="" disabled className="bg-[#131313]">
                    No services available for this selection
                  </option>
                ) : (
                  availableServices.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#131313]">
                      {s.name} — ₹{s.ratePer1000.toFixed(2)}/1k
                    </option>
                  ))
                )}
              </select>
            </FormField>

            {/* Active Service Specs */}
            {activeService && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-semibold text-white block">{activeService.name}</span>
                    <span className="text-slate-400 text-[11px] mt-0.5 block">
                      {activeService.description || "High-speed algorithmic fulfillment with auto-dispatch."}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#D8EC8D]/15 text-[#D8EC8D] font-mono font-bold text-xs shrink-0">
                    ₹{activeService.ratePer1000.toFixed(2)} / 1k
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-slate-400">
                  <div className="bg-white/5 p-2 rounded-lg">
                    <span className="block text-[10px] text-slate-400">Min</span>
                    <span className="text-white font-medium">{activeService.minQty.toLocaleString()}</span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg">
                    <span className="block text-[10px] text-slate-400">Max</span>
                    <span className="text-white font-medium">{activeService.maxQty.toLocaleString()}</span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg">
                    <span className="block text-[10px] text-slate-400">Warranty</span>
                    <span className="text-emerald-400 font-medium">
                      {activeService.refillable ? "30d Refill" : "Standard"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Link & Quantity */}
          <div className="glass-panel p-6 space-y-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono block">
              03 • Target & Volume
            </label>

            <FormField label="Target Vector URL or Username" required helperText="Provide a public URL or profile handle.">
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://instagram.com/yourhandle or post link"
                required
                className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none"
              />
            </FormField>

            <FormField label="Quantity Allocation" required>
              <div className="relative">
                <input
                  type="number"
                  min={activeService?.minQty || 10}
                  max={activeService?.maxQty || 1000000}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 text-white font-mono text-xl pl-4 pr-16 py-2.5 rounded-xl focus:outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 uppercase">
                  Units
                </span>
              </div>
            </FormField>

            {/* Presets */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuantity(preset)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all shrink-0 ${
                    quantity === preset
                      ? "bg-[#D8EC8D] text-[#131313] font-bold shadow-sm"
                      : "bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  +{preset.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </form>

        {/* Right: Live Quote & Submission Panel (5 cols sticky) */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <GlassCard className="p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-base font-semibold text-white">Order Summary</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#D8EC8D]/15 text-[#D8EC8D] text-[10px] font-mono font-semibold">
                Live Calculation
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
                Total Charge Required
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extralight text-white font-mono tracking-tight">
                  ₹{totalPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-mono text-[#D8EC8D]">INR</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                ₹{unitRate.toFixed(2)}/1k × {quantity.toLocaleString()} units
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Available Balance</span>
                <span className="text-white font-semibold">₹{user.balance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-300">
                <span>Order Cost</span>
                <span>- ₹{totalPrice.toFixed(2)}</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between">
                <span className="text-white font-medium">Balance After Order</span>
                <span
                  className={`font-bold ${
                    hasSufficientFunds ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  ₹{remainingBalance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Submission Action Button */}
            <div className="pt-2">
              {hasSufficientFunds ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3.5 px-6 rounded-2xl btn-primary-gradient text-[#171e00] font-bold text-sm shadow-md hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Placing Order...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Order ₹{totalPrice.toFixed(2)}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-3" data-testid="insufficient-funds-alert">
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Insufficient balance (Short by ₹{Math.abs(remainingBalance).toFixed(2)}).</span>
                  </div>
                  <Link
                    href="/wallet"
                    className="w-full py-3.5 px-6 rounded-2xl btn-primary-gradient text-[#171e00] font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-[0.99]"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Funds to Continue</span>
                  </Link>
                </div>
              )}
            </div>

            <div className="space-y-1.5 text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Instant transaction locking with refund guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D8EC8D] shrink-0" />
                <span>Immediate automated dispatch to provider queue</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[400px] flex items-center justify-center text-slate-400 font-mono text-xs">
          Loading order dispatch console...
        </div>
      }
    >
      <NewOrderContent />
    </Suspense>
  );
}
