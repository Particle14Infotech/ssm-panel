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
  Pause,
  Play,
  RefreshCw,
  Film,
  Layers,
  Send,
  Check,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";

function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "https://smm-production-bca7.up.railway.app";
  if (!envUrl.endsWith("/api/v1")) {
    return envUrl.replace(/\/+$/, "") + "/api/v1";
  }
  return envUrl;
}

interface RuleSelectionState {
  enabled: boolean;
  quantity: number;
  deliveryWindowMin: number;
}

export default function PackageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const packageId = params?.id as string;
  const { cancelPackage, pausePackage, resumePackage } = useCustomer();

  const [pkg, setPkg] = useState<any | null>(null);
  const [triggers, setTriggers] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<{ message: string; requestId: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "triggers" | "executions">("timeline");

  // Per-Post Start Flow State
  const [postLink, setPostLink] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewError, setPreviewError] = useState<{ message: string; requestId: string } | null>(null);
  const [ruleSelections, setRuleSelections] = useState<{ [ruleId: string]: RuleSelectionState }>({});
  const [consentChecked, setConsentChecked] = useState(false);
  const [startingDelivery, setStartingDelivery] = useState(false);

  // Cancellation and pause states
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchPackage = useCallback(async () => {
    if (typeof window === "undefined" || !packageId) return;
    const token = localStorage.getItem("authToken");
    if (!token) return;

    setPageError(null);
    try {
      const [pkgRes, trigRes, execRes] = await Promise.all([
        fetch(`${getApiBase()}/packages/${packageId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${getApiBase()}/packages/${packageId}/triggers`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch(`${getApiBase()}/packages/${packageId}/executions`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);

      if (pkgRes.ok) {
        const data = await pkgRes.json();
        setPkg(data);
      } else {
        const errJson = await pkgRes.json().catch(() => ({}));
        const reqId = errJson.requestId || `req_${Date.now()}`;
        setPageError({
          message: errJson.message || "Failed to load package details.",
          requestId: reqId,
        });
      }

      if (trigRes && trigRes.ok) {
        const trigData = await trigRes.json();
        if (Array.isArray(trigData)) setTriggers(trigData);
      }

      if (execRes && execRes.ok) {
        const execData = await execRes.json();
        if (Array.isArray(execData)) setExecutions(execData);
      }
    } catch {
      setPageError({
        message: "Network error loading package details. Please check your connection.",
        requestId: `req_net_${Date.now()}`,
      });
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    fetchPackage();
  }, [fetchPackage]);

  // Handle Preview Post Link
  const handlePreviewPost = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!postLink.trim()) return;

    const token = localStorage.getItem("authToken");
    if (!token) return;

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);

    try {
      const res = await fetch(`${getApiBase()}/packages/${packageId}/triggers/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: postLink.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        const reqId = data.requestId || `req_prev_${Date.now()}`;
        setPreviewError({
          message: data.message || "Invalid post link for this platform.",
          requestId: reqId,
        });
      } else {
        setPreviewData(data);
        // Initialize rule selections with default values
        const initialSelections: { [ruleId: string]: RuleSelectionState } = {};
        if (Array.isArray(data.rules)) {
          data.rules.forEach((r: any) => {
            initialSelections[r.ruleId] = {
              enabled: r.remainingPosts > 0,
              quantity: r.defaultQuantity,
              deliveryWindowMin: r.deliveryWindowMin || 60,
            };
          });
        }
        setRuleSelections(initialSelections);
      }
    } catch {
      setPreviewError({
        message: "Failed to connect to preview service.",
        requestId: `req_err_${Date.now()}`,
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle Start Delivery
  const handleStartDelivery = async () => {
    if (!previewData || startingDelivery) return;
    const token = localStorage.getItem("authToken");
    if (!token) return;

    const chosenRules = Object.entries(ruleSelections)
      .filter(([_, sel]) => sel.enabled)
      .map(([ruleId, sel]) => ({
        ruleId,
        quantity: sel.quantity,
        deliveryWindowMin: sel.deliveryWindowMin,
      }));

    if (chosenRules.length === 0) {
      setNotification({ type: "error", message: "Select at least one service rule to deliver." });
      return;
    }

    setStartingDelivery(true);
    const idempotencyKey = `trig_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      const res = await fetch(`${getApiBase()}/packages/${packageId}/triggers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          url: previewData.normalizedUrl,
          rules: chosenRules,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const reqId = data.requestId || `req_start_${Date.now()}`;
        setNotification({
          type: "error",
          message: `${data.message || "Failed to start delivery"} (Ref: ${reqId})`,
        });
      } else {
        setNotification({
          type: "success",
          message: `Delivery started! ${data.executionsCreated || 1} scheduled execution(s) scheduled.`,
        });
        setPostLink("");
        setPreviewData(null);
        setConsentChecked(false);
        await fetchPackage();
      }
    } catch {
      setNotification({ type: "error", message: "Network connection error while starting delivery." });
    } finally {
      setStartingDelivery(false);
    }
  };

  // Scheduled runs & refund calculations
  const scheduledExecutions = executions.filter(
    (e: any) => e.status === "SCHEDULED" || e.status === "DETECTED"
  );
  const refundableSum = scheduledExecutions.reduce(
    (acc: number, e: any) => acc + Number(e.allocatedCharge || 0),
    0
  );

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
        setNotification({ type: "success", message: "Package delivery paused." });
        await fetchPackage();
      } else {
        setNotification({ type: "error", message: "Failed to pause package." });
      }
    } else if (pkg.status === "PAUSED") {
      const ok = await resumePackage(pkg.id);
      if (ok) {
        setNotification({ type: "success", message: "Package delivery resumed." });
        await fetchPackage();
      } else {
        setNotification({ type: "error", message: "Failed to resume package." });
      }
    }
    setActionInProgress(false);
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 font-mono text-sm">
        Loading package details...
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="py-24 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="text-white font-semibold text-lg">{pageError.message}</div>
        <div className="text-xs text-slate-500 font-mono">Reference: {pageError.requestId}</div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={fetchPackage}
            className="px-4 py-2 rounded-xl bg-[#D8EC8D] text-[#131313] font-bold text-xs hover:brightness-105 transition-all"
          >
            Retry
          </button>
          <Link href="/packages" className="text-xs text-slate-400 hover:text-white underline">
            Back to Packages
          </Link>
        </div>
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

  const completedExecs = executions.filter((e) => e.status === "COMPLETED").length;
  const totalExecs = executions.length;
  const progressPercent = totalExecs > 0 ? Math.round((completedExecs / totalExecs) * 100) : 0;

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
              <PlatformIcon platform={pkg.platform || "instagram"} size={22} />
              <h1 className="text-2xl font-bold text-white">@{pkg.handle}</h1>
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
              ID: #{pkg.id} · Active through{" "}
              {new Date(pkg.endAt || pkg.endDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="text-[11px] text-slate-500">
              Platform: <span className="capitalize text-slate-300">{pkg.platform}</span> · We do not verify account ownership.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
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

            {pkg.status === "ACTIVE" && (
              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold text-xs border border-rose-500/20 transition-all"
              >
                <Ban className="w-4 h-4" />
                <span>Cancel Remaining</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress & Stat Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/5">
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-mono text-slate-500">Total Upfront</div>
            <div className="text-lg font-mono font-bold text-white mt-1">₹{Number(pkg.totalCharge).toFixed(2)}</div>
            <div className="text-[10px] text-slate-500">Maximum reserve</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-mono text-slate-500">Triggers Started</div>
            <div className="text-lg font-mono font-bold text-[#D8EC8D] mt-1">
              {triggers.length} post(s)
            </div>
            <div className="text-[10px] text-slate-500">Manual Start flow</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-mono text-slate-500">Execution Progress</div>
            <div className="text-lg font-mono font-bold text-white mt-1">
              {completedExecs} / {totalExecs}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">{progressPercent}% complete</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] uppercase font-mono text-slate-500">Refunded Amount</div>
            <div className="text-lg font-mono font-bold text-amber-400 mt-1">
              ₹{Number(pkg.refundedAmount || 0).toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500">Unused / partials</div>
          </div>
        </div>
      </GlassCard>

      {/* ACTIVE PACKAGE CARD: START FLOW WITH LINK PREVIEW */}
      {pkg.status === "ACTIVE" && (
        <GlassCard className="p-6 md:p-8 rounded-3xl border-white/10 space-y-6 bg-white/[0.02]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#D8EC8D]/15 text-[#D8EC8D] flex items-center justify-center">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Start Delivery for New Post</h2>
                <p className="text-xs text-slate-400">
                  Paste the post or reel link below to configure quantity, interval, and start drip delivery.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-500 self-start sm:self-auto">
              Per-post quota applies
            </span>
          </div>

          {/* Link Box Input */}
          <form onSubmit={handlePreviewPost} className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              required
              placeholder={`https://${pkg.platform}.com/...`}
              value={postLink}
              onChange={(e) => {
                setPostLink(e.target.value);
                setPreviewData(null);
                setPreviewError(null);
              }}
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#D8EC8D]/50"
            />
            <button
              type="submit"
              disabled={previewLoading || !postLink.trim()}
              className="px-6 py-3 rounded-2xl bg-[#D8EC8D] text-[#131313] font-bold text-xs hover:brightness-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center gap-2 shadow-sm"
            >
              {previewLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating Link...</span>
                </>
              ) : (
                <>
                  <span>Preview Post</span>
                </>
              )}
            </button>
          </form>

          {/* Preview Error Banner */}
          {previewError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{previewError.message}</span>
              </div>
              <span className="font-mono text-[10px] text-rose-400/70">Ref: {previewError.requestId}</span>
            </div>
          )}

          {/* Preview Configuration Section (zero side effects) */}
          {previewData && (
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/5">
                <div>
                  <div className="text-xs text-slate-400">Target Media Key</div>
                  <div className="text-sm font-mono font-bold text-white">{previewData.mediaKey}</div>
                </div>
                <div className="text-xs text-slate-400">
                  Normalized URL:{" "}
                  <a
                    href={previewData.normalizedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#D8EC8D] hover:underline font-mono"
                  >
                    {previewData.normalizedUrl.slice(0, 45)}...
                  </a>
                </div>
              </div>

              {/* Service Rules Checklist */}
              <div className="space-y-4">
                <div className="text-xs font-semibold text-slate-300">
                  Select Services to Deliver for this Post:
                </div>

                <div className="space-y-3">
                  {previewData.rules?.map((rule: any) => {
                    const sel = ruleSelections[rule.ruleId] || {
                      enabled: false,
                      quantity: rule.defaultQuantity,
                      deliveryWindowMin: rule.deliveryWindowMin || 60,
                    };
                    const isExhausted = rule.remainingPosts <= 0;

                    return (
                      <div
                        key={rule.ruleId}
                        className={`p-4 rounded-xl border transition-all ${
                          sel.enabled
                            ? "bg-[#D8EC8D]/5 border-[#D8EC8D]/30"
                            : "bg-white/[0.01] border-white/5 opacity-60"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={isExhausted}
                              checked={sel.enabled}
                              onChange={(e) =>
                                setRuleSelections((prev) => ({
                                  ...prev,
                                  [rule.ruleId]: { ...sel, enabled: e.target.checked },
                                }))
                              }
                              className="w-4 h-4 rounded text-[#D8EC8D] focus:ring-0 bg-black/40 border-white/20"
                            />
                            <div>
                              <div className="text-sm font-medium text-white">{rule.serviceName}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                Quota: {rule.usedCount} / {rule.maxPosts} posts used (
                                <span className={isExhausted ? "text-rose-400" : "text-emerald-400"}>
                                  {rule.remainingPosts} remaining
                                </span>
                                )
                              </div>
                            </div>
                          </label>

                          {/* Per-Rule Quantity and Delivery Window Controls */}
                          {sel.enabled && (
                            <div className="flex items-center gap-4 text-xs font-mono">
                              <div>
                                <label className="text-[10px] uppercase text-slate-500 block mb-1">
                                  Quantity (max {formatIndianNumber(rule.maxQuantity)})
                                </label>
                                <input
                                  type="number"
                                  min={rule.minQuantity}
                                  max={rule.maxQuantity}
                                  value={sel.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || rule.minQuantity;
                                    setRuleSelections((prev) => ({
                                      ...prev,
                                      [rule.ruleId]: { ...sel, quantity: val },
                                    }));
                                  }}
                                  className="w-28 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] uppercase text-slate-500 block mb-1">
                                  Window (minutes)
                                </label>
                                <input
                                  type="number"
                                  min={rule.minGapMinutes || 5}
                                  max={1440}
                                  step={5}
                                  value={sel.deliveryWindowMin}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 60;
                                    setRuleSelections((prev) => ({
                                      ...prev,
                                      [rule.ruleId]: { ...sel, deliveryWindowMin: val },
                                    }));
                                  }}
                                  className="w-24 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Consent and Compliance Rules */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#D8EC8D] focus:ring-0 bg-black/40 border-white/20 shrink-0"
                  />
                  <span>
                    I confirm that I understand platform rules and delivery terms. We do not verify account ownership.
                  </span>
                </label>
              </div>

              {/* Start Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewData(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={startingDelivery || !consentChecked}
                  onClick={handleStartDelivery}
                  className="px-6 py-2.5 rounded-xl bg-[#D8EC8D] text-[#131313] font-bold text-xs hover:brightness-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                >
                  {startingDelivery ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Scheduling Runs...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Start Delivery</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      )}

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
          <span>Package Rules ({pkg.rules?.length || 0})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("triggers")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === "triggers"
              ? "bg-[#D8EC8D]/15 text-white border border-[#D8EC8D]/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Posts Delivered ({triggers.length})</span>
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
          <span>Drip Executions ({executions.length})</span>
        </button>
      </div>

      {/* TAB 1: PACKAGE RULES OVERVIEW */}
      {activeTab === "timeline" && (
        <section className="space-y-4">
          <div className="glass-panel overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-4">Kind</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Quota / Total Qty</th>
                    <th className="py-3 px-4">Qty / Post</th>
                    <th className="py-3 px-4">Rate / 1k</th>
                    <th className="py-3 px-4">Allocated Reserve</th>
                    <th className="py-3 px-4 text-right">Quota Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {pkg.rules?.map((r: any) => (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-white font-semibold">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-slate-300">
                          {r.kind}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-200 font-sans font-medium">
                        {r.service?.displayName || r.service?.name}
                      </td>
                      <td className="py-3 px-4 text-white">
                        {r.kind === "FOLLOWERS_INTERVAL"
                          ? `${formatIndianNumber(r.totalFollowers || 0)} total`
                          : `${r.maxPosts} posts max`}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {r.kind === "POST_TRIGGERED" ? formatIndianNumber(r.quantityPerPost) : "—"}
                      </td>
                      <td className="py-3 px-4 text-[#D8EC8D]">₹{Number(r.rateSnapshot).toFixed(2)}</td>
                      <td className="py-3 px-4 text-white font-semibold">
                        ₹{Number(r.unitCharge).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {r.kind === "POST_TRIGGERED" ? (
                          <span
                            className={
                              r.usedCount >= r.maxPosts ? "text-rose-400" : "text-emerald-400"
                            }
                          >
                            {r.usedCount} / {r.maxPosts}
                          </span>
                        ) : (
                          <span className="text-slate-500">Scheduled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: TRIGGERED POSTS TABLE */}
      {activeTab === "triggers" && (
        <section className="space-y-4">
          {triggers.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-slate-400 text-xs space-y-2">
              <Film className="w-8 h-8 mx-auto text-slate-500" />
              <div>No posts started for this package yet.</div>
              <div className="text-[11px] text-slate-500">
                Paste your post link above to configure per-post drip delivery.
              </div>
            </div>
          ) : (
            <div className="glass-panel overflow-hidden rounded-2xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">Media Key</th>
                      <th className="py-3 px-4">Target Link</th>
                      <th className="py-3 px-4">Executions</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {triggers.map((trig) => (
                      <tr key={trig.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 text-white font-semibold">{trig.mediaKey}</td>
                        <td className="py-3 px-4 text-slate-400 max-w-[260px] truncate" title={trig.url}>
                          {trig.url}
                        </td>
                        <td className="py-3 px-4 text-[#D8EC8D]">
                          {trig.executions?.length || 0} run(s)
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {new Date(trig.createdAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <a
                            href={trig.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#D8EC8D] hover:underline inline-flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
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

      {/* TAB 3: WORKFLOW EXECUTIONS TABLE */}
      {activeTab === "executions" && (
        <section className="space-y-4">
          {executions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-slate-400 text-xs space-y-2">
              <Layers className="w-8 h-8 mx-auto text-slate-500" />
              <div>No workflow executions scheduled yet.</div>
              <div className="text-[11px] text-slate-500">
                Executions are created when followers drip is purchased or when you start post delivery.
              </div>
            </div>
          ) : (
            <div className="glass-panel overflow-hidden rounded-2xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">Seq #</th>
                      <th className="py-3 px-4">Service</th>
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4">Target Link</th>
                      <th className="py-3 px-4">Quantity</th>
                      <th className="py-3 px-4">Allocated Charge</th>
                      <th className="py-3 px-4">Scheduled For</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Order Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {executions.map((e) => (
                      <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 text-white font-semibold">#{e.seq}</td>
                        <td className="py-3 px-4 text-slate-200 font-sans font-medium">
                          {e.rule?.service?.displayName || e.rule?.service?.name || "Service"}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[10px]">{e.source}</td>
                        <td className="py-3 px-4 text-slate-400 max-w-[160px] truncate" title={e.targetUrl}>
                          {e.targetUrl}
                        </td>
                        <td className="py-3 px-4 text-white font-bold">{formatIndianNumber(e.quantity)}</td>
                        <td className="py-3 px-4 text-[#D8EC8D]">₹{Number(e.allocatedCharge).toFixed(2)}</td>
                        <td className="py-3 px-4 text-slate-300">
                          {new Date(e.executeAt).toLocaleString([], {
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
                                : e.status === "CANCELLED"
                                ? "bg-slate-500/15 text-slate-400 border border-slate-500/20"
                                : "bg-white/5 text-slate-300 border border-white/10"
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {e.childOrderId ? (
                            <Link href="/orders" className="text-[11px] text-[#D8EC8D] hover:underline">
                              #{e.childOrderId.slice(0, 8)}
                            </Link>
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
                Cancelling will stop all upcoming executions and refund the unused reserve back to your wallet.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Undispatched runs:</span>
                <span className="font-mono text-white font-bold">{scheduledExecutions.length}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Refund to Wallet:</span>
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
                Keep Active
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
