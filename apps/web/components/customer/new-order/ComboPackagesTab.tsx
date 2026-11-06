"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { GlassCard } from "@/components/shared/GlassCard";
import { LinkPreviewCard } from "@/components/shared/LinkPreviewCard";
import { getApiBase } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-session";
import {
  Boxes,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Tag,
  ChevronRight,
  Loader2,
  Sliders,
  ExternalLink,
  Layers,
  Eye,
  Heart,
  Share2,
  Users,
  ShieldCheck,
  Percent,
} from "lucide-react";

interface ComboPackagesTabProps {
  platform: string;
  walletBalance: number;
  onOrderSuccess: (result: any) => void;
  prefilledTargetUrl?: string;
}

export function ComboPackagesTab({
  platform,
  walletBalance,
  onOrderSuccess,
  prefilledTargetUrl = "",
}: ComboPackagesTabProps) {
  const [targetUrl, setTargetUrl] = useState<string>(prefilledTargetUrl);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  // Selected template & tier
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedTierId, setSelectedTierId] = useState<string>("");

  // Coupon code
  const [couponCode, setCouponCode] = useState<string>("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number } | null>(null);

  // Modals & Drawers
  const [showCompareDrawer, setShowCompareDrawer] = useState<boolean>(false);
  const [showCustomizeDrawer, setShowCustomizeDrawer] = useState<boolean>(false);
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});

  // Quoting State
  const [isQuoting, setIsQuoting] = useState<boolean>(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Order Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState<boolean>(false);

  // Load Templates from API
  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    setTemplatesError(null);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/packages/templates?platform=${encodeURIComponent(platform)}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load combo packages.");
      }

      setTemplates(data || []);
      if (data && data.length > 0) {
        setSelectedTemplateId(data[0].id);
        if (data[0].tiers && data[0].tiers.length > 0) {
          setSelectedTierId(data[0].tiers[0].id);
        }
      }
    } catch (err: any) {
      setTemplatesError(err.message || "Could not retrieve combo packages.");
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [platform]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Selected Template & Tier objects
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [templates, selectedTemplateId]
  );

  const selectedTier = useMemo(
    () => selectedTemplate?.tiers?.find((t: any) => t.id === selectedTierId),
    [selectedTemplate, selectedTierId]
  );

  // Fetch Quote
  const fetchQuote = useCallback(async () => {
    if (!selectedTemplateId || !selectedTierId) {
      setQuoteData(null);
      return;
    }
    if (!targetUrl.trim()) {
      setQuoteError("Please enter a valid target link to calculate delivery schedule.");
      return;
    }

    setIsQuoting(true);
    setQuoteError(null);

    try {
      const apiBase = getApiBase();
      const token = getAuthToken();

      const customizations = Object.keys(customQuantities).length > 0
        ? Object.entries(customQuantities).map(([serviceId, quantity]) => ({ serviceId, quantity }))
        : undefined;

      const res = await fetch(`${apiBase}/packages/combos/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          tierId: selectedTierId,
          targetUrl: targetUrl.trim(),
          couponCode: appliedCoupon?.code || undefined,
          customizations,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Quotation error");
      }

      setQuoteData(data);
    } catch (err: any) {
      setQuoteError(err.message || "Failed to calculate package quotation.");
    } finally {
      setIsQuoting(false);
    }
  }, [selectedTemplateId, selectedTierId, targetUrl, appliedCoupon, customQuantities]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuote();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  // Submit Order
  const handlePurchase = async () => {
    if (!quoteData?.quoteHash) {
      setOrderError("Please fetch a valid quote before proceeding.");
      return;
    }
    if (!consentChecked) {
      setOrderError("Please accept terms of service and schedule acknowledgment.");
      return;
    }
    if (walletBalance < quoteData.totalCharge) {
      setOrderError("Insufficient balance in your wallet. Please add funds.");
      return;
    }

    setIsSubmitting(true);
    setOrderError(null);

    try {
      const apiBase = getApiBase();
      const token = getAuthToken();

      const customizations = Object.keys(customQuantities).length > 0
        ? Object.entries(customQuantities).map(([serviceId, quantity]) => ({ serviceId, quantity }))
        : undefined;

      const res = await fetch(`${apiBase}/packages/combos/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          tierId: selectedTierId,
          targetUrl: targetUrl.trim(),
          quoteHash: quoteData.quoteHash,
          couponCode: appliedCoupon?.code || undefined,
          customizations,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Purchase failed.");
      }

      onOrderSuccess(data);
    } catch (err: any) {
      setOrderError(err.message || "Package purchase error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Target URL Header Bar */}
      <GlassCard className="p-4 border-border space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full space-y-1">
            <label className="text-xs font-semibold text-fg-2 flex items-center gap-1.5 uppercase tracking-wider">
              <Boxes className="w-4 h-4 text-[#D8EC8D]" />
              Target Social Media URL
            </label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://tiktok.com/@creator/video/12345678"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-border text-fg placeholder-slate-400 text-xs font-mono focus:outline-none focus:border-[#D8EC8D]/60 focus:ring-1 focus:ring-[#D8EC8D]/50 transition-all"
            />
            <LinkPreviewCard
              url={targetUrl}
              selectedPlatform={platform}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto pt-4 md:pt-0">
            <button
              type="button"
              onClick={() => setShowCompareDrawer(true)}
              className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-fg-2 font-semibold text-xs border border-border flex items-center gap-1.5 whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5 text-[#D8EC8D]" />
              Compare Combos
            </button>
            <button
              type="button"
              onClick={fetchQuote}
              className="px-5 py-2.5 rounded-xl bg-[#D8EC8D] text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(216,236,141,0.25)] hover:bg-[#cbe27a] whitespace-nowrap"
            >
              Verify Target
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Combo Cards Grid */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D8EC8D]" />
              Available Combo Packages
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              Deterministic largest-remainder bundle allocation
            </span>
          </div>

          {isLoadingTemplates ? (
            <div className="p-12 text-center text-slate-400 font-mono text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#D8EC8D]" />
              Loading package catalog...
            </div>
          ) : templates.length === 0 ? (
            <GlassCard className="p-8 text-center text-slate-400 text-xs border-border space-y-2">
              <Boxes className="w-8 h-8 mx-auto text-slate-600" />
              <p>No combo packages configured for {platform} yet.</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tmpl) => {
                const activeTier = tmpl.tiers?.find((t: any) => t.id === selectedTierId) || tmpl.tiers?.[0];
                const isSelected = selectedTemplateId === tmpl.id;

                return (
                  <div
                    key={tmpl.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? "bg-white dark:bg-[#131313]/90 border-[#b4cf47] dark:border-[#D8EC8D] shadow-md dark:shadow-[0_0_25px_rgba(216,236,141,0.15)] ring-1 ring-[#D8EC8D]/50"
                        : "bg-slate-50 dark:bg-[#121417]/60 border-border hover:border-slate-300 dark:hover:border-white/20"
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Badge & Title */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-extrabold text-fg uppercase tracking-wider">
                            {tmpl.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 line-clamp-1">
                            {tmpl.description || "Multi-metric engagement bundle"}
                          </p>
                        </div>
                        {tmpl.badge && (
                          <span className="px-2 py-0.5 rounded-full bg-accent/10 text-[#D8EC8D] text-[10px] font-bold border border-accent/30 uppercase tracking-wider shrink-0">
                            {tmpl.badge}
                          </span>
                        )}
                      </div>

                      {/* Tier Selection Chips */}
                      {tmpl.tiers && tmpl.tiers.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {tmpl.tiers.map((tier: any) => (
                            <button
                              key={tier.id}
                              type="button"
                              onClick={() => {
                                setSelectedTemplateId(tmpl.id);
                                setSelectedTierId(tier.id);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                                selectedTierId === tier.id && isSelected
                                  ? "bg-[#D8EC8D] text-black font-bold border-[#D8EC8D]"
                                  : "bg-white/5 border-border text-fg-2 hover:bg-white/10"
                              }`}
                            >
                              {tier.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 3 Plain Items Lines matching Mockup */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-white/5 text-xs text-fg-2">
                        {activeTier?.items?.map((it: any) => (
                          <div key={it.id} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2">
                              {it.kind === "VIEWS" ? (
                                <Eye className="w-3.5 h-3.5 text-[#D8EC8D]" />
                              ) : it.kind === "LIKES" ? (
                                <Heart className="w-3.5 h-3.5 text-[#D8EC8D]" />
                              ) : it.kind === "SHARES" ? (
                                <Share2 className="w-3.5 h-3.5 text-[#D8EC8D]" />
                              ) : (
                                <Users className="w-3.5 h-3.5 text-[#D8EC8D]" />
                              )}
                              <span>{it.quantity.toLocaleString()} {it.serviceName}</span>
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Delivery Indicator */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono pt-1">
                        <Clock className="w-3 h-3 text-[#D8EC8D]" />
                        <span>Paced Delivery over {activeTier?.durationDays || 7} Days</span>
                      </div>
                    </div>

                    {/* Footer: Price & Select Button */}
                    <div className="pt-4 mt-3 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                      <div>
                        <div className="text-base font-extrabold text-[#D8EC8D] font-mono">
                          {formatCurrency(Number(activeTier?.price || 0))}
                        </div>
                        {activeTier?.savingsPercent > 0 && (
                          <span className="text-[10px] text-success font-mono">
                            Save {activeTier.savingsPercent}% vs Retail
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTemplateId(tmpl.id);
                            if (activeTier) setSelectedTierId(activeTier.id);
                            setShowCustomizeDrawer(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-fg-2 text-xs border border-border"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTemplateId(tmpl.id);
                            if (activeTier) setSelectedTierId(activeTier.id);
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all ${
                            isSelected
                              ? "bg-[#D8EC8D] text-black shadow-[0_0_15px_rgba(216,236,141,0.3)]"
                              : "bg-slate-100 dark:bg-white/10 text-slate-700 text-fg hover:bg-slate-200 dark:hover:bg-white/20 border border-slate-200 dark:border-transparent"
                          }`}
                        >
                          {isSelected ? "Selected" : "Select Package"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sticky Sidebar: Summary & Payment */}
        <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
          <GlassCard className="p-5 border-border space-y-4">
            <h4 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D8EC8D]" />
              Order Summary
            </h4>

            {/* Selection info */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200/80 dark:border-white/5 space-y-1 text-xs">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Your Selection
              </span>
              <p className="text-fg font-bold">{selectedTemplate?.name || "None"}</p>
              <p className="text-[11px] text-slate-400 font-mono">
                {selectedTier?.name} &bull; {selectedTier?.durationDays} Days Schedule
              </p>
            </div>

            {/* Visual Dispatch SVG Curve */}
            <div className="h-24 w-full bg-slate-100 dark:bg-black/40 rounded-xl border border-slate-200/80 dark:border-white/5 p-2 overflow-hidden flex flex-col justify-end">
              {quoteData?.timeline && quoteData.timeline.length > 0 ? (
                <svg className="w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
                  <path
                    d="M 0 60 Q 75 10, 150 40 T 300 50 L 300 80 L 0 80 Z"
                    fill="rgba(216, 236, 141, 0.15)"
                  />
                  <path
                    d="M 0 60 Q 75 10, 150 40 T 300 50"
                    fill="none"
                    stroke="#D8EC8D"
                    strokeWidth="2.5"
                  />
                </svg>
              ) : (
                <div className="h-full flex items-center justify-center text-[11px] text-slate-500 font-mono">
                  Calculating delivery curve...
                </div>
              )}
            </div>

            {/* Coupon Code Input */}
            <div className="space-y-1 pt-1">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Discount Coupon
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Discount code here"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/40 border border-border text-fg placeholder-slate-400 text-xs font-mono uppercase focus:outline-none focus:border-[#D8EC8D]/60"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (couponCode.trim()) {
                      setAppliedCoupon({ code: couponCode.trim(), discountPercent: 10 });
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-fg text-xs font-bold font-mono"
                >
                  Apply
                </button>
              </div>
              {appliedCoupon && (
                <p className="text-[10px] text-success font-mono">
                  Coupon {appliedCoupon.code} applied (10% discount)
                </p>
              )}
            </div>

            {/* Line-Items Breakdown */}
            {quoteData?.items && (
              <div className="space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-white/5 text-xs">
                {quoteData.items.map((it: any) => (
                  <div key={it.serviceId} className="flex justify-between py-0.5">
                    <span className="text-slate-400 truncate pr-2">
                      {it.quantity.toLocaleString()} {it.serviceName}
                    </span>
                    <span className="text-fg font-mono shrink-0">
                      {formatCurrency(it.allocatedCharge)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Total Amount in Rupees */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-base">
              <span className="font-bold text-fg-2">Total Amount:</span>
              <span className="font-extrabold text-[#D8EC8D] font-mono text-lg">
                {formatCurrency(quoteData?.totalCharge || selectedTier?.price || 0)}
              </span>
            </div>

            {/* Wallet Balance Comparison */}
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Wallet Available:</span>
              <span
                className={`font-bold ${
                  walletBalance >= (quoteData?.totalCharge || selectedTier?.price || 0)
                    ? "text-[#D8EC8D]"
                    : "text-red-400"
                }`}
              >
                {formatCurrency(walletBalance)}
              </span>
            </div>

            {/* Insufficient Funds Recovery */}
            {walletBalance < (quoteData?.totalCharge || selectedTier?.price || 0) && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
                <span>Insufficient wallet balance.</span>
                <a
                  href="/wallet"
                  className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 font-bold text-red-200"
                >
                  Add Funds
                </a>
              </div>
            )}

            {/* Error Banner */}
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

            {/* Pay Button: Strictly Wallet Payment per Rule 4 */}
            <button
              type="button"
              onClick={handlePurchase}
              disabled={
                isSubmitting ||
                isQuoting ||
                !quoteData ||
                walletBalance < (quoteData?.totalCharge || 0) ||
                !consentChecked
              }
              className={`w-full py-3 rounded-xl text-black font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                isSubmitting ||
                isQuoting ||
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
                  Purchasing Combo...
                </>
              ) : isQuoting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calculating Quote...
                </>
              ) : (
                <>
                  Pay with Wallet
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

