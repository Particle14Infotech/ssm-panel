"use client";

import React, { useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import {
  Wallet,
  PlusCircle,
  MinusCircle,
  Search,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
} from "lucide-react";

export default function AdminWalletsPage() {
  const { users, adjustUserBalance } = useAdmin();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(100);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustType, setAdjustType] = useState<"ADD" | "DEDUCT">("ADD");

  const totalLiability = users.reduce((acc, u) => acc + u.balance, 0);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdjust = () => {
    if (!selectedUser || !adjustAmount || !adjustReason) return;
    const finalDelta = adjustType === "ADD" ? adjustAmount : -adjustAmount;
    adjustUserBalance(selectedUser.id, finalDelta, adjustReason);
    setSelectedUser(null);
    setAdjustReason("");
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#d8ec8d] animate-pulse" />
              <span className="text-xs uppercase tracking-widest font-mono text-[#d8ec8d]">
                Liquidity & Ledger Operations
              </span>
            </div>
            <h1 className="text-3xl font-light text-white mt-1">Wallet & Liability Manager</h1>
            <p className="text-xs text-[#c7c8b6] mt-0.5">
              Monitor customer wallet deposits, platform liabilities, and process audited balance adjustments.
            </p>
          </div>

          <div className="liquid-glass-pill px-5 py-3 flex items-center gap-3">
            <Wallet className="w-6 h-6 text-[#d8ec8d]" />
            <div>
              <span className="text-[10px] uppercase tracking-wider font-mono text-[#c7c8b6] block">
                Total Platform Liability
              </span>
              <span className="text-lg font-bold font-mono text-[#d8ec8d]">
                ₹{totalLiability.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Adjust Balance Modal */}
        {selectedUser && (
          <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Audited Wallet Adjustment: {selectedUser.name} ({selectedUser.id})
              </h2>
              <span className="text-xs font-mono text-[#d8ec8d]">
                Current Balance: ₹{selectedUser.balance.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-[#c7c8b6] block mb-1">Adjustment Type</label>
                <div className="flex rounded-xl bg-[#131313] p-1 border border-white/10">
                  <button
                    onClick={() => setAdjustType("ADD")}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                      adjustType === "ADD" ? "bg-emerald-500 text-black" : "text-[#c7c8b6]"
                    }`}
                  >
                    + Credit
                  </button>
                  <button
                    onClick={() => setAdjustType("DEDUCT")}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                      adjustType === "DEDUCT" ? "bg-rose-500 text-white" : "text-[#c7c8b6]"
                    }`}
                  >
                    - Debit
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#c7c8b6] block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  className="w-full bg-[#131313] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d8ec8d]"
                />
              </div>

              <div>
                <label className="text-xs text-[#c7c8b6] block mb-1">Audited Reason (Required)</label>
                <input
                  type="text"
                  placeholder="e.g. Manual VIP promotional bonus or goodwill refund"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-[#131313] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d8ec8d]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-1.5 rounded-full bg-[#201f1f] text-xs text-[#c7c8b6] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjust}
                disabled={!adjustReason}
                className="px-4 py-1.5 rounded-full bg-[#d8ec8d] text-[#171e00] font-bold text-xs disabled:opacity-50"
              >
                Confirm Ledger Entry
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#c7c8b6]" />
          <input
            type="text"
            placeholder="Search users by name, email, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-full bg-[#1c1b1b] border border-white/10 text-xs text-white placeholder:text-[#c7c8b6]/50 focus:outline-none focus:border-[#d8ec8d]/40"
          />
        </div>

        {/* Users Wallet Table */}
        <div className="glass-panel rounded-3xl overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#141414] text-[#c7c8b6] text-[11px] uppercase tracking-wider font-mono border-b border-white/10">
                <th className="py-3 px-4">User ID</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Account Tier</th>
                <th className="py-3 px-4 text-right">Available Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ledger Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-[#c7c8b6]">{u.id}</td>
                  <td className="py-3 px-4 text-white font-medium">{u.name}</td>
                  <td className="py-3 px-4 text-[#c7c8b6]">{u.email}</td>
                  <td className="py-3 px-4 text-[#d8ec8d]">{u.tier}</td>
                  <td className="py-3 px-4 text-right font-bold text-white">
                    ₹{u.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="px-3 py-1 rounded-full bg-[#201f1f] hover:bg-[#d8ec8d] hover:text-black text-[11px] text-white transition-all"
                    >
                      Adjust Balance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}
