"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { GlassCard } from "@/components/shared/GlassCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { motion, AnimatePresence } from "framer-motion";
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
  Wallet,
  Copy,
  Sparkles,
  ShieldCheck,
  Activity,
  TrendingUp,
  Users,
  Clipboard,
  ListFilter,
  X,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";
import { formatPackageId } from "@/lib/utils";
import {
  formatInstantForDateTimeLocal,
  localDateTimeToInstant,
} from "@smm/contracts";
import { getApiBase } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-session";

function formatExecutionSchedule(executeAt?: string | Date) {
  if (!executeAt) return null;
  const d = new Date(executeAt);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  if (isToday) return "Delivering Today";
  if (isTomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

interface RuleSelectionState {
  enabled: boolean;
  quantity: number;
  deliveryWindowMin: number;
  runsCount: number;
  intervalMinutes: number;
}

interface ExtraServiceSelectionState {
  enabled: boolean;
  quantity: number;
  runsCount: number;
  intervalMinutes: number;
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
  const [pageError, setPageError] = useState<{ message: string; requestId: string; isAuthError?: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "triggers" | "executions">("timeline");

  // Per-Post Start Flow State
  const [postLink, setPostLink] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewError, setPreviewError] = useState<{ message: string; requestId: string } | null>(null);
  const [ruleSelections, setRuleSelections] = useState<{ [ruleId: string]: RuleSelectionState }>({});
  const [extraSelections, setExtraSelections] = useState<{ [serviceId: string]: ExtraServiceSelectionState }>({});
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
  const [retryingExecutionId, setRetryingExecutionId] = useState<string | null>(null);
  const [retryModalExecution, setRetryModalExecution] = useState<any | null>(null);
  const [retryTargetUrl, setRetryTargetUrl] = useState<string>("");
  const [syncingExecutionId, setSyncingExecutionId] = useState<string | null>(null);
  const [resolvingExecutionId, setResolvingExecutionId] = useState<string | null>(null);
  const [resolveModalExecution, setResolveModalExecution] = useState<any | null>(null);

  const handleSyncExecution = async (executionId: string) => {
    setSyncingExecutionId(executionId);
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBase()}/packages/${packageId}/executions/${executionId}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          type: "success",
          message: data.message || "Live status updated from provider!",
        });
        await fetchPackage();
      } else {
        setNotification({
          type: "error",
          message: data.message || "Could not sync live status from provider.",
        });
      }
    } catch {
      setNotification({
        type: "error",
        message: "Network error while syncing status.",
      });
    } finally {
      setSyncingExecutionId(null);
    }
  };

  const handleConfirmResolve = async (executionId: string) => {
    setResolvingExecutionId(executionId);
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBase()}/packages/${packageId}/executions/${executionId}/resolve-stalled`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          type: "success",
          message: data.message || `Run resolved. ₹${data.refundedAmount?.toFixed(2) || "0.00"} refunded to wallet.`,
        });
        setResolveModalExecution(null);
        await fetchPackage();
      } else {
        setNotification({
          type: "error",
          message: data.message || "Could not resolve execution.",
        });
      }
    } catch {
      setNotification({
        type: "error",
        message: "Network error while resolving execution.",
      });
    } finally {
      setResolvingExecutionId(null);
    }
  };

  const handleConfirmRetry = async (executionId: string, targetUrl?: string) => {
    setRetryingExecutionId(executionId);
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBase()}/packages/${packageId}/executions/${executionId}/retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUrl: targetUrl?.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          type: "success",
          message: data.message || "Execution queued for retry delivery!",
        });
        setRetryModalExecution(null);
        await fetchPackage();
      } else {
        setNotification({
          type: "error",
          message: data.message || "Failed to retry execution.",
        });
      }
    } catch {
      setNotification({
        type: "error",
        message: "Network error while retrying execution.",
      });
    } finally {
      setRetryingExecutionId(null);
    }
  };

  // Speed-Up Schedule State
  const [speedUpModalOpen, setSpeedUpModalOpen] = useState(false);

  // Delivery Window Reschedule Modal State (D3 UI)
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [reschedulePreset, setReschedulePreset] = useState<"ANY_TIME" | "DAYTIME" | "EVENING" | "CUSTOM">("DAYTIME");
  const [rescheduleStartHour, setRescheduleStartHour] = useState<number>(9);
  const [rescheduleEndHour, setRescheduleEndHour] = useState<number>(21);
  const [rescheduleTimezone, setRescheduleTimezone] = useState<string>("Asia/Kolkata");
  const [reschedulePreviewData, setReschedulePreviewData] = useState<any>(null);
  const [loadingReschedulePreview, setLoadingReschedulePreview] = useState<boolean>(false);
  const [submittingReschedule, setSubmittingReschedule] = useState<boolean>(false);
  const [rescheduleError, setRescheduleError] = useState<{ message: string; requestId?: string } | null>(null);
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

  // Quick Action State
  const [copiedId, setCopiedId] = useState(false);
  const handleCopyId = () => {
    if (!pkg?.id) return;
    navigator.clipboard.writeText(pkg.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handlePasteLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setPostLink(text.trim());
        setPreviewData(null);
        setPreviewError(null);
      }
    } catch {
      // clipboard access error / permission denied
    }
  };

  const fetchPackage = useCallback(async () => {
    if (typeof window === "undefined" || !packageId) return;
    const token = getAuthToken();
    if (!token) {
      setPageError({
        message: "You are not logged in. Please sign in to view package details.",
        requestId: `auth_missing_${Date.now()}`,
        isAuthError: true,
      });
      setLoading(false);
      return;
    }

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
        const isAuthErr = pkgRes.status === 401 || (errJson.message && (errJson.message.toLowerCase().includes("jwt") || errJson.message.toLowerCase().includes("expired") || errJson.message.toLowerCase().includes("unauthorized")));
        setPageError({
          message: isAuthErr ? "Your login session has expired. Please log in again to continue." : (errJson.message || "Failed to load package details."),
          requestId: reqId,
          isAuthError: isAuthErr,
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

    const token = getAuthToken();
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
              deliveryWindowMin: r.defaultWindowMin || 1440,
              runsCount: r.runsCount || 2,
              intervalMinutes: r.gapMinutes || 120,
            };
          });
        }
        setRuleSelections(initialSelections);

        // Initialize extra complementary services
        const initialExtras: { [serviceId: string]: ExtraServiceSelectionState } = {};
        if (Array.isArray(data.availableExtraServices)) {
          data.availableExtraServices.forEach((s: any) => {
            initialExtras[s.id] = {
              enabled: false,
              quantity: s.minQty || 100,
              runsCount: 1,
              intervalMinutes: 120,
            };
          });
        }
        setExtraSelections(initialExtras);
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
    const token = getAuthToken();
    if (!token) return;

    const chosenRules = Object.entries(ruleSelections)
      .filter(([_, sel]) => sel.enabled)
      .map(([ruleId, sel]) => ({
        ruleId,
        quantity: sel.quantity,
        deliveryWindowMin: sel.deliveryWindowMin,
        runsCount: sel.runsCount,
        intervalMinutes: sel.intervalMinutes,
      }));

    const chosenExtras = Object.entries(extraSelections)
      .filter(([_, sel]) => sel.enabled)
      .map(([serviceId, sel]) => ({
        serviceId,
        quantity: sel.quantity,
        runsCount: sel.runsCount,
        intervalMinutes: sel.intervalMinutes,
      }));

    if (chosenRules.length === 0 && chosenExtras.length === 0) {
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
          extraServices: chosenExtras,
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
          message: `🚀 1st run dispatched immediately to provider! ${
            (data.executionsCreated || 1) - 1 > 0
              ? `${(data.executionsCreated || 1) - 1} further run(s) queued on schedule.`
              : ""
          }`,
        });
        setPostLink("");
        setPreviewData(null);
        setConsentChecked(false);
        setActiveTab("executions");
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
      const token = getAuthToken();
      const res = await fetch(`${getApiBase()}/packages/${packageId}/speed-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ speedFactor }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: "success",
          message: `Delivery schedule accelerated (${speedFactor}x)! Upcoming runs recalculated with standard platform bounds.`,
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
      const token = getAuthToken();
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
      const token = getAuthToken();
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
      const token = getAuthToken();
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

  const handleFetchReschedulePreview = async () => {
    setLoadingReschedulePreview(true);
    setRescheduleError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBase()}/packages/${packageId}/reschedule/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          timezone: rescheduleTimezone,
          deliveryWindow: {
            timezone: rescheduleTimezone,
            ranges:
              reschedulePreset === "ANY_TIME"
                ? []
                : reschedulePreset === "DAYTIME"
                ? [{ startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 }]
                : reschedulePreset === "EVENING"
                ? [{ startHour: 17, startMinute: 0, endHour: 23, endMinute: 0 }]
                : [{ startHour: rescheduleStartHour, startMinute: 0, endHour: rescheduleEndHour, endMinute: 0 }],
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not preview schedule.");
      }
      setReschedulePreviewData(data);
    } catch (err: any) {
      setRescheduleError({
        message: err.message || "Failed to load schedule preview.",
        requestId: "req_" + Math.random().toString(36).slice(2, 9),
      });
    } finally {
      setLoadingReschedulePreview(false);
    }
  };

  const handleConfirmReschedule = async () => {
    setSubmittingReschedule(true);
    setRescheduleError(null);
    try {
      const token = getAuthToken();
      const idempotencyKey = `idemp_resched_${packageId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const res = await fetch(`${getApiBase()}/packages/${packageId}/reschedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          timezone: rescheduleTimezone,
          deliveryWindow: {
            timezone: rescheduleTimezone,
            ranges:
              reschedulePreset === "ANY_TIME"
                ? []
                : reschedulePreset === "DAYTIME"
                ? [{ startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 }]
                : reschedulePreset === "EVENING"
                ? [{ startHour: 17, startMinute: 0, endHour: 23, endMinute: 0 }]
                : [{ startHour: rescheduleStartHour, startMinute: 0, endHour: rescheduleEndHour, endMinute: 0 }],
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to apply delivery window reschedule.");
      }
      setNotification({
        type: "success",
        message: `Delivery window updated successfully! ${data.rescheduledCount || 0} upcoming runs adjusted.`,
      });
      setRescheduleModalOpen(false);
      await fetchPackage();
    } catch (err: any) {
      setRescheduleError({
        message: err.message || "Reschedule execution failed.",
        requestId: "req_" + Math.random().toString(36).slice(2, 9),
      });
    } finally {
      setSubmittingReschedule(false);
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

    const token = getAuthToken();
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
    const isAuthErr =
      pageError.isAuthError ||
      pageError.message.toLowerCase().includes("jwt") ||
      pageError.message.toLowerCase().includes("expired") ||
      pageError.message.toLowerCase().includes("unauthorized") ||
      pageError.message.toLowerCase().includes("session");

    return (
      <div className="py-24 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-danger flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="text-fg font-semibold text-lg">{pageError.message}</div>
        <div className="text-xs text-slate-500 font-mono">Reference: {pageError.requestId}</div>
        <div className="flex items-center justify-center gap-3 pt-2">
          {isAuthErr ? (
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl bg-[#D8EC8D] text-[#131313] font-bold text-xs hover:brightness-105 transition-all shadow-md inline-block"
            >
              Log In Again
            </Link>
          ) : (
            <button
              type="button"
              onClick={fetchPackage}
              className="px-4 py-2 rounded-xl bg-[#D8EC8D] text-[#131313] font-bold text-xs hover:brightness-105 transition-all"
            >
              Retry
            </button>
          )}
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
        <div className="text-fg font-semibold text-lg">Package not found</div>
        <Link href="/packages" className="text-xs text-[#D8EC8D] underline">
          Back to Growth Packages
        </Link>
      </div>
    );
  }

  const completedExecs = executions.filter((e) => e.status === "COMPLETED").length;
  const totalExecs = executions.length;
  const progressPercent = totalExecs > 0 ? Math.round((completedExecs / totalExecs) * 100) : 0;
  const nextScheduledExecution = executions
    .filter((e) => e.status === "SCHEDULED" || e.status === "PENDING")
    .sort((a, b) => new Date(a.executeAt).getTime() - new Date(b.executeAt).getTime())[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-8 max-w-7xl mx-auto pb-16"
    >
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
      <GlassCard className="p-6 md:p-8 rounded-3xl border-border space-y-6 bg-gradient-to-b from-white/[0.04] to-transparent relative overflow-hidden shadow-2xl">
        {/* Subtle ambient lighting */}
        <div className="absolute top-0 right-0 w-96 h-48 bg-[#D8EC8D]/5 blur-[90px] pointer-events-none -z-10" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex items-center gap-3.5 flex-wrap">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-amber-500/20 border border-border flex items-center justify-center p-2.5 shadow-lg">
                <PlatformIcon platform={pkg.platform || "instagram"} size={26} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-fg tracking-tight truncate max-w-xl">
                    {pkg.handle?.startsWith("http") ? (
                      <span className="font-mono text-base sm:text-lg">{pkg.handle}</span>
                    ) : (
                      `@${pkg.handle}`
                    )}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold border shadow-sm ${
                      pkg.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-success border-emerald-500/30"
                        : pkg.status === "PAUSED"
                        ? "bg-amber-500/10 text-warning border-amber-500/30"
                        : pkg.status === "COMPLETED"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        : pkg.status === "CANCELLED"
                        ? "bg-rose-500/10 text-danger border-rose-500/30"
                        : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${pkg.status === "ACTIVE" ? "bg-emerald-400 animate-pulse" : "bg-current"}`} />
                    <span>{pkg.status}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-1">
                  <span>ID: {formatPackageId(pkg.id)}</span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title="Copy full Package ID"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-slate-600">·</span>
                  <span className="text-fg-2">
                    Active through {new Date(pkg.endAt || pkg.endDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-0.5 flex-wrap">
              <span>Platform: <strong className="capitalize text-slate-200">{pkg.platform}</strong></span>
              <span className="text-slate-600">·</span>
              <span>Schedule Timezone: <strong className="text-slate-200">{pkg.timezone || "UTC"}</strong></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">Drip Delivery Campaign</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setProblemModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-fg-2 hover:text-amber-300 font-medium text-xs border border-border transition-all hover:border-amber-500/30"
            >
              <AlertCircle className="w-3.5 h-3.5 text-warning" />
              <span>Report Issue</span>
            </button>

            {pkg.status === "ACTIVE" && (
              <button
                type="button"
                onClick={() => setSpeedUpModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-[#D8EC8D] font-semibold text-xs border border-accent/30 transition-all shadow-sm"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Speed Up</span>
              </button>
            )}

            {(pkg.status === "ACTIVE" || pkg.status === "PAUSED") && (
              <button
                type="button"
                onClick={() => {
                  setRescheduleTimezone(pkg.timezone || "Asia/Kolkata");
                  setRescheduleModalOpen(true);
                  setReschedulePreviewData(null);
                  setRescheduleError(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-[#D8EC8D] font-semibold text-xs border border-accent/30 transition-all"
              >
                <Clock className="w-3.5 h-3.5 text-[#D8EC8D]" />
                <span>Change Delivery Window</span>
              </button>
            )}

            {(pkg.status === "ACTIVE" || pkg.status === "PAUSED") && (
              <button
                type="button"
                disabled={actionInProgress}
                onClick={handleTogglePause}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-fg-2 font-semibold text-xs border border-border transition-all"
              >
                {pkg.status === "ACTIVE" ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-warning" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-success" />
                    <span>Resume</span>
                  </>
                )}
              </button>
            )}

            {pkg.status === "ACTIVE" && (
              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold text-xs border border-rose-500/20 transition-all hover:border-rose-500/40"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancel Remaining</span>
              </button>
            )}
          </div>
        </div>

        {/* Retainer & Auto-Renew Management Bar */}
        {(pkg.mode === "RETAINER" || pkg.autoRenew) && (
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent/10 text-[#D8EC8D] flex items-center justify-center shrink-0">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-fg">Monthly Retainer & Auto-Renew</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                    pkg.autoRenew
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                      : "bg-white/5 text-slate-400 border border-border"
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
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-fg-2 hover:text-white transition-colors">
              <input
                type="checkbox"
                disabled={togglingAutoRenew}
                checked={Boolean(pkg.autoRenew)}
                onChange={(e) => handleToggleAutoRenew(e.target.checked)}
                className="w-4 h-4 rounded text-[#D8EC8D] focus:ring-0 bg-slate-100 dark:bg-black/40 border-slate-300 dark:border-white/20"
              />
              <span>Auto-Renew</span>
            </label>

            <button
              type="button"
              onClick={() => setRenewModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-fg font-medium text-xs border border-border transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Repeat className="w-3.5 h-3.5 text-[#D8EC8D]" />
              <span>Renew Retainer</span>
            </button>
          </div>
        </div>
        )}

        {/* Progress & Stat Highlights */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-slate-200/60 dark:border-white/5">
          {/* Card 1: Total Upfront */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:border-white/15 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Total Order Value</span>
              <div className="w-7 h-7 rounded-lg bg-accent/10 text-[#D8EC8D] flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-fg tracking-tight">
              ₹{Number(pkg.reserveTotal ?? pkg.totalCharge ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#D8EC8D]" />
              <span>Pre-funded package total</span>
            </div>
          </div>

          {/* Card 2: Triggers / Posts Started */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:border-white/15 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Target Reel / Link</span>
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-info flex items-center justify-center">
                <Film className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-fg tracking-tight flex items-baseline gap-2">
              <span className="text-[#D8EC8D]">{triggers.length > 0 ? triggers.length : (pkg.slots?.length || 1)}</span>
              <span className="text-xs text-slate-400 font-normal">{triggers.length > 0 ? "post(s)" : "Active Target"}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#D8EC8D]" />
              <span>Target link attached</span>
            </div>
          </div>

          {/* Card 3: Execution Progress with Animated Progress Bar */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:border-white/15 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Drip Progress</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-success flex items-center justify-center">
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-xl sm:text-2xl font-mono font-bold text-fg tracking-tight">
                {completedExecs} <span className="text-xs text-slate-400 font-normal">/ {totalExecs} runs</span>
              </div>
              <span className="text-xs font-mono font-bold text-[#D8EC8D]">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#D8EC8D] to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(progressPercent, totalExecs > 0 ? 6 : 0))}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between font-mono">
                <span>Status:</span>
                <span className="text-emerald-400 font-semibold">{pkg.status === "ACTIVE" ? "In Progress" : pkg.status}</span>
              </div>
          </div>

          {/* Card 4: Refunded / Protected */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:border-white/15 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Protected Balance</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-warning flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-warning tracking-tight">
              ₹{Number(pkg.refundedAmount || 0).toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span>Unused balance protected</span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* CAMPAIGN PROGRESS & METRICS GRAPH (Theme-Matched Visualizer) */}
      <GlassCard className="p-6 md:p-8 rounded-3xl border-border space-y-6 bg-white/[0.02]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/15 text-[#D8EC8D] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-fg">Campaign Delivery Progress</h2>
              <p className="text-xs text-slate-400">
                Paced delivery metrics and stage completion for this package
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-accent/10 text-[#D8EC8D] border border-accent/20">
              {completedExecs} of {totalExecs} Batches Delivered
            </span>
          </div>
        </div>

        {/* Per-Service Metric Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pkg.rules?.map((r: any, idx: number) => {
            const totalUnits = (r.quantityPerPost || 0) * (r.maxPosts || 1);
            const ruleExecs = executions.filter((e: any) => e.ruleId === r.id);
            const deliveredUnits = ruleExecs
              .filter((e: any) => e.status === "COMPLETED")
              .reduce((sum: number, e: any) => sum + (e.quantity || 0), 0);
            const pct = totalUnits > 0 ? Math.min(100, Math.round((deliveredUnits / totalUnits) * 100)) : 0;

            const colorGradients = [
              "from-[#D8EC8D] to-emerald-400",
              "from-sky-400 to-indigo-500",
              "from-amber-400 to-orange-500",
              "from-purple-400 to-pink-500",
            ];
            const activeGradient = colorGradients[idx % colorGradients.length];

            return (
              <div
                key={r.id || idx}
                className="p-4 rounded-2xl bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-xs text-fg truncate">
                    {r.service?.displayName || r.service?.name}
                  </div>
                  <span className="text-xs font-mono font-bold text-[#D8EC8D] shrink-0">
                    {pct}%
                  </span>
                </div>

                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${activeGradient} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(pct, totalUnits > 0 && deliveredUnits > 0 ? 5 : 2)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-0.5">
                  <span>
                    <strong className="text-fg">{formatIndianNumber(deliveredUnits)}</strong> / {formatIndianNumber(totalUnits)}
                  </span>
                  <span>{formatIndianNumber(r.quantityPerPost || 0)} / day</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Day-by-Day Delivery Stage Stepper */}
        {(() => {
          const durationDays = pkg.rules?.[0]?.maxPosts || 5;
          const daysArray = Array.from({ length: durationDays }, (_, i) => i + 1);

          // Calculate completed days based on executions completed
          const runsPerDay = Math.max(1, Math.floor(totalExecs / durationDays));
          const completedDays = Math.floor(completedExecs / runsPerDay);

          return (
            <div className="p-4 rounded-2xl bg-white/[0.015] border border-slate-200/60 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-400 uppercase tracking-wider text-[10px]">
                  Daily Pacing Timeline
                </span>
                <span className="text-[11px] font-mono text-[#D8EC8D]">
                  Day {Math.min(durationDays, completedDays + 1)} of {durationDays} Active
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 pt-1">
                {daysArray.map((dayNum) => {
                  const isPast = dayNum <= completedDays;
                  const isCurrent = dayNum === completedDays + 1 && completedDays < durationDays;
                  const isFuture = dayNum > completedDays + 1;

                  const nextTodayExec = executions.find((e: any) => e.status === "SCHEDULED" && e.executeAt);
                  const isDelayed = nextTodayExec?.executeAt && (new Date(nextTodayExec.executeAt).getTime() < Date.now() - 15 * 60 * 1000);
                  const todayTimeStr = nextTodayExec?.executeAt
                    ? new Date(nextTodayExec.executeAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
                    : null;

                  return (
                    <div
                      key={dayNum}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isPast
                          ? "bg-emerald-500/10 border-emerald-500/30 text-success"
                          : isCurrent
                          ? isDelayed
                            ? "bg-amber-500/10 border-amber-500/40 text-warning shadow-sm shadow-amber-500/10"
                            : "bg-accent/10 border-accent/40 text-[#D8EC8D] shadow-sm shadow-accent/10"
                          : "bg-white/[0.02] border-slate-200/60 dark:border-white/5 text-slate-500"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 mb-1">
                        {isPast ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        ) : isCurrent ? (
                          isDelayed ? (
                            <Clock className="w-3.5 h-3.5 text-warning" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          )
                        ) : (
                          <Clock className="w-3 h-3 text-slate-500" />
                        )}
                        <span className="text-xs font-bold font-mono">Day {dayNum}</span>
                      </div>
                      <div className="text-[10px] font-mono">
                        {isPast
                          ? "Completed"
                          : isCurrent
                          ? isDelayed
                            ? "Delayed"
                            : "Active Today"
                          : "Scheduled"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </GlassCard>

      {/* TARGET MEDIA SUMMARY CARD (When Slot is Already Attached) */}
      {pkg.status === "ACTIVE" && pkg.slots && pkg.slots.length > 0 && pkg.slots[0].targetUrl && (
        <GlassCard className="p-6 md:p-8 rounded-3xl border-border space-y-4 bg-white/[0.02]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-accent/15 text-[#D8EC8D] flex items-center justify-center shrink-0">
                <PlatformIcon platform={pkg.platform || "instagram"} size={22} />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                  Active Campaign Target
                </div>
                <div className="font-mono text-sm font-bold text-fg truncate max-w-xl">
                  {pkg.slots[0].targetUrl}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(pkg.slots[0].targetUrl);
                  setNotification({ type: "success", message: "Link copied to clipboard!" });
                }}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-fg-2 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 border border-border transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </button>
              <a
                href={pkg.slots[0].targetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-[#D8EC8D] text-[#131313] text-xs font-bold inline-flex items-center gap-1.5 hover:brightness-105 transition-all shadow-sm"
              >
                <span>View Reel</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60 dark:border-white/5 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#D8EC8D]" />
              <span>Multi-Day Paced Schedule</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#D8EC8D]" />
              <span>Staggered Metric Sequencing</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#D8EC8D]" />
              <span>1 Active Delivery Guard per Target</span>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ACTIVE PACKAGE CARD: START FLOW WITH LINK PREVIEW (For Unattached Retainers) */}
      {pkg.status === "ACTIVE" && (!pkg.slots || pkg.slots.length === 0 || !pkg.slots[0]?.targetUrl) && (
        <GlassCard className="p-6 md:p-8 rounded-3xl border-border space-y-6 bg-white/[0.02]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent/15 text-[#D8EC8D] flex items-center justify-center">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-fg">Start Delivery for New Post</h2>
                <p className="text-xs text-slate-400">
                  Paste the post or reel link below to configure quantity, interval, and start drip delivery.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-500 self-start sm:self-auto">
              Per-post quota applies
            </span>
          </div>

          {/* Link Box Input with Direct Paste & Clear Buttons */}
          <form onSubmit={handlePreviewPost} className="relative">
            <div className="relative flex items-center">
              <div className="absolute left-4 pointer-events-none text-slate-400">
                <PlatformIcon platform={pkg.platform || "instagram"} size={20} />
              </div>
              <input
                type="url"
                required
                placeholder={`https://${pkg.platform || "instagram"}.com/p/... or /reel/...`}
                value={postLink}
                onChange={(e) => {
                  setPostLink(e.target.value);
                  setPreviewData(null);
                  setPreviewError(null);
                }}
                className="w-full bg-slate-100 dark:bg-black/40 border border-border rounded-2xl pl-12 pr-44 py-3.5 text-sm text-fg font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#D8EC8D] focus:ring-1 focus:ring-[#D8EC8D]/50 transition-all shadow-inner"
              />
              <div className="absolute right-2 flex items-center gap-2">
                {!postLink && (
                  <button
                    type="button"
                    onClick={handlePasteLink}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-fg-2 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-200/60 dark:border-white/5"
                    title="Paste from clipboard"
                  >
                    <Clipboard className="w-3.5 h-3.5 text-[#D8EC8D]" />
                    <span>Paste</span>
                  </button>
                )}
                {postLink && (
                  <button
                    type="button"
                    onClick={() => {
                      setPostLink("");
                      setPreviewData(null);
                      setPreviewError(null);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title="Clear"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={previewLoading || !postLink.trim()}
                  className="px-5 py-2 rounded-xl bg-[#D8EC8D] text-[#131313] font-bold text-xs hover:brightness-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  {previewLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Preview Post</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 pl-1">
              Supports Instagram Reels, Posts, Carousels, and IGTV. We distribute likes & views across multiple days.
            </p>
          </form>

          {/* Preview Error Banner */}
          {previewError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
                <span>{previewError.message}</span>
              </div>
              <span className="font-mono text-[10px] text-danger/70">Ref: {previewError.requestId}</span>
            </div>
          )}

          {/* Preview Configuration Section (zero side effects) */}
          {previewData && (
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-border space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200/60 dark:border-white/5">
                <div>
                  <div className="text-xs text-slate-400">Target Media Key</div>
                  <div className="text-sm font-mono font-bold text-fg">{previewData.mediaKey}</div>
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
                <div className="text-xs font-semibold text-fg-2">
                  Select Services to Deliver for this Post:
                </div>

                <div className="space-y-3">
                  {previewData.rules?.map((rule: any) => {
                    const maxAllowed = rule.maxQtyPerPost ?? rule.maxQuantity ?? rule.maxQty ?? rule.defaultQuantity ?? 10000;
                    const minAllowed = rule.minQty ?? rule.minQuantity ?? 10;
                    const sel = ruleSelections[rule.ruleId] || {
                      enabled: false,
                      quantity: rule.defaultQuantity || maxAllowed,
                      deliveryWindowMin: rule.deliveryWindowMin || 1440,
                    };
                    const isExhausted = rule.remainingPosts <= 0;

                    return (
                      <div
                        key={rule.ruleId}
                        className={`p-4 rounded-xl border transition-all ${
                          sel.enabled
                            ? "bg-[#D8EC8D]/5 border-accent/30"
                            : "bg-white/[0.01] border-slate-200/60 dark:border-white/5 opacity-60"
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
                              className="w-4 h-4 rounded text-[#D8EC8D] focus:ring-0 bg-slate-100 dark:bg-black/40 border-slate-300 dark:border-white/20"
                            />
                            <div>
                              <div className="text-sm font-medium text-fg">{rule.serviceName}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                Quota: {rule.usedCount} / {rule.maxPosts} posts used (
                                <span className={isExhausted ? "text-danger" : "text-success"}>
                                  {rule.remainingPosts} remaining
                                </span>
                                )
                              </div>
                            </div>
                          </label>

                          {/* Per-Rule Quantity, Trigger Runs, and Interval Gap Controls */}
                          {sel.enabled && (
                            <div className="flex flex-wrap items-center gap-4 text-xs font-mono mt-3 pt-3 border-t border-slate-200/60 dark:border-white/5">
                              <div>
                                <label className="text-[10px] uppercase text-slate-500 block mb-1">
                                  Quantity (max {formatIndianNumber(maxAllowed)})
                                </label>
                                <input
                                  type="number"
                                  min={minAllowed}
                                  max={maxAllowed}
                                  value={sel.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || minAllowed;
                                    setRuleSelections((prev) => ({
                                      ...prev,
                                      [rule.ruleId]: { ...sel, quantity: val },
                                    }));
                                  }}
                                  className="w-28 bg-white/[0.04] border border-border rounded-lg px-2.5 py-1.5 text-xs text-fg"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] uppercase text-slate-500 block mb-1">
                                  Trigger Runs
                                </label>
                                <select
                                  value={sel.runsCount || 1}
                                  onChange={(e) => {
                                    const runs = parseInt(e.target.value, 10) || 1;
                                    setRuleSelections((prev) => ({
                                      ...prev,
                                      [rule.ruleId]: { ...sel, runsCount: runs },
                                    }));
                                  }}
                                  className="bg-slate-100 dark:bg-[#1e2315] border border-border rounded-lg px-2.5 py-1.5 text-xs text-fg font-mono"
                                >
                                  <option value={1}>1 Run (Standard 100%)</option>
                                  <option value={2}>2 Runs (50% each)</option>
                                  <option value={3}>3 Runs (Balanced)</option>
                                  <option value={4}>4 Runs (25% each)</option>
                                  <option value={5}>5 Runs (Drip)</option>
                                  <option value={8}>8 Runs (Extended)</option>
                                  <option value={10}>10 Runs (Ultra Drip)</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-[10px] uppercase text-slate-500 block mb-1">
                                  Interval Gap
                                </label>
                                <select
                                  value={sel.intervalMinutes || 120}
                                  onChange={(e) => {
                                    const gap = parseInt(e.target.value, 10) || 120;
                                    setRuleSelections((prev) => ({
                                      ...prev,
                                      [rule.ruleId]: { ...sel, intervalMinutes: gap },
                                    }));
                                  }}
                                  className="bg-slate-100 dark:bg-[#1e2315] border border-border rounded-lg px-2.5 py-1.5 text-xs text-fg font-mono"
                                >
                                  <option value={15}>Every 15 Minutes</option>
                                  <option value={30}>Every 30 Minutes</option>
                                  <option value={60}>Every 1 Hour</option>
                                  <option value={120}>Every 2 Hours</option>
                                  <option value={360}>Every 6 Hours</option>
                                  <option value={720}>Every 12 Hours</option>
                                  <option value={1440}>Every 24 Hours (Daily)</option>
                                  <option value={2880}>Every 48 Hours (2 Days)</option>
                                </select>
                              </div>

                              <div className="w-full text-[11px] text-[#D8EC8D]/80 flex items-center gap-1.5 mt-0.5">
                                <span>⚡ Delivery Plan:</span>
                                <span className="font-semibold">
                                  {sel.runsCount || 1} run(s) of ~{Math.floor(sel.quantity / (sel.runsCount || 1))} units
                                </span>
                                <span>• Spaced every {(sel.intervalMinutes || 120) >= 60 ? `${(sel.intervalMinutes || 120) / 60} hour(s)` : `${sel.intervalMinutes || 120} min`}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Extra Platform Services (Reach, Impressions, Shares, Saves, Comments) */}
              {Array.isArray(previewData.availableExtraServices) && previewData.availableExtraServices.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#D8EC8D] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Boost Post with Extra Platform Add-ons (Reach, Shares, Saves, etc.)</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Deducted from wallet balance</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {previewData.availableExtraServices.map((service: any) => {
                      const extraSel = extraSelections[service.id] || {
                        enabled: false,
                        quantity: service.minQty || 100,
                        runsCount: 1,
                        intervalMinutes: 120,
                      };
                      const estCost = ((extraSel.quantity * service.ratePer1000) / 1000).toFixed(2);

                      return (
                        <div
                          key={service.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            extraSel.enabled
                              ? "bg-accent/10 border-[#D8EC8D]/40 shadow-sm"
                              : "bg-white/[0.01] border-slate-200/60 dark:border-white/5 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <label className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={extraSel.enabled}
                                onChange={(e) =>
                                  setExtraSelections((prev) => ({
                                    ...prev,
                                    [service.id]: { ...extraSel, enabled: e.target.checked },
                                  }))
                                }
                                className="w-4 h-4 mt-0.5 rounded text-[#D8EC8D] focus:ring-0 bg-slate-100 dark:bg-black/40 border-slate-300 dark:border-white/20"
                              />
                              <div>
                                <div className="text-xs font-bold text-fg leading-tight">
                                  {service.displayName || service.name}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  ₹{service.ratePer1000.toFixed(2)} / 1K • Min {service.minQty}
                                </div>
                              </div>
                            </label>

                            {extraSel.enabled && (
                              <span className="text-xs font-mono font-bold text-[#D8EC8D] bg-slate-100 dark:bg-black/40 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-white/5">
                                ₹{estCost}
                              </span>
                            )}
                          </div>

                          {extraSel.enabled && (
                            <div className="grid grid-cols-3 gap-2 text-xs font-mono mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/5">
                              <div>
                                <label className="text-[9px] uppercase text-slate-500 block mb-0.5">Qty</label>
                                <input
                                  type="number"
                                  min={service.minQty}
                                  max={service.maxQty}
                                  value={extraSel.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || service.minQty;
                                    setExtraSelections((prev) => ({
                                      ...prev,
                                      [service.id]: { ...extraSel, quantity: val },
                                    }));
                                  }}
                                  className="w-full bg-white/[0.04] border border-border rounded-lg px-2 py-1 text-xs text-fg"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] uppercase text-slate-500 block mb-0.5">Runs</label>
                                <select
                                  value={extraSel.runsCount || 1}
                                  onChange={(e) => {
                                    const runs = parseInt(e.target.value, 10) || 1;
                                    setExtraSelections((prev) => ({
                                      ...prev,
                                      [service.id]: { ...extraSel, runsCount: runs },
                                    }));
                                  }}
                                  className="w-full bg-slate-100 dark:bg-[#1e2315] border border-border rounded-lg px-2 py-1 text-xs text-fg font-mono"
                                >
                                  <option value={1}>1 Run</option>
                                  <option value={2}>2 Runs</option>
                                  <option value={3}>3 Runs</option>
                                  <option value={4}>4 Runs</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] uppercase text-slate-500 block mb-0.5">Interval</label>
                                <select
                                  value={extraSel.intervalMinutes || 120}
                                  onChange={(e) => {
                                    const gap = parseInt(e.target.value, 10) || 120;
                                    setExtraSelections((prev) => ({
                                      ...prev,
                                      [service.id]: { ...extraSel, intervalMinutes: gap },
                                    }));
                                  }}
                                  className="w-full bg-slate-100 dark:bg-[#1e2315] border border-border rounded-lg px-2 py-1 text-xs text-fg font-mono"
                                >
                                  <option value={30}>30 min</option>
                                  <option value={60}>1 hour</option>
                                  <option value={120}>2 hours</option>
                                  <option value={360}>6 hours</option>
                                  <option value={1440}>1 day</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Consent and Compliance Rules */}
              <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-white/5">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#D8EC8D] focus:ring-0 bg-slate-100 dark:bg-black/40 border-slate-300 dark:border-white/20 shrink-0"
                  />
                  <span>
                    I confirm that I understand platform rules and delivery terms. We do not verify account ownership.
                  </span>
                </label>
              </div>

              {/* Start Button & Wallet Balance Summary */}
              {(() => {
                const totalExtraCost = Object.entries(extraSelections)
                  .filter(([_, s]) => s.enabled)
                  .reduce((acc, [serviceId, s]) => {
                    const svc = previewData.availableExtraServices?.find((x: any) => x.id === serviceId);
                    return acc + (svc ? (s.quantity * svc.ratePer1000) / 1000 : 0);
                  }, 0);

                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div>
                      {totalExtraCost > 0 && (
                        <div className="text-xs font-mono text-fg-2">
                          Wallet Add-on Charge:{" "}
                          <span className="font-bold text-[#D8EC8D]">₹{totalExtraCost.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewData(null)}
                        className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-fg-2 font-semibold text-xs transition-all"
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
                );
              })()}
            </div>
          )}
        </GlassCard>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white/[0.03] border border-border rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("timeline")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2.5 ${
            activeTab === "timeline"
              ? "bg-[#D8EC8D] text-[#131313] shadow-md shadow-[#D8EC8D]/15 font-bold"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>Campaign Services</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === "timeline"
                ? "bg-slate-100 dark:bg-black/20 text-[#131313]"
                : "bg-white/10 text-fg-2"
            }`}
          >
            {pkg.rules?.length || 0}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("triggers")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2.5 ${
            activeTab === "triggers"
              ? "bg-[#D8EC8D] text-[#131313] shadow-md shadow-[#D8EC8D]/15 font-bold"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Posts Delivered</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === "triggers"
                ? "bg-slate-100 dark:bg-black/20 text-[#131313]"
                : "bg-white/10 text-fg-2"
            }`}
          >
            {triggers.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("executions")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2.5 ${
            activeTab === "executions"
              ? "bg-[#D8EC8D] text-[#131313] shadow-md shadow-[#D8EC8D]/15 font-bold"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Delivery Batches</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === "executions"
                ? "bg-slate-100 dark:bg-black/20 text-[#131313]"
                : "bg-white/10 text-fg-2"
            }`}
          >
            {executions.length}
          </span>
        </button>
      </div>

      {/* TAB 1: PACKAGE RULES OVERVIEW */}
      {activeTab === "timeline" && (
        <section className="space-y-4">
          <div className="glass-panel overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/20">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-white/[0.03] text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                    <th className="py-3.5 px-4 font-semibold">Service Details</th>
                    <th className="py-3.5 px-4 font-semibold">Total Quantity</th>
                    <th className="py-3.5 px-4 font-semibold">Daily Pace</th>
                    <th className="py-3.5 px-4 font-semibold">Rate</th>
                    <th className="py-3.5 px-4 font-semibold">Total Charge</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Delivery Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pkg.rules?.map((r: any) => {
                    const totalUnits = (r.quantityPerPost || 0) * (r.maxPosts || 1);
                    return (
                      <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-sans font-medium text-fg text-xs">
                            {r.service?.displayName || r.service?.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono capitalize flex items-center gap-1.5 mt-0.5">
                            <span>{r.service?.platform || pkg.platform || "Instagram"}</span>
                            <span>•</span>
                            <span>Paced Drip</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-fg text-xs font-semibold">
                          {formatIndianNumber(totalUnits)} units
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#D8EC8D] text-xs font-semibold">
                          {formatIndianNumber(r.quantityPerPost || 0)} / day
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400 text-xs">
                          ₹{Number(r.rateSnapshot || 0).toFixed(2)}
                          <span className="text-[10px] text-slate-500 font-normal"> / 1k</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-fg font-bold text-xs">
                          ₹{Number(r.reserve || r.unitCharge * (r.maxPosts || 1)).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-success border border-emerald-500/20">
                            <Check className="w-3 h-3 text-success" />
                            <span>Active</span>
                          </span>
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

      {/* TAB 2: TRIGGERED POSTS TABLE */}
      {activeTab === "triggers" && (
        <section className="space-y-4">
          {triggers.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white/[0.02] border border-slate-200/60 dark:border-white/5 text-center text-slate-400 text-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-border mx-auto flex items-center justify-center text-slate-400">
                <Film className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-fg">No posts started for this package yet</div>
              <div className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Paste your post or reel link above to schedule automated drip delivery for your media.
              </div>
            </div>
          ) : (
            <div className="glass-panel overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-white/[0.03] text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                      <th className="py-3.5 px-4 font-semibold">Media Key</th>
                      <th className="py-3.5 px-4 font-semibold">Target Link</th>
                      <th className="py-3.5 px-4 font-semibold">Drip Runs</th>
                      <th className="py-3.5 px-4 font-semibold">Initiated Date</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {triggers.map((trig) => (
                      <tr key={trig.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-bold text-fg bg-white/5 px-2.5 py-1 rounded-lg border border-border">
                            {trig.mediaKey}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-fg-2 max-w-[280px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-mono text-xs text-fg-2" title={trig.url}>
                              {trig.url}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(trig.url);
                              }}
                              title="Copy URL"
                              className="text-slate-500 hover:text-white p-1 rounded transition-colors"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold font-mono bg-accent/10 text-[#D8EC8D] border border-accent/20">
                            <Layers className="w-3 h-3" />
                            <span>{trig.executions?.length || 0} run(s)</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-fg-2 font-mono text-xs">
                          {new Date(trig.createdAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {pkg.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTriggerForSwap(trig);
                                  setSwapNewUrl(trig.url);
                                  setSwapModalOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 border border-border transition-all hover:border-white/20"
                              >
                                <Link2 className="w-3.5 h-3.5 text-[#D8EC8D]" />
                                <span>Swap Link</span>
                              </button>
                            )}
                            <a
                              href={trig.url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-accent/10 hover:bg-accent/20 text-[#D8EC8D] text-xs font-semibold inline-flex items-center gap-1.5 border border-accent/20 transition-all"
                            >
                              <span>Open Post</span>
                              <ExternalLink className="w-3.5 h-3.5" />
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
            <div className="p-12 rounded-3xl bg-white/[0.02] border border-slate-200/60 dark:border-white/5 text-center text-slate-400 text-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-border mx-auto flex items-center justify-center text-slate-400">
                <Layers className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-fg">No drip executions scheduled yet</div>
              <div className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Executions are created when you configure recurring scheduled drips or start post delivery.
              </div>
            </div>
          ) : (
            <div className="glass-panel overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-white/[0.03] text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                      <th className="py-3.5 px-4 font-semibold">Batch #</th>
                      <th className="py-3.5 px-4 font-semibold">Service</th>
                      <th className="py-3.5 px-4 font-semibold">Target Link</th>
                      <th className="py-3.5 px-4 font-semibold">Quantity</th>
                      <th className="py-3.5 px-4 font-semibold">Charge</th>
                      <th className="py-3.5 px-4 font-semibold">Status</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Action / Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {executions.map((e) => (
                      <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-fg text-xs">
                          <span className="px-2 py-0.5 rounded bg-white/5 text-fg-2">
                            #{String(e.seq).padStart(2, "0")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-sans font-medium text-fg text-xs">
                            {e.rule?.service?.displayName || e.rule?.service?.name || "Service"}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono capitalize">
                            Paced Delivery
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 max-w-[180px]">
                          <span className="truncate block font-mono text-xs text-fg-2" title={e.targetUrl || pkg.slots?.[0]?.targetUrl}>
                            {e.targetUrl || pkg.slots?.[0]?.targetUrl || "—"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-fg font-bold text-xs">
                          {formatIndianNumber(e.quantity)}
                          {e.order?.remains !== undefined && e.order?.remains !== null && (
                            <div className="mt-0.5 text-[10px] font-normal text-slate-400">
                              Remains: {formatIndianNumber(e.order.remains)}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#D8EC8D] font-bold text-xs">
                          ₹{Number(e.allocatedCharge).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5">
                            {(() => {
                              const isToday = Boolean(e.executeAt && new Date(e.executeAt).toDateString() === new Date().toDateString());
                              const isScheduled = e.status === "SCHEDULED";
                              const isOverdue = isScheduled && e.executeAt && new Date(e.executeAt).getTime() < Date.now() - 15 * 60 * 1000;
                              // For executions scheduled on current day, they are actively delivering today in intraday micro-batches!
                              const isTodayActive = isScheduled && isToday;

                              return (
                                <>
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold w-fit ${
                                      e.status === "COMPLETED"
                                        ? "bg-emerald-500/15 text-success border border-emerald-500/20"
                                        : e.status === "DISPATCHED" || e.status === "PROCESSING"
                                        ? "bg-amber-500/15 text-warning border border-amber-500/20"
                                        : isTodayActive
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                        : isOverdue
                                        ? "bg-amber-500/15 text-warning border border-amber-500/20"
                                        : isScheduled
                                        ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
                                        : e.status === "PARTIAL"
                                        ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                                        : e.status === "FAILED"
                                        ? "bg-rose-500/15 text-danger border border-rose-500/20"
                                        : "bg-slate-500/15 text-slate-400 border border-slate-500/20"
                                    }`}
                                  >
                                    {e.status === "COMPLETED" ? (
                                      <Check className="w-3 h-3 text-success" />
                                    ) : e.status === "PROCESSING" || e.status === "DISPATCHED" ? (
                                      <RefreshCw className="w-3 h-3 animate-spin text-warning" />
                                    ) : isTodayActive ? (
                                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                                    ) : isScheduled ? (
                                      isOverdue ? (
                                        <Clock className="w-3 h-3 text-warning" />
                                      ) : (
                                        <Clock className="w-3 h-3 text-cyan-400" />
                                      )
                                    ) : e.status === "FAILED" ? (
                                      <XCircle className="w-3 h-3 text-danger" />
                                    ) : null}
                                    <span>
                                      {e.status === "COMPLETED"
                                        ? "COMPLETED"
                                        : e.status === "PROCESSING" || e.status === "DISPATCHED"
                                        ? e.status
                                        : isTodayActive
                                        ? "IN PROGRESS"
                                        : isOverdue
                                        ? "DELAYED"
                                        : e.status}
                                    </span>
                                  </span>
                                  {isScheduled && e.executeAt && (
                                    <span className={`text-[10px] font-mono pl-0.5 ${isTodayActive ? "text-emerald-400/80 font-medium" : "text-slate-400"}`}>
                                      {formatExecutionSchedule(e.executeAt)}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {(e.status === "FAILED" || e.status === "PARTIAL") ? (
                            <button
                              type="button"
                              disabled={retryingExecutionId === e.id}
                              onClick={() => {
                                setRetryModalExecution(e);
                                setRetryTargetUrl(e.targetUrl || pkg?.targetUrl || pkg?.handle || "");
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#D8EC8D] text-[#131313] hover:brightness-105 text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${retryingExecutionId === e.id ? "animate-spin" : ""}`} />
                              <span>{retryingExecutionId === e.id ? "Retrying..." : "Retry Run"}</span>
                            </button>
                          ) : (e.status === "DISPATCHED" || e.status === "PROCESSING") ? (
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                title="Check live status from provider"
                                disabled={syncingExecutionId === e.id}
                                onClick={() => handleSyncExecution(e.id)}
                                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer text-[11px] inline-flex items-center gap-1 border border-border"
                              >
                                <RefreshCw className={`w-3 h-3 ${syncingExecutionId === e.id ? "animate-spin text-[#D8EC8D]" : ""}`} />
                                <span className="hidden sm:inline">Sync</span>
                              </button>
                              <button
                                type="button"
                                title="Resolve stalled run and unblock schedule"
                                disabled={resolvingExecutionId === e.id}
                                onClick={() => setResolveModalExecution(e)}
                                className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-warning text-[11px] font-semibold transition-colors cursor-pointer border border-amber-500/20 inline-flex items-center gap-1"
                              >
                                <Zap className="w-3 h-3" />
                                <span>Resolve</span>
                              </button>
                            </div>
                          ) : e.childOrderId ? (
                            <Link
                              href="/orders"
                              className="px-2.5 py-1 rounded-md bg-accent/10 hover:bg-accent/20 text-[11px] font-mono text-[#D8EC8D] font-semibold border border-accent/20 transition-all inline-block"
                            >
                              #{e.childOrderId.slice(0, 8)}
                            </Link>
                          ) : (
                            <span className="text-slate-500 font-mono text-xs">Queued</span>
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
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-border space-y-5 bg-white dark:bg-[#171717]">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-danger">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-fg">Cancel Remaining Runs?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cancelling will stop all upcoming executions and refund the unused reserve back to your wallet.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-slate-200/60 dark:border-white/5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Undispatched runs:</span>
                <span className="font-mono text-fg font-bold">{scheduledExecutions.length}</span>
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
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-fg font-medium text-xs transition-colors"
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
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-border space-y-5 bg-white dark:bg-[#171717] shadow-2xl">
            <div className="flex items-center gap-3 text-warning">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-fg">Report a Problem</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1.5">Issue Category</label>
                <select
                  value={problemIssue}
                  onChange={(e) => setProblemIssue(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-border text-fg text-xs font-mono focus:outline-none focus:border-[#D8EC8D]"
                >
                  <option value="Execution delayed or missed" className="bg-white dark:bg-[#1c1c1c] text-fg">Execution delayed or missed</option>
                  <option value="Quantity drop or discrepancy" className="bg-white dark:bg-[#1c1c1c] text-fg">Quantity drop or discrepancy</option>
                  <option value="Post URL was not detected" className="bg-white dark:bg-[#1c1c1c] text-fg">Post URL was not detected</option>
                  <option value="Other delivery issue" className="bg-white dark:bg-[#1c1c1c] text-fg">Other delivery issue</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1.5">Description & Details</label>
                <textarea
                  rows={4}
                  value={problemDesc}
                  onChange={(e) => setProblemDesc(e.target.value)}
                  placeholder="Provide any details about the discrepancy..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-border text-fg text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#D8EC8D]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProblemModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-fg font-medium text-xs transition-colors"
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
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-border space-y-5 bg-white dark:bg-[#171717] shadow-2xl">
            <div className="flex items-center gap-3 text-[#D8EC8D]">
              <div className="p-2 rounded-xl bg-accent/15 border border-accent/30">
                <FastForward className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-fg">Accelerate Delivery Schedule</h3>
                <p className="text-xs text-slate-400">Compresses remaining run intervals within pace cap.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-slate-200/60 dark:border-white/5 space-y-2 text-xs">
                <div className="text-fg-2 font-medium">Select Compression Factor:</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { factor: 1.25, label: "1.25x (Standard)" },
                    { factor: 1.5, label: "1.50x (Moderate)" },
                    { factor: 2.0, label: "2.00x (Maximum)" },
                  ].map((opt) => (
                    <button
                      key={opt.factor}
                      type="button"
                      onClick={() => setSpeedFactor(opt.factor)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        speedFactor === opt.factor
                          ? "bg-accent/15 border-[#D8EC8D] text-[#D8EC8D] font-bold"
                          : "bg-white/5 border-border text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="text-xs">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-fg-muted leading-relaxed bg-slate-100 dark:bg-black/30 p-3 rounded-xl border border-slate-200/60 dark:border-white/5">
                Remaining scheduled executions will be shifted forward by {speedFactor}x compression. Minimum 15-minute intervals between runs are automatically enforced to stay strictly within platform delivery limits.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSpeedUpModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-fg font-medium text-xs transition-colors"
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
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-border space-y-5 bg-white dark:bg-[#171717] shadow-2xl">
            <div className="flex items-center gap-3 text-fg">
              <div className="p-2 rounded-xl bg-white/10 border border-slate-300 dark:border-white/20 text-[#D8EC8D]">
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
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200/60 dark:border-white/5 text-xs font-mono text-slate-400 truncate">
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
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-border text-fg text-xs font-mono focus:outline-none focus:border-[#D8EC8D]"
                />
              </div>

              <div className="text-[11px] text-fg-muted leading-relaxed bg-slate-100 dark:bg-black/30 p-3 rounded-xl border border-slate-200/60 dark:border-white/5">
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
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-fg font-medium text-xs transition-colors"
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
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-border space-y-5 bg-white dark:bg-[#171717] shadow-2xl">
            <div className="flex items-center gap-3 text-fg">
              <div className="p-2 rounded-xl bg-accent/15 border border-accent/30 text-[#D8EC8D]">
                <Repeat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Renew Package Retainer</h3>
                <p className="text-xs text-slate-400">Extend growth package for another monthly cycle.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-slate-200/60 dark:border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Target Handle:</span>
                  <span className="font-mono text-fg font-bold">@{pkg.handle}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Cycle Duration:</span>
                  <span className="font-mono text-fg font-bold">30 Days</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-200/60 dark:border-white/5">
                  <span>Wallet Charge / Reserve:</span>
                  <span className="font-mono text-[#D8EC8D] font-bold text-sm">
                    ₹{Number(pkg.reserveTotal || pkg.totalCharge).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-fg-muted leading-relaxed bg-slate-100 dark:bg-black/30 p-3 rounded-xl border border-slate-200/60 dark:border-white/5">
                Confirming renewal will deduct ₹{Number(pkg.reserveTotal || pkg.totalCharge).toFixed(2)} from your wallet and provision an active package cycle with all current rule quotas restored.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRenewModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-fg font-medium text-xs transition-colors"
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

      {/* Change Delivery Window Modal (D3 UI) */}
      {rescheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 rounded-3xl border-border space-y-5 bg-white dark:bg-[#171717] shadow-2xl">
            <div className="flex items-center justify-between text-fg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-accent/15 border border-accent/30 text-[#D8EC8D]">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">Change Delivery Window</h3>
                  <p className="text-xs text-slate-400">Reschedule remaining runs to a new window.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Presets */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Window Preset
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: "ANY_TIME", label: "Any time (24/7)" },
                    { key: "DAYTIME", label: "Daytime (09:00 - 21:00)" },
                    { key: "EVENING", label: "Evening (17:00 - 23:00)" },
                    { key: "CUSTOM", label: "Custom Window" },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setReschedulePreset(p.key as any)}
                      className={`py-2 px-2.5 text-xs font-semibold rounded-xl border text-left transition-all ${
                        reschedulePreset === p.key
                          ? "bg-[#D8EC8D] text-black border-[#D8EC8D] font-bold"
                          : "bg-surface-raised border-border text-fg-muted hover:text-fg"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timezone */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Timezone</span>
                <select
                  value={rescheduleTimezone}
                  onChange={(e) => setRescheduleTimezone(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-fg text-xs focus:outline-none"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="UTC">UTC (Universal Time)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                </select>
              </div>

              {/* Error card */}
              {rescheduleError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{rescheduleError.message}</span>
                    <button
                      type="button"
                      onClick={handleFetchReschedulePreview}
                      className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-[10px] font-mono"
                    >
                      Retry
                    </button>
                  </div>
                  {rescheduleError.requestId && (
                    <div className="text-[10px] font-mono text-slate-400">Ref: {rescheduleError.requestId}</div>
                  )}
                </div>
              )}

              {/* Preview Button */}
              {!reschedulePreviewData && (
                <button
                  type="button"
                  disabled={loadingReschedulePreview}
                  onClick={handleFetchReschedulePreview}
                  className="w-full py-2.5 rounded-xl bg-[#D8EC8D] text-black font-semibold text-xs hover:brightness-105 transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  {loadingReschedulePreview ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Computing Schedule...</span>
                    </>
                  ) : (
                    <span>Preview New Schedule</span>
                  )}
                </button>
              )}

              {/* Preview Schedule Changes section */}
              {reschedulePreviewData && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs font-semibold text-fg">
                    <span>Preview Schedule Changes</span>
                    <span className="font-mono text-[#D8EC8D] text-[11px]">
                      {reschedulePreviewData.rescheduledCount || reschedulePreviewData.runs?.length || 0} Runs
                    </span>
                  </div>

                  {reschedulePreviewData.warnings?.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                      {reschedulePreviewData.warnings.join(" ")}
                    </div>
                  )}

                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                    {(reschedulePreviewData.runs || []).map((r: any) => (
                      <div
                        key={r.executionId || r.seq}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface-raised border border-border text-[11px]"
                      >
                        <span className="font-mono text-fg font-medium">Run #{r.seq}</span>
                        <span className="font-mono text-[#D8EC8D] font-semibold">
                          {new Date(r.executeAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: rescheduleTimezone,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setReschedulePreviewData(null)}
                      className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-fg text-xs"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={submittingReschedule}
                      onClick={handleConfirmReschedule}
                      className="flex-1 py-2 rounded-xl bg-[#D8EC8D] text-black font-semibold text-xs hover:brightness-105 transition-all flex items-center justify-center gap-1.5 shadow-md"
                    >
                      {submittingReschedule ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Applying...</span>
                        </>
                      ) : (
                        <span>Confirm Reschedule</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}
      {/* Customer Retry Execution Modal */}
      {retryModalExecution && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-5 sm:p-6 rounded-3xl border-border space-y-4 bg-white dark:bg-[#171717] shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-accent/15 border border-accent/30 text-[#D8EC8D]">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">Retry Execution Run</h3>
                  <p className="text-xs text-slate-400">Re-queue this batch for delivery.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRetryModalExecution(null)}
                className="text-slate-400 hover:text-fg transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span>Run / Service:</span>
                <span className="text-fg font-semibold truncate max-w-[180px]">
                  {retryModalExecution.rule?.service?.displayName || retryModalExecution.rule?.service?.name || "Service"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Quantity:</span>
                <span className="text-fg font-bold">{formatIndianNumber(retryModalExecution.quantity)} units</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-white/5">
                <span>Allocated Value:</span>
                <span className="text-[#D8EC8D] font-bold">₹{Number(retryModalExecution.allocatedCharge).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">
                Target Link (Edit if original link was broken or rejected)
              </label>
              <input
                type="url"
                value={retryTargetUrl}
                onChange={(e) => setRetryTargetUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-black/50 border border-slate-200/80 dark:border-white/10 text-fg text-xs font-mono focus:outline-none focus:border-[#D8EC8D]"
              />
              <p className="text-[10px] text-slate-400">
                If this run was refunded to your wallet upon failure, the allocated value will be deducted upon confirmation.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRetryModalExecution(null)}
                disabled={retryingExecutionId !== null}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-fg font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={retryingExecutionId !== null}
                onClick={() => handleConfirmRetry(retryModalExecution.id, retryTargetUrl)}
                className="flex-1 py-2 rounded-xl bg-[#D8EC8D] text-black font-bold text-xs hover:brightness-105 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {retryingExecutionId === retryModalExecution.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Queuing...</span>
                  </>
                ) : (
                  <span>Confirm Retry</span>
                )}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Customer Resolve Stalled Execution Modal */}
      {resolveModalExecution && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-5 sm:p-6 rounded-3xl border-border space-y-4 bg-white dark:bg-[#171717] shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-warning">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">Resolve Stalled Run</h3>
                  <p className="text-xs text-slate-400">Finalize batch and unblock upcoming schedule.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResolveModalExecution(null)}
                className="text-slate-400 hover:text-fg transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span>Run / Service:</span>
                <span className="text-fg font-semibold truncate max-w-[180px]">
                  {resolveModalExecution.rule?.service?.displayName || resolveModalExecution.rule?.service?.name || "Service"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Target Units:</span>
                <span className="text-fg font-bold">{formatIndianNumber(resolveModalExecution.quantity)} units</span>
              </div>
              {resolveModalExecution.order?.remains !== undefined && (
                <div className="flex items-center justify-between text-slate-400">
                  <span>Undelivered Units:</span>
                  <span className="text-amber-400 font-bold">{formatIndianNumber(resolveModalExecution.order.remains)} units</span>
                </div>
              )}
              <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-white/5">
                <span>Allocated Value:</span>
                <span className="text-[#D8EC8D] font-bold">₹{Number(resolveModalExecution.allocatedCharge).toFixed(2)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              If upstream delivery is taking longer than expected, resolving this run will finalize it as <span className="text-blue-400 font-semibold font-mono">PARTIAL</span>, automatically refund any undelivered balance back to your wallet, and immediately allow tomorrow&apos;s run to dispatch on schedule.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolveModalExecution(null)}
                disabled={resolvingExecutionId !== null}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-fg font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resolvingExecutionId !== null}
                onClick={() => handleConfirmResolve(resolveModalExecution.id)}
                className="flex-1 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/30 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {resolvingExecutionId === resolveModalExecution.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Resolving...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Finalize & Refund</span>
                  </>
                )}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </motion.div>
  );
}
