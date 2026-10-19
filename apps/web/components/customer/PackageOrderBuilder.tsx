"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { GlassCard } from "@/components/shared/GlassCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import {
  Boxes,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Wallet,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";
import { PackageQuoteResponse } from "@smm/contracts";

export function PackageOrderBuilder() {
  const router = useRouter();
  const { user, services, fetchPackageQuote, purchasePackage } = useCustomer();

  const [platform, setPlatform] = useState<string>("instagram");
  const [durationDays, setDurationDays] = useState<number>(7);
  const [profileUrl, setProfileUrl] = useState<string>("");
  const [postUrl, setPostUrl] = useState<string>("");

  // Service selections and quantities
  const [followersQty, setFollowersQty] = useState<number>(1400);
  const [likesQty, setLikesQty] = useState<number>(3500);
  const [viewsQty, setViewsQty] = useState<number>(7000);

  const [quote, setQuote] = useState<PackageQuoteResponse | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Available services for the chosen platform
  const platformServices = useMemo(() => {
    return services.filter(
      (s) =>
        (s.status === "ACTIVE" || !s.status) &&
        (s.platform?.toLowerCase() === platform || s.platform?.toLowerCase().includes(platform))
    );
  }, [services, platform]);

  const followerService = useMemo(() => {
    return (
      platformServices.find((s) => s.name.toLowerCase().includes("follower")) ||
      platformServices[0]
    );
  }, [platformServices]);

  const likeService = useMemo(() => {
    return (
      platformServices.find((s) => s.name.toLowerCase().includes("like")) ||
      platformServices[1] ||
      platformServices[0]
    );
  }, [platformServices]);

  const viewService = useMemo(() => {
    return (
      platformServices.find((s) => s.name.toLowerCase().includes("view")) ||
      platformServices[2] ||
      platformServices[0]
    );
  }, [platformServices]);

  // Recalculate quote whenever inputs change
  useEffect(() => {
    let isCancelled = false;

    const compute = async () => {
      if (!followerService && !likeService) return;
      setCalculating(true);
      setErrorMessage(null);

      const items: any[] = [];
      if (followerService && followersQty > 0) {
        items.push({
          serviceId: followerService.id,
          target: profileUrl || "https://instagram.com/profile",
          targetType: "PROFILE",
          quantity: followersQty,
        });
      }
      if (likeService && likesQty > 0) {
        items.push({
          serviceId: likeService.id,
          target: postUrl || "https://instagram.com/p/reel",
          targetType: "POST_OR_REEL",
          quantity: likesQty,
        });
      }
      if (viewService && viewsQty > 0 && viewService.id !== likeService?.id) {
        items.push({
          serviceId: viewService.id,
          target: postUrl || "https://instagram.com/p/reel",
          targetType: "POST_OR_REEL",
          quantity: viewsQty,
        });
      }

      try {
        const q = await fetchPackageQuote({
          name: `${platform.toUpperCase()} Growth Bundle (${durationDays} Days)`,
          days: durationDays,
          items,
        });
        if (!isCancelled && q) {
          setQuote(q);
        }
      } catch (err: any) {
        if (!isCancelled) setErrorMessage(err.message);
      } finally {
        if (!isCancelled) setCalculating(false);
      }
    };

    const timer = setTimeout(compute, 300);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    platform,
    durationDays,
    profileUrl,
    postUrl,
    followersQty,
    likesQty,
    viewsQty,
    followerService,
    likeService,
    viewService,
  ]);

  const totalCharge = quote?.totalCharge || 0;
  const hasSufficientFunds = user.balance >= totalCharge;
  const shortfall = Math.max(0, Number((totalCharge - user.balance).toFixed(2)));

  const handleExecutePurchase = async () => {
    if (!quote || purchasing) return;
    setPurchasing(true);
    setErrorMessage(null);

    const items: any[] = [];
    if (followerService && followersQty > 0) {
      items.push({
        serviceId: followerService.id,
        target: profileUrl.trim(),
        targetType: "PROFILE",
        quantity: followersQty,
      });
    }
    if (likeService && likesQty > 0) {
      items.push({
        serviceId: likeService.id,
        target: postUrl.trim(),
        targetType: "POST_OR_REEL",
        quantity: likesQty,
      });
    }
    if (viewService && viewsQty > 0 && viewService.id !== likeService?.id) {
      items.push({
        serviceId: viewService.id,
        target: postUrl.trim(),
        targetType: "POST_OR_REEL",
        quantity: viewsQty,
      });
    }

    const res = await purchasePackage({
      name: `${platform.toUpperCase()} Growth Bundle (${durationDays} Days)`,
      days: durationDays,
      items,
      idempotencyKey: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    });

    setPurchasing(false);
    setConfirmModalOpen(false);

    if (res.success && res.package) {
      router.push(`/packages/${res.package.id}`);
    } else {
      setErrorMessage(res.error || "Failed to purchase package.");
    }
  };

  const isFormValid =
    Boolean(profileUrl.trim()) &&
    Boolean(postUrl.trim()) &&
    totalCharge > 0 &&
    hasSufficientFunds;

  return (
    <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_380px] gap-8 items-start">
      {/* LEFT COLUMN: BUILDER CONFIG */}
      <div className="w-full max-w-[760px] space-y-6">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Platform Selector */}
        <section className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            1. Target Platform
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: "instagram", name: "Instagram" },
              { id: "youtube", name: "YouTube" },
              { id: "tiktok", name: "TikTok" },
              { id: "x_twitter", name: "X (Twitter)" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                  platform === p.id
                    ? "bg-[#D8EC8D]/10 border-[#D8EC8D] text-white font-bold"
                    : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <PlatformIcon platform={p.id} size={16} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 2. Duration Selector */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              2. Growth Duration
            </label>
            <span className="text-xs text-[#D8EC8D] font-mono font-semibold">
              Delivered daily over {durationDays} days
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { days: 7, label: "7 Days", desc: "1 Week Sprint" },
              { days: 14, label: "14 Days", desc: "2 Weeks Steady" },
              { days: 30, label: "30 Days", desc: "1 Month Organic" },
            ].map((d) => (
              <button
                key={d.days}
                type="button"
                onClick={() => setDurationDays(d.days)}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  durationDays === d.days
                    ? "bg-[#D8EC8D]/10 border-[#D8EC8D] text-white"
                    : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-sm font-bold text-white">{d.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{d.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 3. Target Links */}
        <section className="space-y-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            3. Targets & Campaigns
          </label>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-white mb-1.5 flex items-center justify-between">
                <span>Profile Link or Handle (for Followers)</span>
              </div>
              <input
                type="text"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://instagram.com/yourhandle or @yourhandle"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:border-[#D8EC8D]/50 focus:outline-none"
              />
            </div>

            <div>
              <div className="text-xs text-white mb-1.5 flex items-center justify-between">
                <span>Recent Post / Reel Link (for Likes & Views)</span>
              </div>
              <input
                type="text"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://instagram.com/p/reel_id"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:border-[#D8EC8D]/50 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* 4. Bundled Quantities */}
        <section className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            4. Total Volume Distribution
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
              <div className="text-xs text-slate-300 font-medium">Followers</div>
              <input
                type="number"
                step={durationDays}
                value={followersQty}
                onChange={(e) => setFollowersQty(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white font-mono text-center focus:outline-none"
              />
              <div className="text-[10px] text-slate-400 text-center font-mono">
                ~{Math.round(followersQty / durationDays)} / day
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
              <div className="text-xs text-slate-300 font-medium">Likes</div>
              <input
                type="number"
                step={durationDays}
                value={likesQty}
                onChange={(e) => setLikesQty(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white font-mono text-center focus:outline-none"
              />
              <div className="text-[10px] text-slate-400 text-center font-mono">
                ~{Math.round(likesQty / durationDays)} / day
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
              <div className="text-xs text-slate-300 font-medium">Views</div>
              <input
                type="number"
                step={durationDays}
                value={viewsQty}
                onChange={(e) => setViewsQty(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white font-mono text-center focus:outline-none"
              />
              <div className="text-[10px] text-slate-400 text-center font-mono">
                ~{Math.round(viewsQty / durationDays)} / day
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: STICKY SCHEDULE PREVIEW & PURCHASE */}
      <div className="w-full min-[1100px]:sticky min-[1100px]:top-6 space-y-5">
        <GlassCard className="p-6 rounded-3xl border-white/10 space-y-5 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Package Summary
            </h3>
            <span className="text-xs font-mono text-[#D8EC8D]">
              {durationDays} Days Duration
            </span>
          </div>

          {/* Breakdown Items */}
          <div className="space-y-2 text-xs font-mono border-t border-b border-white/5 py-3">
            {quote?.items?.map((item) => (
              <div key={item.serviceId} className="flex items-center justify-between text-slate-300">
                <span className="truncate max-w-[180px]">{item.serviceName}</span>
                <span className="text-white font-semibold">₹{item.charge.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-slate-400 pt-2 text-[11px]">
              <span>Total Scheduled Runs</span>
              <span className="text-white font-bold">{quote?.totalRuns || durationDays * 3}</span>
            </div>
          </div>

          {/* Price Calculation */}
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-400">Total Upfront</span>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-white">
                ₹{totalCharge.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">100% upfront · Prepaid child runs</div>
            </div>
          </div>

          {/* Balance check */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Wallet Balance:</span>
              <span className="font-mono text-white font-semibold">₹{user.balance.toFixed(2)}</span>
            </div>
            {!hasSufficientFunds && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-rose-400">
                <span>Shortfall:</span>
                <span className="font-mono font-bold">₹{shortfall.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          {!hasSufficientFunds ? (
            <button
              type="button"
              onClick={() => router.push(`/wallet?amount=${shortfall}`)}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#131313] font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              <span>Add ₹{shortfall.toFixed(2)} to Wallet</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!isFormValid || calculating}
              onClick={() => setConfirmModalOpen(true)}
              className="w-full py-3 px-4 rounded-xl bg-[#D8EC8D] text-[#131313] font-bold text-xs hover:brightness-105 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Review & Purchase Package</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <div className="text-[11px] text-slate-500 text-center leading-relaxed">
            Child orders are dispatched automatically by our database scheduler without repeated charges. Unexecuted runs can be cancelled anytime for an instant refund.
          </div>
        </GlassCard>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-white/10 space-y-5 bg-[#171717]">
            <div className="w-12 h-12 rounded-2xl bg-[#D8EC8D]/10 border border-[#D8EC8D]/30 flex items-center justify-center text-[#D8EC8D]">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">Confirm Growth Package</h3>
              <p className="text-xs text-slate-400">
                Your wallet will be debited <strong>₹{totalCharge.toFixed(2)}</strong> upfront. Deliveries will run automatically across {durationDays} days.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Duration:</span>
                <span className="text-white font-bold">{durationDays} Days</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Runs:</span>
                <span className="text-white font-bold">{quote?.totalRuns} automated runs</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Upfront Charge:</span>
                <span className="text-[#D8EC8D] font-bold">₹{totalCharge.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors"
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={purchasing}
                onClick={handleExecutePurchase}
                className="flex-1 py-2.5 rounded-xl bg-[#D8EC8D] text-[#131313] font-bold text-xs hover:brightness-105 transition-all shadow-md"
              >
                {purchasing ? "Processing..." : "Confirm & Launch"}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
