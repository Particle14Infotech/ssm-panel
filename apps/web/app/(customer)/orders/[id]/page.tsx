"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Boxes,
  Wallet,
  ArrowRight,
  Layers,
} from "lucide-react";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = (params.id as string) || "";
  const { orders, cancelOrder, refillOrder, user } = useCustomer();

  const order = orders.find((o) => o.id === orderId) || {
    id: orderId,
    serviceId: "srv-01",
    serviceName: "Meta Reels High-Retention Vector [Real Accounts - Direct Start]",
    platform: "instagram",
    target: "https://instagram.com/p/C123456789",
    quantity: 5000,
    charge: 250.0,
    startCount: 1420,
    remains: 1250,
    status: "IN_PROGRESS" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    refillable: true,
    cancellable: true,
    isPrepaid: false,
    packageRun: null,
  };

  const [refilling, setRefilling] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const totalAimUnits = (order as any).totalQuantity ?? order.quantity;
  const remains = order.remains ?? 0;
  const deliveredUnits = Math.max(0, totalAimUnits - remains);
  const progressPercent = totalAimUnits > 0
    ? Math.min(100, Math.round((deliveredUnits / totalAimUnits) * 100))
    : 0;

  const pkgRun = (order as any).packageRun;
  const parentPackage = pkgRun?.package;
  const pkgPercent = parentPackage && parentPackage.totalRuns > 0
    ? Math.min(100, Math.round((parentPackage.completedRuns / parentPackage.totalRuns) * 100))
    : 0;

  const handleCancel = async () => {
    setCancelling(true);
    await cancelOrder(order.id);
    setCancelling(false);
  };

  const handleRefill = async () => {
    setRefilling(true);
    await refillOrder(order.id);
    setRefilling(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="p-2 rounded-full liquid-glass-pill hover:bg-white/20 text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-light text-white">Order {order.id}</h1>
              <span className="px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-[#D8EC8D]/15 text-[#D8EC8D] border border-[#D8EC8D]/30">
                {order.status}
              </span>
              {(order as any).isPrepaid && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Prepaid Package
                </span>
              )}
            </div>
            <p className="text-xs text-[#c7c8b6] font-mono mt-0.5">
              Created on {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Action Triggers */}
        <div className="flex items-center gap-2">
          {order.refillable && order.status === "COMPLETED" && (
            <button
              onClick={handleRefill}
              disabled={refilling}
              className="px-4 py-2 rounded-full bg-[#201f1f] text-white border border-white/10 hover:bg-white hover:text-black text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refilling ? "animate-spin" : ""}`} />
              <span>Request Refill</span>
            </button>
          )}

          {order.cancellable && (order.status === "PENDING" || order.status === "PROCESSING") && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-4 py-2 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Order</span>
            </button>
          )}

          <Link
            href={`/support?orderId=${order.id}`}
            className="px-4 py-2 rounded-full btn-primary-gradient text-[#171e00] text-xs font-bold shadow-[0_0_20px_rgba(216,236,141,0.2)] transition-all flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Open Ticket</span>
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Progress & Metrics */}
        <div className="lg:col-span-7 space-y-6">
          {/* Aim Fulfillment Card */}
          <div className="glass-panel rounded-3xl p-6 space-y-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
            <div>
              <div className="flex justify-between items-center text-xs font-mono mb-2">
                <span className="text-[#c7c8b6] uppercase tracking-wider font-semibold">
                  Aim Fulfillment Progress
                </span>
                <span className="text-[#D8EC8D] font-bold text-sm">{progressPercent}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#201f1f] overflow-hidden p-0.5 border border-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#D8EC8D] to-[#BEF264] transition-all duration-700"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono text-[#c7c8b6] mt-3 pt-3 border-t border-white/5">
                <div>
                  <span className="text-[10px] uppercase text-[#a0a28f] block">Start Count</span>
                  <span className="font-semibold text-white">{order.startCount ?? 0}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#a0a28f] block">Delivered Aim</span>
                  <span className="font-semibold text-[#D8EC8D]">{deliveredUnits.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#a0a28f] block">Aim Remaining</span>
                  <span className="font-semibold text-amber-300">{remains.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
              <div className="bg-[#201f1f] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] uppercase font-mono text-[#c7c8b6] block">Aim Target</span>
                <span className="text-xl font-light text-white">{totalAimUnits.toLocaleString()}</span>
              </div>
              <div className="bg-[#201f1f] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] uppercase font-mono text-[#c7c8b6] block">Total Charge</span>
                <span className="text-xl font-light text-[#D8EC8D]">
                  {(order as any).isPrepaid ? "Prepaid (₹0.00)" : `₹${order.charge.toFixed(2)}`}
                </span>
              </div>
              <div className="bg-[#201f1f] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] uppercase font-mono text-[#c7c8b6] block">Platform</span>
                <span className="text-xl font-light text-white uppercase">{order.platform}</span>
              </div>
            </div>

            <div className="bg-[#201f1f] p-4 rounded-2xl border border-white/5 space-y-2">
              <span className="text-xs uppercase font-mono text-[#c7c8b6]">Target Link</span>
              <a
                href={order.target}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-cyan-400 hover:underline break-all flex items-center gap-1.5"
              >
                <span>{order.target}</span>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
              </a>
            </div>
          </div>

          {/* Growth Package Integration Card (If order is part of a Package) */}
          {parentPackage && (
            <div className="glass-panel rounded-3xl p-6 border border-purple-500/20 bg-purple-950/10 space-y-4 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Part of Growth Package</h3>
                    <p className="text-xs text-purple-300/80 font-mono">
                      {parentPackage.name} - Run #{pkgRun?.runIndex ?? 1}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {parentPackage.status}
                </span>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                  <span className="text-[#c7c8b6]">Package Overall Aim Progress</span>
                  <span className="text-purple-300 font-bold">{pkgPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#201f1f] overflow-hidden p-0.5 border border-purple-500/20">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-[#D8EC8D] transition-all duration-700"
                    style={{ width: `${pkgPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-[#c7c8b6] mt-2">
                  <span>Completed: {parentPackage.completedRuns} / {parentPackage.totalRuns} runs</span>
                  <span>Failed/Cancelled: {parentPackage.failedRuns + parentPackage.cancelledRuns}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Link
                  href={`/packages/${parentPackage.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 hover:text-white transition-colors"
                >
                  <span>View Full Package Aim & Schedule</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Execution Timeline & Need to Recharge */}
        <div className="lg:col-span-5 space-y-6">
          {/* Need to Recharge / Live Balance Card */}
          <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 bg-emerald-950/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Wallet & Recharge</h3>
                  <p className="text-xs text-emerald-300/80">Available Account Balance</p>
                </div>
              </div>
              <span className="text-lg font-mono font-bold text-emerald-400">
                ₹{(user?.balance ?? 0).toFixed(2)}
              </span>
            </div>

            <p className="text-xs text-[#c7c8b6] leading-relaxed">
              {(user?.balance ?? 0) < 50
                ? "Your balance is low. Recharge now to keep continuous package schedules and automated drip-feeds active without interruption."
                : "Need to order more aim units or schedule recurring packages? Add funds anytime."}
            </p>

            <Link
              href="/wallet"
              className="w-full py-2.5 px-4 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold shadow-[0_0_20px_rgba(216,236,141,0.2)] transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Need to Recharge / Add Funds</span>
            </Link>
          </div>

          {/* Audit & Event Timeline */}
          <div className="glass-panel rounded-3xl p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
            <h2 className="text-base font-medium text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#D8EC8D]" />
              <span>Audit & Event Timeline</span>
            </h2>

            <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10 pl-6">
              <div className="relative">
                <span className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-[#D8EC8D]" />
                <div className="text-xs font-semibold text-white">Order Placed & Wallet Debited</div>
                <div className="text-[11px] font-mono text-[#c7c8b6]">{new Date(order.createdAt).toLocaleTimeString()}</div>
                <p className="text-xs text-[#c7c8b6] mt-0.5">
                  {(order as any).isPrepaid
                    ? "Prepaid growth package allotment debited at package activation."
                    : `₹${order.charge.toFixed(2)} debited via atomic double-entry ledger.`}
                </p>
              </div>

              <div className="relative">
                <span className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <div className="text-xs font-semibold text-white">Dispatched to High-Speed Node</div>
                <div className="text-[11px] font-mono text-[#c7c8b6]">Node AP-S1 Mumbai Shard</div>
                <p className="text-xs text-[#c7c8b6] mt-0.5">Encrypted API outbox relay synchronized.</p>
              </div>

              <div className="relative">
                <span className={`absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full ${order.status === "COMPLETED" ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
                <div className="text-xs font-semibold text-white">Current Status: {order.status}</div>
                <div className="text-[11px] font-mono text-[#c7c8b6]">{new Date(order.updatedAt).toLocaleTimeString()}</div>
                <p className="text-xs text-[#c7c8b6] mt-0.5">Automated telemetry polling active.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
