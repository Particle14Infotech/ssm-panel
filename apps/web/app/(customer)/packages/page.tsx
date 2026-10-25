"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { BentoCard } from "@/components/motion/BentoCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { motion, AnimatePresence } from "framer-motion";
import {
  Boxes,
  PlusCircle,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  ShoppingBag,
  RefreshCw,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";

function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "https://smm-production-bca7.up.railway.app";
  if (!envUrl.endsWith("/api/v1")) {
    return envUrl.replace(/\/+$/, "") + "/api/v1";
  }
  return envUrl;
}

export default function PackagesListPage() {
  const router = useRouter();
  const { packages, user } = useCustomer();

  const [bundleTemplates, setBundleTemplates] = useState<any[]>([]);
  const [, setLoadingBundles] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState<any | null>(null);
  const [bundleHandle, setBundleHandle] = useState("");
  const [purchasingBundle, setPurchasingBundle] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadBundles() {
      try {
        const res = await fetch(`${getApiBase()}/packages/bundle/templates`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setBundleTemplates(data);
        }
      } catch {
        // Fallback or offline
      } finally {
        setLoadingBundles(false);
      }
    }
    loadBundles();
  }, []);

  const handlePurchaseBundle = async () => {
    if (!selectedBundle || !bundleHandle.trim()) return;
    setPurchasingBundle(true);
    setBundleError(null);

    const token = localStorage.getItem("authToken");
    if (!token) {
      setBundleError("Please log in to purchase a growth bundle.");
      setPurchasingBundle(false);
      return;
    }

    try {
      const idempotencyKey = `bnd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const res = await fetch(`${getApiBase()}/packages/bundle/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          templateId: selectedBundle.id,
          handle: bundleHandle.trim().replace(/^@/, ""),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage(`Bundle purchased successfully! Package #${data.packageId?.slice(0, 8)} is now active.`);
        setSelectedBundle(null);
        setBundleHandle("");
        setTimeout(() => {
          if (data.packageId) {
            router.push(`/packages/${data.packageId}`);
          }
        }, 1200);
      } else {
        setBundleError(data.message || "Failed to purchase bundle. Ensure sufficient wallet balance.");
      }
    } catch {
      setBundleError("Network error while purchasing bundle.");
    } finally {
      setPurchasingBundle(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-8 max-w-7xl mx-auto pb-16"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#171e00]/95 border border-[#D8EC8D]/40 text-[#D8EC8D] text-xs font-semibold shadow-xl backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-[#D8EC8D]/10 border border-[#D8EC8D]/30 flex items-center justify-center text-[#D8EC8D]">
              <Boxes className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Growth Packages</h1>
          </div>
          <p className="text-sm text-slate-400">
            Multi-service drip delivery bundles scheduled over days and weeks with automated fulfillment.
          </p>
        </div>

        <Link
          href="/new-order?tab=package"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D8EC8D] text-[#131313] font-semibold text-sm hover:brightness-105 transition-all shadow-sm self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Custom Package</span>
        </Link>
      </div>

      {/* SECTION 1: PRESET GROWTH BUNDLES */}
      {bundleTemplates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D8EC8D]" />
              <h2 className="text-base font-bold text-white">Featured Growth Bundles</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#D8EC8D]/15 text-[#D8EC8D] border border-[#D8EC8D]/30">
                1-Click Activation
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono">Curated multi-week packages</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bundleTemplates.map((bundle) => (
              <BentoCard
                key={bundle.id}
                spotlightColor="rgba(216, 236, 141, 0.12)"
                enableBorderBeam={bundle.discountPercent > 10}
                className="p-6 rounded-3xl border-white/10 hover:border-[#D8EC8D]/40 transition-all flex flex-col justify-between space-y-5 bg-[#1c1b1b]/80 backdrop-blur-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform={bundle.platform} size={20} />
                      <h3 className="text-base font-semibold text-white">{bundle.name}</h3>
                    </div>
                    {bundle.discountPercent > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#D8EC8D]/15 text-[#D8EC8D] border border-[#D8EC8D]/30">
                        {bundle.discountPercent}% Off Bundle
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{bundle.description}</p>

                  {/* Bundled Items Preview */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5 text-xs font-mono">
                    <div className="text-[10px] uppercase text-slate-500 font-semibold">Included Services:</div>
                    {bundle.rules?.map((r: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-slate-300">
                        <span className="capitalize">
                          {r.serviceId.replace(/^srv_/, "").replace(/_/g, " ")} ({r.kind})
                        </span>
                        <span className="text-white font-bold">
                          {formatIndianNumber(r.quantityPerPost)} units
                          {r.maxPosts ? ` × ${r.maxPosts} posts` : ""}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono pt-1 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{bundle.durationDays} Days Schedule</span>
                    </div>
                    <div>
                      <span>Prepaid Price: </span>
                      <span className="text-[#D8EC8D] font-bold text-sm">
                        ₹{Number(bundle.bundlePrice).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedBundle(bundle);
                    setBundleError(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#D8EC8D] text-black font-bold text-xs hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Choose & Activate Bundle</span>
                </motion.button>
              </BentoCard>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: MY ACTIVE PACKAGES */}
      <div className="space-y-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">My Active Packages ({packages.length})</h2>
          <span className="text-xs text-slate-400 font-mono">Active schedule monitors</span>
        </div>

        {packages.length === 0 ? (
          <BentoCard
            spotlightColor="rgba(216, 236, 141, 0.05)"
            className="p-12 rounded-3xl border-white/10 text-center space-y-4 bg-white/[0.02]"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
              <Boxes className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-lg font-semibold text-white">No custom packages running yet</h3>
              <p className="text-sm text-slate-400">
                Pick a ready-made bundle above or create your customized drip schedule.
              </p>
            </div>
          </BentoCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {packages.map((pkg) => {
              const completedExecs =
                pkg.executions?.filter((e: any) => e.status === "COMPLETED").length ?? pkg.completedRuns ?? 0;
              const totalExecs = pkg.executions?.length ?? pkg.totalRuns ?? 0;
              const progressPercent =
                totalExecs > 0 ? Math.round((completedExecs / totalExecs) * 100) : 0;
              const isCompleted = pkg.status === "COMPLETED";
              const isCancelled = pkg.status === "CANCELLED";
              const isActive = pkg.status === "ACTIVE";

              const displayRules =
                pkg.rules?.map((r: any) => ({
                  id: r.id,
                  platform: pkg.platform || "instagram",
                  serviceName: r.service?.displayName || r.service?.name || "Service",
                  totalQuantity:
                    r.kind === "FOLLOWERS_INTERVAL"
                      ? r.totalFollowers || 0
                      : (r.quantityPerPost || 0) * (r.maxPosts || 1),
                  charge: r.unitCharge,
                })) || pkg.items || [];

              const startDate = pkg.createdAt || pkg.startDate || new Date().toISOString();
              const endDate = pkg.endAt || pkg.endDate || startDate;

              return (
                <BentoCard
                  key={pkg.id}
                  spotlightColor="rgba(216, 236, 141, 0.09)"
                  className="p-6 rounded-3xl border-white/10 flex flex-col justify-between space-y-6 hover:border-[#D8EC8D]/30 transition-all bg-[#1c1b1b]/80 backdrop-blur-md"
                >
                  <div className="space-y-4">
                    {/* Top Bar: Title & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <PlatformIcon platform={pkg.platform || "instagram"} size={16} />
                          <h3 className="text-base font-semibold text-white line-clamp-1">
                            {pkg.handle ? `@${pkg.handle}` : pkg.name}
                          </h3>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">ID: #{pkg.id.slice(0, 8)}</div>
                      </div>
                      <div>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            ACTIVE
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            COMPLETED
                          </span>
                        )}
                        {isCancelled && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertCircle className="w-3 h-3" />
                            CANCELLED
                          </span>
                        )}
                        {pkg.status === "PARTIAL" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            PARTIAL
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar with smooth animation */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">Fulfillment Progress</span>
                        <span className="text-white font-semibold">
                          {completedExecs} / {totalExecs} runs ({progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-[#D8EC8D]/70 to-[#D8EC8D]"
                        />
                      </div>
                    </div>

                    {/* Bundled Items List */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                        Bundled Services
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {displayRules.map((item: any) => (
                          <div
                            key={item.id}
                            className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1"
                          >
                            <div className="flex items-center gap-1.5 text-slate-300 font-medium truncate">
                              <PlatformIcon platform={item.platform} size={14} />
                              <span className="truncate">{item.serviceName}</span>
                            </div>
                            <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                              <span>{formatIndianNumber(item.totalQuantity)} units</span>
                              <span className="text-[#D8EC8D]">₹{Number(item.charge).toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Dates & Financials */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs font-mono">
                      <div>
                        <div className="text-[10px] uppercase text-slate-500">Schedule Duration</div>
                        <div className="text-white font-medium mt-0.5 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {new Date(startDate).toLocaleDateString([], { month: "short", day: "numeric" })} -{" "}
                            {new Date(endDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase text-slate-500">Total Upfront</div>
                        <div className="text-[#D8EC8D] font-bold text-sm mt-0.5">
                          ₹{Number(pkg.totalCharge).toFixed(2)}
                        </div>
                        {pkg.refundedAmount > 0 && (
                          <div className="text-[10px] text-amber-400">
                            Refunded: ₹{Number(pkg.refundedAmount).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="pt-4 border-t border-white/5">
                    <Link
                      href={`/packages/${pkg.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-[#D8EC8D]/15 hover:text-[#D8EC8D] hover:border-[#D8EC8D]/30 text-white font-medium text-xs transition-all border border-white/5"
                    >
                      <span>View Schedule Timeline & Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </BentoCard>
              );
            })}
          </div>
        )}
      </div>

      {/* 1-Click Purchase Bundle Modal with AnimatePresence */}
      <AnimatePresence>
        {selectedBundle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="max-w-md w-full"
            >
              <BentoCard
                spotlightColor="rgba(216, 236, 141, 0.15)"
                className="w-full p-6 rounded-3xl border-white/10 space-y-5 bg-[#171717] shadow-2xl"
              >
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2.5 rounded-xl bg-[#D8EC8D]/15 border border-[#D8EC8D]/30 text-[#D8EC8D]">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{selectedBundle.name}</h3>
                    <p className="text-xs text-slate-400">
                      {selectedBundle.durationDays} Days Multi-Service Drip Schedule
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-mono text-slate-400 block mb-1">
                      Target Account Handle
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-500 font-mono text-xs">@</span>
                      <input
                        type="text"
                        required
                        placeholder="creator_handle"
                        value={bundleHandle}
                        onChange={(e) => setBundleHandle(e.target.value)}
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[#D8EC8D]"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      We do not verify account ownership. Enter exact platform username.
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Your Wallet Balance:</span>
                      <span className="text-white font-bold">
                        ₹{user?.balance !== undefined ? user.balance.toFixed(2) : "0.00"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Prepaid Bundle Total:</span>
                      <span className="text-[#D8EC8D] font-bold text-sm">
                        ₹{Number(selectedBundle.bundlePrice).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {bundleError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{bundleError}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedBundle(null);
                      setBundleHandle("");
                      setBundleError(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={purchasingBundle || !bundleHandle.trim()}
                    onClick={handlePurchaseBundle}
                    className="flex-1 py-2.5 rounded-xl bg-[#D8EC8D] text-black font-semibold text-xs hover:brightness-105 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {purchasingBundle ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Activating...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Activate Now</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </BentoCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
