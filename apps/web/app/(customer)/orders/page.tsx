"use client";

import React, { useState, useMemo, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { OrderItem } from "@smm/contracts";
import {
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  PlusCircle,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Bookmark,
  Star,
  Boxes,
  Wallet,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PackageThumbnail } from "@/components/shared/PackageThumbnail";
import { formatOrderId } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { GlassCard } from "@/components/shared/GlassCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { motion } from "framer-motion";
import { getApiBase } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-session";
import { formatIndianNumber } from "@/lib/numberFormat";

// Helper: Determine Package Category
function getPackageCategory(pkg: any): "CUSTOM" | "COMBO" | "AUTOPILOT" {
  if (
    pkg.priceSnapshot?.type === "AUTOPILOT" ||
    pkg.id?.startsWith("pkg_auto_") ||
    pkg.mode === "AUTOPILOT" ||
    pkg.name?.toLowerCase().includes("autopilot")
  ) {
    return "AUTOPILOT";
  }
  if (
    pkg.mode === "TEMPLATE" ||
    pkg.id?.startsWith("pkg_bundle_") ||
    pkg.priceSnapshot?.type === "COMBO" ||
    pkg.name?.toLowerCase().includes("bundle")
  ) {
    return "COMBO";
  }
  return "CUSTOM";
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

function OrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderPlaced = searchParams?.get("orderPlaced") === "true";
  const placedOrderId = searchParams?.get("orderId");

  const { orders, packages, refillOrder, cancelOrder, addFavorite, removeFavorite, favorites, refreshFavorites, user } = useCustomer();

  const [selectedOrderType, setSelectedOrderType] = useState<"ALL" | "SINGLE" | "COMBO" | "CUSTOM" | "AUTOPILOT">("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refillingId, setRefillingId] = useState<string | null>(null);
  const [activeModalOrder, setActiveModalOrder] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Order Problem Report State
  const [orderProblemModalOpen, setOrderProblemModalOpen] = useState(false);
  const [orderProblemIssue, setOrderProblemIssue] = useState("Execution delayed or missed");
  const [orderProblemDesc, setOrderProblemDesc] = useState("");
  const [submittingOrderProblem, setSubmittingOrderProblem] = useState(false);

  // Sub-orders & platform dropdown state
  const [expandedPackageIds, setExpandedPackageIds] = useState<Record<string, boolean>>({});
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  const platformDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (platformDropdownRef.current && !platformDropdownRef.current.contains(event.target as Node)) {
        setPlatformDropdownOpen(false);
      }
    }
    if (platformDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [platformDropdownOpen]);

  const toggleExpandPackage = (pkgId: string) => {
    setExpandedPackageIds((prev) => ({
      ...prev,
      [pkgId]: !prev[pkgId],
    }));
  };

  // Unified Orders: Merges Standalone Single Orders and Purchased Package Orders
  // Both are top-level parent orders. Sub-orders/execution runs are strictly viewed in details.
  const unifiedOrders = useMemo(() => {
    const list: any[] = [];

    // 1. Standalone single orders (exclude child package runs)
    (orders || []).forEach((o: any) => {
      if (!o.packageExecutionId && !o.packageRun && !o.parentOrderId && !o.isPackageRun) {
        list.push({
          ...o,
          orderKind: "SINGLE",
          isPackage: false,
          displayName: o.serviceName,
          displayTarget: o.target,
          totalQty: o.totalQuantity ?? (o.runs ? o.quantity * o.runs : o.quantity),
          formattedCharge: o.isPrepaid ? "Prepaid" : `₹${Number(o.charge).toFixed(2)}`,
        });
      }
    });

    // 2. Package orders (Combo, Custom Drip, Auto-Pilot)
    (packages || []).forEach((pkg: any) => {
      const cat = getPackageCategory(pkg); // "COMBO" | "CUSTOM" | "AUTOPILOT"
      const completedExecs = pkg.executions?.filter((e: any) => e.status === "COMPLETED").length ?? pkg.completedRuns ?? 0;
      const totalExecs = pkg.executions?.length ?? pkg.totalRuns ?? (pkg.rules?.length || 1);
      const upfrontTotal = getPackageTotal(pkg);
      const targetDisplay = pkg.handle
        ? (pkg.handle.startsWith("http") ? pkg.handle : `@${pkg.handle.replace(/^@/, "")}`)
        : (pkg.slots?.[0]?.targetUrl || "Social Target");
      const totalQty = pkg.rules?.reduce((acc: number, r: any) => acc + (r.kind === "FOLLOWERS_INTERVAL" ? r.totalFollowers || 0 : (r.quantityPerPost || 0) * (r.maxPosts || 1)), 0) || 1000;

      list.push({
        id: pkg.id,
        userId: pkg.userId,
        serviceId: pkg.rules?.[0]?.serviceId || "package",
        serviceName: pkg.name || (cat === "AUTOPILOT" ? "Auto-Pilot Growth Engine" : cat === "COMBO" ? "Reels Growth Combo" : "Custom Drip Campaign"),
        displayName: pkg.name || (cat === "AUTOPILOT" ? "Auto-Pilot Growth Engine" : cat === "COMBO" ? "Reels Growth Combo" : "Custom Drip Campaign"),
        platform: (pkg.platform || "instagram").toLowerCase(),
        target: targetDisplay,
        displayTarget: targetDisplay,
        quantity: totalQty,
        totalQty: totalQty,
        charge: upfrontTotal,
        formattedCharge: `₹${upfrontTotal.toFixed(2)}`,
        startCount: 0,
        remains: Math.max(0, totalQty - Math.round(totalQty * (totalExecs > 0 ? completedExecs / totalExecs : 0))),
        status: pkg.status === "ACTIVE" ? "IN_PROGRESS" : pkg.status === "COMPLETED" ? "COMPLETED" : pkg.status === "CANCELLED" ? "CANCELLED" : pkg.status || "PROCESSING",
        createdAt: pkg.createdAt || new Date().toISOString(),
        updatedAt: pkg.updatedAt || pkg.createdAt || new Date().toISOString(),
        refillable: false,
        cancellable: pkg.status === "ACTIVE",
        isDripFeed: true,
        runs: totalExecs,
        completedRuns: completedExecs,
        quantityPerRun: Math.round(totalQty / Math.max(1, totalExecs)),
        totalQuantity: totalQty,
        orderKind: cat, // "COMBO" | "CUSTOM" | "AUTOPILOT"
        isPackage: true,
        rawPackage: pkg,
        packageExecution: {
          package: pkg,
          seq: completedExecs,
          runIndex: completedExecs,
          packageId: pkg.id,
        },
      });
    });

    // Sort by createdAt desc
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [orders, packages]);

  const orderTypeFilters = [
    { id: "ALL", label: "All Dispatches" },
    { id: "SINGLE", label: "Single Orders" },
    { id: "COMBO", label: "Combo Packages" },
    { id: "CUSTOM", label: "Custom Packages" },
    { id: "AUTOPILOT", label: "Auto-Pilot" },
  ];

  const getOrderTypeCount = (typeKey: string) => {
    if (typeKey === "ALL") return unifiedOrders.length;
    return unifiedOrders.filter((o) => o.orderKind === typeKey).length;
  };

  const handleReportOrderProblem = async () => {
    if (!activeModalOrder || !orderProblemDesc.trim()) return;
    setSubmittingOrderProblem(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${getApiBase()}/orders/${activeModalOrder.id}/report-problem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          issueType: orderProblemIssue,
          notes: orderProblemDesc.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToastMessage("Problem reported. High-priority ticket created.");
        setOrderProblemModalOpen(false);
        setOrderProblemDesc("");
      } else {
        setToastMessage(data.message || "Failed to submit report.");
      }
    } catch {
      setToastMessage("Network error reporting problem.");
    } finally {
      setSubmittingOrderProblem(false);
    }
  };

  const handleToggleOrderFavorite = async (order: OrderItem) => {
    const existingFav = favorites?.find(
      (f) => f.serviceId === order.serviceId && f.targetUrl === order.target
    );

    if (existingFav) {
      const res = await removeFavorite(existingFav.id);
      if (res.success) {
        setToastMessage("Removed from favorites!");
      } else {
        setToastMessage(res.error || "Failed to remove favorite");
      }
    } else {
      const res = await addFavorite({
        serviceId: order.serviceId,
        targetUrl: order.target,
        defaultQuantity: order.quantity,
        isDripFeed: order.isDripFeed,
        dripRuns: order.runs || undefined,
        dripInterval: order.intervalMinutes || undefined,
        customName: order.serviceName,
      });
      if (res.success) {
        setToastMessage("Saved to favorites!");
      } else {
        setToastMessage(res.error || "Could not save favorite");
      }
    }
    if (refreshFavorites) await refreshFavorites();
    setTimeout(() => setToastMessage(null), 3000);
  };

  const statusList = [
    { id: "ALL", label: "All Orders" },
    { id: "PROCESSING", label: "Processing" },
    { id: "IN_PROGRESS", label: "In Progress" },
    { id: "COMPLETED", label: "Completed" },
    { id: "PENDING", label: "Pending" },
    { id: "PARTIAL", label: "Partial" },
    { id: "CANCELLED", label: "Cancelled" },
  ];

  const getStatusCount = (statusKey: string) => {
    let pool = unifiedOrders;
    if (selectedOrderType !== "ALL") {
      pool = pool.filter((o) => o.orderKind === selectedOrderType);
    }
    if (statusKey === "ALL") return pool.length;
    return pool.filter((o) => o.status === statusKey).length;
  };

  const filteredOrders = useMemo(() => {
    return unifiedOrders.filter((order) => {
      const matchesType = selectedOrderType === "ALL" || order.orderKind === selectedOrderType;
      const matchesStatus = selectedStatus === "ALL" || order.status === selectedStatus;
      const matchesPlatform =
        selectedPlatform === "ALL" ||
        order.platform?.toLowerCase() === selectedPlatform.toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        query === "" ||
        order.id.toLowerCase().includes(query) ||
        order.serviceName.toLowerCase().includes(query) ||
        order.target.toLowerCase().includes(query);

      return matchesType && matchesStatus && matchesPlatform && matchesSearch;
    });
  }, [unifiedOrders, selectedOrderType, selectedStatus, selectedPlatform, searchQuery]);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleRefill = async (orderId: string) => {
    setRefillingId(orderId);
    await refillOrder(orderId);
    setTimeout(() => setRefillingId(null), 800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-8 pb-16"
    >
      {/* Floating Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#171e00]/95 border border-[#D8EC8D]/40 text-[#D8EC8D] text-xs font-semibold shadow-xl backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
      {/* Order Placed Success Banner */}
      {orderPlaced && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#171e00]/40 border border-[#D8EC8D]/50 text-white backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_30px_rgba(216,236,141,0.15)] animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D8EC8D]/20 border border-[#D8EC8D]/40 text-[#D8EC8D] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                Order Placed Successfully!
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D8EC8D]/20 text-[#D8EC8D] border border-[#D8EC8D]/30">
                  Dispatched
                </span>
              </h3>
              <p className="text-xs text-fg-2 mt-0.5">
                {placedOrderId ? (
                  <>
                    Order Reference: <span className="font-mono text-[#D8EC8D] font-semibold">{placedOrderId}</span>. Dispatched to the algorithm engine & upstream provider network.
                  </>
                ) : (
                  "Your order has been queued and dispatched to the upstream provider network."
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href="/new-order"
              className="px-3.5 py-2 rounded-xl bg-[#D8EC8D] text-[#171e00] font-bold text-xs hover:brightness-105 transition-all text-center shrink-0 w-full sm:w-auto"
            >
              New Order
            </Link>
            <button
              type="button"
              onClick={() => router.replace("/orders")}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Clean (Telemetry badge removed) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-fg tracking-tight">Orders History</h1>
          <p className="text-xs text-slate-400">
            View real-time delivery status, start count tracking, and warranty refills.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Link
            href="/packages"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-semibold transition-all"
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>My Packages</span>
          </Link>
          <Link
            href="/new-order"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl btn-primary-gradient hover:brightness-105 text-[#171e00] text-xs font-bold shadow-sm transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Order</span>
          </Link>
        </div>
      </div>

      {/* Order Category Tabs (All Dispatches, Single Orders, Combo Packages, Custom Packages, Auto-Pilot) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {orderTypeFilters.map((tab) => {
          const isSelected = selectedOrderType === tab.id;
          const count = getOrderTypeCount(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedOrderType(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? "bg-[#D8EC8D] text-[#131313] font-bold shadow-sm shadow-[#D8EC8D]/20"
                  : "bg-surface-raised text-fg-muted hover:text-fg border border-border"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isSelected ? "bg-black/20 text-[#131313] font-bold" : "bg-surface text-fg-muted border border-border"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 space-y-4">
        {/* Status Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {statusList.map((st) => {
            const count = getStatusCount(st.id);
            const isSelected = selectedStatus === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStatus(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#D8EC8D] text-[#131313] font-bold shadow-sm shadow-[#D8EC8D]/20"
                    : "bg-surface-raised text-slate-700 text-fg-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10"
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-white/20 text-[#131313] font-bold" : "bg-white/5 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Platform Filter Row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1 border-t border-slate-200/60 dark:border-white/5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by Order ID, service name, or target link..."
              className="w-full bg-surface-raised border border-border focus:border-[#D8EC8D]/50 rounded-xl pl-9 pr-4 py-2 text-xs text-fg placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* High-Contrast Dark Mode Safe Platform Filter Dropdown */}
          <div className="relative w-full sm:w-48" ref={platformDropdownRef}>
            <button
              type="button"
              onClick={() => setPlatformDropdownOpen((prev) => !prev)}
              aria-label="Filter orders by platform"
              aria-expanded={platformDropdownOpen}
              className="w-full bg-surface-raised hover:bg-surface border border-border focus:border-[#D8EC8D]/50 rounded-xl px-3 py-2 text-xs text-fg flex items-center justify-between gap-2 transition-all shadow-xs"
            >
              <div className="flex items-center gap-2 truncate">
                {selectedPlatform !== "ALL" ? (
                  <PlatformIcon platform={selectedPlatform} size={14} useBrandColor={true} />
                ) : (
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span className="font-medium truncate">
                  {selectedPlatform === "ALL"
                    ? "All Platforms"
                    : selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  platformDropdownOpen ? "rotate-180 text-[#D8EC8D]" : ""
                }`}
              />
            </button>

            {platformDropdownOpen && (
              <div className="absolute right-0 left-0 sm:left-auto sm:w-52 mt-1 z-50 rounded-xl bg-[#18191B] border border-white/10 shadow-2xl p-1.5 space-y-0.5 backdrop-blur-xl">
                {[
                  { value: "ALL", label: "All Platforms" },
                  { value: "instagram", label: "Instagram" },
                  { value: "youtube", label: "YouTube" },
                  { value: "tiktok", label: "TikTok" },
                  { value: "telegram", label: "Telegram" },
                  { value: "twitter", label: "X (Twitter)" },
                  { value: "spotify", label: "Spotify" },
                ].map((opt) => {
                  const isSelected = selectedPlatform === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSelectedPlatform(opt.value);
                        setPlatformDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-2 rounded-lg text-left text-xs transition-colors flex items-center justify-between gap-2 ${
                        isSelected
                          ? "bg-[#D8EC8D]/15 text-[#D8EC8D] font-bold"
                          : "text-slate-200 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {opt.value !== "ALL" ? (
                          <PlatformIcon platform={opt.value} size={14} useBrandColor={true} />
                        ) : (
                          <Filter className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span className="truncate">{opt.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#D8EC8D] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="glass-panel p-4 md:p-6 rounded-3xl overflow-hidden space-y-4">
        {unifiedOrders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="You have not placed any orders yet. Select a service or package to launch your first social media campaign."
            actionText="Place your first order"
            actionHref="/new-order"
          />
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-mono">
            No orders match the current filter criteria.
          </div>
        ) : (
          <>
            {/* MOBILE CARDS VIEW (< md) */}
            <div className="block md:hidden space-y-3">
              {filteredOrders.map((order) => {
                const isNewlyPlaced = Boolean(placedOrderId && order.id === placedOrderId);
                return (
                  <div
                    key={order.id}
                    onClick={() => setActiveModalOrder(order)}
                    className={`p-4 rounded-2xl transition-all space-y-3 cursor-pointer active:scale-[0.99] ${
                      isNewlyPlaced
                        ? "bg-accent/10 border-[#D8EC8D] ring-2 ring-[#D8EC8D]/50 shadow-[0_0_20px_rgba(216,236,141,0.2)]"
                        : "bg-white/[0.02] border border-border hover:border-accent/30"
                    }`}
                  >
                    {/* Top Header: ID + Copy + Status */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/5 pb-2.5">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-fg">
                        <span>{formatOrderId(order.id)}</span>
                        {isNewlyPlaced && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#D8EC8D] text-[#171e00] uppercase font-mono">
                            NEW
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(formatOrderId(order.id));
                          }}
                          className="text-fg-muted hover:text-slate-900 dark:hover:text-white p-1 transition-colors"
                          title="Copy ID"
                        >
                          {copiedId === order.id ? (
                            <Check className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>

                  {/* Service Name & Platform */}
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-fg leading-snug line-clamp-2">
                        {order.serviceName}
                      </span>
                      {order.isPackage && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                          order.orderKind === "AUTOPILOT"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : order.orderKind === "COMBO"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}>
                          {order.orderKind}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-slate-200/60 dark:border-white/5 text-[10px] uppercase font-mono text-fg-2">
                        <PlatformIcon platform={order.platform} size={12} useBrandColor={true} />
                        <span>{order.platform}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                      </span>
                      {order.isPackage && order.runs && (
                        <span className="text-[10px] text-accent-text font-mono font-semibold">
                          {order.completedRuns ?? 0}/{order.runs} runs
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Target Link */}
                  <div className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-black/20 p-2 rounded-xl border border-slate-200/60 dark:border-white/5 truncate">
                    {order.target}
                  </div>

                  {/* Start Count ➔ End Goal Count Telemetry */}
                  <div className="flex items-center justify-between text-[11px] font-mono bg-surface-raised p-2 rounded-xl border border-border">
                    <span className="text-fg-muted">Start: <strong className="text-fg">{formatIndianNumber(order.startCount ?? 1420)}</strong></span>
                    <span className="text-accent-text font-bold">Goal: {formatIndianNumber((order.startCount ?? 1420) + (order.totalQty || order.quantity || 1000))}</span>
                  </div>

                  {/* Quantity & Charge */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-white/5">
                    <div>
                      <span className="text-slate-400">Qty: </span>
                      <span className="font-mono font-bold text-fg">{order.quantity.toLocaleString()}</span>
                      {order.remains !== null && order.remains !== undefined && (
                        <span className="text-slate-500 text-[10px] ml-1.5">({order.remains} left)</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400">Charge: </span>
                      <span className="font-mono font-bold text-[#D8EC8D]">
                        {(order as any).isPrepaid ? "Prepaid" : `₹${order.charge.toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleToggleOrderFavorite(order)}
                      className={`p-2 rounded-xl transition-colors cursor-pointer min-h-[38px] flex items-center justify-center ${
                        favorites?.some((f) => f.serviceId === order.serviceId && f.targetUrl === order.target)
                          ? "text-amber-500 bg-amber-500/10 dark:text-[#D8EC8D] dark:bg-accent/15"
                          : "text-slate-400 hover:text-amber-500 bg-slate-100 dark:bg-white/5"
                      }`}
                      title="Save as Favorite"
                    >
                      <Star className={`w-4 h-4 ${favorites?.some((f) => f.serviceId === order.serviceId && f.targetUrl === order.target) ? "fill-amber-400 dark:fill-[#D8EC8D] text-amber-500 dark:text-[#D8EC8D]" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalOrder(order)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-fg text-xs font-semibold text-center transition-colors min-h-[38px] flex items-center justify-center cursor-pointer border border-slate-200/80 dark:border-white/5"
                    >
                      Details
                    </button>
                    {order.refillable && (
                      <button
                        type="button"
                        onClick={() => handleRefill(order.id)}
                        disabled={refillingId === order.id}
                        className="flex-1 py-2 px-3 rounded-xl bg-accent/15 hover:bg-accent/25 text-[#D8EC8D] text-xs font-medium text-center transition-colors min-h-[38px] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${refillingId === order.id ? "animate-spin" : ""}`} />
                        <span>Refill</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

            {/* DESKTOP TABLE VIEW (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/90 dark:border-border text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-400 font-mono font-bold bg-slate-100/70 dark:bg-white/[0.02]">
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Service & Platform</th>
                    <th className="py-3 px-3">Target Vector</th>
                    <th className="py-3 px-3">Quantity</th>
                    <th className="py-3 px-3">Charge</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-white/5 text-xs">
                  {filteredOrders.map((order) => {
                    const isNewlyPlaced = Boolean(placedOrderId && order.id === placedOrderId);
                    const isOrderFavorited = favorites?.some(
                      (f) => f.serviceId === order.serviceId && f.targetUrl === order.target
                    );

                    return (
                      <tr
                        key={order.id}
                        onClick={() => setActiveModalOrder(order)}
                        className={`transition-colors cursor-pointer group ${
                          isNewlyPlaced ? "bg-accent/10 hover:bg-accent/15" : "hover:bg-slate-50/80 dark:hover:bg-white/[0.04]"
                        }`}
                      >
                        {/* Order ID */}
                        <td className="py-3.5 px-3 font-mono font-semibold text-fg whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="group-hover:text-[#D8EC8D] transition-colors">{formatOrderId(order.id)}</span>
                          {isNewlyPlaced && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#D8EC8D] text-[#171e00] uppercase font-mono">
                              NEW
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(formatOrderId(order.id));
                            }}
                            className="text-fg-muted hover:text-slate-900 dark:hover:text-white transition-colors"
                            title="Copy ID"
                          >
                            {copiedId === order.id ? (
                              <Check className="w-3 h-3 text-success" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                        </span>
                      </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-fg max-w-xs truncate">{order.serviceName}</span>
                        {order.isPackage && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                            order.orderKind === "AUTOPILOT"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : order.orderKind === "COMBO"
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}>
                            {order.orderKind}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <PlatformIcon platform={order.platform} size={13} useBrandColor={true} />
                        <span className="text-[10px] text-slate-400 uppercase font-mono">{order.platform}</span>
                        {order.isPackage && order.runs && (
                          <span className="text-[10px] text-accent-text font-mono font-semibold ml-1">
                            ({order.completedRuns ?? 0}/{order.runs} runs)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Target */}
                    <td className="py-3.5 px-3 font-mono">
                      <a
                        href={order.target}
                        target="_blank"
                        rel="noreferrer"
                        className="text-fg-2 hover:text-[#D8EC8D] max-w-[180px] truncate block"
                        title={order.target}
                      >
                        {order.target}
                      </a>
                    </td>

                    {/* Quantity & Aim */}
                    <td className="py-3.5 px-3 font-mono">
                      {(order as any).packageExecution || (order as any).packageRun ? (() => {
                        const pe = (order as any).packageExecution || (order as any).packageRun;
                        const runNum = pe.seq ?? pe.runIndex ?? 1;
                        const pkg = pe.package;
                        const totalRuns =
                          pkg?.totalRuns ??
                          (pkg?.rules?.reduce((acc: number, r: any) => acc + (r.maxPosts || 1), 0) ||
                            runNum);
                        const completedRuns = pkg?.completedRuns ?? runNum;
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px] font-semibold flex items-center gap-1">
                                <Boxes className="w-2.5 h-2.5" />
                                Package Run #{runNum}
                              </span>
                              <span className="text-fg font-medium">
                                {order.quantity.toLocaleString()} units
                              </span>
                            </div>
                            {pkg && (
                              <div className="text-[10px] text-fg-2">
                                Aim: {completedRuns} / {totalRuns} runs done
                              </div>
                            )}
                            {order.remains !== null && order.remains !== undefined && (
                              <span className="text-[10px] text-slate-400 block font-mono">
                                Remains: {order.remains.toLocaleString()}
                              </span>
                            )}
                          </div>
                        );
                      })() : order.isDripFeed || order.dripMode === "MANAGED" || order.dripMode === "NATIVE" ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-accent/15 text-[#D8EC8D] text-[10px] font-semibold">
                              Drip-feed ({order.dripMode || "MANAGED"})
                            </span>
                            <span className="text-fg font-medium">
                              {order.totalQuantity ?? (order.runs ? order.quantity * order.runs : order.quantity)} total
                            </span>
                          </div>
                          {order.runsList && order.runsList.length > 0 ? (
                            <div className="text-[10px] text-fg-2">
                              {order.runsList.filter((r: any) => r.status === "COMPLETED").length} of {order.runsList.length} runs done
                              {" "}({order.runsList.reduce((acc: number, r: any) => acc + (r.delivered || 0), 0)} / {order.totalQuantity ?? order.quantity * (order.runs || 1)})
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400">
                              {order.quantityPerRun ?? order.quantity} × {order.runs} runs ({order.intervalMinutes}m)
                            </div>
                          )}
                          {order.runsList?.find((r: any) => r.status === "SCHEDULED") && (
                            <div className="text-[10px] text-[#D8EC8D] font-mono">
                              Next run: {new Date(order.runsList.find((r: any) => r.status === "SCHEDULED")!.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                          {order.remains !== null && order.remains !== undefined && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Remains: {order.remains.toLocaleString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-fg font-medium">{order.quantity.toLocaleString()}</span>
                            <span className="text-slate-400 text-[10px]">aim</span>
                          </div>
                          {order.remains !== null && order.remains !== undefined && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Remains: {order.remains.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Charge */}
                    <td className="py-3.5 px-3 font-mono font-semibold whitespace-nowrap">
                      {(order as any).isPrepaid ? (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 text-[10px] font-bold">
                          Prepaid (₹0.00)
                        </span>
                      ) : (
                        <span className="text-fg">
                          ₹{order.charge.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <StatusBadge status={order.status} />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setActiveModalOrder(order)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-fg-2 hover:text-white text-xs font-medium transition-all"
                        >
                          Details
                        </button>

                        {order.refillable && (
                          <button
                            type="button"
                            onClick={() => handleRefill(order.id)}
                            disabled={refillingId === order.id}
                            className="px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 text-[#D8EC8D] text-xs font-medium transition-all flex items-center gap-1"
                          >
                            <RefreshCw className={`w-3 h-3 ${refillingId === order.id ? "animate-spin" : ""}`} />
                            <span>{refillingId === order.id ? "Refilling" : "Refill"}</span>
                          </button>
                        )}

                        {order.cancellable && (
                          <button
                            type="button"
                            onClick={() => cancelOrder(order.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-medium transition-all"
                          >
                            Cancel
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleOrderFavorite(order);
                          }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isOrderFavorited
                              ? "text-amber-500 bg-amber-500/10 dark:text-[#D8EC8D] dark:bg-accent/15"
                              : "text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-white/10"
                          }`}
                          title={isOrderFavorited ? "Remove from Favorites" : "Save as Favorite"}
                        >
                          <Star className={`w-3.5 h-3.5 ${isOrderFavorited ? "fill-amber-400 dark:fill-[#D8EC8D] text-amber-500 dark:text-[#D8EC8D]" : ""}`} />
                        </button>

                        <Link
                          href={`/support?orderId=${order.id}`}
                          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                          title="Open Ticket"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </>
        )}
      </div>

      {/* Details & Timeline Drawer / Modal (Bottom Sheet on Mobile, Centered on Desktop) */}
      {activeModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#1c1b1b] border border-border rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 md:p-8 max-w-lg w-full space-y-5 sm:space-y-6 shadow-2xl relative text-xs max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-mono text-[#D8EC8D] font-semibold">
                  Order Telemetry & Execution Lifecycle
                </span>
                <h3 className="text-base font-semibold text-fg">Order {formatOrderId(activeModalOrder.id)}</h3>
              </div>
              <button
                onClick={() => setActiveModalOrder(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400"
                aria-label="Close details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lifecycle Timeline */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-slate-200/60 dark:border-white/5 space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                Dispatch Lifecycle
              </div>
              <div className="flex items-center justify-between relative pt-1">
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-5 h-5 rounded-full bg-[#D8EC8D] text-[#131313] flex items-center justify-center text-[10px] font-bold">
                    1
                  </div>
                  <span className="text-[10px] font-mono text-fg-2">Created</span>
                </div>
                <div className="flex-1 h-0.5 bg-[#D8EC8D]/40 -mt-3" />

                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-5 h-5 rounded-full bg-[#D8EC8D] text-[#131313] flex items-center justify-center text-[10px] font-bold">
                    2
                  </div>
                  <span className="text-[10px] font-mono text-fg-2">Dispatched</span>
                </div>
                <div className="flex-1 h-0.5 bg-[#D8EC8D]/40 -mt-3" />

                <div className="flex flex-col items-center gap-1 z-10">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    activeModalOrder.status === "COMPLETED"
                      ? "bg-emerald-600 text-white"
                      : activeModalOrder.status === "FAILED" || activeModalOrder.status === "CANCELLED"
                      ? "bg-rose-600 text-white"
                      : "bg-[#D8EC8D]/40 text-[#D8EC8D] animate-pulse"
                  }`}>
                    3
                  </div>
                  <span className="text-[10px] font-mono text-fg-2">
                    {activeModalOrder.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Aim & Fulfillment Progress */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-slate-200/60 dark:border-white/5 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                  Aim Fulfillment Progress
                </span>
                <span className="text-[#D8EC8D] font-mono font-bold">
                  {Math.min(
                    100,
                    Math.round(
                      (Math.max(
                        0,
                        (activeModalOrder.totalQuantity ?? (activeModalOrder.runs ? activeModalOrder.quantity * activeModalOrder.runs : activeModalOrder.quantity)) -
                          (activeModalOrder.remains ?? 0)
                      ) /
                        Math.max(
                          1,
                          activeModalOrder.totalQuantity ?? (activeModalOrder.runs ? activeModalOrder.quantity * activeModalOrder.runs : activeModalOrder.quantity)
                        )) *
                        100
                    )
                  )}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#D8EC8D] to-[#BEF264] transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (Math.max(
                          0,
                          (activeModalOrder.totalQuantity ?? (activeModalOrder.runs ? activeModalOrder.quantity * activeModalOrder.runs : activeModalOrder.quantity)) -
                            (activeModalOrder.remains ?? 0)
                        ) /
                          Math.max(
                            1,
                            activeModalOrder.totalQuantity ?? (activeModalOrder.runs ? activeModalOrder.quantity * activeModalOrder.runs : activeModalOrder.quantity)
                          )) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] font-mono text-fg-2 pt-1 bg-surface-raised p-2 rounded-xl border border-border">
                <span>Start: <strong className="text-fg">{formatIndianNumber(activeModalOrder.startCount ?? 1420)}</strong></span>
                <span className="text-accent-text font-bold">
                  Now: {formatIndianNumber((activeModalOrder.startCount ?? 1420) + Math.max(
                    0,
                    (activeModalOrder.totalQuantity ?? (activeModalOrder.runs ? activeModalOrder.quantity * activeModalOrder.runs : activeModalOrder.quantity)) -
                      (activeModalOrder.remains ?? 0)
                  ))}
                </span>
                <span>
                  Goal: <strong className="text-fg">{formatIndianNumber(
                    (activeModalOrder.startCount ?? 1420) + (activeModalOrder.totalQuantity ??
                    (activeModalOrder.runs ? activeModalOrder.quantity * activeModalOrder.runs : activeModalOrder.quantity))
                  )}</strong>
                </span>
              </div>
            </div>

            {/* Growth Package Integration Card (If part of a multi-day package) */}
            {((activeModalOrder as any).packageExecution || (activeModalOrder as any).packageRun) && (() => {
              const pe = (activeModalOrder as any).packageExecution || (activeModalOrder as any).packageRun;
              const pkg = pe.package;
              const runNum = pe.seq ?? pe.runIndex ?? 1;
              const pkgId = pkg?.id || pe.packageId;
              const totalRuns =
                pkg?.totalRuns ??
                (pkg?.rules?.reduce((acc: number, r: any) => acc + (r.maxPosts || 1), 0) ||
                  runNum);
              const completedRuns = pkg?.completedRuns ?? runNum;
              const pct = totalRuns > 0 ? Math.min(100, Math.round((completedRuns / totalRuns) * 100)) : 0;
              const pkgName =
                pkg?.name ||
                (pkg?.platform && pkg?.handle ? `${pkg.platform} @${pkg.handle}` : "Growth Package");
              return (
                <div className="p-4 rounded-2xl bg-purple-950/25 border border-purple-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono text-purple-400 font-bold block">
                          Part of Growth Package
                        </span>
                        <span className="text-fg font-semibold text-xs">
                          {pkgName}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                      {pkg?.status || "ACTIVE"}
                    </span>
                  </div>

                  {pkg && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-fg-2">
                        <span>Package Overall Aim</span>
                        <span className="text-purple-300 font-bold">
                          {completedRuns} of {totalRuns} runs completed
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-purple-500/15">
                    <span className="text-[10px] text-purple-200/80 font-mono">
                      Run #{runNum} · Prepaid Child Order
                    </span>
                    {pkgId && (
                      <Link
                        href={`/packages/${pkgId}`}
                        className="inline-flex items-center gap-1 text-[11px] text-[#D8EC8D] hover:underline font-semibold"
                      >
                        <span>View Package Timeline</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Spec Details */}
            <div className="bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl p-4 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Service</span>
                <span className="text-fg font-medium truncate max-w-[200px]">{activeModalOrder.serviceName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Platform</span>
                <span className="text-fg uppercase">{activeModalOrder.platform}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Target Vector</span>
                <span className="text-[#D8EC8D] truncate max-w-[200px]">{activeModalOrder.target}</span>
              </div>
              {activeModalOrder.isDripFeed ? (
                <>
                  <div className="flex justify-between text-slate-400">
                    <span>Delivery Mode</span>
                    <span className="text-[#D8EC8D] font-bold">Drip-feed ({activeModalOrder.runs} runs / {activeModalOrder.intervalMinutes}m)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Per-Run Quantity</span>
                    <span className="text-fg font-medium">{(activeModalOrder.quantityPerRun ?? activeModalOrder.quantity).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Total Quantity</span>
                    <span className="text-fg font-bold">{(activeModalOrder.totalQuantity ?? (activeModalOrder.runs ? activeModalOrder.quantity * activeModalOrder.runs : activeModalOrder.quantity)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Estimated Schedule</span>
                    <span className="text-fg">{((activeModalOrder.runs || 1) - 1) * (activeModalOrder.intervalMinutes || 0)} mins</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-400">
                  <span>Aim Quantity</span>
                  <span className="text-fg">{activeModalOrder.quantity.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>Start Count</span>
                <span className="text-fg">{activeModalOrder.startCount ?? 0}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Units Remaining</span>
                <span className="text-fg">{activeModalOrder.remains ?? 0}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-fg font-semibold">
                <span>Total Charge</span>
                <span>
                  {(activeModalOrder as any).isPrepaid
                    ? "₹0.00 (Prepaid via Package)"
                    : `₹${activeModalOrder.charge.toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Wallet Balance & Need to Recharge Section */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent/15 text-[#D8EC8D] flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">Wallet Balance</span>
                  <span className="text-fg font-bold font-mono text-sm">
                    ₹{user?.balance !== undefined ? user.balance.toFixed(2) : "0.00"}
                  </span>
                </div>
              </div>
              <Link
                href="/wallet"
                className="px-3.5 py-2 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold hover:brightness-105 transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <span>Add Funds / Recharge</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Package Execution Sub-Orders Timeline */}
            {activeModalOrder.isPackage && activeModalOrder.rawPackage?.executions && activeModalOrder.rawPackage.executions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold">
                    Package Child Runs &amp; Batches ({activeModalOrder.rawPackage.executions.length} runs)
                  </span>
                  <Link
                    href={`/packages/${activeModalOrder.id}`}
                    className="text-[11px] text-[#D8EC8D] hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Full Schedule</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 no-scrollbar">
                  {activeModalOrder.rawPackage.executions.map((exec: any, idx: number) => (
                    <div key={exec.id || idx} className="p-2.5 rounded-xl bg-white/[0.02] border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-[11px] font-mono">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-fg font-semibold">Run #{exec.seq ?? (idx + 1)}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            exec.status === "COMPLETED" ? "bg-emerald-500/15 text-emerald-300" :
                            exec.status === "DISPATCHING" || exec.status === "PROCESSING" ? "bg-amber-500/15 text-amber-300" :
                            exec.status === "FAILED" || exec.status === "CANCELLED" ? "bg-rose-500/15 text-rose-300" :
                            "bg-white/10 text-fg-2"
                          }`}>
                            {exec.status}
                          </span>
                        </div>
                        <div className="text-slate-500 text-[10px] mt-0.5">
                          {exec.serviceName ? `${exec.serviceName} · ` : ""}
                          {exec.scheduledAt ? new Date(exec.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Scheduled"}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-fg font-medium">{exec.quantity ?? 100} units</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-Run Execution Timeline */}
            {activeModalOrder.runsList && activeModalOrder.runsList.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold">
                    Run Timeline ({activeModalOrder.runsList.length} runs)
                  </span>
                  {activeModalOrder.dripMode === "MANAGED" && activeModalOrder.runsList.some((r: any) => r.status === "SCHEDULED") && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm("Cancel all remaining scheduled runs? Delivered runs will be kept, and unsent runs will be refunded immediately to your wallet.")) {
                          await cancelOrder(activeModalOrder.id);
                          setActiveModalOrder(null);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[10px] font-mono transition-colors"
                    >
                      Cancel Remaining Runs
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 no-scrollbar">
                  {activeModalOrder.runsList.map((run: any) => (
                    <div key={run.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-[11px] font-mono">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-fg font-semibold">Run #{run.runIndex + 1}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            run.status === "COMPLETED" ? "bg-emerald-500/15 text-emerald-300" :
                            run.status === "DISPATCHING" || run.status === "PROCESSING" ? "bg-amber-500/15 text-amber-300" :
                            run.status === "FAILED" || run.status === "CANCELED" ? "bg-rose-500/15 text-rose-300" :
                            "bg-white/10 text-fg-2"
                          }`}>
                            {run.status}
                          </span>
                        </div>
                        <div className="text-slate-500 text-[10px] mt-0.5">
                          {run.providerOrderId ? `Provider #${run.providerOrderId} · ` : ""}
                          {new Date(run.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {run.lastError ? ` · Error: ${run.lastError}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-fg font-medium">{run.quantity} units</span>
                        <div className="text-[10px] text-slate-400">
                          {run.status === "FAILED" || run.status === "CANCELED" ? (
                            <span className="text-danger">₹{run.chargeShare.toFixed(2)} refunded</span>
                          ) : (
                            <span>₹{run.chargeShare.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOrderProblemModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-warning font-medium text-xs transition-colors border border-slate-200/60 dark:border-white/5 flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Report Issue</span>
              </button>
              <Link
                href={`/support?orderId=${activeModalOrder.id}`}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-fg font-medium text-xs transition-colors"
              >
                Open Ticket
              </Link>
              <button
                onClick={() => setActiveModalOrder(null)}
                className="px-5 py-2 rounded-xl btn-primary-gradient text-[#171e00] font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Problem Report Modal (Bottom Sheet on Mobile) */}
      {orderProblemModalOpen && activeModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <GlassCard className="max-w-md w-full p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl border-border space-y-4 sm:space-y-5 bg-white dark:bg-[#171717] shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-warning">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-fg">Report Order Issue</h3>
                <p className="text-xs text-slate-400 font-mono">Order {formatOrderId(activeModalOrder.id)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1.5">Issue Category</label>
                <select
                  value={orderProblemIssue}
                  onChange={(e) => setOrderProblemIssue(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-border text-fg text-xs font-mono focus:outline-none focus:border-[#D8EC8D]"
                >
                  <option value="Execution delayed or missed" className="bg-[#1c1c1c] text-slate-100">Execution delayed or missed</option>
                  <option value="Quantity drop or discrepancy" className="bg-[#1c1c1c] text-slate-100">Quantity drop or discrepancy</option>
                  <option value="Target URL not updating" className="bg-[#1c1c1c] text-slate-100">Target URL not updating</option>
                  <option value="Other delivery issue" className="bg-[#1c1c1c] text-slate-100">Other delivery issue</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1.5">Description & Details</label>
                <textarea
                  rows={4}
                  value={orderProblemDesc}
                  onChange={(e) => setOrderProblemDesc(e.target.value)}
                  placeholder="Describe what occurred with this order..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-border text-fg text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#D8EC8D]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOrderProblemModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-fg font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingOrderProblem || !orderProblemDesc.trim()}
                onClick={handleReportOrderProblem}
                className="flex-1 py-2.5 rounded-xl bg-[#D8EC8D] text-black font-semibold text-xs hover:brightness-105 transition-all shadow-md disabled:opacity-50"
              >
                {submittingOrderProblem ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </motion.div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500 animate-pulse font-mono">Loading orders...</div>}>
      <OrdersPageContent />
    </Suspense>
  );
}
