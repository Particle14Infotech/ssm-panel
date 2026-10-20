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
  Plus,
  RefreshCw,
  Radio,
  Sliders,
  Check,
  Layers,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";
import { PackageQuoteResponse } from "@smm/contracts";

export function PackageOrderBuilder() {
  const router = useRouter();
  const {
    user,
    services,
    instagramAccounts,
    connectInstagramAccount,
    fetchPackageQuote,
    purchasePackage,
  } = useCustomer();

  // State: Connected Account
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectUsername, setConnectUsername] = useState("");
  const [connectPlatformId, setConnectPlatformId] = useState("");
  const [connecting, setConnecting] = useState(false);

  // State: Package Duration
  const [durationDays, setDurationDays] = useState<number>(30);
  const [autoPostMode, setAutoPostMode] = useState<boolean>(true);

  // State: Per-service workflows & per-post customization
  const [likesEnabled, setLikesEnabled] = useState<boolean>(true);
  const [likesPerPost, setLikesPerPost] = useState<number>(500);
  const [likesDelay, setLikesDelay] = useState<number>(5); // minutes
  const [likesMediaTypes, setLikesMediaTypes] = useState<string[]>(["IMAGE", "VIDEO", "REEL"]);

  const [viewsEnabled, setViewsEnabled] = useState<boolean>(true);
  const [viewsPerPost, setViewsPerPost] = useState<number>(1000);
  const [viewsDelay, setViewsDelay] = useState<number>(0); // minutes
  const [viewsMediaTypes, setViewsMediaTypes] = useState<string[]>(["REEL", "VIDEO"]);

  const [followersEnabled, setFollowersEnabled] = useState<boolean>(true);
  const [followersTotalQty, setFollowersTotalQty] = useState<number>(3000);

  const [maxPostsToProcess, setMaxPostsToProcess] = useState<number>(30);

  // Quote & Execution State
  const [quote, setQuote] = useState<PackageQuoteResponse | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [consentRulesUnderstood, setConsentRulesUnderstood] = useState<boolean>(false);

  // Automatically select first connected account if available
  useEffect(() => {
    if (instagramAccounts && instagramAccounts.length > 0 && !selectedConnectionId) {
      setSelectedConnectionId(instagramAccounts[0].id);
    }
  }, [instagramAccounts, selectedConnectionId]);

  const selectedAccount = useMemo(() => {
    return instagramAccounts?.find((a) => a.id === selectedConnectionId) || null;
  }, [instagramAccounts, selectedConnectionId]);

  // Catalog service resolution
  const instagramServices = useMemo(() => {
    return services.filter(
      (s) =>
        (s.status === "ACTIVE" || !s.status) &&
        (s.platform?.toLowerCase() === "instagram" || s.platform?.toLowerCase().includes("insta"))
    );
  }, [services]);

  const likeService = useMemo(() => {
    return (
      instagramServices.find((s) => s.name.toLowerCase().includes("like")) ||
      instagramServices[0]
    );
  }, [instagramServices]);

  const viewService = useMemo(() => {
    return (
      instagramServices.find(
        (s) => s.name.toLowerCase().includes("reel") || s.name.toLowerCase().includes("view")
      ) ||
      instagramServices[1] ||
      instagramServices[0]
    );
  }, [instagramServices]);

  const followerService = useMemo(() => {
    return (
      instagramServices.find((s) => s.name.toLowerCase().includes("follower")) ||
      instagramServices[2] ||
      instagramServices[0]
    );
  }, [instagramServices]);

  // Handle Account Connection
  const handleConnectAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectUsername.trim()) return;
    setConnecting(true);
    setErrorMessage(null);

    const cleanUser = connectUsername.replace(/^@/, "").trim();
    const platformId = connectPlatformId.trim() || `ig_${Date.now()}`;

    const res = await connectInstagramAccount({
      username: cleanUser,
      platformAccountId: platformId,
      accountType: "BUSINESS",
      grantedScopes: ["instagram_basic", "instagram_manage_insights"],
    });

    setConnecting(false);
    if (res.success && res.connection) {
      setSelectedConnectionId(res.connection.id);
      setConnectModalOpen(false);
      setConnectUsername("");
      setConnectPlatformId("");
    } else {
      setErrorMessage(res.error || "Failed to authorize Instagram account.");
    }
  };

  // Re-calculate Quote Server-Side
  useEffect(() => {
    let isCancelled = false;

    const compute = async () => {
      setCalculating(true);
      setErrorMessage(null);

      const items: any[] = [];
      const username = selectedAccount?.username || "connected_account";
      const targetProfile = `https://instagram.com/${username}`;

      if (likesEnabled && likeService) {
        items.push({
          serviceId: likeService.id,
          target: targetProfile,
          targetType: "POST_OR_REEL",
          quantity: likesPerPost * maxPostsToProcess,
          quantityPerPost: likesPerPost,
          maximumPostsToProcess: maxPostsToProcess,
          delayAfterPublication: likesDelay,
          eligibleMediaTypes: likesMediaTypes,
          enabled: true,
        });
      }

      if (viewsEnabled && viewService) {
        items.push({
          serviceId: viewService.id,
          target: targetProfile,
          targetType: "POST_OR_REEL",
          quantity: viewsPerPost * maxPostsToProcess,
          quantityPerPost: viewsPerPost,
          maximumPostsToProcess: maxPostsToProcess,
          delayAfterPublication: viewsDelay,
          eligibleMediaTypes: viewsMediaTypes,
          enabled: true,
        });
      }

      if (followersEnabled && followerService) {
        items.push({
          serviceId: followerService.id,
          target: targetProfile,
          targetType: "PROFILE",
          quantity: followersTotalQty,
          enabled: true,
        });
      }

      if (items.length === 0) {
        setQuote(null);
        setCalculating(false);
        return;
      }

      try {
        const q = await fetchPackageQuote({
          name: `Instagram Auto-Post Package (@${username})`,
          connectionId: selectedConnectionId || undefined,
          accountUsername: username,
          autoPostEnabled: autoPostMode,
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
    selectedConnectionId,
    selectedAccount,
    durationDays,
    autoPostMode,
    likesEnabled,
    likesPerPost,
    likesDelay,
    likesMediaTypes,
    viewsEnabled,
    viewsPerPost,
    viewsDelay,
    viewsMediaTypes,
    followersEnabled,
    followersTotalQty,
    maxPostsToProcess,
    likeService,
    viewService,
    followerService,
  ]);

  const totalCharge = quote?.totalCharge || 0;
  const hasSufficientFunds = user.balance >= totalCharge;
  const shortfall = Math.max(0, Number((totalCharge - user.balance).toFixed(2)));

  const handleExecutePurchase = async () => {
    if (!quote || purchasing) return;
    setPurchasing(true);
    setErrorMessage(null);

    const items: any[] = [];
    const username = selectedAccount?.username || "connected_account";
    const targetProfile = `https://instagram.com/${username}`;

    if (likesEnabled && likeService) {
      items.push({
        serviceId: likeService.id,
        target: targetProfile,
        targetType: "POST_OR_REEL",
        quantity: likesPerPost * maxPostsToProcess,
        quantityPerPost: likesPerPost,
        maximumPostsToProcess: maxPostsToProcess,
        delayAfterPublication: likesDelay,
        eligibleMediaTypes: likesMediaTypes,
        enabled: true,
      });
    }

    if (viewsEnabled && viewService) {
      items.push({
        serviceId: viewService.id,
        target: targetProfile,
        targetType: "POST_OR_REEL",
        quantity: viewsPerPost * maxPostsToProcess,
        quantityPerPost: viewsPerPost,
        maximumPostsToProcess: maxPostsToProcess,
        delayAfterPublication: viewsDelay,
        eligibleMediaTypes: viewsMediaTypes,
        enabled: true,
      });
    }

    if (followersEnabled && followerService) {
      items.push({
        serviceId: followerService.id,
        target: targetProfile,
        targetType: "PROFILE",
        quantity: followersTotalQty,
        enabled: true,
      });
    }

    const res = await purchasePackage({
      name: `Instagram Auto-Post Package (@${username})`,
      connectionId: selectedConnectionId || undefined,
      accountUsername: username,
      autoPostEnabled: autoPostMode,
      days: durationDays,
      items,
      idempotencyKey: `ig_pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
    Boolean(selectedConnectionId) &&
    totalCharge > 0 &&
    hasSufficientFunds &&
    (likesEnabled || viewsEnabled || followersEnabled);

  return (
    <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_390px] gap-8 items-start">
      {/* LEFT COLUMN: BUILDER CONFIG */}
      <div className="w-full max-w-[760px] space-y-6">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Account Selection & Authorization */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              1. Authorized Instagram Account
            </label>
            <button
              type="button"
              onClick={() => setConnectModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-[#D8EC8D] hover:underline font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect New Account</span>
            </button>
          </div>

          {instagramAccounts && instagramAccounts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {instagramAccounts.map((acc) => {
                const isSelected = selectedConnectionId === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedConnectionId(acc.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative ${
                      isSelected
                        ? "bg-[#D8EC8D]/10 border-[#D8EC8D] shadow-[0_0_20px_rgba(216,236,141,0.12)]"
                        : "bg-white/[0.02] border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">@{acc.username}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-mono">
                            {acc.connectionStatus}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          ID: {acc.platformAccountId} · {acc.accountType}
                        </div>
                        {acc.lastDetectedAt && (
                          <div className="text-[10px] text-slate-500">
                            Last active: {new Date(acc.lastDetectedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#D8EC8D] text-[#131313] flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-slate-400">
                <PlatformIcon platform="instagram" size={20} />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">No Connected Account</div>
                <div className="text-xs text-slate-400 max-w-sm mx-auto">
                  Connect your verified Instagram Business or Creator account to enable automatic new post and Reel detection.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConnectModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#D8EC8D] text-[#131313] font-bold text-xs hover:brightness-105 transition-all inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Connect Account</span>
              </button>
            </div>
          )}
        </section>

        {/* 2. Duration Selector */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              2. Package Duration & Active Monitoring
            </label>
            <span className="text-xs text-[#D8EC8D] font-mono font-semibold">
              Monitors new posts for {durationDays} days
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { days: 7, label: "7 Days", desc: "1-Week Sprint" },
              { days: 15, label: "15 Days", desc: "Bi-Weekly" },
              { days: 30, label: "30 Days", desc: "1 Month Pro" },
              { days: 60, label: "60 Days", desc: "2 Months Scale" },
              { days: 90, label: "90 Days", desc: "Quarterly" },
              { days: 180, label: "180 Days", desc: "Semi-Annual" },
              { days: 365, label: "365 Days", desc: "1 Year Growth" },
            ].map((d) => (
              <button
                key={d.days}
                type="button"
                onClick={() => setDurationDays(d.days)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  durationDays === d.days
                    ? "bg-[#D8EC8D]/10 border-[#D8EC8D] text-white"
                    : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <div className="text-xs font-bold text-white">{d.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{d.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 3. Per-Service Auto-Post Workflows */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              3. Configured Workflows on Each New Post
            </label>
            <span className="text-[11px] text-slate-500 font-mono">
              Max {maxPostsToProcess} posts quota
            </span>
          </div>

          {/* Workflow A: Likes on New Media */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="chk-likes"
                  checked={likesEnabled}
                  onChange={(e) => setLikesEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#D8EC8D] rounded"
                />
                <label htmlFor="chk-likes" className="text-sm font-semibold text-white cursor-pointer">
                  Auto-Likes on New Posts & Reels
                </label>
              </div>
              <span className="text-xs font-mono text-[#D8EC8D]">
                {likesEnabled ? `${formatIndianNumber(likesPerPost)} / post` : "Disabled"}
              </span>
            </div>

            {likesEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/5 text-xs">
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Quantity per Post</label>
                  <input
                    type="number"
                    step={100}
                    value={likesPerPost}
                    onChange={(e) => setLikesPerPost(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-center focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Execution Delay</label>
                  <select
                    value={likesDelay}
                    onChange={(e) => setLikesDelay(parseInt(e.target.value, 10))}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none"
                  >
                    <option value={0}>Immediate (0m)</option>
                    <option value={5}>5 Minutes delay</option>
                    <option value={15}>15 Minutes delay</option>
                    <option value={30}>30 Minutes delay</option>
                    <option value={60}>1 Hour delay</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Media Types</label>
                  <div className="text-[11px] text-slate-300 font-mono py-2">
                    Posts + Reels
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Workflow B: Views on New Reels & Videos */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="chk-views"
                  checked={viewsEnabled}
                  onChange={(e) => setViewsEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#D8EC8D] rounded"
                />
                <label htmlFor="chk-views" className="text-sm font-semibold text-white cursor-pointer">
                  Auto-Views on New Reels & Videos
                </label>
              </div>
              <span className="text-xs font-mono text-[#D8EC8D]">
                {viewsEnabled ? `${formatIndianNumber(viewsPerPost)} / reel` : "Disabled"}
              </span>
            </div>

            {viewsEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/5 text-xs">
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Quantity per Reel</label>
                  <input
                    type="number"
                    step={250}
                    value={viewsPerPost}
                    onChange={(e) => setViewsPerPost(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-center focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Execution Delay</label>
                  <select
                    value={viewsDelay}
                    onChange={(e) => setViewsDelay(parseInt(e.target.value, 10))}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none"
                  >
                    <option value={0}>Immediate (0m)</option>
                    <option value={5}>5 Minutes delay</option>
                    <option value={15}>15 Minutes delay</option>
                    <option value={30}>30 Minutes delay</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Media Types</label>
                  <div className="text-[11px] text-slate-300 font-mono py-2">
                    Reels Only
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Workflow C: Daily Steady Follower Growth */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="chk-followers"
                  checked={followersEnabled}
                  onChange={(e) => setFollowersEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#D8EC8D] rounded"
                />
                <label htmlFor="chk-followers" className="text-sm font-semibold text-white cursor-pointer">
                  Steady Profile Follower Growth
                </label>
              </div>
              <span className="text-xs font-mono text-[#D8EC8D]">
                {followersEnabled ? `~${Math.round(followersTotalQty / durationDays)} / day` : "Disabled"}
              </span>
            </div>

            {followersEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5 text-xs">
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Total Followers across Duration</label>
                  <input
                    type="number"
                    step={durationDays}
                    value={followersTotalQty}
                    onChange={(e) => setFollowersTotalQty(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-center focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Drip-Feed Schedule</label>
                  <div className="text-xs font-mono text-slate-300 py-2">
                    Divided evenly over {durationDays} daily runs
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: STICKY SCHEDULE PREVIEW & PURCHASE */}
      <div className="w-full min-[1100px]:sticky min-[1100px]:top-6 space-y-5">
        <GlassCard className="p-6 rounded-3xl border-white/10 space-y-5 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Package Engine Quote
            </h3>
            <span className="text-xs font-mono text-[#D8EC8D]">
              {durationDays} Days Active
            </span>
          </div>

          {/* Account Target */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-xs space-y-1">
            <div className="text-slate-500 text-[10px] uppercase font-mono">Monitored Target</div>
            <div className="font-bold text-white text-sm">
              {selectedAccount ? `@${selectedAccount.username}` : "Select account on left"}
            </div>
            <div className="text-[11px] text-slate-400">
              Eligible new posts & reels triggered via link in dashboard
            </div>
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
              <span>Max Posts Limit</span>
              <span className="text-white font-bold">{maxPostsToProcess} posts</span>
            </div>
          </div>

          {/* Price Calculation */}
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-400">Upfront Package Fee</span>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-white">
                ₹{totalCharge.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">Prepaid entitlement snapshot</div>
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

          {/* Consent Checkbox (Non-negotiable Rule 4) */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <input
              type="checkbox"
              id="chk-consent-rules"
              checked={consentRulesUnderstood}
              onChange={(e) => setConsentRulesUnderstood(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#D8EC8D] rounded"
            />
            <label htmlFor="chk-consent-rules" className="text-[11px] text-slate-300 cursor-pointer leading-relaxed">
              I understand social platform terms of service and delivery risks. Workflows start within about 5-15 minutes. Upfront fee is the maximum reserve; all unused reserve is refunded to your wallet upon completion or cancellation.
            </label>
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
              disabled={!isFormValid || !consentRulesUnderstood || calculating}
              onClick={() => setConfirmModalOpen(true)}
              className="w-full py-3 px-4 rounded-xl bg-[#D8EC8D] text-[#131313] font-bold text-xs hover:brightness-105 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Review & Purchase Package</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <div className="text-[11px] text-slate-500 text-center leading-relaxed">
            Deliveries start within about 5-15 minutes. Maximum reserve total; unused balance is refunded automatically.
          </div>
        </GlassCard>
      </div>

      {/* Connect Account Modal */}
      {connectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-white/10 space-y-5 bg-[#171717]">
            <div className="w-12 h-12 rounded-2xl bg-[#D8EC8D]/10 border border-[#D8EC8D]/30 flex items-center justify-center text-[#D8EC8D]">
              <PlatformIcon platform="instagram" size={24} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">Authorize Instagram Account</h3>
              <p className="text-xs text-slate-400">
                Enter your verified Instagram handle. In production, official Meta Graph API OAuth validates account ownership without asking for passwords.
              </p>
            </div>

            <form onSubmit={handleConnectAccount} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1.5 font-medium">
                  Instagram Handle / Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="@yourbrand or brand_name"
                  value={connectUsername}
                  onChange={(e) => setConnectUsername(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:border-[#D8EC8D]/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1.5 font-medium">
                  Platform Account ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-assigned or IG User ID"
                  value={connectPlatformId}
                  onChange={(e) => setConnectPlatformId(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:border-[#D8EC8D]/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConnectModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connecting}
                  className="flex-1 py-2.5 rounded-xl bg-[#D8EC8D] text-[#131313] font-bold text-xs hover:brightness-105 transition-all shadow-md"
                >
                  {connecting ? "Authorizing..." : "Authorize Account"}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-white/10 space-y-5 bg-[#171717]">
            <div className="w-12 h-12 rounded-2xl bg-[#D8EC8D]/10 border border-[#D8EC8D]/30 flex items-center justify-center text-[#D8EC8D]">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">Confirm Auto-Post Package</h3>
              <p className="text-xs text-slate-400">
                Your wallet will be debited <strong>₹{totalCharge.toFixed(2)}</strong> upfront. Monitoring and workflows will activate immediately for <strong>@{selectedAccount?.username}</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Account:</span>
                <span className="text-white font-bold">@{selectedAccount?.username}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Duration:</span>
                <span className="text-white font-bold">{durationDays} Days</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Workflows:</span>
                <span className="text-white font-bold">
                  {[
                    likesEnabled && "Likes",
                    viewsEnabled && "Reel Views",
                    followersEnabled && "Followers",
                  ]
                    .filter(Boolean)
                    .join(" + ")}
                </span>
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
