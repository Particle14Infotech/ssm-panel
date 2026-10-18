"use client";


import React, { useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { OrderStatus, OrderItem } from "@smm/contracts";
import {
  Search,
  Filter,
  Download,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ExternalLink,
  RefreshCw,
  Edit,
  Save,
} from "lucide-react";

export default function AdminOrdersPage() {
  const { orders, updateOrderStatus, resendOrderToProvider, refreshAdminData } = useAdmin();
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editStatusValue, setEditStatusValue] = useState<OrderStatus>("PENDING");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [dripFeedOnly, setDripFeedOnly] = useState<boolean>(false);
  const [selectedTraceOrder, setSelectedTraceOrder] = useState<OrderItem | null>(null);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshAdminData();
    setIsRefreshing(false);
  };

  // Auto-refresh orders every 10 seconds for real-time supervisor telemetry
  React.useEffect(() => {
    const interval = setInterval(() => {
      refreshAdminData();
    }, 10000);
    return () => clearInterval(interval);
  }, [refreshAdminData]);

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = selectedStatus === "ALL" || o.status === selectedStatus;
    const matchesDrip = !dripFeedOnly || Boolean(o.isDripFeed);
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === "" ||
      o.id.toLowerCase().includes(q) ||
      o.userId.toLowerCase().includes(q) ||
      (o.userEmail && o.userEmail.toLowerCase().includes(q)) ||
      (o.providerOrderId && o.providerOrderId.toLowerCase().includes(q)) ||
      (o.providerName && o.providerName.toLowerCase().includes(q)) ||
      o.serviceName.toLowerCase().includes(q) ||
      o.target.toLowerCase().includes(q);

    return matchesStatus && matchesDrip && matchesSearch;
  });

  const handleSaveStatus = (orderId: string) => {
    updateOrderStatus(orderId, editStatusValue);
    setEditingOrderId(null);
  };

  const handleResend = async (orderId: string) => {
    await resendOrderToProvider(orderId);
    alert(`Order ${orderId} resent to upstream provider node queue.`);
  };

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Header Telemetry */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#D8EC8D]">
              <span className="w-2 h-2 rounded-full bg-[#D8EC8D] animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Root Orders Administration / Execution Supervisor
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">Admin Orders Ledger</h1>
            <p className="text-xs text-on-surface-variant">
              Override fulfillment states, resend stuck provider vectors, or issue direct ledger refunds.
            </p>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-[#D8EC8D]/40 text-xs font-mono text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#D8EC8D] ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh Orders"}</span>
          </button>
        </div>

        {/* Filters & Search */}
        <div className="glass-panel rounded-3xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, User ID, Target URL, or Service..."
              className="w-full bg-surface-container-highest/80 border border-white/5 focus:border-[#D8EC8D]/50 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setDripFeedOnly(!dripFeedOnly)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-mono font-semibold transition-all flex items-center gap-2 ${
                dripFeedOnly
                  ? "btn-primary-gradient text-[#171e00] shadow-sm shadow-[#D8EC8D]/20"
                  : "bg-surface-container-highest/80 border border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <span>Drip-feed Only</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-bold">
                {orders.filter((o) => o.isDripFeed).length}
              </span>
            </button>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-surface-container-highest/80 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white font-medium cursor-pointer"
            >
              <option value="ALL">All Statuses ({orders.length})</option>
              <option value="PROCESSING">Processing</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="glass-panel rounded-3xl p-4 md:p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase font-mono text-on-surface-variant">
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Service & Platform</th>
                  <th className="py-3 px-3">Target URL</th>
                  <th className="py-3 px-3">Qty / Remains</th>
                  <th className="py-3 px-3">Charge</th>
                  <th className="py-3 px-3">Provider Ref</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Root Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-3 font-mono font-bold text-white whitespace-nowrap">
                      <div>{order.id.slice(0, 8)}...</div>
                      <div className="text-[10px] text-on-surface-variant font-normal">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                      </div>
                    </td>
                    <td className="py-4 px-3 font-mono text-on-surface-variant whitespace-nowrap">
                      <div className="text-white font-medium">{order.userEmail || order.userId}</div>
                      <div className="text-[10px] text-white/40">{order.userId}</div>
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-medium text-white max-w-xs truncate">{order.serviceName}</div>
                      <div className="text-[10px] text-on-surface-variant uppercase font-mono mt-0.5">
                        {order.platform}
                      </div>
                    </td>
                    <td className="py-4 px-3">
                      <a
                        href={order.target}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#D8EC8D] hover:underline font-mono truncate max-w-[160px] inline-flex items-center gap-1"
                      >
                        <span className="truncate">{order.target}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </td>
                    <td className="py-4 px-3 font-mono text-white">
                      {order.isDripFeed ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.2 rounded bg-[#D8EC8D]/15 text-[#D8EC8D] text-[10px] font-semibold">
                              Drip-feed
                            </span>
                            <span className="font-semibold text-[#D8EC8D]">
                              {(order.totalQuantity ?? (order.runs ? order.quantity * order.runs : order.quantity)).toLocaleString()} units
                            </span>
                          </div>
                          <div className="text-[10px] text-on-surface-variant">
                            {order.quantityPerRun ?? order.quantity} / run × {order.runs} runs ({order.intervalMinutes}m)
                          </div>
                          <div className="text-[10px] text-on-surface-variant">
                            Remains: {order.remains ?? 0}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>{order.quantity.toLocaleString()} units</div>
                          <div className="text-[10px] text-on-surface-variant">
                            Remains: {order.remains ?? 0}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="py-4 px-3 font-mono font-semibold text-[#D8EC8D] whitespace-nowrap">
                      ₹{order.charge.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-xs whitespace-nowrap">
                      {order.providerOrderId ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px]">
                          #{order.providerOrderId}
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/30 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-4 px-3 whitespace-nowrap">
                      {editingOrderId === order.id ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={editStatusValue}
                            onChange={(e) => setEditStatusValue(e.target.value as OrderStatus)}
                            className="bg-black border border-white/20 rounded-lg px-2 py-1 text-xs text-white"
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="PROCESSING">PROCESSING</option>
                            <option value="IN_PROGRESS">IN_PROGRESS</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="PARTIAL">PARTIAL</option>
                            <option value="CANCELLED">CANCELLED</option>
                            <option value="REFUNDED">REFUNDED</option>
                          </select>
                          <button
                            onClick={() => handleSaveStatus(order.id)}
                            className="p-1 rounded btn-primary-gradient text-[#171e00]"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingOrderId(order.id);
                            setEditStatusValue(order.status);
                          }}
                          className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors flex items-center gap-1"
                          title="Click to edit status"
                        >
                          <span>{order.status}</span>
                          <Edit className="w-2.5 h-2.5 opacity-60" />
                        </button>
                      )}
                    </td>
                    <td className="py-4 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedTraceOrder(order)}
                          className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-mono transition-colors"
                          title="View Provider Execution Trace & Events"
                        >
                          Trace
                        </button>
                        <button
                          onClick={() => handleResend(order.id)}
                          className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white text-[10px] font-mono transition-all flex items-center gap-1"
                          title="Resend to Provider Node"
                        >
                          <RefreshCw className="w-3 h-3 text-[#D8EC8D]" />
                          <span>Resend</span>
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                          className="px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-semibold"
                        >
                          Force Complete
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.id, "REFUNDED")}
                          className="px-2.5 py-1 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[10px] font-mono font-semibold"
                        >
                          Refund
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Provider Execution Trace Modal */}
        {selectedTraceOrder && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#1c1b1b] border border-white/15 rounded-3xl p-6 md:p-8 max-w-2xl w-full space-y-5 shadow-2xl relative text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-mono text-[#D8EC8D] font-bold uppercase block">
                    Provider Execution Trace
                  </span>
                  <h3 className="text-base font-semibold text-white">Order #{selectedTraceOrder.id}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTraceOrder(null)}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-mono"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                <div className="bg-white/5 p-2.5 rounded-xl">
                  <span className="text-slate-400 block text-[10px]">Service</span>
                  <span className="text-white font-medium truncate block">{selectedTraceOrder.serviceName}</span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl">
                  <span className="text-slate-400 block text-[10px]">Mode</span>
                  <span className={selectedTraceOrder.isDripFeed ? "text-[#D8EC8D] font-bold" : "text-white"}>
                    {selectedTraceOrder.isDripFeed ? `Drip-feed (${selectedTraceOrder.runs} runs)` : "Direct Single"}
                  </span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl">
                  <span className="text-slate-400 block text-[10px]">Total Qty</span>
                  <span className="text-white font-bold">{selectedTraceOrder.totalQuantity ?? selectedTraceOrder.quantity}</span>
                </div>
                <div className="bg-white/5 p-2.5 rounded-xl">
                  <span className="text-slate-400 block text-[10px]">Provider Ref</span>
                  <span className="text-emerald-300 font-bold">#{selectedTraceOrder.providerOrderId || "None"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">
                  Sanitized Upstream Events ({selectedTraceOrder.providerEvents?.length || 0})
                </span>
                {(!selectedTraceOrder.providerEvents || selectedTraceOrder.providerEvents.length === 0) ? (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-slate-400 text-center font-mono">
                    No provider telemetry events recorded yet for this order.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedTraceOrder.providerEvents.map((evt: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5 font-mono text-[11px]">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="text-[#D8EC8D] font-bold uppercase">{evt.action}</span>
                          <span>{evt.createdAt ? new Date(evt.createdAt).toLocaleTimeString() : ""}</span>
                        </div>
                        {evt.requestPayload && (
                          <div>
                            <span className="text-[10px] text-slate-500 block">Request Params:</span>
                            <pre className="text-[10px] bg-white/5 p-1.5 rounded overflow-x-auto text-slate-300">
                              {typeof evt.requestPayload === "string" ? evt.requestPayload : JSON.stringify(evt.requestPayload, null, 2)}
                            </pre>
                          </div>
                        )}
                        {evt.responsePayload && (
                          <div>
                            <span className="text-[10px] text-slate-500 block">Provider Response:</span>
                            <pre className="text-[10px] bg-white/5 p-1.5 rounded overflow-x-auto text-emerald-300">
                              {typeof evt.responsePayload === "string" ? evt.responsePayload : JSON.stringify(evt.responsePayload, null, 2)}
                            </pre>
                          </div>
                        )}
                        {evt.error && (
                          <div className="text-rose-400 text-[10px]">
                            Error: {evt.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
