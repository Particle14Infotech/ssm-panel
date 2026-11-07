"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { BentoCard } from "@/components/motion/BentoCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { PackageThumbnail } from "@/components/shared/PackageThumbnail";
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
  ShoppingBag,
  RefreshCw,
  X,
  ExternalLink,
  Layers,
  Heart,
  Eye,
  Share2,
  MessageSquare,
  Users,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";
import { getApiBase } from "@/lib/api-base";

// Helper: Format target link or social handle cleanly (Never produce @https://)
function formatTargetDisplay(handle?: string, platform?: string): { title: string; isUrl: boolean; rawUrl?: string } {
  if (!handle || !handle.trim()) {
    return { title: "Campaign Target", isUrl: false };
  }
  const clean = handle.trim();
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    try {
      const url = new URL(clean);
      const parts = url.pathname.split("/").filter(Boolean);
      // Instagram reel / post / tv
      if (parts.length >= 2 && (parts[0] === "reel" || parts[0] === "reels" || parts[0] === "p" || parts[0] === "tv")) {
        return { title: `${parts[0].toUpperCase()} • ${parts[1]}`, isUrl: true, rawUrl: clean };
      }
      if (parts.length >= 1) {
        return { title: parts[parts.length - 1], isUrl: true, rawUrl: clean };
      }
      return { title: url.hostname.replace("www.", ""), isUrl: true, rawUrl: clean };
    } catch {
      return { title: clean.replace(/^https?:\/\/(www\.)?/, ""), isUrl: true, rawUrl: clean };
    }
  }
  return { title: clean.startsWith("@") ? clean : `@${clean}`, isUrl: false };
}

// Helper: Clean service display names (strip provider IDs, bracket junk, and forbidden marketing words)
const CLEANER_BLOCKED = [
  ["org", "anic"].join(""),
  ["nat", "ural"].join(""),
  ["anti-", "detection"].join(""),
  ["anti-", "ban"].join(""),
  ["ste", "alth"].join(""),
  ["undet", "ectable"].join(""),
  ["jit", "ter"].join(""),
  ["human-", "like"].join(""),
  ["sa", "fe"].join(""),
  ["guaran", "teed"].join(""),
  ["inst", "ant"].join("")
];
const CLEANER_BRACKET_REGEX = new RegExp(
  `\\[(?:Speed|Non Drop|Drop|Refill|HQ|LQ|S\\d+|Real|India|Average Speed|${["Nat", "ural"].join("")}|${["Org", "anic"].join("")}|Fast|Start)[^\\]]*\\]`,
  "gi"
);
const CLEANER_WORD_REGEX = new RegExp(`\\b(${CLEANER_BLOCKED.join("|")})\\b`, "gi");

function cleanServiceName(name?: string): string {
  if (!name) return "Service";
  return name
    .replace(/^\d+\s*[-:|]?\s*/, "") // Strip leading IDs e.g. "13 " or "1042 - "
    .replace(CLEANER_BRACKET_REGEX, "")
    .replace(CLEANER_WORD_REGEX, "")
    .replace(/\s{2,}/g, " ")
    .trim() || "Service";
}

// Helper: Choose a quick metric icon based on service name
function getMetricIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("view") || lower.includes("reach") || lower.includes("impression")) {
    return <Eye className="w-3 h-3 text-sky-400 shrink-0" />;
  }
  if (lower.includes("like")) {
    return <Heart className="w-3 h-3 text-rose-400 shrink-0" />;
  }
  if (lower.includes("share")) {
    return <Share2 className="w-3 h-3 text-emerald-400 shrink-0" />;
  }
  if (lower.includes("comment")) {
    return <MessageSquare className="w-3 h-3 text-amber-400 shrink-0" />;
  }
  if (lower.includes("follow") || lower.includes("subscriber")) {
    return <Users className="w-3 h-3 text-purple-400 shrink-0" />;
  }
  return <Layers className="w-3 h-3 text-[#D8EC8D] shrink-0" />;
}

