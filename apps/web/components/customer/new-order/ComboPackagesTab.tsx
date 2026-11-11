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
  Layers,
  Eye,
  Heart,
  Share2,
  Users,
  ShieldCheck,
  Percent,
  Zap,
  Bookmark,
  Repeat,
  MessageCircle,
  Flame,
  ArrowRight,
  Check,
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
  const [linkPreview, setLinkPreview] = useState<any | null>(null);
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
  const [consentChecked, setConsentChecked] = useState<boolean>(true);

  // Load Templates from API
  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    setTemplatesError(null);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      // Pass platform if present; if empty or ALL, fetch all active
      const url = platform && platform !== "ALL"
        ? `${apiBase}/packages/templates?platform=${encodeURIComponent(platform)}`
        : `${apiBase}/packages/templates`;
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load combo packages.");
      }

      const tmpls = Array.isArray(data) ? data : [];
      setTemplates(tmpls);

      if (tmpls.length > 0 && !selectedTemplateId) {
        // Default to Reels Growth Packages if present, else first
        const reelsTmpl = tmpls.find((t) => t.slug?.includes("reels") || t.slug?.includes("growth")) || tmpls[0];
        setSelectedTemplateId(reelsTmpl.id);
        if (reelsTmpl.tiers && reelsTmpl.tiers.length > 0) {
          // Default to middle tier (Tier 2 ₹3,999) if available, else first tier
          const tier2 = reelsTmpl.tiers.find((t: any) => t.name.includes("Tier 2")) || reelsTmpl.tiers[0];
          setSelectedTierId(tier2.id);
        }
      }
    } catch (err: any) {
      setTemplatesError(err.message || "Could not retrieve combo packages.");
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [platform, selectedTemplateId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // SMART AUTO-SUGGESTION ENGINE
  const aiSuggestion = useMemo(() => {
    const raw = targetUrl.trim().toLowerCase();
    if (!raw) return null;

    const isReelOrVideo =
      raw.includes("/reel/") ||
      raw.includes("/reels/") ||
      raw.includes("/tv/") ||
      raw.includes("/shorts/") ||
      raw.includes("/video/") ||
      raw.includes("tiktok.com") ||
      raw.includes("youtu.be") ||
      linkPreview?.kind === "REEL" ||
      linkPreview?.kind === "VIDEO";

    const isProfile =
      raw.startsWith("@") ||
      (!raw.includes("/p/") && !raw.includes("/reel/") && !raw.includes("/tv/") && !raw.includes("/video/") && !raw.includes("?v=") &&
        (raw.match(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com|twitter\.com|x\.com)\/[a-zA-Z0-9._]+$/) ||
         (!raw.includes("/") && raw.length > 2)));

    if (isReelOrVideo) {
      const matchTmpl = templates.find((t) => t.slug?.includes("reels") || t.slug?.includes("growth"));
      const matchTier = matchTmpl?.tiers?.find((t: any) => t.name.includes("Tier 2")) || matchTmpl?.tiers?.[0];
      return {
        type: "REEL",
        label: "Instagram Reel / Video Detected",
        templateSlug: matchTmpl?.slug || "instagram-reels-growth-pack",
        templateId: matchTmpl?.id,
        tierId: matchTier?.id,
        tierName: matchTier?.name || "Tier 2 — Viral Push",
        reason: "Best match for algorithmic momentum! Paces 1.6M+ Views, 40K+ Likes, and 75K+ Shares.",
        badge: "VIRAL REELS PICK",
      };
    }

    if (isProfile) {
      const matchTmpl = templates.find((t) => t.slug?.includes("profile"));
      return {
        type: "PROFILE",
        label: "Creator / Brand Profile Detected",
        templateSlug: matchTmpl?.slug || "profile-power-up",
        templateId: matchTmpl?.id,
        tierId: matchTmpl?.tiers?.[0]?.id,
        tierName: matchTmpl?.tiers?.[0]?.name || "Profile Booster",
        reason: "Best match for profile authority! Adds high-retention VIP followers and profile reach.",
        badge: "PROFILE POWER-UP",
      };
    }

    // Default for photo / regular post
    const matchTmpl = templates.find((t) => t.slug?.includes("engagement"));
    return {
      type: "POST",
      label: "Standard Post / Media Detected",
      templateSlug: matchTmpl?.slug || "engagement-boost",
      templateId: matchTmpl?.id,
      tierId: matchTmpl?.tiers?.[0]?.id,
      tierName: matchTmpl?.tiers?.[0]?.name || "Engagement Ignition",
      reason: "Best match for organic interaction! Delivers high-velocity likes, shares, and comments.",
      badge: "ENGAGEMENT BOOST",
    };
  }, [targetUrl, linkPreview, templates]);

  // Apply AI Suggestion automatically when detected
  const [hasAutoApplied, setHasAutoApplied] = useState(false);
  useEffect(() => {
    if (aiSuggestion && aiSuggestion.templateId && !hasAutoApplied) {
      setSelectedTemplateId(aiSuggestion.templateId);
      if (aiSuggestion.tierId) {
        setSelectedTierId(aiSuggestion.tierId);
      }
      setHasAutoApplied(true);
    }
  }, [aiSuggestion, hasAutoApplied]);

  // Reset auto applied flag when targetUrl changes significantly
  useEffect(() => {
    setHasAutoApplied(false);
  }, [targetUrl]);

  // Selected Template & Tier objects
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [templates, selectedTemplateId]
  );

  const selectedTier = useMemo(
    () => selectedTemplate?.tiers?.find((t: any) => t.id === selectedTierId) || selectedTemplate?.tiers?.[0],
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
          preview: linkPreview ? {
            thumbnailUrl: linkPreview.thumbnailUrl,
            title: linkPreview.title,
            authorName: linkPreview.authorName,
            kind: linkPreview.kind,
            isCarousel: linkPreview.isCarousel,
            slideIndex: linkPreview.slideIndex,
          } : undefined,
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Group templates into Reels Growth (multi-tier) vs Single Boost Packs
  const reelsGrowthTemplate = useMemo(() => {
    return templates.find((t) => t.slug?.includes("reels") || t.slug?.includes("growth"));
  }, [templates]);

  const otherTemplates = useMemo(() => {
    return templates.filter((t) => !t.slug?.includes("reels") && !t.slug?.includes("growth"));
  }, [templates]);

  return (
    <div className="space-y-6">
      {/* Target URL Header Bar with Embedded Thumbnail Card */}
      <GlassCard className="p-4 border-border space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="flex-1 w-full space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-fg-2 flex items-center gap-1.5 uppercase tracking-wider">
                <Boxes className="w-4 h-4 text-[#D8EC8D]" />
                Target Social Media URL or Handle
              </label>
              <span className="text-[10px] font-mono text-[#D8EC8D] flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Auto-Thumbnail & Smart Suggestion
              </span>
            </div>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="e.g. https://www.instagram.com/reel/C7x9yz12345/ or @username"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-border text-fg placeholder-slate-400 text-xs font-mono focus:outline-none focus:border-[#D8EC8D]/60 focus:ring-1 focus:ring-[#D8EC8D]/50 transition-all"
            />
            {/* Embedded Live Thumbnail & Metadata */}
            <LinkPreviewCard
              url={targetUrl}
              selectedPlatform={platform}
              onPreviewChange={setLinkPreview}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto pt-2 md:pt-4 self-end">
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

        {/* AI SMART SUGGESTION BANNER */}
        {aiSuggestion && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-accent/20 via-accent/10 to-transparent border border-accent/30 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shrink-0">
                <Sparkles className="w-4 h-4 text-[#D8EC8D]" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-accent text-black">
                    {aiSuggestion.badge}
                  </span>
                  <span className="text-xs font-extrabold text-fg">
                    {aiSuggestion.label} &rarr; Suggested: {aiSuggestion.tierName}
                  </span>
                </div>
                <p className="text-[11px] text-fg-2">
                  {aiSuggestion.reason}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (aiSuggestion.templateId) setSelectedTemplateId(aiSuggestion.templateId);
                if (aiSuggestion.tierId) setSelectedTierId(aiSuggestion.tierId);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#D8EC8D] hover:bg-[#cbe27a] text-black text-xs font-extrabold shrink-0 flex items-center gap-1 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              Applied
            </button>
          </div>
        )}
      </GlassCard>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Combo Cards Grid */}
        <div className="lg:col-span-8 space-y-6">
          {/* SECTION 1: Instagram Reels Growth Packages (Reference Banner style: Tier 1 ₹2,999, Tier 2 ₹3,999, Tier 3 ₹4,999) */}
          {reelsGrowthTemplate && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#D8EC8D]/20 border border-[#D8EC8D]/30 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-[#D8EC8D]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-fg uppercase tracking-wider flex items-center gap-2">
                      {reelsGrowthTemplate.name}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white font-extrabold font-mono">
                        HOT ALGORITHM
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Multi-metric algorithmic ignition bundle (Views, Likes, Comments, Shares, Saves & Reposts)
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                  Paced algorithmic delivery
                </span>
              </div>

              {/* Tiers List as High-Impact Pricing Cards */}
              <div className="space-y-3">
                {reelsGrowthTemplate.tiers?.map((tier: any, idx: number) => {
                  const isSelected =
                    selectedTemplateId === reelsGrowthTemplate.id && selectedTierId === tier.id;
                  const isAiRecommended =
                    aiSuggestion?.type === "REEL" &&
                    (aiSuggestion.tierId === tier.id || (!aiSuggestion.tierId && idx === 1));

                  // Extract metrics if available
                  const viewsItem = tier.items?.find((i: any) => i.kind === "VIEWS");
                  const likesItem = tier.items?.find((i: any) => i.kind === "LIKES");
                  const commentsItem = tier.items?.find((i: any) => i.kind === "COMMENTS");
                  const sharesItem = tier.items?.find((i: any) => i.kind === "SHARES");

                  // Fallback numbers matching reference image
                  const viewsDisplay = viewsItem ? `${(viewsItem.quantity / 1000000).toFixed(1)}M+` : idx === 0 ? "1.2M+" : idx === 1 ? "1.6M+" : "2M+";
                  const likesDisplay = likesItem ? `${(likesItem.quantity / 1000).toFixed(0)}K+` : idx === 0 ? "30K+" : idx === 1 ? "40K+" : "50K+";
                  const commentsDisplay = commentsItem ? `${commentsItem.quantity.toLocaleString()}+` : idx === 0 ? "2,400+" : idx === 1 ? "3,200+" : "4K+";
                  const sharesDisplay = sharesItem ? `${sharesItem.quantity.toLocaleString()}+` : idx === 0 ? "56,400+" : idx === 1 ? "75,200+" : "94K+";
                  const savesDisplay = idx === 0 ? "6K+" : idx === 1 ? "8K+" : "10K+";
                  const repostsDisplay = idx === 0 ? "4,500+" : idx === 1 ? "6K+" : "7,500+";

                  const tierColorClass =
                    idx === 0
                      ? "from-rose-600 to-pink-600"
                      : idx === 1
                      ? "from-purple-600 to-indigo-600"
                      : "from-blue-600 to-cyan-600";

                  return (
                    <div
                      key={tier.id}
                      onClick={() => {
                        setSelectedTemplateId(reelsGrowthTemplate.id);
                        setSelectedTierId(tier.id);
                      }}
                      className={`relative p-4 rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                        isSelected
                          ? "bg-surface-raised border-[#D8EC8D] shadow-lg dark:shadow-[0_0_30px_rgba(216,236,141,0.2)] ring-2 ring-[#D8EC8D]/50"
                          : "bg-surface border-border hover:border-slate-300 dark:hover:border-white/20"
                      }`}
                    >
                      {/* AI Suggested Ribbon */}
                      {isAiRecommended && (
                        <div className="absolute top-0 right-0 bg-[#D8EC8D] text-black font-extrabold text-[9px] px-3 py-0.5 rounded-bl-xl uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-3 h-3" />
                          AI Suggested Best Match
                        </div>
                      )}

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Left Ribbon / Badge */}
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-24 h-16 rounded-xl bg-gradient-to-br ${tierColorClass} text-white flex flex-col items-center justify-center p-2 text-center shadow-md shrink-0`}
                          >
                            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Growth</span>
                            <span className="text-xs font-black uppercase tracking-tight">Package</span>
                            <span className="text-[9px] font-mono opacity-80">{tier.name.split("—")[0]}</span>
                          </div>

                          {/* Deliverables Matrix */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Eye className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              <span className="text-fg font-black">{viewsDisplay}</span>
                              <span className="text-[11px] text-fg-muted">Views</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Heart className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                              <span className="text-fg font-black">{likesDisplay}</span>
                              <span className="text-[11px] text-fg-muted">Likes</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MessageCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="text-fg font-black">{commentsDisplay}</span>
                              <span className="text-[11px] text-fg-muted">Comments</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Share2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span className="text-fg font-black">{sharesDisplay}</span>
                              <span className="text-[11px] text-fg-muted">Shares</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Bookmark className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-fg font-black">{savesDisplay}</span>
                              <span className="text-[11px] text-fg-muted">Saves</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Repeat className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span className="text-fg font-black">{repostsDisplay}</span>
                              <span className="text-[11px] text-fg-muted">Reposts</span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Price & Choose Button */}
                        <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-border">
                          <div className="text-left md:text-right">
                            <div className="text-xl sm:text-2xl font-black text-[#D8EC8D] font-mono tracking-tight">
                              {formatCurrency(Number(tier.price))}
                            </div>
                            <span className="text-[10px] text-fg-muted font-mono block">
                              {tier.durationDays} Days Paced
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTemplateId(reelsGrowthTemplate.id);
                              setSelectedTierId(tier.id);
                            }}
                            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${
                              isSelected
                                ? "bg-[#D8EC8D] text-black shadow-[0_0_15px_rgba(216,236,141,0.35)]"
                                : "bg-red-600 hover:bg-red-500 text-white shadow-md"
                            }`}
                          >
                            <span>{isSelected ? "Selected" : "Choose Package"}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: Other Multi-Metric Packs (Profile Power-Up ₹1,435, Engagement Boost ₹1,235) */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D8EC8D]" />
              Targeted Engagement & Profile Combos
            </h3>

            {isLoadingTemplates ? (
              <div className="p-8 text-center text-slate-400 font-mono text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#D8EC8D]" />
                Loading packages...
              </div>
            ) : otherTemplates.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No additional combo packs configured.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherTemplates.map((tmpl) => {
                  const activeTier = tmpl.tiers?.[0];
                  const isSelected = selectedTemplateId === tmpl.id;
                  const isAiRecommended =
                    (aiSuggestion?.type === "PROFILE" && tmpl.slug?.includes("profile")) ||
                    (aiSuggestion?.type === "POST" && tmpl.slug?.includes("engagement"));

                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => {
                        setSelectedTemplateId(tmpl.id);
                        if (activeTier) setSelectedTierId(activeTier.id);
                      }}
                      className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-surface-raised border-[#D8EC8D] shadow-md dark:shadow-[0_0_25px_rgba(216,236,141,0.15)] ring-1 ring-[#D8EC8D]/50"
                          : "bg-surface border-border hover:border-slate-300 dark:hover:border-white/20"
                      }`}
                    >
                      {isAiRecommended && (
                        <div className="absolute top-0 right-0 bg-[#D8EC8D] text-black font-extrabold text-[9px] px-2.5 py-0.5 rounded-bl-xl uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-3 h-3" />
                          AI Suggested
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              {tmpl.slug?.includes("profile") ? (
                                <Users className="w-4 h-4 text-[#D8EC8D]" />
                              ) : (
                                <Zap className="w-4 h-4 text-[#D8EC8D]" />
                              )}
                              <h4 className="text-sm font-extrabold text-fg uppercase tracking-wider">
                                {tmpl.name}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {tmpl.description || "Multi-metric engagement bundle"}
                            </p>
                          </div>
                          {tmpl.badge && (
                            <span className="px-2 py-0.5 rounded-full bg-accent/10 text-[#D8EC8D] text-[10px] font-bold border border-accent/30 uppercase tracking-wider shrink-0">
                              {tmpl.badge}
                            </span>
                          )}
                        </div>

                        {/* Items list */}
                        <div className="space-y-1.5 pt-2 border-t border-border text-xs text-fg-2">
                          {activeTier?.items?.map((it: any) => (
                            <div key={it.id} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-2">
                                {it.kind === "FOLLOWERS" ? (
                                  <Users className="w-3.5 h-3.5 text-[#D8EC8D]" />
                                ) : it.kind === "LIKES" ? (
                                  <Heart className="w-3.5 h-3.5 text-pink-400" />
                                ) : it.kind === "COMMENTS" ? (
                                  <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                                )}
                                <span className="font-bold text-fg">{it.quantity.toLocaleString()}</span>
                                <span className="text-fg-muted">{it.serviceName || it.kind}</span>
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono pt-1">
                          <Clock className="w-3 h-3 text-[#D8EC8D]" />
                          <span>Paced Delivery over {activeTier?.durationDays || 5} Days</span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="pt-4 mt-3 border-t border-border flex items-center justify-between">
                        <div>
                          <div className="text-lg font-extrabold text-[#D8EC8D] font-mono">
                            {formatCurrency(Number(activeTier?.price || 0))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTemplateId(tmpl.id);
                            if (activeTier) setSelectedTierId(activeTier.id);
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all ${
                            isSelected
                              ? "bg-[#D8EC8D] text-black shadow-md"
                              : "bg-surface-raised hover:bg-surface-elevated text-fg-2 border border-border"
                          }`}
                        >
                          {isSelected ? "Selected" : "Choose"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Sticky Sidebar: Summary & Checkout */}
        <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
          <GlassCard className="p-5 border-border space-y-4">
            <h4 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D8EC8D]" />
              Combo Order Summary
            </h4>

            {/* Selection info */}
            <div className="p-3 rounded-xl bg-surface-raised border border-border space-y-1.5 text-xs">
              <span className="text-[10px] text-fg-muted uppercase tracking-wider font-semibold">
                Selected Package
              </span>
              <p className="text-fg font-extrabold text-sm">{selectedTemplate?.name || "None"}</p>
              <div className="flex items-center justify-between text-[11px] text-fg-2 font-mono">
                <span>{selectedTier?.name || "Standard Tier"}</span>
                <span className="text-[#D8EC8D] font-bold">
                  {selectedTier ? formatCurrency(Number(selectedTier.price)) : "—"}
                </span>
              </div>
              <p className="text-[10px] text-fg-muted font-mono">
                Pacing Duration: {selectedTier?.durationDays || 7} Days Automated Schedule
              </p>
            </div>

            {/* Visual Wave Schedule Simulation */}
            <div className="h-24 w-full bg-surface-raised rounded-xl border border-border p-2 overflow-hidden flex flex-col justify-end relative">
              <span className="absolute top-2 left-2 text-[10px] font-mono text-fg-muted uppercase">
                Algorithmic Wave Curve
              </span>
              <svg className="w-full h-16" viewBox="0 0 300 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="neonWave" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D8EC8D" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#D8EC8D" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 60 Q 50 10, 100 45 T 200 20 T 300 55 L 300 80 L 0 80 Z"
                  fill="url(#neonWave)"
                />
                <path
                  d="M 0 60 Q 50 10, 100 45 T 200 20 T 300 55"
                  fill="none"
                  stroke="#D8EC8D"
                  strokeWidth="2.5"
                />
              </svg>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2 pt-2 border-t border-border text-xs">
              <div className="flex justify-between text-fg-2">
                <span>Base Bundle Price:</span>
                <span className="font-mono">{formatCurrency(quoteData?.basePrice || selectedTier?.price || 0)}</span>
              </div>
              {quoteData?.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Coupon Discount:</span>
                  <span className="font-mono">-{formatCurrency(quoteData.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-fg pt-2 border-t border-border">
                <span>Total Charge:</span>
                <span className="font-mono text-base text-[#D8EC8D]">
                  {formatCurrency(quoteData?.totalCharge || selectedTier?.price || 0)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-fg-muted font-mono">
                <span>Wallet Balance:</span>
                <span className={walletBalance >= (quoteData?.totalCharge || selectedTier?.price || 0) ? "text-emerald-400" : "text-red-400"}>
                  {formatCurrency(walletBalance)}
                </span>
              </div>
            </div>

            {/* Error alerts */}
            {quoteError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{quoteError}</span>
              </div>
            )}
            {orderError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{orderError}</span>
              </div>
            )}

            {/* Consent Checkbox */}
            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 rounded border-border text-[#D8EC8D] focus:ring-accent"
              />
              <span className="text-[11px] text-fg-muted leading-tight">
                I understand this combo executes on an automated multi-day pacing schedule to emulate natural organic growth.
              </span>
            </label>

            {/* Checkout Button */}
            <button
              type="button"
              disabled={isSubmitting || isQuoting || !selectedTemplate || !selectedTier || !targetUrl.trim()}
              onClick={handlePurchase}
              className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                isSubmitting || isQuoting || !targetUrl.trim()
                  ? "bg-surface-raised text-fg-muted cursor-not-allowed border border-border"
                  : "bg-[#D8EC8D] hover:bg-[#cbe27a] text-black shadow-[0_0_20px_rgba(216,236,141,0.35)]"
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Bundle Dispatch...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Purchase Combo Bundle</span>
                </>
              )}
            </button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
