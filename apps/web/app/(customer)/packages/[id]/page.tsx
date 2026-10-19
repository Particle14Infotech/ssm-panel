"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { GlassCard } from "@/components/shared/GlassCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import {
  Boxes,
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  Ban,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";

function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "https://smm-production-bca7.up.railway.app";
  if (!envUrl.endsWith("/api/v1")) {
    return envUrl.replace(/\/+$/, "") + "/api/v1";
  }
  return envUrl;
}

export default function PackageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const packageId = params?.id as string;
  const { cancelPackage } = useCustomer();

  const [pkg, setPkg] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchPackage = async () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("authToken");
    if (!token) return;

    try {
      const res = await fetch(`${getApiBase()}/packages/${packageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPkg(data);
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackage();
  }, [packageId]);

  const scheduledRuns = pkg?.runs?.filter((r: any) => r.status === "SCHEDULED") || [];
  const refundableSum = scheduledRuns.reduce((acc: number, r: any) => acc + (r.chargeShare || 0), 0);

  const handleConfirmCancel = async () => {
    setCancelling(true);
    const res = await cancelPackage(packageId);
    setCancelling(false);
    setCancelModalOpen(false);

    if (res.success) {
      setNotification({
        type: "success",
        message: `Package cancelled. ₹${Number(res.refundedAmount || refundableSum).toFixed(2)} refunded to your wallet!`,
      });
      fetchPackage();
    } else {
      setNotification({
        type: "error",
        message: res.error || "Failed to cancel package.",
      });
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 font-mono text-sm">
        Loading package details...
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="text-white font-semibold text-lg">Package not found</div>
        <Link href="/packages" className="text-xs text-[#D8EC8D] underline">
          Back to Growth Packages
        </Link>
      </div>
    );
  }

  const progressPercent =
    pkg.totalRuns > 0 ? Math.round((pkg.completedRuns / pkg.totalRuns) * 100) : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all ${
            notification.type === "success"
              ? "bg-[#171e00]/95 border-[#D8EC8D]/40 text-[#D8EC8D]"
              : "bg-red-950/95 border-red-500/40 text-red-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Top Back Link */}
      <div>
        <Link
          href="/packages"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Packages</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <GlassCard className="p-6 md:p-8 rounded-3xl border-white/10 space-y-6 bg-white/[0.02]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{pkg.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                  pkg.status === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : pkg.status === "COMPLETED"
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    : pkg.status === "CANCELLED"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}
              >
                {pkg.status}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              ID: #{pkg.id} · Scheduled from{" "}
              {new Date(pkg.startDate).toLocaleDateString([], { month: "short", day: "numeric" })} to{" "}
              {new Date(pkg.endDate).toLocaleDateString([], { month: "short", day: "numeric" })}
            </div>
          </div>

          {/* Cancel Button if eligible */}
          {pkg.status === "ACTIVE" && scheduledRuns.length > 0 && (
            <button
              type="button"
              onClick={() => setCancelModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold text-xs border border-rose-500/20 transition-all self-start md:self-auto"
            >
              <Ban className="w-4 h-4" />
              <span>Cancel Remaining Runs</span>
            </button>
          )}
        </div>

        {/* Stat Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/5">
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-mono text-slate-500">Total Upfront</div>
            <div className="text-lg font-mono font-bold text-white mt-1">₹{Number(pkg.totalCharge).toFixed(2)}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-mono text-slate-500">Fulfillment</div>
            <div className="text-lg font-mono font-bold text-[#D8EC8D] mt-1">
              {pkg.completedRuns} / {pkg.totalRuns} runs
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-mono text-slate-500">Refunded Amount</div>
            <div className="text-lg font-mono font-bold text-amber-400 mt-1">
              ₹{Number(pkg.refundedAmount || 0).toFixed(2)}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-mono text-slate-500">Progress</div>
            <div className="text-lg font-mono font-bold text-white mt-1">{progressPercent}%</div>
          </div>
        </div>
      </GlassCard>

      {/* Run Timeline Table */}
      <section aria-labelledby="timeline-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="timeline-heading" className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Fulfillment Run Timeline
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            {pkg.runs?.length || 0} scheduled runs
          </span>
        </div>

        <div className="glass-panel overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-4">Run #</th>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Target Link</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Charge Share</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Order Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {pkg.runs?.map((r: any) => {
                  const isRunCompleted = r.status === "COMPLETED";
                  const isRunProcessing = r.status === "PROCESSING" || r.status === "DISPATCHING";
                  const isRunCancelled = r.status === "CANCELLED";

                  return (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">#{r.runIndex}</td>
                      <td className="py-3 px-4 text-slate-300">
                        {new Date(r.scheduledAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 text-white font-sans font-medium">
                        <div className="flex items-center gap-1.5 truncate max-w-[200px]" title={r.serviceName}>
                          {r.platform && <PlatformIcon platform={r.platform} size={14} />}
                          <span className="truncate">{r.serviceName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-[180px] truncate" title={r.target}>
                        {r.target}
                      </td>
                      <td className="py-3 px-4 text-white font-bold">{formatIndianNumber(r.quantity)}</td>
                      <td className="py-3 px-4 text-[#D8EC8D]">₹{Number(r.chargeShare).toFixed(2)}</td>
                      <td className="py-3 px-4">
                        {isRunCompleted && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            COMPLETED
                          </span>
                        )}
                        {isRunProcessing && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400">
                            <Clock className="w-3 h-3 animate-spin" />
                            PROCESSING
                          </span>
                        )}
                        {r.status === "SCHEDULED" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400">
                            <Clock className="w-3 h-3" />
                            SCHEDULED
                          </span>
                        )}
                        {isRunCancelled && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-400">
                            <XCircle className="w-3 h-3" />
                            CANCELLED
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {r.childOrderId ? (
                          <Link
                            href={`/orders`}
                            className="text-[11px] text-[#D8EC8D] hover:underline"
                          >
                            #{r.childOrderId.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Cancellation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-white/10 space-y-5 bg-[#171717]">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Cancel Remaining Runs?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                You have <strong className="text-white">{scheduledRuns.length}</strong> upcoming runs scheduled. Cancelling will stop all future deliveries.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Runs to cancel:</span>
                <span className="font-mono text-white font-bold">{scheduledRuns.length}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Instant Wallet Refund:</span>
                <span className="font-mono text-[#D8EC8D] font-bold text-sm">
                  ₹{refundableSum.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors"
              >
                Keep Package Active
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all shadow-md"
              >
                {cancelling ? "Refunding..." : "Confirm & Refund"}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
