"use client";

import React, { useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { AdminCoupon } from "@/content/admin-data";
import {
  Tag,
  PlusCircle,
  Percent,
  Calendar,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Sparkles,
} from "lucide-react";

export default function AdminCouponsPage() {
  const { coupons, addCoupon, toggleCoupon } = useAdmin();
  const [isAdding, setIsAdding] = useState(false);

  // New Coupon Form
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [minDeposit, setMinDeposit] = useState<number>(1000);
  const [maxUsage, setMaxUsage] = useState<number>(500);

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    const newC: AdminCoupon = {
      id: `CPN-${Math.floor(10 + Math.random() * 90)}`,
      code: code.trim().toUpperCase(),
      discountType,
      discountValue,
      minDeposit,
      usageCount: 0,
      maxUsage,
      expiresAt: "2026-12-31T23:59:59Z",
      active: true,
    };

    addCoupon(newC);
    setIsAdding(false);
    setCode("");
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
                Promotional Campaign & Bonus Code Matrix
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">Coupons & Discounts</h1>
            <p className="text-xs text-on-surface-variant">
              Generate promotional coupon codes, percentage boosts on deposits, and usage caps.
            </p>
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="px-5 py-2.5 rounded-full btn-primary-gradient text-[#171e00] text-xs font-bold hover:brightness-110 flex items-center gap-2 shadow-[0_0_20px_rgba(216,236,141,0.25)] shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Promo Coupon</span>
          </button>
        </div>

        {/* Add Coupon Modal */}
        {isAdding && (
          <form
            onSubmit={handleCreateCoupon}
            className="glass-panel rounded-3xl p-6 md:p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-semibold text-white">Create Promo Coupon</h3>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-xs text-on-surface-variant hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Coupon Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. FESTIVE25"
                  required
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Discount Type
                </label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "PERCENT" | "FIXED")}
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white"
                >
                  <option value="PERCENT">Percentage (%) Bonus</option>
                  <option value="FIXED">Flat (₹) Credit</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Value ({discountType === "PERCENT" ? "%" : "₹"})
                </label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Min Deposit (INR)
                </label>
                <input
                  type="number"
                  value={minDeposit}
                  onChange={(e) => setMinDeposit(Number(e.target.value))}
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-on-surface-variant block mb-1">
                  Max Uses
                </label>
                <input
                  type="number"
                  value={maxUsage}
                  onChange={(e) => setMaxUsage(Number(e.target.value))}
                  className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-2 rounded-full btn-primary-gradient text-[#171e00] text-xs font-bold hover:brightness-110 shadow-md"
              >
                Save & Activate Coupon
              </button>
            </div>
          </form>
        )}

        {/* Coupons Table */}
        <div className="glass-panel rounded-3xl p-4 md:p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase font-mono text-on-surface-variant">
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Discount Bonus</th>
                  <th className="py-3 px-3">Min Deposit</th>
                  <th className="py-3 px-3">Claimed Usage</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-3 font-mono font-bold text-white whitespace-nowrap">
                      {coupon.code}
                    </td>
                    <td className="py-4 px-3 font-mono font-bold text-emerald-400">
                      {coupon.discountType === "PERCENT"
                        ? `${coupon.discountValue}% Bonus`
                        : `+₹${coupon.discountValue} Flat`}
                    </td>
                    <td className="py-4 px-3 font-mono text-white">
                      ₹{coupon.minDeposit.toLocaleString()}
                    </td>
                    <td className="py-4 px-3 font-mono text-on-surface-variant">
                      {coupon.usageCount} / {coupon.maxUsage || "∞"} claims
                    </td>
                    <td className="py-4 px-3 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          coupon.active
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {coupon.active ? "ACTIVE" : "DISABLED"}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => toggleCoupon(coupon.id)}
                        className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold"
                      >
                        {coupon.active ? "Deactivate" : "Activate"}
                      </button>
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