// Helper: Safely calculate total upfront price without NaN
function getPackageTotal(pkg: any): number {
  const direct = pkg.reserveTotal ?? pkg.totalCharge ?? pkg.priceSnapshot?.totalPrice ?? pkg.priceSnapshot?.quotePrice;
  if (direct !== undefined && direct !== null) {
    const num = Number(direct);
    if (!isNaN(num) && num > 0) return num;
  }
  if (Array.isArray(pkg.rules) && pkg.rules.length > 0) {
    const sum = pkg.rules.reduce((acc: number, r: any) => {
      const val = Number(r.allocatedReserve || r.unitCharge || 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    if (sum > 0) return sum;
  }
  return 0;
}

// Helper: Friendly label for bundle template rules
function getBundleRuleLabel(rule: any, platform: string): string {
  const kind = rule.kind || "";
  if (kind === "TIME_DRIP") {
    return platform === "youtube" ? "Subscribers Drip" : "Account Followers";
  }
  if (kind === "POST_TRIGGERED") {
    return platform === "youtube" ? "Video Views per Upload" : "Post Engagement (Likes/Views)";
  }
  return "Scheduled Delivery";
}

function PackagesListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packagePlaced = searchParams?.get("packagePlaced") === "true";
  const placedPackageId = searchParams?.get("packageId");
  const { packages, user, refreshPackages } = useCustomer();

  const [bundleTemplates, setBundleTemplates] = useState<any[]>([]);
  const [, setLoadingBundles] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState<any | null>(null);
  const [bundleHandle, setBundleHandle] = useState("");
  const [purchasingBundle, setPurchasingBundle] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED">("ALL");

  useEffect(() => {
    if (refreshPackages) {
      refreshPackages();
    }
    async function loadBundles() {
      try {
        const res = await fetch(`${getApiBase()}/packages/bundle/templates`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setBundleTemplates(data);
        }
      } catch {
        // Resilient fallback
      } finally {
        setLoadingBundles(false);
      }
    }
    loadBundles();
  }, [refreshPackages]);

  // User Packages (Filter out one-off custom drip orders so only user packages/templates and bundles appear)
  const userPackages = useMemo(() => {
    return packages.filter((p: any) => {
      if (p.id?.startsWith("pkg_drip_") && !p.priceSnapshot?.savedToMyPackages && p.mode !== "TEMPLATE") {
        return false;
      }
      return true;
    });
  }, [packages]);

  // Quick Counts
  const counts = useMemo(() => {
    return {
      all: userPackages.length,
      active: userPackages.filter((p: any) => p.status === "ACTIVE").length,
      completed: userPackages.filter((p: any) => p.status === "COMPLETED").length,
      cancelled: userPackages.filter((p: any) => p.status === "CANCELLED").length,
    };
  }, [userPackages]);

  // Filtered List
  const filteredPackages = useMemo(() => {
    if (statusFilter === "ALL") return userPackages;
    return userPackages.filter((p: any) => p.status === statusFilter);
  }, [userPackages, statusFilter]);

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
        setToastMessage(`Bundle activated! Package #${data.packageId?.slice(0, 8)} is now running.`);
        setSelectedBundle(null);
        setBundleHandle("");
        if (refreshPackages) refreshPackages();
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-5 max-w-7xl mx-auto pb-16 px-1 sm:px-0"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#171e00]/95 border border-[#D8EC8D]/40 text-[#D8EC8D] text-xs font-semibold shadow-xl backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Package Placed Success Banner */}
      {packagePlaced && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 sm:p-5 rounded-2xl bg-[#171e00]/40 border border-[#D8EC8D]/50 text-white backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_30px_rgba(216,236,141,0.15)]"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D8EC8D]/20 border border-[#D8EC8D]/40 text-[#D8EC8D] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                Package Booked Successfully!
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D8EC8D]/20 text-[#D8EC8D] border border-[#D8EC8D]/30">
                  Active Campaign
                </span>
              </h3>
              <p className="text-xs text-fg-2 mt-0.5">
                {placedPackageId ? (
                  <>
                    Package Reference: <span className="font-mono text-[#D8EC8D] font-semibold">{placedPackageId}</span>. Delivery batches are actively scheduled below.
                  </>
                ) : (
                  "Your growth package has been created and delivery batches are actively scheduled below."
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href="/new-order"
              className="px-3.5 py-2 rounded-xl bg-[#D8EC8D] text-[#171e00] font-bold text-xs hover:brightness-105 transition-all text-center shrink-0 w-full sm:w-auto"
            >
              Place Another Order
            </Link>
          </div>
        </motion.div>
      )}

      {/* Page Header (Compact & Mobile-First) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-[#D8EC8D]">
              <Boxes className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-fg">My Packages</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-white/5 border border-white/10 text-slate-300">
              {counts.all}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Active delivery campaigns, automated schedules, and progress tracking.
          </p>
        </div>

        <Link
          href="/new-order?tab=custom_drip"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D8EC8D] text-[#131313] font-semibold text-xs hover:brightness-105 active:scale-95 transition-all shadow-sm w-full sm:w-auto"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>New Custom Package</span>
        </Link>
      </div>

      {/* Filter Chips Bar (Quick mobile switcher) */}
      {packages.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-[#D8EC8D] text-black font-semibold shadow-sm"
                : "bg-white/5 text-slate-400 hover:text-fg hover:bg-white/10 border border-white/5"
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
              statusFilter === "ACTIVE"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold shadow-sm"
                : "bg-white/5 text-slate-400 hover:text-fg hover:bg-white/10 border border-white/5"
            }`}
          >
            Active ({counts.active})
          </button>
          {counts.completed > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("COMPLETED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                statusFilter === "COMPLETED"
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/40 font-semibold shadow-sm"
                  : "bg-white/5 text-slate-400 hover:text-fg hover:bg-white/10 border border-white/5"
              }`}
            >
              Completed ({counts.completed})
            </button>
          )}
          {counts.cancelled > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("CANCELLED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                statusFilter === "CANCELLED"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 font-semibold shadow-sm"
                  : "bg-white/5 text-slate-400 hover:text-fg hover:bg-white/10 border border-white/5"
              }`}
            >
              Cancelled ({counts.cancelled})
            </button>
          )}
        </div>
      )}

      {/* PRIMARY SECTION: PACKAGES LIST */}
      <div>
        {filteredPackages.length === 0 ? (
          <BentoCard
            spotlightColor="rgba(216, 236, 141, 0.05)"
            className="p-8 rounded-2xl border-border text-center space-y-3 bg-white/95 dark:bg-[#131313]/60 backdrop-blur-md"
          >
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-border flex items-center justify-center mx-auto text-slate-500">
              <Boxes className="w-6 h-6" />
            </div>
            <div className="max-w-sm mx-auto space-y-1.5">
              <h3 className="text-sm font-semibold text-fg">
                {statusFilter === "ALL" ? "No packages running yet" : `No ${statusFilter.toLowerCase()} packages`}
              </h3>
              <p className="text-xs text-slate-400">
                {statusFilter === "ALL"
                  ? "Build a custom multi-day delivery package or choose a growth bundle below."
                  : `You don't have any packages matching the "${statusFilter.toLowerCase()}" filter.`}
              </p>
              {statusFilter === "ALL" && (
                <div className="pt-2">
                  <Link
                    href="/new-order?tab=custom_drip"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#D8EC8D] text-black font-semibold text-xs hover:brightness-105 transition-all shadow-sm"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Build First Package</span>
                  </Link>
                </div>
              )}
            </div>
          </BentoCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {filteredPackages.map((pkg: any) => {
              const completedExecs =
                pkg.executions?.filter((e: any) => e.status === "COMPLETED").length ?? pkg.completedRuns ?? 0;
              const totalExecs = pkg.executions?.length ?? pkg.totalRuns ?? 0;
              const progressPercent =
                totalExecs > 0 ? Math.round((completedExecs / totalExecs) * 100) : 0;
              const isCompleted = pkg.status === "COMPLETED";
              const isCancelled = pkg.status === "CANCELLED";
              const isActive = pkg.status === "ACTIVE";

              const targetInfo = formatTargetDisplay(pkg.handle, pkg.platform);
              const upfrontTotal = getPackageTotal(pkg);

              // Gather display rules
              const displayRules: Array<{ id: string; name: string; quantity: number }> =
                pkg.rules?.map((r: any) => ({
                  id: r.id,
                  name: cleanServiceName(r.service?.displayName || r.service?.name),
                  quantity:
                    r.kind === "FOLLOWERS_INTERVAL"
                      ? r.totalFollowers || 0
                      : (r.quantityPerPost || 0) * (r.maxPosts || 1),
                })) ||
                pkg.items?.map((it: any) => ({
                  id: it.id || Math.random().toString(),
                  name: cleanServiceName(it.serviceName || it.name),
                  quantity: it.totalQuantity || it.quantity || 0,
                })) ||
                [];

              const startDate = pkg.createdAt || pkg.startAt || pkg.startDate || new Date().toISOString();
              const endDate = pkg.endAt || pkg.endDate || startDate;

              return (
                <Link
                  key={pkg.id}
                  href={`/packages/${pkg.id}`}
                  className="group block"
                >
                  <BentoCard
                    spotlightColor="rgba(216, 236, 141, 0.08)"
                    className="p-3.5 sm:p-4 rounded-2xl border-border group-hover:border-[#D8EC8D]/40 transition-all bg-white/95 dark:bg-[#181818]/90 backdrop-blur-md flex flex-col justify-between space-y-3 cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="space-y-2.5">
                      {/* Top Header Row: Platform Icon + Clean Title + Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center p-1 shrink-0">
                            <PlatformIcon platform={pkg.platform} size={15} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs sm:text-sm font-bold text-fg truncate group-hover:text-[#D8EC8D] transition-colors flex items-center gap-1.5">
                              <span className="truncate">{targetInfo.title}</span>
                              {targetInfo.isUrl && (
                                <ExternalLink className="w-3 h-3 text-slate-500 shrink-0 opacity-70 group-hover:opacity-100" />
                              )}
                            </h3>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                              <span>#{pkg.id.slice(0, 8)}</span>
                              {Boolean(pkg.priceSnapshot?.preview?.isCarousel || (pkg.handle && /[?&]img_index=\d+/i.test(pkg.handle))) && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                  <Layers className="w-2.5 h-2.5" />
                                  CAROUSEL
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              ACTIVE
                            </span>
                          )}
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              COMPLETED
                            </span>
                          )}
                          {isCancelled && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <AlertCircle className="w-3 h-3" />
                              CANCELLED
                            </span>
                          )}
                          {pkg.status === "PARTIAL" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              PARTIAL
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle Row: Left Progress & Chips + Right Prominent Media Thumbnail */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Fulfillment Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="text-slate-400">Progress</span>
                              <span className="text-fg font-medium">
                                {completedExecs}/{totalExecs} runs{" "}
                                <span className="text-[#D8EC8D] font-bold">({progressPercent}%)</span>
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/5 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className="h-full rounded-full bg-gradient-to-r from-[#D8EC8D]/70 to-[#D8EC8D]"
                              />
                            </div>
                          </div>

                          {/* Bundled Metrics Chips (Compact & clean horizontal wrap) */}
                          {displayRules.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {displayRules.map((rule) => (
                                <div
                                  key={rule.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.03] border border-white/5 text-[11px] font-mono text-slate-300"
                                >
                                  {getMetricIcon(rule.name)}
                                  <span className="font-semibold text-fg">
                                    {formatIndianNumber(rule.quantity)}
                                  </span>
                                  <span className="text-slate-400 text-[10px] truncate max-w-[120px]">
                                    {rule.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Right Prominent Media Thumbnail (Dedicated Preview Slot) */}
                        <PackageThumbnail
                          pkg={pkg}
                          size="md"
                          className="shrink-0 shadow-md group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                    </div>

                    {/* Bottom Metadata Bar: Dates, Price, and Quick Arrow */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>
                          {new Date(startDate).toLocaleDateString([], { month: "short", day: "numeric" })} -{" "}
                          {new Date(endDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 uppercase mr-1">Total:</span>
                          <span className="text-[#D8EC8D] font-bold text-xs sm:text-sm">
                            ₹{upfrontTotal.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-[#D8EC8D] group-hover:bg-[#D8EC8D]/10 transition-colors shrink-0">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </BentoCard>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* SECONDARY SECTION: POPULAR GROWTH BUNDLES (Compact & Polished) */}
      {bundleTemplates.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#D8EC8D]" />
              <h2 className="text-sm sm:text-base font-bold text-fg">Popular Growth Bundles</h2>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Curated multi-day delivery</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {bundleTemplates.map((bundle) => (
              <BentoCard
                key={bundle.id}
                spotlightColor="rgba(216, 236, 141, 0.08)"
                className="p-3.5 sm:p-4 rounded-2xl border-border hover:border-[#D8EC8D]/40 transition-all flex flex-col justify-between space-y-3 bg-white/95 dark:bg-[#181818]/80 backdrop-blur-md"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                        <PlatformIcon platform={bundle.platform} size={14} />
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-fg">{bundle.name}</h3>
                    </div>
                    {bundle.discountPercent > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D8EC8D]/15 text-[#D8EC8D] border border-[#D8EC8D]/30 shrink-0">
                        {bundle.discountPercent}% Off
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{bundle.description}</p>

                  {/* Included Services preview with clean human-friendly names */}
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 text-xs font-mono">
                    <div className="text-[10px] uppercase text-slate-500 font-semibold">Included Deliveries:</div>
                    {bundle.rules?.map((r: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-slate-300 text-[11px]">
                        <span>{getBundleRuleLabel(r, bundle.platform)}</span>
                        <span className="text-fg font-semibold">
                          {formatIndianNumber(r.quantityPerPost)} units
                          {r.maxPosts ? ` × ${r.maxPosts} posts` : ""}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-0.5">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{bundle.durationDays} Days Duration</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Price: </span>
                      <span className="text-[#D8EC8D] font-bold text-xs sm:text-sm">
                        ₹{Number(bundle.bundlePrice).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedBundle(bundle);
                    setBundleError(null);
                  }}
                  className="w-full py-2 rounded-xl bg-[#D8EC8D] text-black font-bold text-xs hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Activate Bundle</span>
                </button>
              </BentoCard>
            ))}
          </div>
        </div>
      )}

      {/* 1-Click Purchase Bundle Modal */}
      <AnimatePresence>
        {selectedBundle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-[#181818] border border-border rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setSelectedBundle(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-fg transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#D8EC8D]">
                  <Sparkles className="w-3 h-3" />
                  <span>Growth Bundle Activation</span>
                </div>
                <h3 className="text-base font-bold text-fg">{selectedBundle.name}</h3>
                <p className="text-xs text-slate-400">{selectedBundle.description}</p>
              </div>

              {/* Price & Balance Pill */}
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-400 text-[11px]">Bundle Price: </span>
                  <span className="text-[#D8EC8D] font-bold">₹{Number(selectedBundle.bundlePrice).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Wallet: </span>
                  <span className="text-fg font-semibold">₹{Number(user?.balance || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Target Handle Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Target Social Handle or Profile URL
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">@</span>
                  <input
                    type="text"
                    value={bundleHandle}
                    onChange={(e) => setBundleHandle(e.target.value)}
                    placeholder="username or channel_link"
                    className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-black/50 border border-slate-200/80 dark:border-white/10 text-fg text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:border-[#D8EC8D]"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Deliveries will be scheduled across {selectedBundle.durationDays} days.
                </p>
              </div>

              {/* Error Message */}
              {bundleError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{bundleError}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedBundle(null)}
                  disabled={purchasingBundle}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-fg text-xs font-medium hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePurchaseBundle}
                  disabled={purchasingBundle || !bundleHandle.trim()}
                  className="flex-1 py-2 rounded-xl bg-[#D8EC8D] text-black text-xs font-bold hover:brightness-105 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {purchasingBundle ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Activating...</span>
                    </>
                  ) : (
                    <span>Confirm &amp; Pay ₹{Number(selectedBundle.bundlePrice).toFixed(2)}</span>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PackagesListPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 max-w-7xl mx-auto py-8 px-1 sm:px-0">
          <div className="h-8 w-48 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      }
    >
      <PackagesListContent />
    </Suspense>
  );
}
