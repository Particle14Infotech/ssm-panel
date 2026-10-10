"use client";

import React, { useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { OrderStatus } from "@smm/contracts";
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
  const { orders, updateOrderStatus, resendOrderToProvider } = useAdmin();
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editStatusValue, setEditStatusValue] = useState<OrderStatus>("PENDING");

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = selectedStatus === "ALL" || o.status === selectedStatus;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === "" ||
      o.id.toLowerCase().includes(q) ||
      o.userId.toLowerCase().includes(q) ||
      o.serviceName.toLowerCase().includes(q) ||
      o.target.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
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
    <div className="w-full bg-[#0e0e0e] min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Header Telemetry */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#DBEF90]">
              <span className="w-2 h-2 rounded-full bg-[#DBEF90] animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Root Orders Administration / Execution Supervisor
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">Admin Orders Ledger</h1>
            <p className="text-xs text-on-surface-variant">
              Override fulfillment states, resend stuck provider vectors, or issue direct ledger refunds.
            </p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-[#1c1b1b]/80 border border-white/10 rounded-3xl p-4 backdrop-blur-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, User ID, Target URL, or Service..."
              className="w-full bg-surface-container-highest/80 border border-white/5 focus:border-[#DBEF90] rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
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
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-[#1c1b1b]/80 border border-white/10 rounded-3xl p-4 md:p-6 backdrop-blur-2xl shadow-2xl overflow-hidden">
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
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Root Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-3 font-mono font-bold text-white whitespace-nowrap">
                      <span className="text-[#DBEF90] mr-1">✦</span>
                      {order.id}
                    </td>
                    <td className="py-4 px-3 font-mono text-on-surface-variant whitespace-nowrap">
                      {order.userId}
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
                        className="text-[#DBEF90] hover:underline font-mono truncate max-w-[160px] inline-flex items-center gap-1"
                      >
                        <span className="truncate">{order.target}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </td>
                    <td className="py-4 px-3 font-mono text-white">
                      <div>{order.quantity.toLocaleString()} units</div>
                      <div className="text-[10px] text-on-surface-variant">
                        Remains: {order.remains ?? 0}
                      </div>
                    </td>
                    <td className="py-4 px-3 font-mono font-semibold text-[#DBEF90] whitespace-nowrap">
                      ₹{order.charge.toFixed(2)}
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
                            className="p-1 rounded bg-[#DBEF90] text-[#2a3400]"
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
                          onClick={() => handleResend(order.id)}
                          className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white text-[10px] font-mono transition-all flex items-center gap-1"
                          title="Resend to Provider Node"
                        >
                          <RefreshCw className="w-3 h-3 text-[#DBEF90]" />
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
      </div>
    </div>
  );
}
