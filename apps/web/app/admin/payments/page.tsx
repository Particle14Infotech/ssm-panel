"use client";

import React, { useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import {
  Search,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  DollarSign,
  Download,
} from "lucide-react";

export default function AdminPaymentsPage() {
  const { transactions, approvePayment } = useAdmin();
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredTxns = transactions.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      q === "" ||
      t.id.toLowerCase().includes(q) ||
      t.userId.toLowerCase().includes(q) ||
      t.method.toLowerCase().includes(q) ||
      t.referenceId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Header Telemetry */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#D8EC8D]">
              <span className="w-2 h-2 rounded-full bg-[#D8EC8D] animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Financial Audit Trail & Gateway Verifications
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">Payment Audits</h1>
            <p className="text-xs text-on-surface-variant">
              Reconcile incoming UPI QR, Stripe card, and crypto USDT wallet liquidity credits.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="glass-panel rounded-3xl p-4 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Transaction ID, User ID, Reference Hash, or Gateway..."
              className="w-full bg-surface-container-highest/80 border border-white/5 focus:border-[#D8EC8D]/50 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Payments Table */}
        <div className="glass-panel rounded-3xl p-4 md:p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase font-mono text-on-surface-variant">
                  <th className="py-3 px-3">Txn ID</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Gateway Method</th>
                  <th className="py-3 px-3">Reference ID / Hash</th>
                  <th className="py-3 px-3">Amount Deposited</th>
                  <th className="py-3 px-3">Bonus</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTxns.map((txn) => (
                  <tr key={txn.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-3 font-mono font-bold text-white whitespace-nowrap">
                      {txn.id}
                    </td>
                    <td className="py-4 px-3 font-mono text-on-surface-variant whitespace-nowrap">
                      {new Date(txn.createdAt).toLocaleString()}
                    </td>
                    <td className="py-4 px-3 font-mono text-white whitespace-nowrap">
                      {txn.userId}
                    </td>
                    <td className="py-4 px-3 font-medium text-white">{txn.method}</td>
                    <td className="py-4 px-3 font-mono text-on-surface-variant truncate max-w-[160px]">
                      {txn.referenceId}
                    </td>
                    <td className="py-4 px-3 font-mono font-bold text-white whitespace-nowrap">
                      ₹{txn.amount.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-emerald-400 whitespace-nowrap">
                      +₹{txn.bonus.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          txn.status === "SUCCESS"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {txn.status}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right whitespace-nowrap">
                      {txn.status !== "SUCCESS" && (
                        <button
                          onClick={() => approvePayment(txn.id)}
                          className="px-3 py-1 rounded-full bg-emerald-500 text-black text-[11px] font-bold hover:brightness-110 shadow-sm"
                        >
                          Manual Approve
                        </button>
                      )}
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
