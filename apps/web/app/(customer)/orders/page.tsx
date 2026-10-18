"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { GlassCard } from "@/components/shared/GlassCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { motion } from "framer-motion";

export default function OrdersPage() {
  const { orders, refillOrder, cancelOrder } = useCustomer();
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refillingId, setRefillingId] = useState<string | null>(null);
  const [activeModalOrder, setActiveModalOrder] = useState<OrderItem | null>(null);

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
    if (statusKey === "ALL") return orders.length;
    return orders.filter((o) => o.status === statusKey).length;
  };

  const filteredOrders = orders.filter((order) => {
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
      {/* Header Clean (Telemetry badge removed) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-white tracking-tight">Orders History</h1>
          <p className="text-xs text-slate-400">
            View real-time delivery status, start count tracking, and warranty refills.
          </p>
        </div>

        <Link
          href="/new-order"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl btn-primary-gradient hover:brightness-105 text-[#171e00] text-xs font-bold shadow-sm transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>New Order</span>
        </Link>
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
                    : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
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
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1 border-t border-white/5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by Order ID, service name, or target link..."
              className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full sm:w-44 bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-sans"
            >
              <option value="ALL" className="bg-[#131313]">All Platforms</option>
              <option value="instagram" className="bg-[#131313]">Instagram</option>
              <option value="youtube" className="bg-[#131313]">YouTube</option>
              <option value="tiktok" className="bg-[#131313]">TikTok</option>
              <option value="telegram" className="bg-[#131313]">Telegram</option>
              <option value="twitter" className="bg-[#131313]">X (Twitter)</option>
              <option value="spotify" className="bg-[#131313]">Spotify</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="glass-panel p-4 md:p-6 rounded-3xl overflow-hidden space-y-4">
        {orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="You have not placed any orders yet. Select a service to launch your first social media campaign."
            actionText="Place your first order"
            actionHref="/new-order"
          />
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-mono">
            No orders match the current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
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
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Order ID */}
                    <td className="py-3.5 px-3 font-mono font-semibold text-white whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#D8EC8D]">#</span>
                        <span>{order.id}</span>
                        <button
                          onClick={() => handleCopy(order.id)}
                          className="text-slate-400 hover:text-white"
                          title="Copy ID"
                        >
                          {copiedId === order.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
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
                      <div className="font-medium text-white max-w-xs truncate">{order.serviceName}</div>
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
                        className="text-slate-300 hover:text-[#D8EC8D] max-w-[180px] truncate block"
                        title={order.target}
                      >
                        {order.target}
                      </a>
                    </td>

                    {/* Quantity */}
                    <td className="py-3.5 px-3 font-mono">
                      {order.isDripFeed ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded bg-[#D8EC8D]/15 text-[#D8EC8D] text-[10px] font-semibold">
                              Drip-feed
                            </span>
                            <span className="text-white font-medium">
                              {order.totalQuantity ?? (order.runs ? order.quantity * order.runs : order.quantity)} total
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {order.quantityPerRun ?? order.quantity} × {order.runs} runs ({order.intervalMinutes}m)
                          </div>
                          {order.remains !== null && order.remains !== undefined && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Remains: {order.remains.toLocaleString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <>
                          <span className="text-white font-medium">{order.quantity.toLocaleString()}</span>
                          {order.remains !== null && order.remains !== undefined && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Remains: {order.remains.toLocaleString()}
                            </span>
                          )}
                        </>
                      )}
                    </td>

                    {/* Charge */}
                    <td className="py-3.5 px-3 font-mono font-semibold text-white whitespace-nowrap">
                      ₹{order.charge.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <StatusBadge status={order.status} />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveModalOrder(order)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-all"
                        >
                          Details
                        </button>

                        {order.refillable && (
                          <button
                            type="button"
                            onClick={() => handleRefill(order.id)}
                            disabled={refillingId === order.id}
                            className="px-2.5 py-1 rounded-lg bg-[#D8EC8D]/15 hover:bg-[#D8EC8D]/25 text-[#D8EC8D] text-xs font-medium transition-all flex items-center gap-1"
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
        )}
      </div>

      {/* Details & Timeline Drawer / Modal */}
      {activeModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1c1b1b] border border-white/15 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-6 shadow-2xl relative text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-mono text-[#D8EC8D] font-semibold">
                  Order Telemetry & Execution Lifecycle
                </span>
                <h3 className="text-base font-semibold text-white">Order #{activeModalOrder.id}</h3>
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
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                Dispatch Lifecycle
              </div>
              <div className="flex items-center justify-between relative pt-1">
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-5 h-5 rounded-full bg-[#D8EC8D] text-[#131313] flex items-center justify-center text-[10px] font-bold">
                    1
                  </div>
                  <span className="text-[10px] font-mono text-slate-300">Created</span>
                </div>
                <div className="flex-1 h-0.5 bg-[#D8EC8D]/40 -mt-3" />

                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-5 h-5 rounded-full bg-[#D8EC8D] text-[#131313] flex items-center justify-center text-[10px] font-bold">
                    2
                  </div>
                  <span className="text-[10px] font-mono text-slate-300">Dispatched</span>
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
                  <span className="text-[10px] font-mono text-slate-300">
                    {activeModalOrder.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Spec Details */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Service</span>
                <span className="text-white font-medium truncate max-w-[200px]">{activeModalOrder.serviceName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Platform</span>
                <span className="text-white uppercase">{activeModalOrder.platform}</span>
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
                    <span className="text-white font-medium">{(activeModalOrder.quantityPerRun ?? activeModalOrder.quantity).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Total Quantity</span>
                    <span className="text-white font-bold">{(activeModalOrder.totalQuantity ?? (activeModalOrder.runs ? activeModalOrder.quantity * activeModalOrder.runs : activeModalOrder.quantity)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Estimated Schedule</span>
                    <span className="text-white">{((activeModalOrder.runs || 1) - 1) * (activeModalOrder.intervalMinutes || 0)} mins</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-400">
                  <span>Quantity</span>
                  <span className="text-white">{activeModalOrder.quantity.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>Start Count</span>
                <span className="text-white">{activeModalOrder.startCount ?? 0}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Units Remaining</span>
                <span className="text-white">{activeModalOrder.remains ?? 0}</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between text-white font-semibold">
                <span>Total Charge</span>
                <span>₹{activeModalOrder.charge.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href={`/support?orderId=${activeModalOrder.id}`}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors"
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
    </motion.div>
  );
}
