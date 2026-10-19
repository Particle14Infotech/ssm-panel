"use client";

import React from "react";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import { GlassCard } from "@/components/shared/GlassCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import {
  Boxes,
  PlusCircle,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  RotateCcw,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";

export default function PackagesListPage() {
  const { packages, isLoading } = useCustomer();

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-[#D8EC8D]/10 border border-[#D8EC8D]/30 flex items-center justify-center text-[#D8EC8D]">
              <Boxes className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Growth Packages</h1>
          </div>
          <p className="text-sm text-slate-400">
            Multi-service drip delivery bundles scheduled over days and weeks with automated fulfillment.
          </p>
        </div>

        <Link
          href="/new-order?tab=package"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D8EC8D] text-[#131313] font-semibold text-sm hover:brightness-105 transition-all shadow-sm self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create New Package</span>
        </Link>
      </div>

      {/* Packages Grid */}
      {packages.length === 0 ? (
        <GlassCard className="p-12 rounded-3xl border-white/10 text-center space-y-4 bg-white/[0.02]">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
            <Boxes className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-semibold text-white">No active packages yet</h3>
            <p className="text-sm text-slate-400">
              Bundle followers, likes, and views over 7 to 30 days to build steady, organic-looking social momentum.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/new-order?tab=package"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D8EC8D] text-[#131313] font-semibold text-sm hover:brightness-105 transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Configure Your First Package</span>
            </Link>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {packages.map((pkg) => {
            const progressPercent =
              pkg.totalRuns > 0 ? Math.round((pkg.completedRuns / pkg.totalRuns) * 100) : 0;
            const isCompleted = pkg.status === "COMPLETED";
            const isCancelled = pkg.status === "CANCELLED";
            const isActive = pkg.status === "ACTIVE";

            return (
              <GlassCard
                key={pkg.id}
                className="p-6 rounded-2xl border-white/10 flex flex-col justify-between space-y-6 hover:border-white/20 transition-all bg-white/[0.02]"
              >
                <div className="space-y-4">
                  {/* Top Bar: Title & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-white line-clamp-1">{pkg.name}</h3>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">ID: #{pkg.id.slice(0, 8)}</div>
                    </div>
                    <div>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          ACTIVE
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          COMPLETED
                        </span>
                      )}
                      {isCancelled && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <AlertCircle className="w-3 h-3" />
                          CANCELLED
                        </span>
                      )}
                      {pkg.status === "PARTIAL" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          PARTIAL
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Fulfillment Progress</span>
                      <span className="text-white font-semibold">
                        {pkg.completedRuns} / {pkg.totalRuns} runs ({progressPercent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#D8EC8D]/70 to-[#D8EC8D] transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Bundled Items List */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Bundled Services
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {pkg.items?.map((item: any) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1"
                        >
                          <div className="flex items-center gap-1.5 text-slate-300 font-medium truncate">
                            <PlatformIcon platform={item.platform} size={14} />
                            <span className="truncate">{item.serviceName}</span>
                          </div>
                          <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                            <span>{formatIndianNumber(item.totalQuantity)} units</span>
                            <span className="text-[#D8EC8D]">₹{Number(item.charge).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dates & Financials */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs font-mono">
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">Schedule Duration</div>
                      <div className="text-white font-medium mt-0.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {new Date(pkg.startDate).toLocaleDateString([], { month: "short", day: "numeric" })} -{" "}
                          {new Date(pkg.endDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-slate-500">Total Upfront</div>
                      <div className="text-[#D8EC8D] font-bold text-sm mt-0.5">
                        ₹{Number(pkg.totalCharge).toFixed(2)}
                      </div>
                      {pkg.refundedAmount > 0 && (
                        <div className="text-[10px] text-amber-400">
                          Refunded: ₹{Number(pkg.refundedAmount).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-white/5">
                  <Link
                    href={`/packages/${pkg.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-all border border-white/5 hover:border-white/10"
                  >
                    <span>View Schedule Timeline & Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
