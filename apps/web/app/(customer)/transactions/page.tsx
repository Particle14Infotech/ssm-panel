"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import {
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Search,
  Download,
  Filter,
  ShieldCheck,
  PlusCircle,
} from "lucide-react";
import { TransactionType } from "@smm/contracts";

export default function TransactionsPage() {
  const { user, transactions } = useCustomer();
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = transactions.filter((t) => {
    if (selectedType !== "ALL" && t.status !== selectedType && t.method !== selectedType) {
      return false;
    }
    if (
      searchQuery &&
      !t.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.referenceId.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#d8ec8d] animate-pulse" />
            <span className="text-xs uppercase tracking-widest font-mono text-[#d8ec8d]">
              Financial Ledger & Audit Trail
            </span>
          </div>
          <h1 className="text-3xl font-light text-white mt-1">Transaction Ledger</h1>
          <p className="text-xs text-[#c7c8b6] mt-0.5">
            Cryptographically audited append-only accounting. Every credit and debit is immutable.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="liquid-glass-pill px-4 py-2 flex items-center gap-2">
            <span className="text-xs font-mono text-[#c7c8b6]">Balance:</span>
            <span className="text-sm font-bold text-[#d8ec8d] font-mono">
              ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <Link
            href="/app/wallet"
            className="px-4 py-2 rounded-full bg-gradient-to-r from-[#d8ec8d] to-[#bccf74] text-[#171e00] font-bold text-xs hover:shadow-[0_0_20px_rgba(216,236,141,0.3)] transition-all flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Funds</span>
          </Link>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 glass-panel p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#c7c8b6]" />
          <input
            type="text"
            placeholder="Search by Txn ID or Ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-full bg-[#201f1f] border border-white/5 text-xs text-white placeholder:text-[#c7c8b6]/50 focus:outline-none focus:border-[#d8ec8d]/40"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {["ALL", "SUCCESS", "PENDING", "UPI", "CARD", "NETBANKING"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-all ${
                selectedType === type
                  ? "bg-[#d8ec8d] text-[#171e00] font-bold"
                  : "bg-[#201f1f] text-[#c7c8b6] hover:text-white"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-3xl overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#141414] text-[#c7c8b6] text-[11px] uppercase tracking-wider font-mono border-b border-white/10">
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Reference ID</th>
                <th className="py-3 px-4">Method / Channel</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4 text-right">Bonus Credit</th>
                <th className="py-3 px-4 text-right">Net Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#c7c8b6]">
                    No ledger entries found matching filters.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const isCredit = tx.amount >= 0;
                  return (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-white font-semibold flex items-center gap-1.5">
                        {isCredit ? (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span>{tx.id}</span>
                      </td>
                      <td className="py-3 px-4 text-[#c7c8b6]">{tx.referenceId}</td>
                      <td className="py-3 px-4 text-white">{tx.method}</td>
                      <td className="py-3 px-4 text-[#c7c8b6]">
                        {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-right text-[#d8ec8d]">
                        {tx.bonus > 0 ? `+₹${tx.bonus.toFixed(2)}` : "—"}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${isCredit ? "text-emerald-400" : "text-rose-400"}`}>
                        {isCredit ? `+₹${tx.amount.toFixed(2)}` : `-₹${Math.abs(tx.amount).toFixed(2)}`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
