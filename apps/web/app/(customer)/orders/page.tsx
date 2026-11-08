"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
  ShoppingBag,
  PlusCircle,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Bookmark,
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

export default function OrdersPage() {
  const { orders, packages, refillOrder, cancelOrder, addFavorite, user, refreshPackages, refreshData } = useCustomer();
  const [orderTypeTab, setOrderTypeTab] = useState<"ALL" | "STANDARD" | "CUSTOM">("ALL");
  const [savingPackageId, setSavingPackageId] = useState<string | null>(null);

  const customOrders = useMemo(() => {
    return (packages || []).filter((p: any) => p.id?.startsWith("pkg_drip_"));
  }, [packages]);

  const handleSaveCustomToMyPackages = async (pkgId: string) => {
    setSavingPackageId(pkgId);
    try {
      const token = getAuthToken() || localStorage.getItem("authToken");
      const res = await fetch(`${getApiBase()}/packages/${pkgId}/save-to-my-packages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage("Custom order saved to My Packages!");
        if (refreshPackages) refreshPackages();
        if (refreshData) refreshData();
      } else {
        setToastMessage(data.message || "Could not save to My Packages.");
      }
    } catch {
      setToastMessage("Network error saving package.");
    } finally {
      setSavingPackageId(null);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleSaveCustomOrderAsFavorite = async (customOrder: any) => {
    const primaryRule = customOrder.rules?.[0];
    const serviceId = primaryRule?.serviceId || "custom_service";
    const serviceName = primaryRule?.service?.displayName || primaryRule?.service?.name || "Custom Campaign";
    const targetUrl = customOrder.slots?.[0]?.targetUrl || customOrder.handle || "";

    const res = await addFavorite({
      serviceId,
      targetUrl,
      defaultQuantity: primaryRule?.quantityPerPost || 1000,
      isDripFeed: true,
      dripRuns: customOrder.rules?.length || 5,
      customName: `Custom: ${serviceName}`,
    });
    if (res.success) {
      setToastMessage("Saved to favorites!");
    } else {
      setToastMessage(res.error || "Failed to save favorite");
    }
    setTimeout(() => setToastMessage(null), 3000);
  };
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refillingId, setRefillingId] = useState<string | null>(null);
  const [activeModalOrder, setActiveModalOrder] = useState<OrderItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Order Problem Report State
  const [orderProblemModalOpen, setOrderProblemModalOpen] = useState(false);
  const [orderProblemIssue, setOrderProblemIssue] = useState("Execution delayed or missed");
  const [orderProblemDesc, setOrderProblemDesc] = useState("");
  const [submittingOrderProblem, setSubmittingOrderProblem] = useState(false);

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

  const handleSaveOrderAsFavorite = async (order: OrderItem) => {
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
      setTimeout(() => setToastMessage(null), 3000);
    } else {
      setToastMessage(res.error || "Could not save favorite");
      setTimeout(() => setToastMessage(null), 3000);
    }
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

  const filteredCustomOrders = useMemo(() => {
    return customOrders.filter((co: any) => {
      const matchesStatus =
        selectedStatus === "ALL" ||
        (selectedStatus === "PROCESSING" && (co.status === "ACTIVE" || co.status === "PENDING")) ||
        (selectedStatus === "IN_PROGRESS" && co.status === "ACTIVE") ||
        co.status === selectedStatus;

      const matchesPlatform =
        selectedPlatform === "ALL" ||
        co.platform?.toLowerCase() === selectedPlatform.toLowerCase();

      const query = searchQuery.toLowerCase().trim();
      const handleStr = (co.handle || "").toLowerCase();
      const idStr = co.id.toLowerCase();
      const matchesSearch =
        query === "" ||
        idStr.includes(query) ||
        handleStr.includes(query) ||
        co.rules?.some((r: any) =>
          (r.service?.displayName || r.service?.name || "").toLowerCase().includes(query)
        );

      return matchesStatus && matchesPlatform && matchesSearch;
    });
  }, [customOrders, selectedStatus, selectedPlatform, searchQuery]);

  const getStatusCount = (statusKey: string) => {
    if (orderTypeTab === "CUSTOM") {
      if (statusKey === "ALL") return customOrders.length;
      return customOrders.filter((co) => co.status === statusKey).length;
    }
    if (orderTypeTab === "STANDARD") {
      if (statusKey === "ALL") return orders.length;
      return orders.filter((o) => o.status === statusKey).length;
    }
    if (statusKey === "ALL") return orders.length + customOrders.length;
    return orders.filter((o) => o.status === statusKey).length + customOrders.filter((co) => co.status === statusKey).length;
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
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

      return matchesStatus && matchesPlatform && matchesSearch;
    });
  }, [orders, selectedStatus, selectedPlatform, searchQuery]);

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
      {/* Header Clean (Telemetry badge removed) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-fg tracking-tight">Orders History</h1>
          <p className="text-xs text-slate-400">
            View real-time delivery status, start count tracking, and warranty refills.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200/80 dark:border-white/5 text-xs">
            <button
              type="button"
              onClick={() => setOrderTypeTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                orderTypeTab === "ALL"
                  ? "bg-[#D8EC8D] text-black shadow-xs font-bold"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              All ({orders.length + customOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setOrderTypeTab("STANDARD")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                orderTypeTab === "STANDARD"
                  ? "bg-[#D8EC8D] text-black shadow-xs font-bold"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              Standard ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setOrderTypeTab("CUSTOM")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                orderTypeTab === "CUSTOM"
                  ? "bg-purple-500 text-white shadow-xs font-bold"
                  : "text-purple-400 hover:text-purple-300"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Custom Orders ({customOrders.length})</span>
            </button>
          </div>

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

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              aria-label="Filter orders by platform"
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full sm:w-44 bg-surface-raised border border-border focus:border-[#D8EC8D]/50 rounded-xl px-3 py-2 text-xs text-fg focus:outline-none font-sans"
            >
              <option value="ALL" className="bg-white text-slate-900 dark:bg-[#131313] text-fg">All Platforms</option>
              <option value="instagram" className="bg-white text-slate-900 dark:bg-[#131313] text-fg">Instagram</option>
              <option value="youtube" className="bg-white text-slate-900 dark:bg-[#131313] text-fg">YouTube</option>
              <option value="tiktok" className="bg-white text-slate-900 dark:bg-[#131313] text-fg">TikTok</option>
              <option value="telegram" className="bg-white text-slate-900 dark:bg-[#131313] text-fg">Telegram</option>
              <option value="twitter" className="bg-white text-slate-900 dark:bg-[#131313] text-fg">X (Twitter)</option>
              <option value="spotify" className="bg-white text-slate-900 dark:bg-[#131313] text-fg">Spotify</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="glass-panel p-4 md:p-6 rounded-3xl overflow-hidden space-y-4">
        {orders.length === 0 && customOrders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="You have not placed any orders yet. Select a service to launch your first social media campaign."
            actionText="Place your first order"
            actionHref="/new-order"
          />
        ) : (orderTypeTab === "STANDARD" ? filteredOrders.length === 0 : orderTypeTab === "CUSTOM" ? filteredCustomOrders.length === 0 : (filteredOrders.length === 0 && filteredCustomOrders.length === 0)) ? (
          <div className="py-12 text-center text-slate-400 text-xs font-mono">
            No orders match the current filter criteria.
          </div>
        ) : (
          <>
            {/* MOBILE CARDS VIEW (< md) */}
            <div className="block md:hidden space-y-3">
              {/* Custom Orders */}
              {(orderTypeTab === "ALL" || orderTypeTab === "CUSTOM") &&
                filteredCustomOrders.map((co: any) => {
                  const completedRuns = co.executions?.filter((e: any) => e.status === "COMPLETED").length ?? 0;
                  const totalRuns = co.executions?.length ?? 1;
                  const progressPercent = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
                  const totalCharge = Number(co.reserveTotal || co.priceSnapshot?.totalCharge || 0);
                  const targetLink = co.slots?.[0]?.targetUrl || co.handle || "";

                  return (
                    <div
                      key={co.id}
                      className="p-4 rounded-2xl bg-purple-950/10 border border-purple-500/25 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-purple-500/20 pb-2.5">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-fg">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Custom Order
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">#{co.id.slice(0, 8)}</span>
                        </div>
                        <StatusBadge status={co.status} />
                      </div>

                      <div className="flex items-center gap-3">
                        <PackageThumbnail pkg={co} size="sm" className="shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-xs font-bold text-fg truncate">
                            {targetLink}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-[10px] uppercase font-mono text-fg-2">
                              <PlatformIcon platform={co.platform} size={11} />
                              <span>{co.platform}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {completedRuns}/{totalRuns} runs ({progressPercent}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/5 overflow-hidden">
                        <div
                          style={{ width: `${progressPercent}%` }}
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-[#D8EC8D]"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-purple-500/15 text-xs">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase mr-1">Total:</span>
                          <span className="font-mono font-bold text-[#D8EC8D]">₹{totalCharge.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveCustomOrderAsFavorite(co)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                            title="Save as Favorite"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={savingPackageId === co.id}
                            onClick={() => handleSaveCustomToMyPackages(co.id)}
                            className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-semibold text-[11px] transition-colors flex items-center gap-1"
                            title="Save to My Packages"
                          >
                            <Boxes className="w-3 h-3" />
                            <span>{savingPackageId === co.id ? "Saving..." : "Save to My Packages"}</span>
                          </button>
                          <Link
                            href={`/packages/${co.id}`}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                            title="View Details"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Standard Orders (Mobile) */}
              {(orderTypeTab === "ALL" || orderTypeTab === "STANDARD") &&
                filteredOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => setActiveModalOrder(order)}
                  className="p-4 rounded-2xl bg-white/[0.02] border border-border hover:border-accent/30 transition-all space-y-3 cursor-pointer active:scale-[0.99]"
                >
                  {/* Top Header: ID + Copy + Status */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/5 pb-2.5">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-fg">
                      <span>{formatOrderId(order.id)}</span>
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
                    <div className="text-sm font-semibold text-fg leading-snug line-clamp-2">
                      {order.serviceName}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-slate-200/60 dark:border-white/5 text-[10px] uppercase font-mono text-fg-2">
                        <PlatformIcon platform={order.platform} size={12} useBrandColor={true} />
                        <span>{order.platform}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                  </div>

                  {/* Target Link */}
                  <div className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-black/20 p-2 rounded-xl border border-slate-200/60 dark:border-white/5 truncate">
                    {order.target}
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
                      onClick={() => setActiveModalOrder(order)}
                      className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-fg text-xs font-medium text-center transition-colors min-h-[38px] flex items-center justify-center"
                    >
                      Details
                    </button>
                    {order.refillable && (
                      <button
                        type="button"
                        onClick={() => handleRefill(order.id)}
                        disabled={refillingId === order.id}
                        className="flex-1 py-2 px-3 rounded-xl bg-accent/15 hover:bg-accent/25 text-[#D8EC8D] text-xs font-medium text-center transition-colors min-h-[38px] flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${refillingId === order.id ? "animate-spin" : ""}`} />
                        <span>Refill</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE VIEW (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                    <th className="py-3 px-3">Order ID</th>
                    <th className="py-3 px-3">Service & Platform</th>
                    <th className="py-3 px-3">Target Vector</th>
                    <th className="py-3 px-3">Quantity</th>
                    <th className="py-3 px-3">Charge</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {/* Custom Orders Desktop Rows */}
                  {(orderTypeTab === "ALL" || orderTypeTab === "CUSTOM") &&
                    filteredCustomOrders.map((co: any) => {
                      const completedRuns = co.executions?.filter((e: any) => e.status === "COMPLETED").length ?? 0;
                      const totalRuns = co.executions?.length ?? 1;
                      const progressPercent = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
                      const totalCharge = Number(co.reserveTotal || co.priceSnapshot?.totalCharge || 0);
                      const targetLink = co.slots?.[0]?.targetUrl || co.handle || "";

                      return (
                        <tr
                          key={co.id}
                          className="bg-purple-950/[0.08] hover:bg-purple-950/[0.18] transition-colors group"
                        >
                          <td className="py-3.5 px-3 font-mono font-semibold text-fg whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" />
                                Custom Order
                              </span>
                              <span className="text-[11px] text-slate-400">#{co.id.slice(0, 8)}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block font-normal mt-0.5">
                              {co.createdAt ? new Date(co.createdAt).toLocaleDateString() : ""}
                            </span>
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <PackageThumbnail pkg={co} size="sm" className="shrink-0" />
                              <div className="min-w-0">
                                <div className="font-semibold text-fg max-w-xs truncate">
                                  Multi-Service Custom Drip ({co.rules?.length || 1} services)
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <PlatformIcon platform={co.platform} size={12} />
                                  <span className="text-[10px] text-slate-400 uppercase font-mono">{co.platform}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 font-mono">
                            <a
                              href={targetLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-fg-2 hover:text-[#D8EC8D] max-w-[180px] truncate block"
                              title={targetLink}
                            >
                              {targetLink}
                            </a>
                          </td>

                          <td className="py-3.5 px-3 font-mono">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-fg font-medium">
                                  {completedRuns}/{totalRuns} runs ({progressPercent}%)
                                </span>
                              </div>
                              <div className="w-28 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                                <div
                                  style={{ width: `${progressPercent}%` }}
                                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-[#D8EC8D]"
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 font-mono font-bold text-[#D8EC8D]">
                            ₹{totalCharge.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-3">
                            <StatusBadge status={co.status} />
                          </td>

                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveCustomOrderAsFavorite(co)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                                title="Save as Favorite"
                              >
                                <Bookmark className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={savingPackageId === co.id}
                                onClick={() => handleSaveCustomToMyPackages(co.id)}
                                className="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-semibold text-[10px] transition-colors flex items-center gap-1"
                                title="Save to My Packages"
                              >
                                <Boxes className="w-3 h-3" />
                                <span>{savingPackageId === co.id ? "Saving..." : "Save to My Packages"}</span>
                              </button>
                              <Link
                                href={`/packages/${co.id}`}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors inline-block"
                                title="View Details"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {/* Standard Orders Desktop Rows */}
                  {(orderTypeTab === "ALL" || orderTypeTab === "STANDARD") &&
                    filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setActiveModalOrder(order)}
                      className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                    >
                      {/* Order ID */}
                      <td className="py-3.5 px-3 font-mono font-semibold text-fg whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="group-hover:text-[#D8EC8D] transition-colors">{formatOrderId(order.id)}</span>
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
                      <div className="font-medium text-fg max-w-xs truncate">{order.serviceName}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <PlatformIcon platform={order.platform} size={13} useBrandColor={true} />
                        <span className="text-[10px] text-slate-400 uppercase font-mono">{order.platform}</span>
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
                          onClick={() => handleSaveOrderAsFavorite(order)}
                          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-[#D8EC8D] transition-colors"
                          title="Save as Favorite"
                        >
                          <Bookmark className="w-3.5 h-3.5" />
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
                ))}
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
              <div className="flex justify-between text-[11px] font-mono text-fg-2 pt-1">
                <span>Start: {activeModalOrder.startCount ?? 0}</span>
                <span>
                  Delivered:{" "}
                  {Math.max(
                    0,
                    (activeModalOrder.totalQuantity ?? (activeModalOrder.runs ? activeModalOrder.quantity * activeModalOrder.runs : activeModalOrder.quantity)) -
                      (activeModalOrder.remains ?? 0)
                  ).toLocaleString()}
                </span>
                <span>
                  Aim Goal:{" "}
                  {(
                    activeModalOrder.totalQuantity ??
                    (activeModalOrder.runs ? activeModalOrder.quantity * activeModalOrder.runs : activeModalOrder.quantity)
                  ).toLocaleString()}
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
                  <option value="Execution delayed or missed" className="bg-white dark:bg-[#1c1c1c] text-fg">Execution delayed or missed</option>
                  <option value="Quantity drop or discrepancy" className="bg-white dark:bg-[#1c1c1c] text-fg">Quantity drop or discrepancy</option>
                  <option value="Target URL not updating" className="bg-white dark:bg-[#1c1c1c] text-fg">Target URL not updating</option>
                  <option value="Other delivery issue" className="bg-white dark:bg-[#1c1c1c] text-fg">Other delivery issue</option>
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
