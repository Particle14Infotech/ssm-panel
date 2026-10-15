"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import { OrderItem, OrderStatus } from "@smm/contracts";
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Radio,
  Clock,
  Shield,
  Layers,
  ChevronRight,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ShoppingBag,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export default function OrdersPage() {
  const { orders, refillOrder, cancelOrder } = useCustomer();
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refillingId, setRefillingId] = useState<string | null>(null);
  const [activeModalOrder, setActiveModalOrder] = useState<OrderItem | null>(null);

  const statusList = [
    { id: "ALL", label: "All", color: "bg-primary-container" },
    { id: "PROCESSING", label: "Processing", color: "bg-amber-400" },
    { id: "IN_PROGRESS", label: "In Progress", color: "bg-[#DBEF90]" },
    { id: "COMPLETED", label: "Completed", color: "bg-emerald-400" },
    { id: "PENDING", label: "Pending", color: "bg-slate-400" },
    { id: "PARTIAL", label: "Partial", color: "bg-purple-400" },
    { id: "CANCELLED", label: "Cancelled", color: "bg-rose-400" },
    { id: "REFUNDED", label: "Refunded", color: "bg-[#ffafd5]" },
  ];

  const getStatusCount = (statusKey: string) => {
    if (statusKey === "ALL") return orders.length;
    return orders.filter((o) => o.status === statusKey).length;
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = selectedStatus === "ALL" || order.status === selectedStatus;
    const matchesPlatform = selectedPlatform === "ALL" || order.platform.toLowerCase() === selectedPlatform.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      query === "" ||
      order.id.toLowerCase().includes(query) ||
      order.serviceName.toLowerCase().includes(query) ||
      order.target.toLowerCase().includes(query);

    return matchesStatus && matchesPlatform && matchesSearch;
  });

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#DBEF90]/15 text-[#DBEF90] border border-[#DBEF90]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#DBEF90]" />
            Completed
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            In Progress
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Processing
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Pending
          </span>
        );
      case "PARTIAL":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            Partial
          </span>
        );
      case "CANCELLED":
      case "REFUNDED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white">
            {status}
          </span>
        );
    }
  };

  const exportCSV = () => {
    const headers = ["Order ID", "Platform", "Service", "Target", "Quantity", "Remains", "Charge", "Status", "Created At"];
    const rows = filteredOrders.map((o) => [
      o.id,
      o.platform,
      `"${o.serviceName.replace(/"/g, '""')}"`,
      `"${o.target}"`,
      o.quantity,
      o.remains ?? 0,
      o.charge,
      o.status,
      o.createdAt,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `smm_orders_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full bg-[#0e0e0e] min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Header Telemetry Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#DBEF90]">
              <span className="w-2 h-2 rounded-full bg-[#DBEF90] animate-pulse shadow-[0_0_8px_rgba(219,239,144,0.8)]" />
              <span className="uppercase tracking-widest font-semibold">
                Algorithmic Execution Ledger / Cluster Telemetry
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-3xl md:text-4xl font-light text-white tracking-tight">Orders Log</h1>
              <span className="text-[#DBEF90] text-3xl font-light leading-none">*</span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Query real-time vector deliveries, node fulfillment states, and refill warranties.
            </p>
          </div>

          {/* Real-time Cluster SLA Metrics */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="liquid-glass-pill px-4 py-2.5 rounded-2xl flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-[10px] uppercase text-zinc-400 block">Active Vectors</span>
                <span className="text-white font-bold">{orders.length} Vectors • 99.8% SLA</span>
              </div>
              <div className="w-[1px] h-6 bg-white/10" />
              <div>
                <span className="text-[10px] uppercase text-zinc-400 block">Dispatch Latency</span>
                <span className="text-[#DBEF90] font-bold">18.4ms</span>
              </div>
            </div>

            <div className="liquid-glass-pill px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#DBEF90] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#DBEF90]" />
              </span>
              <span className="text-[#DBEF90] font-bold">Live Sync</span>
              <span className="text-zinc-400">4s poller</span>
            </div>
          </div>
        </div>

        {/* Status Filters Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {statusList.map((item) => {
            const count = getStatusCount(item.id);
            const isSelected = selectedStatus === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedStatus(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  isSelected
                    ? "bg-[#d8ec8d] text-[#2a3400] shadow-[0_0_16px_rgba(219,239,144,0.25)] font-bold scale-[1.02]"
                    : "bg-surface-container-low border border-white/5 text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    isSelected ? "bg-[#2a3400]/20 text-[#2a3400]" : "bg-white/10 text-on-surface-variant"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Platform Filters & Export Action Bar */}
        <div className="glass-panel p-4 rounded-3xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID (e.g. ORD-98421), Target URL, or Service Name..."
              className="w-full bg-[#161616]/80 border border-white/10 focus:border-[#DBEF90] rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none transition-all font-mono"
            />
          </div>

          {/* Platform Filter Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="bg-[#161616]/80 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none font-medium cursor-pointer"
            >
              <option value="ALL">All Platforms</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="tiktok">TikTok</option>
              <option value="telegram">Telegram</option>
              <option value="twitter">Twitter / X</option>
              <option value="spotify">Spotify</option>
              <option value="linkedin">LinkedIn</option>
            </select>

            {/* Export CSV Button */}
            <button
              onClick={exportCSV}
              className="px-4 py-2.5 rounded-2xl liquid-glass-pill hover:border-[#DBEF90]/40 text-xs font-semibold text-white flex items-center gap-2 transition-all shrink-0"
              title="Export Current Table as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* New Order CTA */}
            <Link
              href="/new-order"
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#DBEF90] to-[#bccf74] text-[#171e00] text-xs font-bold hover:brightness-110 flex items-center gap-1.5 shadow-[0_0_15px_rgba(219,239,144,0.25)] shrink-0"
            >
              <span>+ New Order</span>
            </Link>
          </div>
        </div>

        {/* Master Orders Table */}
        <div className="glass-panel p-4 md:p-6 rounded-3xl overflow-hidden">
          {orders.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={ShoppingBag}
                title="No orders yet"
                description="You haven't placed any orders yet. Place your first order to get started."
                actionText="Place your first order"
                actionHref="/new-order"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-on-surface-variant font-mono">
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Service & Platform</th>
                  <th className="py-3 px-3">Target Vector</th>
                  <th className="py-3 px-3">Volume & Remains</th>
                  <th className="py-3 px-3">Cost</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="w-8 h-8 text-on-surface-variant opacity-40" />
                        <span className="font-semibold text-white">No matching orders found</span>
                        <p className="text-xs text-on-surface-variant max-w-sm">
                          Try adjusting your status filter, platform, or search query.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const progressPercent =
                      order.quantity > 0 && order.remains !== null && order.remains !== undefined
                        ? Math.min(100, Math.round(((order.quantity - order.remains) / order.quantity) * 100))
                        : order.status === "COMPLETED"
                        ? 100
                        : 0;

                    return (
                      <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                        {/* Order ID with one-click copy */}
                        <td className="py-4 px-3 font-mono font-bold text-white whitespace-nowrap">
                          <button
                            onClick={() => handleCopy(order.id)}
                            className="inline-flex items-center gap-1.5 hover:text-[#DBEF90] transition-colors"
                            title="Click to copy ID"
                          >
                            <span className="text-[#DBEF90]">✦</span>
                            <span>{order.id}</span>
                            {copiedId === order.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 text-on-surface-variant" />
                            )}
                          </button>
                        </td>

                        {/* Timestamp */}
                        <td className="py-4 px-3 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        {/* Service & Platform */}
                        <td className="py-4 px-3">
                          <div className="font-medium text-white max-w-xs truncate">{order.serviceName}</div>
                          <div className="text-[10px] text-on-surface-variant uppercase font-mono mt-0.5">
                            {order.platform}
                          </div>
                        </td>

                        {/* Target Link */}
                        <td className="py-4 px-3">
                          <a
                            href={order.target}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-on-surface-variant hover:text-[#DBEF90] max-w-[180px] truncate transition-colors font-mono"
                          >
                            <span className="truncate">{order.target}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                          </a>
                        </td>

                        {/* Volume, Progress & Remains */}
                        <td className="py-4 px-3 font-mono min-w-[140px]">
                          <div className="flex items-center justify-between text-white font-semibold">
                            <span>{order.quantity.toLocaleString()}</span>
                            <span className="text-[10px] text-[#DBEF90]">{progressPercent}%</span>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1.5">
                            <div
                              className="h-full bg-gradient-to-r from-[#5b6b1b] to-[#DBEF90] rounded-full transition-all"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          {order.remains !== null && order.remains !== undefined && (
                            <div className="text-[10px] text-on-surface-variant mt-1">
                              Remains: {order.remains.toLocaleString()}
                            </div>
                          )}
                        </td>

                        {/* Charge */}
                        <td className="py-4 px-3 font-mono font-semibold text-[#DBEF90] whitespace-nowrap">
                          ₹{order.charge.toFixed(2)}
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-3 whitespace-nowrap">{getStatusBadge(order.status)}</td>

                        {/* Actions */}
                        <td className="py-4 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setActiveModalOrder(order)}
                              className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white text-[11px] font-medium transition-all"
                            >
                              Inspect
                            </button>

                            {order.refillable && (
                              <button
                                onClick={() => handleRefill(order.id)}
                                disabled={refillingId === order.id}
                                className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-[#DBEF90]/20 text-[#DBEF90] border border-white/10 hover:border-[#DBEF90]/40 text-[11px] font-semibold transition-all flex items-center gap-1"
                                title="Request Auto Refill"
                              >
                                <RefreshCw className={`w-3 h-3 ${refillingId === order.id ? "animate-spin" : ""}`} />
                                <span>Refill</span>
                              </button>
                            )}

                            {order.cancellable && (
                              <button
                                onClick={() => cancelOrder(order.id)}
                                className="px-2.5 py-1 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] font-semibold transition-all"
                              >
                                Cancel
                              </button>
                            )}

                            <Link
                              href={`/support?orderId=${order.id}`}
                              className="p-1 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-white transition-all"
                              title="Open Support Ticket"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>

      {/* Inspect Order Telemetry Modal */}
      {activeModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1c1b1b] border border-white/15 rounded-3xl p-6 max-w-lg w-full space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[#DBEF90] font-bold">✦</span>
                <h3 className="text-lg font-light text-white">Order Telemetry: {activeModalOrder.id}</h3>
              </div>
              <button
                onClick={() => setActiveModalOrder(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-on-surface-variant"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="bg-surface-container-high/40 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Service</span>
                  <span className="text-white font-semibold">{activeModalOrder.serviceName}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Platform</span>
                  <span className="text-white uppercase">{activeModalOrder.platform}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Target</span>
                  <a
                    href={activeModalOrder.target}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#DBEF90] underline truncate max-w-[220px]"
                  >
                    {activeModalOrder.target}
                  </a>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Start Count</span>
                  <span className="text-white">{activeModalOrder.startCount ?? "Syncing..."}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Total Ordered</span>
                  <span className="text-white">{activeModalOrder.quantity.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Units Remaining</span>
                  <span className="text-white">{activeModalOrder.remains?.toLocaleString() ?? 0}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Charge Deducted</span>
                  <span className="text-[#DBEF90] font-bold">₹{activeModalOrder.charge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Status</span>
                  <span>{getStatusBadge(activeModalOrder.status)}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 text-[11px] text-on-surface-variant leading-relaxed">
                ✦ AP-S1 Cluster Vector Node: Verified hash routing. Non-drop algorithmic daemon connected.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href={`/support?orderId=${activeModalOrder.id}`}
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
              >
                Open Ticket
              </Link>
              <button
                onClick={() => setActiveModalOrder(null)}
                className="px-5 py-2 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
