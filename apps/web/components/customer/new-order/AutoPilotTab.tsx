"use client";

import React, { useState, useMemo } from "react";
import { GlassCard } from "@/components/shared/GlassCard";
import { getApiBase } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-session";
import {
  Repeat,
  Heart,
  Eye,
  Share2,
  Users,
  Clock,
  Sparkles,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Layers,
} from "lucide-react";

interface AutoPilotTabProps {
  platform: string;
  services: any[];
  walletBalance: number;
  onOrderSuccess: (result: any) => void;
  prefilledTargetUrl?: string;
}

export function AutoPilotTab({
  platform,
  services,
  walletBalance,
  onOrderSuccess,
  prefilledTargetUrl = "",
}: AutoPilotTabProps) {
  // Slots configuration
  const [totalSlots, setTotalSlots] = useState<number>(5);
  const [durationDays, setDurationDays] = useState<number>(14);

  // Per-post recipe
  const [likesPerPost, setLikesPerPost] = useState<number>(500);
  const [viewsPerPost, setViewsPerPost] = useState<number>(1000);
  const [sharesPerPost, setSharesPerPost] = useState<number>(200);

  // Optional Followers drip
  const [includeFollowers, setIncludeFollowers] = useState<boolean>(false);
  const [followersTotal, setFollowersTotal] = useState<number>(2500);
  const [profileUrl, setProfileUrl] = useState<string>("");

  // Coming Soon toggle for auto-detect (strictly disabled per Rule 5)
  const [autoDetectEnabled] = useState<boolean>(false);

  // Initial slot link (optional)
  const [firstPostUrl, setFirstPostUrl] = useState<string>(prefilledTargetUrl);

  // Quoting & Purchase
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState<boolean>(false);

  // Approximate charges using catalog rates
  const likesRate = 45; // per 1k
  const viewsRate = 20; // per 1k
  const sharesRate = 30; // per 1k
  const followersRate = 180; // per 1k

  const totalLikesUnits = likesPerPost * totalSlots;
  const totalViewsUnits = viewsPerPost * totalSlots;
  const totalSharesUnits = sharesPerPost * totalSlots;

  const totalCharge = useMemo(() => {
    let sum =
      (totalLikesUnits * likesRate) / 1000 +
      (totalViewsUnits * viewsRate) / 1000 +
      (totalSharesUnits * sharesRate) / 1000;
    if (includeFollowers) {
      sum += (followersTotal * followersRate) / 1000;
    }
    return Math.round(sum * 100) / 100;
  }, [totalLikesUnits, totalViewsUnits, totalSharesUnits, includeFollowers, followersTotal]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(val);
  };

  const handlePurchase = async () => {
    if (!consentChecked) {
      setOrderError("Please agree to the Terms of Service.");
      return;
    }
    if (walletBalance < totalCharge) {
      setOrderError("Insufficient balance in your wallet. Please add funds.");
      return;
    }
    if (includeFollowers && !profileUrl.trim()) {
      setOrderError("Please provide your profile link for followers delivery.");
      return;
    }

    setIsSubmitting(true);
    setOrderError(null);

    try {
      const apiBase = getApiBase();
      const token = getAuthToken();

      // Find services from catalog
      const likeService = services.find((s) => s.kind === "LIKES") || services[0];
      const viewService = services.find((s) => s.kind === "VIEWS") || services[0];
      const shareService = services.find((s) => s.kind === "SHARES") || services[0];

      const res = await fetch(`${apiBase}/packages/custom-campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          platform: platform || "instagram",
          profileUrl: profileUrl.trim() || undefined,
          targetUrl: firstPostUrl.trim() || undefined,
          durationDays,
          quoteHash: `qh_v2_auto_${Date.now()}`,
          services: [
            { serviceId: likeService?.id || "srv_1", quantity: totalLikesUnits },
            { serviceId: viewService?.id || "srv_2", quantity: totalViewsUnits },
            { serviceId: shareService?.id || "srv_3", quantity: totalSharesUnits },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Auto-pilot purchase failed.");
      }

      onOrderSuccess(data);
    } catch (err: any) {
      setOrderError(err.message || "Failed to initialize Auto-Pilot package.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <GlassCard className="p-5 border-border space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-fg uppercase tracking-wider flex items-center gap-2">
              <Repeat className="w-4 h-4 text-[#D8EC8D]" />
              Auto-Pilot Post Slot Engine
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pre-purchase delivery slots. As you publish new posts, paste links into your available slots to trigger dispatches.
            </p>
          </div>

          {/* Disabled Coming Soon Automatic Detection Toggle (Strictly compliant with Rule 5) */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-border text-xs text-fg-muted">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px]">Automatic post detection:</span>
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-slate-500 border border-border font-mono">
              Coming Soon
            </span>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Recipe Configuration */}
        <div className="lg:col-span-8 space-y-4">
          <GlassCard className="p-5 border-border space-y-5">
            {/* Number of Post Slots Selector */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#D8EC8D]" />
                  Number of Post Slots
                </span>
                <span className="font-mono text-[#D8EC8D] font-bold">
                  {totalSlots} Posts Package
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[3, 5, 10, 20].map((slots) => (
                  <button
                    key={slots}
                    type="button"
                    onClick={() => setTotalSlots(slots)}
                    className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                      totalSlots === slots
                        ? "bg-[#D8EC8D] text-black border-[#D8EC8D] shadow-[0_0_15px_rgba(216,236,141,0.2)]"
                        : "bg-slate-100 dark:bg-black/30 border border-border text-fg-2 hover:bg-slate-200 dark:hover:bg-white/5"
                    }`}
                  >
                    {slots} Posts
                  </button>
                ))}
              </div>
            </div>

            {/* Per-Post Recipe Sliders */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-4">
              <h4 className="text-xs font-bold text-fg-2 uppercase tracking-wider">
                Per-Post Engagement Recipe
              </h4>

              {/* Likes per Post */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-[#D8EC8D]" />
                    Likes per Post
                  </span>
                  <span className="font-mono text-fg font-bold">{likesPerPost}</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="2500"
                  step="50"
                  value={likesPerPost}
                  onChange={(e) => setLikesPerPost(parseInt(e.target.value) || 500)}
                  className="w-full accent-[#D8EC8D] bg-slate-200 dark:bg-black/40 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* Views per Post */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-[#D8EC8D]" />
                    Views per Post
                  </span>
                  <span className="font-mono text-fg font-bold">{viewsPerPost}</span>
                </div>
                <input
                  type="range"
                  min="250"
                  max="10000"
                  step="250"
                  value={viewsPerPost}
                  onChange={(e) => setViewsPerPost(parseInt(e.target.value) || 1000)}
                  className="w-full accent-[#D8EC8D] bg-slate-200 dark:bg-black/40 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* Shares per Post */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-[#D8EC8D]" />
                    Shares per Post
                  </span>
                  <span className="font-mono text-fg font-bold">{sharesPerPost}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="25"
                  value={sharesPerPost}
                  onChange={(e) => setSharesPerPost(parseInt(e.target.value) || 200)}
                  className="w-full accent-[#D8EC8D] bg-slate-200 dark:bg-black/40 h-1.5 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Optional Followers Drip */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFollowers}
                  onChange={(e) => setIncludeFollowers(e.target.checked)}
                  className="rounded text-[#D8EC8D] bg-slate-100 dark:bg-black/40 border-slate-300 dark:border-white/20 accent-[#D8EC8D] cursor-pointer"
                />
                <span className="text-xs font-bold text-fg flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#D8EC8D]" />
                  Include Followers Steady Drip across Schedule
                </span>
              </label>

              {includeFollowers && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Profile URL
                    </label>
                    <input
                      type="url"
                      value={profileUrl}
                      onChange={(e) => setProfileUrl(e.target.value)}
                      placeholder="https://instagram.com/profile"
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-black/40 border border-border text-fg text-xs font-mono focus:outline-none focus:border-[#D8EC8D]/60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Total Followers ({durationDays} Days)
                    </label>
                    <input
                      type="number"
                      value={followersTotal}
                      onChange={(e) => setFollowersTotal(parseInt(e.target.value) || 2500)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-black/40 border border-border text-fg text-xs font-mono focus:outline-none focus:border-[#D8EC8D]/60"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Initial First Post Slot (Optional) */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-1.5">
              <label className="text-xs font-bold text-fg uppercase tracking-wider">
                First Slot Link (Optional)
              </label>
              <input
                type="url"
                value={firstPostUrl}
                onChange={(e) => setFirstPostUrl(e.target.value)}
                placeholder="https://instagram.com/reel/123 (or assign later in package controls)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-border text-fg placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-[#D8EC8D]/60"
              />
              <p className="text-[10px] text-slate-500">
                You can activate slot 1 now, or leave blank and activate all slots on-demand.
              </p>
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Order Summary & Purchase */}
        <div className="lg:col-span-4 space-y-4">
          <GlassCard className="p-5 border-border space-y-4">
            <h4 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D8EC8D]" />
              Auto-Pilot Summary
            </h4>

            {/* Overview Card */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200/60 dark:border-white/5 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Slots Purchased:</span>
                <span className="text-fg font-bold">{totalSlots} Posts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Likes:</span>
                <span className="text-[#D8EC8D]">{totalLikesUnits.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Views:</span>
                <span className="text-[#D8EC8D]">{totalViewsUnits.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Shares:</span>
                <span className="text-[#D8EC8D]">{totalSharesUnits.toLocaleString()}</span>
              </div>
              {includeFollowers && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Followers Drip:</span>
                  <span className="text-[#D8EC8D]">{followersTotal.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Total Amount in Rupees */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between">
              <span className="text-sm font-bold text-fg-2">Total Price:</span>
              <span className="text-lg font-extrabold text-[#D8EC8D] font-mono">
                {formatCurrency(totalCharge)}
              </span>
            </div>

            {/* Wallet Balance Verification */}
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Wallet Available:</span>
              <span
                className={`font-bold ${
                  walletBalance >= totalCharge ? "text-[#D8EC8D]" : "text-red-400"
                }`}
              >
                {formatCurrency(walletBalance)}
              </span>
            </div>

            {/* Error Callout */}
            {orderError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{orderError}</p>
              </div>
            )}

            {/* Consent Checkbox */}
            <label className="flex items-start gap-2 text-[11px] text-slate-400 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 rounded text-[#D8EC8D] bg-slate-100 dark:bg-black/40 border-slate-300 dark:border-white/20 accent-[#D8EC8D] cursor-pointer"
              />
              <span className="leading-tight">
                I agree to the Terms of Service and deterministic slot dispatch allocation.
              </span>
            </label>

            {/* Purchase Button */}
            <button
              type="button"
              onClick={handlePurchase}
              disabled={isSubmitting || walletBalance < totalCharge || !consentChecked}
              className={`w-full py-3 rounded-xl text-black font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                isSubmitting || walletBalance < totalCharge || !consentChecked
                  ? "bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-200/60 dark:border-white/5"
                  : "bg-[#D8EC8D] hover:bg-[#cbe27a] shadow-[0_0_20px_rgba(216,236,141,0.3)] active:scale-[0.99]"
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Package...
                </>
              ) : (
                <>
                  Purchase Auto-Pilot Slots
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

