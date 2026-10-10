"use client";

import React, { useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { AdminUser } from "@/content/admin-data";
import {
  Search,
  Users,
  DollarSign,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Shield,
  CreditCard,
  Edit,
} from "lucide-react";

export default function AdminUsersPage() {
  const { users, updateUserBalance, updateUserStatus } = useAdmin();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [balanceModalUser, setBalanceModalUser] = useState<AdminUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(500);
  const [adjustType, setAdjustType] = useState<"ADD" | "DEDUCT">("ADD");

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      q === "" ||
      u.id.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceModalUser) return;

    const newBalance =
      adjustType === "ADD"
        ? balanceModalUser.balance + adjustAmount
        : Math.max(0, balanceModalUser.balance - adjustAmount);

    updateUserBalance(balanceModalUser.id, Number(newBalance.toFixed(2)));
    setBalanceModalUser(null);
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
                Customer Directory & Ledger Adjustments
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">User Directory</h1>
            <p className="text-xs text-on-surface-variant">
              Inspect user spending metrics, modify liquid wallet balances, and set tier privileges.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-[#1c1b1b]/80 border border-white/10 rounded-3xl p-4 backdrop-blur-2xl flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user by name, email, or user ID..."
              className="w-full bg-surface-container-highest/80 border border-white/5 focus:border-[#DBEF90] rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-[#1c1b1b]/80 border border-white/10 rounded-3xl p-4 md:p-6 backdrop-blur-2xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase font-mono text-on-surface-variant">
                  <th className="py-3 px-3">User ID</th>
                  <th className="py-3 px-3">Full Name & Email</th>
                  <th className="py-3 px-3">Current Balance</th>
                  <th className="py-3 px-3">Total Spent</th>
                  <th className="py-3 px-3">Orders</th>
                  <th className="py-3 px-3">Account Tier</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-3 font-mono font-bold text-white whitespace-nowrap">
                      <span className="text-[#DBEF90] mr-1">✦</span>
                      {user.id}
                    </td>
                    <td className="py-4 px-3">
                      <div className="font-semibold text-white">{user.name}</div>
                      <div className="text-[11px] text-on-surface-variant font-mono">{user.email}</div>
                    </td>
                    <td className="py-4 px-3 font-mono font-bold text-[#DBEF90] whitespace-nowrap">
                      ₹{user.balance.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-white whitespace-nowrap">
                      ₹{user.totalSpent.toLocaleString()}
                    </td>
                    <td className="py-4 px-3 font-mono text-on-surface-variant">
                      {user.totalOrders}
                    </td>
                    <td className="py-4 px-3 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#DBEF90]/15 text-[#DBEF90] border border-[#DBEF90]/30">
                        {user.tier}
                      </span>
                    </td>
                    <td className="py-4 px-3 whitespace-nowrap">
                      <button
                        onClick={() =>
                          updateUserStatus(
                            user.id,
                            user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
                          )
                        }
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          user.status === "ACTIVE"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {user.status}
                      </button>
                    </td>
                    <td className="py-4 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setBalanceModalUser(user)}
                        className="px-3 py-1 rounded-full bg-white/5 hover:bg-[#DBEF90] text-white hover:text-[#2a3400] text-[11px] font-semibold transition-all inline-flex items-center gap-1"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>Adjust Balance</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Adjust Balance Modal */}
      {balanceModalUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleAdjustSubmit}
            className="bg-[#1c1b1b] border border-white/15 rounded-3xl p-6 md:p-8 max-w-md w-full space-y-4 shadow-2xl relative text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-semibold text-white">
                Adjust Wallet: {balanceModalUser.name}
              </h3>
              <button
                type="button"
                onClick={() => setBalanceModalUser(null)}
                className="text-xs text-on-surface-variant hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 font-mono">
              <div className="bg-surface-container-high/40 rounded-2xl p-3.5 flex justify-between text-on-surface-variant">
                <span>Current Balance:</span>
                <span className="text-[#DBEF90] font-bold">₹{balanceModalUser.balance.toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType("ADD")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    adjustType === "ADD"
                      ? "bg-emerald-500 text-black"
                      : "bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  + Add Credit
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType("DEDUCT")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    adjustType === "DEDUCT"
                      ? "bg-rose-500 text-white"
                      : "bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  - Deduct Balance
                </button>
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Adjustment Amount (INR)
                </label>
                <input
                  type="number"
                  min={1}
                  step={10}
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBalanceModalUser(null)}
                className="px-4 py-2 rounded-full bg-white/10 text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110"
              >
                Confirm Adjustment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
