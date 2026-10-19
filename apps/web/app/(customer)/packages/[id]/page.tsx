"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Pause,
  Play,
  RefreshCw,
  Film,
  Layers,
  Sparkles,
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
  const { cancelPackage, pausePackage, resumePackage, pollInstagramConnection } = useCustomer();

  const [pkg, setPkg] = useState<any | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"timeline" | "posts" | "executions">("timeline");

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [polling, setPolling] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchPackage = useCallback(async () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("authToken");
    if (!token) return;

    try {
      const [pkgRes, postsRes, execRes] = await Promise.all([
        fetch(`${getApiBase()}/packages/${packageId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${getApiBase()}/packages/${packageId}/posts`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch(`${getApiBase()}/packages/${packageId}/executions`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);

      if (pkgRes.ok) {
        const data = await pkgRes.json();
        setPkg(data);
      }
      if (postsRes && postsRes.ok) {
        const postsData = await postsRes.json();
        if (Array.isArray(postsData)) setPosts(postsData);
      }
      if (execRes && execRes.ok) {
        const execData = await execRes.json();
        if (Array.isArray(execData)) setExecutions(execData);
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    fetchPackage();
  }, [fetchPackage]);

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

  const handleTogglePause = async () => {
    if (!pkg) return;
    setActionInProgress(true);
    if (pkg.status === "ACTIVE") {
      const ok = await pausePackage(pkg.id);
      if (ok) {
        setNotification({ type: "success", message: "Monitoring paused. No new workflows will be scheduled." });
        await fetchPackage();
      } else {
        setNotification({ type: "error", message: "Failed to pause package." });
      }
    } else if (pkg.status === "PAUSED") {
      const ok = await resumePackage(pkg.id);
      if (ok) {
        setNotification({ type: "success", message: "Monitoring resumed successfully." });
        await fetchPackage();
      } else {
        setNotification({ type: "error", message: "Failed to resume package." });
      }
    }
    setActionInProgress(false);
  };

  const handlePollNow = async () => {
    if (!pkg?.connectionId) return;
    setPolling(true);
    const res = await pollInstagramConnection(pkg.connectionId);
    setPolling(false);
    if (res) {
      setNotification({
        type: "success",
        message: `Poll finished: ${res.detectedCount || 0} new media item(s) detected.`,
      });
      await fetchPackage();
    } else {
      setNotification({ type: "error", message: "Failed to query Instagram API." });
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
                    : pkg.status === "PAUSED"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : pkg.status === "COMPLETED"
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    : pkg.status === "CANCELLED"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                }`}
              >
                {pkg.status}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              ID: #{pkg.id} · Active from{" "}
              {new Date(pkg.startDate).toLocaleDateString([], { month: "short", day: "numeric" })} to{" "}
              {new Date(pkg.endDate).toLocaleDateString([], { month: "short", day: "numeric" })}
            </div>
            {pkg.connection && (
              <div className="inline-flex items-center gap-2 text-xs text-[#D8EC8D] font-mono mt-1">
                <PlatformIcon platform="instagram" size={14} />
                <span>@{pkg.connection.username}</span>
                <span className="text-slate-500">· Status: {pkg.connection.connectionStatus}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            {pkg.connectionId && (
              <button
                type="button"
                disabled={polling}
                onClick={handlePollNow}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-xs border border-white/10 transition-all"
                title="Query Instagram API for newly published posts immediately"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${polling ? "animate-spin" : ""}`} />
                <span>{polling ? "Checking..." : "Poll New Posts"}</span>
              </button>
            )}

            {(pkg.status === "ACTIVE" || pkg.status === "PAUSED") && (
              <button
                type="button"
                disabled={actionInProgress}
                onClick={handleTogglePause}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs border border-white/10 transition-all"
              >
                {pkg.status === "ACTIVE" ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Resume</span>
                  </>
                )}
              </button>
            )}

            {pkg.status === "ACTIVE" && scheduledRuns.length > 0 && (
              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold text-xs border border-rose-500/20 transition-all"
              >
                <Ban className="w-4 h-4" />
                <span>Cancel Runs</span>
              </button>
            )}
          </div>
        </div>

        {/* Stat Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/5">
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-mono text-slate-500">Total Upfront</div>
            <div className="text-lg font-mono font-bold text-white mt-1">₹{Number(pkg.totalCharge).toFixed(2)}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-mono text-slate-500">Auto-Post Activity</div>
            <div className="text-lg font-mono font-bold text-[#D8EC8D] mt-1">
              {pkg.postsProcessed || 0} processed
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {pkg.postsDetected || 0} posts detected
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-mono text-slate-500">Scheduled Runs</div>
            <div className="text-lg font-mono font-bold text-white mt-1">
              {pkg.completedRuns} / {pkg.totalRuns} runs
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-mono text-slate-500">Refunded Amount</div>
            <div className="text-lg font-mono font-bold text-amber-400 mt-1">
              ₹{Number(pkg.refundedAmount || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("timeline")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === "timeline"
              ? "bg-[#D8EC8D]/15 text-white border border-[#D8EC8D]/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Run Timeline ({pkg.runs?.length || 0})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("posts")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === "posts"
              ? "bg-[#D8EC8D]/15 text-white border border-[#D8EC8D]/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Detected Posts ({posts.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("executions")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === "executions"
              ? "bg-[#D8EC8D]/15 text-white border border-[#D8EC8D]/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Workflow Executions ({executions.length})</span>
        </button>
      </div>

      {/* TAB 1: RUN TIMELINE TABLE */}
      {activeTab === "timeline" && (
        <section aria-labelledby="timeline-heading" className="space-y-4">
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
      )}

      {/* TAB 2: DETECTED POSTS & REELS */}
      {activeTab === "posts" && (
        <section className="space-y-4">
          {posts.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-slate-400 text-xs space-y-2">
              <Film className="w-8 h-8 mx-auto text-slate-500" />
              <div>No new posts detected yet.</div>
              <div className="text-[11px] text-slate-500">
                New publications on your connected account will be detected automatically. Click &quot;Poll New Posts&quot; to check immediately.
              </div>
            </div>
          ) : (
            <div className="glass-panel overflow-hidden rounded-2xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">Media ID</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Published At</th>
                      <th className="py-3 px-4">First Detected</th>
                      <th className="py-3 px-4">Executions</th>
                      <th className="py-3 px-4 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {posts.map((p) => (
                      <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 text-white font-semibold">{p.mediaId}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-slate-300">
                            {p.mediaType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {new Date(p.publishedAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(p.firstDetectedAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4 text-[#D8EC8D]">
                          {p.executions?.length || 0} scheduled
                        </td>
                        <td className="py-3 px-4 text-right">
                          {p.permalink ? (
                            <a
                              href={p.permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#D8EC8D] hover:underline inline-flex items-center gap-1"
                            >
                              <span>View</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: AUTOMATION EXECUTIONS HISTORY */}
      {activeTab === "executions" && (
        <section className="space-y-4">
          {executions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-slate-400 text-xs space-y-2">
              <Layers className="w-8 h-8 mx-auto text-slate-500" />
              <div>No workflow executions recorded yet.</div>
              <div className="text-[11px] text-slate-500">
                Executions are triggered according to your configured delay policies when new posts are detected.
              </div>
            </div>
          ) : (
            <div className="glass-panel overflow-hidden rounded-2xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Service</th>
                      <th className="py-3 px-4">Media Target</th>
                      <th className="py-3 px-4">Scheduled For</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Attempts</th>
                      <th className="py-3 px-4 text-right">Ref / Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {executions.map((e) => (
                      <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 text-white font-semibold">{e.actionType}</td>
                        <td className="py-3 px-4 text-slate-300 font-sans">{e.serviceName}</td>
                        <td className="py-3 px-4 text-slate-400 truncate max-w-[150px]">
                          {e.mediaPermalink ? (
                            <a
                              href={e.mediaPermalink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#D8EC8D] hover:underline"
                            >
                              {e.mediaId}
                            </a>
                          ) : (
                            e.mediaId
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {new Date(e.scheduledAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              e.status === "COMPLETED"
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                : e.status === "PROCESSING"
                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                                : e.status === "FAILED"
                                ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                                : "bg-white/5 text-slate-400 border border-white/10"
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{e.attempts}</td>
                        <td className="py-3 px-4 text-right">
                          {e.providerReference ? (
                            <span className="text-white">#{e.providerReference.slice(0, 8)}</span>
                          ) : e.errorMessage ? (
                            <span className="text-rose-400 truncate max-w-[120px]" title={e.errorMessage}>
                              {e.errorMessage}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

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
