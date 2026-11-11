"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { PlatformPicker } from "./PlatformPicker";
import { SingleOrderTab } from "./SingleOrderTab";
import { CustomDripTab } from "./CustomDripTab";
import { ComboPackagesTab } from "./ComboPackagesTab";
import { AutoPilotTab } from "./AutoPilotTab";
import { StickySummary } from "./StickySummary";
import { CustomPackageBuilder } from "@/components/customer/CustomPackageBuilder";
import { PackageOrderBuilder } from "@/components/customer/PackageOrderBuilder";
import { GlassCard } from "@/components/shared/GlassCard";
import { getApiBase } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-session";
import {
  Zap,
  Boxes,
  Sparkles,
  Repeat,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clipboard,
  ShieldCheck,
} from "lucide-react";

export type OrderTabKey = "single" | "custom_drip" | "combos" | "autopilot";

export function NewOrderShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, favorites, orders, refreshData } = useCustomer();

  // URL state
  const currentTab = (searchParams?.get("tab") || "single") as OrderTabKey;
  const currentPlatform = (searchParams?.get("platform") || "instagram").toLowerCase();

  // Bootstrap state
  const [bootstrapData, setBootstrapData] = useState<any>(null);
  const [isLoadingBootstrap, setIsLoadingBootstrap] = useState<boolean>(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  // Tab State & Drafts
  const [activeTab, setActiveTab] = useState<OrderTabKey>(currentTab);
  const [selectedPlatform, setSelectedPlatform] = useState<string>(currentPlatform);
  const [quickLinkInput, setQuickLinkInput] = useState<string>("");
  const [consentChecked, setConsentChecked] = useState<boolean>(false);
  const [formResetKey, setFormResetKey] = useState<number>(0);

  // Single Order State for Sticky Summary
  const [orderDetails, setOrderDetails] = useState<{
    service: any;
    targetUrl: string;
    quantity: number;
    ratePer1000: number;
    isDrip: boolean;
    dripRuns: number;
    dripIntervalHours: number;
    customComments?: string[];
    geoCountry?: string;
  } | null>(null);

  // Quoting & Submission
  const [isQuoting, setIsQuoting] = useState<boolean>(false);
  const [quoteStale, setQuoteStale] = useState<boolean>(false);
  const [totalCharge, setTotalCharge] = useState<number>(0);
  const [quoteHash, setQuoteHash] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<{ message: string; requestId?: string } | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);

  // Update URL state without full reload
  const updateUrlState = useCallback(
    (tab: OrderTabKey, platform: string) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("tab", tab);
      params.set("platform", platform);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleTabChange = (tab: OrderTabKey) => {
    setActiveTab(tab);
    updateUrlState(tab, selectedPlatform);
  };

  const handlePlatformChange = (platform: string) => {
    setSelectedPlatform(platform);
    updateUrlState(activeTab, platform);
  };

  // Fetch bootstrap data
  const loadBootstrap = useCallback(async (plat: string) => {
    setIsLoadingBootstrap(true);
    setBootstrapError(null);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiBase}/new-order/bootstrap?platform=${plat.toUpperCase()}`, {
        headers,
      });

      if (!res.ok) {
        throw new Error(`Failed to load configuration (HTTP ${res.status})`);
      }

      const data = await res.json();
      setBootstrapData(data);
    } catch (err: any) {
      setBootstrapError(err.message || "Could not load service catalog.");
    } finally {
      setIsLoadingBootstrap(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap(selectedPlatform);
  }, [selectedPlatform, loadBootstrap]);

  // Quick link auto-detection
  const handleQuickLinkPaste = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuickLinkInput(val);
    if (!val.trim()) return;

    const lower = val.toLowerCase();
    if (lower.includes("instagram.com") && selectedPlatform !== "instagram") {
      handlePlatformChange("instagram");
    } else if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
      if (selectedPlatform !== "youtube") handlePlatformChange("youtube");
    } else if (lower.includes("tiktok.com") && selectedPlatform !== "tiktok") {
      handlePlatformChange("tiktok");
    } else if (lower.includes("x.com") || lower.includes("twitter.com")) {
      if (selectedPlatform !== "x") handlePlatformChange("x");
    } else if (lower.includes("t.me") && selectedPlatform !== "telegram") {
      handlePlatformChange("telegram");
    }
  };

  // Real-time server quoting via POST /orders/quote
  const fetchQuote = useCallback(async () => {
    if (!orderDetails?.service?.id || !orderDetails.quantity) return;
    setIsQuoting(true);
    setOrderError(null);

    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const quoteBody = {
        serviceId: orderDetails.service.id,
        quantity: orderDetails.quantity,
        target: orderDetails.targetUrl || "https://example.com/placeholder",
        isDripFeed: orderDetails.isDrip,
        dripRuns: orderDetails.dripRuns,
        dripInterval: orderDetails.dripIntervalHours * 60,
      };

      const res = await fetch(`${apiBase}/orders/quote`, {
        method: "POST",
        headers,
        body: JSON.stringify(quoteBody),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to calculate quote.");
      }

      const q = await res.json();
      setTotalCharge(Number(q.charge || q.totalCharge || 0));
      setQuoteHash(q.quoteHash || "");
      setQuoteStale(false);
    } catch (err: any) {
      setTotalCharge(Math.ceil((orderDetails.quantity * Number(orderDetails.ratePer1000 || 50)) / 1000));
      setQuoteStale(false);
    } finally {
      setIsQuoting(false);
    }
  }, [orderDetails]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  // Submit Order via POST /orders with Idempotency-Key
  const handleSubmitOrder = async () => {
    if (!orderDetails?.service?.id || !orderDetails?.targetUrl) {
      setOrderError({ message: "Please provide a valid destination link." });
      return;
    }
    if (!consentChecked) {
      setOrderError({ message: "Please check the consent box to proceed." });
      return;
    }

    setIsSubmitting(true);
    setOrderError(null);

    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const idempotencyKey = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const payload = {
        serviceId: orderDetails.service.id,
        target: orderDetails.targetUrl.trim(),
        quantity: orderDetails.quantity,
        comments: orderDetails.customComments ? orderDetails.customComments.join("\n") : undefined,
        isDripFeed: orderDetails.isDrip,
        dripRuns: orderDetails.isDrip ? orderDetails.dripRuns : undefined,
        runs: orderDetails.isDrip ? orderDetails.dripRuns : undefined,
        dripInterval: orderDetails.isDrip ? orderDetails.dripIntervalHours * 60 : undefined,
        interval: orderDetails.isDrip ? orderDetails.dripIntervalHours * 60 : undefined,
        idempotencyKey,
      };

      const res = await fetch(`${apiBase}/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const reqId = res.headers.get("x-request-id") || undefined;
        throw { message: json.message || "Failed to place order.", requestId: reqId };
      }

      handleOrderSuccess(json, "single");
    } catch (err: any) {
      setOrderError({
        message: err.message || "An unexpected error occurred while placing order.",
        requestId: err.requestId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Comprehensive reset and redirection upon successful order placement
  const handleOrderSuccess = (orderResult: any, orderKind?: "single" | "package") => {
    setOrderDetails(null);
    setConsentChecked(false);
    setQuickLinkInput("");
    setOrderSuccess(orderResult);
    setOrderError(null);
    setFormResetKey((prev) => prev + 1);

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/new-order");
    }

    if (refreshData) refreshData();

    const isPackage =
      orderKind === "package" ||
      activeTab === "custom_drip" ||
      activeTab === "combos" ||
      activeTab === "autopilot" ||
      Boolean(orderResult?.packageId || orderResult?.package?.id);

    const packageId = orderResult?.packageId || orderResult?.package?.id;
    const orderId = orderResult?.id || orderResult?.orderId || "";

    if (activeTab === "custom_drip" || (packageId && packageId.startsWith("pkg_drip_"))) {
      router.push(`/orders?customOrderPlaced=true${packageId ? `&orderId=${encodeURIComponent(packageId)}` : ""}`);
    } else if (isPackage) {
      router.push(`/packages?packagePlaced=true${packageId ? `&packageId=${encodeURIComponent(packageId)}` : ""}`);
    } else {
      router.push(`/orders?orderPlaced=true${orderId ? `&orderId=${encodeURIComponent(orderId)}` : ""}`);
    }
  };

  const walletBalance = Number(user?.balance || bootstrapData?.balance || 0);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* 1. Four Main Tabs Navigation */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-black/40 border border-slate-200/80 dark:border-white/5 backdrop-blur-xl overflow-x-auto scrollbar-none shadow-xs">
        <button
          type="button"
          onClick={() => handleTabChange("single")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap select-none ${
            activeTab === "single"
              ? "bg-[#D8EC8D] text-[#171e00] shadow-[0_0_20px_rgba(216,236,141,0.35)]"
              : "text-fg-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]"
          }`}
        >
          <Zap className="w-3.5 h-3.5 shrink-0" />
          <span>Single Order</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("custom_drip")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap select-none ${
            activeTab === "custom_drip"
              ? "bg-[#D8EC8D] text-[#171e00] shadow-[0_0_20px_rgba(216,236,141,0.35)]"
              : "text-fg-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>Custom Package</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("combos")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap select-none ${
            activeTab === "combos"
              ? "bg-[#D8EC8D] text-[#171e00] shadow-[0_0_20px_rgba(216,236,141,0.35)]"
              : "text-fg-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]"
          }`}
        >
          <Boxes className="w-3.5 h-3.5 shrink-0" />
          <span>Combo Packages</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("autopilot")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap select-none ${
            activeTab === "autopilot"
              ? "bg-[#D8EC8D] text-[#171e00] shadow-[0_0_20px_rgba(216,236,141,0.35)]"
              : "text-fg-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]"
          }`}
        >
          <Repeat className="w-3.5 h-3.5 shrink-0" />
          <span>Auto-Pilot</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-normal">
            Beta
          </span>
        </button>
      </div>

      {/* 2. Platform Picker Strip & Quick Link Detection Bar (for Single, Custom Drip & Combo Packages) */}
      {activeTab !== "autopilot" && (
        <>
          <PlatformPicker
            platforms={bootstrapData?.enabledPlatforms || ["INSTAGRAM", "YOUTUBE", "TIKTOK", "X", "TELEGRAM"]}
            selectedPlatform={selectedPlatform}
            onSelect={handlePlatformChange}
          />

          {/* Quick Link Detection Bar */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200/90 dark:border-white/5 text-xs shadow-sm dark:shadow-none transition-colors">
            <Clipboard className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1.5" />
            <input
              type="text"
              value={quickLinkInput}
              onChange={handleQuickLinkPaste}
              placeholder="Paste profile or post link here to identify platform..."
              className="w-full bg-transparent text-fg text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none font-mono"
            />
            {quickLinkInput && (
              <button
                type="button"
                onClick={() => setQuickLinkInput("")}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                title="Clear link input"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setQuickLinkInput("");
                setOrderDetails(null);
                setConsentChecked(false);
                setOrderSuccess(null);
                setOrderError(null);
                setFormResetKey((prev) => prev + 1);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors flex items-center gap-1 shrink-0"
              title="Reset order form"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Form</span>
            </button>
          </div>
        </>
      )}

      {/* Success Notification */}
      {orderSuccess && (
        <GlassCard className="p-6 border-[#D8EC8D]/40 bg-[#171e00]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-[#D8EC8D] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-fg font-bold text-sm">Order Dispatched Successfully!</h4>
                <p className="text-xs text-fg-2">
                  Reference: <span className="font-mono text-[#D8EC8D]">#{orderSuccess.id || orderSuccess.orderId}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOrderSuccess(null)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-fg text-xs font-semibold"
            >
              Done
            </button>
          </div>
        </GlassCard>
      )}

      {/* Error Callout with Request ID and Retry */}
      {orderError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{orderError.message}</p>
              {orderError.requestId && (
                <p className="text-[11px] text-red-400 font-mono mt-0.5">
                  Request ID: {orderError.requestId}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSubmitOrder}
            className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold text-xs shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tab Body: Render Active Tab */}
      {activeTab === "single" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full max-w-full">
          {/* Main Left Form Area */}
          <div className="lg:col-span-8 space-y-6 min-w-0 max-w-full">
            <SingleOrderTab
              key={`single-${selectedPlatform}-${formResetKey}`}
              platform={selectedPlatform}
              categories={bootstrapData?.categories || []}
              services={bootstrapData?.services || []}
              durationChips={bootstrapData?.durationChips || [1, 3, 5, 7, 10, 14, 21, 30, 45, 60]}
              favorites={favorites || []}
              recentOrders={orders ? orders.slice(0, 5) : []}
              onOrderDetailsChange={setOrderDetails}
              onSwitchTab={(tab) => handleTabChange(tab as OrderTabKey)}
              prefilledTargetUrl={quickLinkInput}
              isLoading={isLoadingBootstrap}
            />
          </div>

          {/* Sticky Summary Column */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 min-w-0 max-w-full">
            <StickySummary
              serviceName={orderDetails?.service?.displayName || orderDetails?.service?.name || ""}
              targetUrl={orderDetails?.targetUrl || ""}
              quantity={orderDetails?.quantity || 1000}
              ratePer1000={orderDetails?.ratePer1000 || 50}
              totalCharge={totalCharge}
              walletBalance={walletBalance}
              isQuoting={isQuoting}
              isSubmitting={isSubmitting}
              quoteStale={quoteStale}
              onRefreshQuote={fetchQuote}
              onSubmit={handleSubmitOrder}
              consent={consentChecked}
              onConsentChange={setConsentChecked}
              dripDetails={
                orderDetails?.isDrip
                  ? {
                      runs: orderDetails.dripRuns,
                      intervalHours: orderDetails.dripIntervalHours,
                    }
                  : undefined
              }
              customCommentsCount={orderDetails?.customComments ? orderDetails.customComments.length : undefined}
            />
          </div>
        </div>
      )}

      {activeTab === "custom_drip" && (
        <CustomDripTab
          key={`drip-${selectedPlatform}-${formResetKey}`}
          platform={selectedPlatform}
          services={bootstrapData?.services || []}
          durationChips={bootstrapData?.durationChips || [1, 3, 5, 7, 10, 14, 21, 30, 45, 60]}
          walletBalance={walletBalance}
          onOrderSuccess={(res) => handleOrderSuccess(res, "package")}
          prefilledTargetUrl={quickLinkInput}
        />
      )}

      {activeTab === "combos" && (
        <ComboPackagesTab
          key={`combos-${selectedPlatform}-${formResetKey}`}
          platform={selectedPlatform}
          walletBalance={walletBalance}
          onOrderSuccess={(res) => handleOrderSuccess(res, "package")}
          prefilledTargetUrl={quickLinkInput}
        />
      )}

      {activeTab === "autopilot" && (
        <AutoPilotTab
          key={`autopilot-${selectedPlatform}-${formResetKey}`}
          platform={selectedPlatform}
          services={bootstrapData?.services || []}
          walletBalance={walletBalance}
          onOrderSuccess={(res) => handleOrderSuccess(res, "package")}
          prefilledTargetUrl={quickLinkInput}
        />
      )}
    </div>
  );
}

