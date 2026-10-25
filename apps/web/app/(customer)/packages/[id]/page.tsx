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
  FastForward,
  Link2,
  Repeat,
  Zap,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";
import {
  formatInstantForDateTimeLocal,
  localDateTimeToInstant,
} from "@smm/contracts";

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
  const [reschedulingExecutionId, setReschedulingExecutionId] = useState<string | null>(null);
  const [savingRescheduleExecutionId, setSavingRescheduleExecutionId] = useState<string | null>(null);
  const [rescheduleDrafts, setRescheduleDrafts] = useState<Record<string, string>>({});

  // Speed-Up Schedule State
  const [speedUpModalOpen, setSpeedUpModalOpen] = useState(false);
  const [speedFactor, setSpeedFactor] = useState(1.25);
  const [submittingSpeedUp, setSubmittingSpeedUp] = useState(false);

  // Link Swap State
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [selectedTriggerForSwap, setSelectedTriggerForSwap] = useState<any | null>(null);
  const [swapNewUrl, setSwapNewUrl] = useState("");
  const [submittingSwap, setSubmittingSwap] = useState(false);

  // Monthly Retainer Auto-Renew & Manual Renew State
  const [togglingAutoRenew, setTogglingAutoRenew] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [submittingRenew, setSubmittingRenew] = useState(false);

  // Problem Report State
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [problemIssue, setProblemIssue] = useState("Execution delayed or missed");
  const [problemDesc, setProblemDesc] = useState("");
  const [submittingProblem, setSubmittingProblem] = useState(false);

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

  const handleSpeedUp = async () => {
    setSubmittingSpeedUp(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${getApiBase()}/packages/${packageId}/speed-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ speedFactor }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: "success",
          message: `Delivery schedule accelerated (${speedFactor}x)! Upcoming runs recalculated with safe platform bounds.`,
        });
        setSpeedUpModalOpen(false);
        await fetchPackage();
      } else {
        setNotification({
          type: "error",
          message: data.message || "Failed to accelerate schedule.",
        });
      }
    } catch {
      setNotification({ type: "error", message: "Network error speeding up schedule." });
    } finally {
      setSubmittingSpeedUp(false);
    }
  };

  const handleSwapLink = async () => {
    if (!selectedTriggerForSwap || !swapNewUrl.trim()) return;
    setSubmittingSwap(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(
        `${getApiBase()}/packages/${packageId}/triggers/${selectedTriggerForSwap.id}/swap-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ newTargetUrl: swapNewUrl.trim() }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: "success",
          message: `Target link swapped! ${data.swappedExecutionsCount || 0} scheduled execution(s) updated.`,
        });
        setSwapModalOpen(false);
        setSelectedTriggerForSwap(null);
        setSwapNewUrl("");
        await fetchPackage();
      } else {
        setNotification({
          type: "error",
          message: data.message || "Failed to swap link.",
        });
      }
    } catch {
      setNotification({ type: "error", message: "Network error while swapping link." });
    } finally {
      setSubmittingSwap(false);
    }
  };

  const handleToggleAutoRenew = async (newVal: boolean) => {
    setTogglingAutoRenew(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${getApiBase()}/packages/${packageId}/auto-renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: newVal }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: "success",
          message: newVal ? "Auto-renew enabled for monthly retainer." : "Auto-renew disabled.",
        });
        await fetchPackage();
      } else {
        setNotification({
          type: "error",
          message: data.message || "Failed to update auto-renew setting.",
        });
      }
    } catch {
      setNotification({ type: "error", message: "Network error updating auto-renew setting." });
    } finally {
      setTogglingAutoRenew(false);
    }
  };

  const handleManualRenew = async () => {
    setSubmittingRenew(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${getApiBase()}/packages/${packageId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ explicitConsent: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          type: "success",
          message: `Package renewed! New package created: #${data.newPackageId?.slice(0, 8)}.`,
        });
        setRenewModalOpen(false);
        if (data.newPackageId) {
          router.push(`/packages/${data.newPackageId}`);
        } else {
          await fetchPackage();
        }
      } else {
        setNotification({
          type: "error",
          message: data.message || data.reason || "Failed to renew package.",
        });
      }
    } catch {
      setNotification({ type: "error", message: "Network error renewing package." });
    } finally {
      setSubmittingRenew(false);
    }
  };

  const handleRescheduleExecution = async (executionId: string) => {
    const draft = rescheduleDrafts[executionId];
    let executeAt: string;
    try {
      executeAt = localDateTimeToInstant(draft, pkg?.timezone || "UTC");
    } catch (error) {
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Choose a valid time in the package timezone.",
      });
      return;
    }
    if (new Date(executeAt).getTime() <= Date.now()) {
      setNotification({ type: "error", message: "Choose a valid future execution time." });
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      setNotification({ type: "error", message: "Please log in to reschedule an execution." });
      return;
    }

    setSavingRescheduleExecutionId(executionId);
    try {
      const res = await fetch(`${getApiBase()}/packages/${packageId}/executions/${executionId}/reschedule`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ executeAt }),
      });
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        setNotification({
          type: "error",
          message: "The reschedule response could not be confirmed. Refresh the package before retrying.",
        });
        await fetchPackage();
        return;
      }

      if (!res.ok) {
        setNotification({
          type: "error",
          message:
            typeof data === "object" &&
            data !== null &&
            "message" in data &&
            typeof data.message === "string"
              ? data.message
              : "Failed to reschedule execution.",
        });
        return;
      }

      if (
        typeof data !== "object" ||
        data === null ||
        !("success" in data) ||
        data.success !== true
      ) {
        setNotification({
          type: "error",
          message: "The reschedule could not be confirmed. Refresh the package before retrying.",
        });
        await fetchPackage();
        return;
      }

      setRescheduleDrafts((previous) => {
        const next = { ...previous };
        delete next[executionId];
        return next;
      });
      setReschedulingExecutionId(null);
      setNotification({ type: "success", message: "Execution rescheduled." });
      await fetchPackage();
    } catch {
      setNotification({ type: "error", message: "Network error while rescheduling execution." });
    } finally {
      setSavingRescheduleExecutionId(null);
    }
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
              Platform: <span className="capitalize text-slate-300">{pkg.platform}</span> · Schedule timezone:{" "}
              <span className="text-slate-300">{pkg.timezone || "UTC"}</span> · We do not verify account ownership.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setProblemModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs border border-white/10 transition-all"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Report a Problem</span>
            </button>

            {pkg.status === "ACTIVE" && (
              <button
                type="button"
                onClick={() => setSpeedUpModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D8EC8D]/10 hover:bg-[#D8EC8D]/20 text-[#D8EC8D] font-semibold text-xs border border-[#D8EC8D]/30 transition-all"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Speed Up</span>
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

        {/* Retainer & Auto-Renew Management Bar */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#D8EC8D]/10 text-[#D8EC8D] flex items-center justify-center shrink-0">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Monthly Retainer & Auto-Renew</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                    pkg.autoRenew
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                      : "bg-white/5 text-slate-400 border border-white/10"
                  }`}
                >
                  {pkg.autoRenew ? "Auto-Renew Active" : "Manual Renewal"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {pkg.autoRenew
                  ? "Your retainer will automatically reserve next month's cycle from wallet balance when current quota concludes."
                  : "Auto-renewal is paused. You can renew manually or toggle auto-renew at any time."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
              <input
                type="checkbox"
                disabled={togglingAutoRenew}
                checked={Boolean(pkg.autoRenew)}
                onChange={(e) => handleToggleAutoRenew(e.target.checked)}
                className="w-4 h-4 rounded text-[#D8EC8D] focus:ring-0 bg-black/40 border-white/20"
              />
              <span>Auto-Renew</span>
            </label>

            <button
              type="button"
              onClick={() => setRenewModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs border border-white/10 transition-all flex items-center gap-1.5"
            >
              <Repeat className="w-3.5 h-3.5 text-[#D8EC8D]" />
              <span>Renew Retainer</span>
            </button>
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
                          <div className="flex items-center justify-end gap-2">
                            {pkg.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTriggerForSwap(trig);
                                  setSwapNewUrl(trig.url);
                                  setSwapModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] inline-flex items-center gap-1 border border-white/5 transition-all"
                              >
                                <Link2 className="w-3 h-3 text-[#D8EC8D]" />
                                <span>Swap Link</span>
                              </button>
                            )}
                            <a
                              href={trig.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#D8EC8D] hover:underline inline-flex items-center gap-1"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
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
                        <td className="py-3 px-4 text-white font-bold">
                          {formatIndianNumber(e.quantity)}
                          {e.order?.remains !== undefined && e.order?.remains !== null && (
                            <div className="mt-1 text-[10px] font-normal text-slate-400">
                              Remaining: {formatIndianNumber(e.order.remains)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#D8EC8D]">₹{Number(e.allocatedCharge).toFixed(2)}</td>
                        <td className="py-3 px-4 text-slate-300">
                          {new Date(e.executeAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: pkg.timezone || "UTC",
                          })}
                          {e.status === "SCHEDULED" && pkg.status === "ACTIVE" && (
                            <div className="mt-2 space-y-2 font-sans">
                              {reschedulingExecutionId === e.id ? (
                                <>
                                  <p className="max-w-64 text-[10px] text-slate-500">
                                    Enter the schedule time in {pkg.timezone || "UTC"}. Nonexistent or repeated local times during daylight-saving changes are rejected.
                                  </p>
                                  <input
                                    type="datetime-local"
                                    aria-label={`New execution time for ${e.id}`}
                                    value={rescheduleDrafts[e.id] || ""}
                                    onChange={(event) => setRescheduleDrafts((previous) => ({
                                      ...previous,
                                      [e.id]: event.target.value,
                                    }))}
                                    className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-white"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={!rescheduleDrafts[e.id] || savingRescheduleExecutionId === e.id}
                                      onClick={() => handleRescheduleExecution(e.id)}
                                      className="rounded-lg bg-[#D8EC8D]/15 px-2.5 py-1 text-[10px] font-semibold text-[#D8EC8D] disabled:opacity-40"
                                    >
                                      {savingRescheduleExecutionId === e.id ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={savingRescheduleExecutionId === e.id}
                                      onClick={() => {
                                        setReschedulingExecutionId(null);
                                        setRescheduleDrafts((previous) => {
                                          const next = { ...previous };
                                          delete next[e.id];
                                          return next;
                                        });
                                      }}
                                      className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] text-slate-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const localInputValue = formatInstantForDateTimeLocal(
                                      e.executeAt,
                                      pkg.timezone || "UTC"
                                    );
                                    setRescheduleDrafts((previous) => ({ ...previous, [e.id]: localInputValue }));
                                    setReschedulingExecutionId(e.id);
                                  }}
                                  className="text-[10px] text-[#D8EC8D] hover:underline"
                                >
                                  Reschedule
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              e.status === "COMPLETED"
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                : e.status === "DISPATCHED" || e.status === "PROCESSING"
                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                                : e.status === "PARTIAL"
                                ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                                : e.status === "FAILED"
                                ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                                : e.status === "CANCELLED"
                                ? "bg-slate-500/15 text-slate-400 border border-slate-500/20"
                                : "bg-white/5 text-slate-300 border border-white/10"
                            }`}
                          >
                            {e.status}
                          </span>
                          {e.skipReason && (
                            <div className="mt-1 max-w-56 font-sans text-[10px] text-amber-300">
                              {e.skipReason}
                            </div>
                          )}
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

      {/* Problem Report Modal */}
      {problemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-white/10 space-y-5 bg-[#171717] shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Report a Problem</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1.5">Issue Category</label>
                <select
                  value={problemIssue}
                  onChange={(e) => setProblemIssue(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[#D8EC8D]"
                >
                  <option value="Execution delayed or missed" className="bg-[#1c1c1c] text-white">Execution delayed or missed</option>
                  <option value="Quantity drop or discrepancy" className="bg-[#1c1c1c] text-white">Quantity drop or discrepancy</option>
                  <option value="Post URL was not detected" className="bg-[#1c1c1c] text-white">Post URL was not detected</option>
                  <option value="Other delivery issue" className="bg-[#1c1c1c] text-white">Other delivery issue</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1.5">Description & Details</label>
                <textarea
                  rows={4}
                  value={problemDesc}
                  onChange={(e) => setProblemDesc(e.target.value)}
                  placeholder="Provide any details about the discrepancy..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#D8EC8D]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProblemModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingProblem || !problemDesc.trim()}
                onClick={async () => {
                  setSubmittingProblem(true);
                  try {
                    const token = localStorage.getItem("authToken");
                    const res = await fetch(`${getApiBase()}/packages/${packageId}/report-problem`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ issue: problemIssue, description: problemDesc }),
                    });
                    if (res.ok) {
                      setNotification({ message: "Problem reported successfully. High-priority ticket created.", type: "success" });
                      setProblemModalOpen(false);
                      setProblemDesc("");
                    } else {
                      const data = await res.json();
                      setNotification({ message: data.message || "Failed to submit report", type: "error" });
                    }
                  } catch {
                    setNotification({ message: "Network error submitting report", type: "error" });
                  } finally {
                    setSubmittingProblem(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#D8EC8D] text-black font-semibold text-xs hover:brightness-105 transition-all shadow-md disabled:opacity-50"
              >
                {submittingProblem ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Speed-Up Schedule Modal */}
      {speedUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-white/10 space-y-5 bg-[#171717] shadow-2xl">
            <div className="flex items-center gap-3 text-[#D8EC8D]">
              <div className="p-2 rounded-xl bg-[#D8EC8D]/15 border border-[#D8EC8D]/30">
                <FastForward className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Accelerate Delivery Schedule</h3>
                <p className="text-xs text-slate-400">Safely compresses remaining run intervals.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs">
                <div className="text-slate-300 font-medium">Select Compression Factor:</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { factor: 1.25, label: "1.25x (Safe)" },
                    { factor: 1.5, label: "1.50x (Moderate)" },
                    { factor: 2.0, label: "2.00x (Maximum)" },
                  ].map((opt) => (
                    <button
                      key={opt.factor}
                      type="button"
                      onClick={() => setSpeedFactor(opt.factor)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        speedFactor === opt.factor
                          ? "bg-[#D8EC8D]/15 border-[#D8EC8D] text-[#D8EC8D] font-bold"
                          : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="text-xs">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">
                Remaining scheduled executions will be shifted forward by {speedFactor}x compression. Minimum 15-minute intervals between runs are automatically enforced to stay strictly within platform delivery limits.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSpeedUpModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingSpeedUp}
                onClick={handleSpeedUp}
                className="flex-1 py-2.5 rounded-xl bg-[#D8EC8D] text-black font-semibold text-xs hover:brightness-105 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submittingSpeedUp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Compressing...</span>
                  </>
                ) : (
                  <>
                    <FastForward className="w-3.5 h-3.5" />
                    <span>Confirm Speed Up</span>
                  </>
                )}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Link Swap Modal */}
      {swapModalOpen && selectedTriggerForSwap && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-white/10 space-y-5 bg-[#171717] shadow-2xl">
            <div className="flex items-center gap-3 text-white">
              <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-[#D8EC8D]">
                <Link2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Swap Target Post Link</h3>
                <p className="text-xs text-slate-400">Media Key: {selectedTriggerForSwap.mediaKey}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Current URL</label>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs font-mono text-slate-400 truncate">
                  {selectedTriggerForSwap.url}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">New Target Post URL</label>
                <input
                  type="url"
                  required
                  placeholder={`https://${pkg.platform}.com/...`}
                  value={swapNewUrl}
                  onChange={(e) => setSwapNewUrl(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[#D8EC8D]"
                />
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">
                Swapping updates all undispatched, scheduled runs for this trigger to the new link. Already completed or dispatched orders are kept as-is.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSwapModalOpen(false);
                  setSelectedTriggerForSwap(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingSwap || !swapNewUrl.trim() || swapNewUrl.trim() === selectedTriggerForSwap.url}
                onClick={handleSwapLink}
                className="flex-1 py-2.5 rounded-xl bg-[#D8EC8D] text-black font-semibold text-xs hover:brightness-105 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submittingSwap ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Swapping...</span>
                  </>
                ) : (
                  <span>Swap Link</span>
                )}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Manual Retainer Renewal Modal */}
      {renewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-white/10 space-y-5 bg-[#171717] shadow-2xl">
            <div className="flex items-center gap-3 text-white">
              <div className="p-2 rounded-xl bg-[#D8EC8D]/15 border border-[#D8EC8D]/30 text-[#D8EC8D]">
                <Repeat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Renew Package Retainer</h3>
                <p className="text-xs text-slate-400">Extend growth package for another monthly cycle.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Target Handle:</span>
                  <span className="font-mono text-white font-bold">@{pkg.handle}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Cycle Duration:</span>
                  <span className="font-mono text-white font-bold">30 Days</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-white/5">
                  <span>Wallet Charge / Reserve:</span>
                  <span className="font-mono text-[#D8EC8D] font-bold text-sm">
                    ₹{Number(pkg.reserveTotal || pkg.totalCharge).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">
                Confirming renewal will deduct ₹{Number(pkg.reserveTotal || pkg.totalCharge).toFixed(2)} from your wallet and provision an active package cycle with all current rule quotas restored.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRenewModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingRenew}
                onClick={handleManualRenew}
                className="flex-1 py-2.5 rounded-xl bg-[#D8EC8D] text-black font-semibold text-xs hover:brightness-105 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submittingRenew ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Confirm & Renew</span>
                  </>
                )}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
