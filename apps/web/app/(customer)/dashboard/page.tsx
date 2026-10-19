"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import {
  Wallet,
  Activity,
  PlusCircle,
  ShoppingBag,
  TrendingUp,
  Clock,
  RefreshCw,
  Megaphone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  ArrowUpRight,
  Search,
  Copy,
  Check,
  Zap,
  Layers,
  Radio,
  ExternalLink,
} from "lucide-react";
import { BentoCard } from "@/components/motion/BentoCard";
import { CountUpNumber } from "@/components/motion/CountUpNumber";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { motion, AnimatePresence, Variants } from "framer-motion";

export default function CustomerDashboardPage() {
  const { user, orders, refillOrder } = useCustomer();
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [chartRange, setChartRange] = useState<"7d" | "30d">("7d");
  const [refillingId, setRefillingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Platform announcements state (SRS Sec 24, 36)
  const [announcements] = useState([
    {
      id: "ann_1",
      title: "Fast-Track UPI Gateways Active",
      content: "All UPI QR codes and instant PhonePe/GPay deposits are credited within 10-30 seconds with automated ledger verification.",
      type: "SUCCESS",
    },
    {
      id: "ann_2",
      title: "High-Retention YouTube Views Shard Expanded",
      content: "YouTube High Retention Views (Service #2015) throughput expanded to 500k/day with zero drop rate.",
      type: "INFO",
    },
  ]);
  const [activeAnnIndex, setActiveAnnIndex] = useState(0);
  const [annDismissed, setAnnDismissed] = useState(false);

  // Metrics calculations
  const totalSpent = useMemo(
    () => orders.reduce((acc, o) => acc + (o.charge || 0), 0),
    [orders]
  );
  const inProgressCount = useMemo(
    () => orders.filter((o) => o.status === "IN_PROGRESS" || o.status === "PROCESSING").length,
    [orders]
  );
  const completedCount = useMemo(
    () => orders.filter((o) => o.status === "COMPLETED").length,
    [orders]
  );
  const pendingCount = useMemo(
    () => orders.filter((o) => o.status === "PENDING").length,
    [orders]
  );
  const cancelledCount = useMemo(
    () => orders.filter((o) => o.status === "CANCELLED" || o.status === "FAILED" || o.status === "REFUNDED").length,
    [orders]
  );

  const fulfillmentRate = useMemo(() => {
    if (orders.length === 0) return 100;
    return Math.round((completedCount / orders.length) * 1000) / 10;
  }, [completedCount, orders.length]);

  // Social streams distribution
  const platformStats = useMemo(() => {
    const platforms = ["instagram", "youtube", "tiktok", "telegram", "twitter"];
    const total = Math.max(orders.length, 1);
    return platforms.map((plat) => {
      const count = orders.filter((o) => o.platform?.toLowerCase() === plat).length;
      const percentage = Math.round((count / total) * 100);
      return {
        platform: plat,
        count,
        percentage,
      };
    });
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesPlatform =
        selectedPlatform === "ALL" ||
        o.platform?.toLowerCase() === selectedPlatform.toLowerCase();
      const matchesSearch =
        searchQuery.trim() === "" ||
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.serviceName && o.serviceName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (o.target && o.target.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesPlatform && matchesSearch;
    });
  }, [orders, selectedPlatform, searchQuery]);

  const handleRefill = async (orderId: string) => {
    setRefillingId(orderId);
    await refillOrder(orderId);
    setTimeout(() => setRefillingId(null), 1000);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Generate real daily buckets for 7d / 30d orders & spend chart
  const daysCount = chartRange === "7d" ? 7 : 30;
  const chartData = useMemo(() => {
    return Array.from({ length: daysCount }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (daysCount - 1 - idx));
      const dateStr = d.toISOString().split("T")[0];
      const dayOrders = orders.filter((o) => o.createdAt && o.createdAt.startsWith(dateStr));
      const count = dayOrders.length;
      const spend = dayOrders.reduce((acc, o) => acc + (o.charge || 0), 0);
      return {
        date: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        count,
        spend,
      };
    });
  }, [daysCount, orders]);

  const maxChartCount = useMemo(
    () => Math.max(...chartData.map((d) => d.count), 5),
    [chartData]
  );

  const totalPeriodSpend = useMemo(
    () => chartData.reduce((acc, d) => acc + d.spend, 0),
    [chartData]
  );
  const totalPeriodOrders = useMemo(
    () => chartData.reduce((acc, d) => acc + d.count, 0),
    [chartData]
  );

  // Stagger animation container variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-20 max-w-7xl mx-auto"
    >
      {/* 1. Header Command Strip */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight font-sans">
              Command <span className="text-[#d8ec8d]">Center</span>
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1c1b1b] border border-[#d8ec8d]/30 text-[11px] font-mono text-[#d8ec8d]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d8ec8d] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#d8ec8d]" />
              </span>
              <span>LIVE SYNC</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Welcome back, {user.name || "Customer"}. Real-time monitoring of your liquidity, routing velocity, and dispatched orders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/wallet"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition-all font-sans"
          >
            <Wallet className="w-3.5 h-3.5 text-[#d8ec8d]" />
            <span>Deposit</span>
          </Link>
          <Link
            href="/new-order"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold hover:brightness-105 shadow-sm transition-all font-sans"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Order</span>
          </Link>
        </div>
      </motion.div>

      {/* 2. Announcement Broadcast Banner (SRS Sec 24, 36) */}
      {!annDismissed && announcements.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="p-4 rounded-2xl bg-[#1c1b1b]/90 border border-[#d8ec8d]/30 backdrop-blur-xl flex items-center justify-between gap-4 shadow-[0_4px_24px_rgba(216,236,141,0.08)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#d8ec8d]/15 text-[#d8ec8d] flex items-center justify-center shrink-0 border border-[#d8ec8d]/20">
                <Megaphone className="w-4 h-4 text-[#d8ec8d]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#d8ec8d]/20 text-[#d8ec8d] font-bold">
                    Broadcast
                  </span>
                  <span className="text-xs font-bold text-white font-sans">
                    {announcements[activeAnnIndex]?.title}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-sans mt-0.5">
                  {announcements[activeAnnIndex]?.content}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {announcements.length > 1 && (
                <button
                  type="button"
                  onClick={() => setActiveAnnIndex((prev) => (prev + 1) % announcements.length)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono text-slate-300"
                >
                  Next ({activeAnnIndex + 1}/{announcements.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setAnnDismissed(true)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                aria-label="Dismiss announcement"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 3. CORE BENTO MATRIX (Code & Chill Asymmetrical Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        {/* TILE 1: Primary Liquidity Hub (Col-Span 4 on LG) */}
        <motion.div variants={itemVariants} className="lg:col-span-4 h-full">
          <BentoCard
            enableBorderBeam={true}
            beamDuration={7}
            highlight={true}
            className="p-6 h-full flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-[#d8ec8d]" />
                  <span>Available Liquidity</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#d8ec8d]/15 text-[#d8ec8d] border border-[#d8ec8d]/30 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Auto-Refill Active
                </span>
              </div>

              {/* Big Animated Currency Metric */}
              <div className="space-y-1">
                <div className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-sans tabular-nums flex items-baseline gap-1">
                  <span className="text-[#d8ec8d] text-2xl sm:text-3xl">₹</span>
                  <CountUpNumber
                    value={user.balance}
                    decimals={2}
                    duration={1.8}
                    locale="en-IN"
                    className="font-sans font-bold"
                  />
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  Instant spendable ledger liquidity
                </p>
              </div>

              {/* Subtle Decorative Wave Curve in Lime */}
              <div className="h-10 w-full mt-4 opacity-75 overflow-hidden">
                <svg
                  viewBox="0 0 200 40"
                  className="w-full h-full text-[#d8ec8d]"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="limeWaveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d8ec8d" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#d8ec8d" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,30 Q30,10 60,25 T120,15 T160,25 T200,8 L200,40 L0,40 Z"
                    fill="url(#limeWaveGrad)"
                  />
                  <path
                    d="M0,30 Q30,10 60,25 T120,15 T160,25 T200,8"
                    stroke="#d8ec8d"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {/* Quick Stats & Top-Up CTA */}
            <div className="pt-4 mt-2 border-t border-white/[0.08] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Lifetime Outflow</span>
                <span className="text-xs font-semibold text-white font-mono tabular-nums">
                  ₹{totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Link
                href="/wallet"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#d8ec8d]/15 hover:bg-[#d8ec8d]/25 border border-[#d8ec8d]/30 text-[#d8ec8d] text-xs font-semibold font-sans transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Deposit Funds</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </BentoCard>
        </motion.div>

        {/* TILE 2: Fulfillment Stream Health & Gauge (Col-Span 4 on LG) */}
        <motion.div variants={itemVariants} className="lg:col-span-4 h-full">
          <BentoCard className="p-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#d8ec8d]" />
                  <span>Fulfillment Stream</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                  {orders.length} Total Orders
                </span>
              </div>

              {/* Circular Gauge + Success Rate */}
              <div className="flex items-center gap-4 my-2">
                <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="text-white/[0.08]"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="text-[#d8ec8d]"
                      strokeWidth="8"
                      strokeDasharray={251.2}
                      initial={{ strokeDashoffset: 251.2 }}
                      animate={{
                        strokeDashoffset: 251.2 - (251.2 * fulfillmentRate) / 100,
                      }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-sm font-bold text-white font-sans tabular-nums">
                      <CountUpNumber value={fulfillmentRate} decimals={0} suffix="%" duration={1.5} />
                    </span>
                    <span className="text-[9px] uppercase font-mono text-slate-400">Success</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold text-white font-sans">
                    Pipeline Operational
                  </div>
                  <p className="text-xs text-slate-400 font-sans leading-relaxed">
                    Automated provider failover routes orders instantaneously with zero stalls.
                  </p>
                </div>
              </div>
            </div>

            {/* Pipeline State Grid */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.08]">
              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[11px] text-slate-300 font-sans">Completed</span>
                </div>
                <span className="text-xs font-bold text-white font-mono tabular-nums">
                  <CountUpNumber value={completedCount} duration={1.2} />
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d8ec8d] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#d8ec8d]" />
                  </span>
                  <span className="text-[11px] text-slate-300 font-sans">In Progress</span>
                </div>
                <span className="text-xs font-bold text-[#d8ec8d] font-mono tabular-nums">
                  <CountUpNumber value={inProgressCount} duration={1.2} />
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[11px] text-slate-300 font-sans">Queue</span>
                </div>
                <span className="text-xs font-bold text-white font-mono tabular-nums">
                  <CountUpNumber value={pendingCount} duration={1.2} />
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                  <span className="text-[11px] text-slate-300 font-sans">Cancelled</span>
                </div>
                <span className="text-xs font-bold text-slate-400 font-mono tabular-nums">
                  <CountUpNumber value={cancelledCount} duration={1.2} />
                </span>
              </div>
            </div>
          </BentoCard>
        </motion.div>

        {/* TILE 3: Fast Action Launcher (Col-Span 4 on LG) */}
        <motion.div variants={itemVariants} className="lg:col-span-4 h-full">
          <BentoCard className="p-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[#d8ec8d]" />
                  <span>Quick Launchpad</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#d8ec8d]/10 text-[#d8ec8d] font-bold">
                  Instant
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mb-3">
                Frequently accessed command shortcuts for maximum execution speed.
              </p>
            </div>

            {/* 4 Interactive Launch Tiles */}
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/new-order"
                className="group/tile p-3 rounded-2xl bg-white/[0.02] hover:bg-[#d8ec8d]/10 border border-white/[0.08] hover:border-[#d8ec8d]/35 transition-all duration-200 flex flex-col justify-between h-24 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-7 h-7 rounded-lg bg-[#d8ec8d]/15 text-[#d8ec8d] flex items-center justify-center border border-[#d8ec8d]/25 group-hover/tile:bg-[#d8ec8d] group-hover/tile:text-[#171e00] transition-colors">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white group-hover/tile:text-[#d8ec8d] transition-colors font-sans flex items-center justify-between">
                    <span>New Order</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/tile:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-sans">Dispatch now</span>
                </div>
              </Link>

              <Link
                href="/wallet"
                className="group/tile p-3 rounded-2xl bg-white/[0.02] hover:bg-[#d8ec8d]/10 border border-white/[0.08] hover:border-[#d8ec8d]/35 transition-all duration-200 flex flex-col justify-between h-24 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-7 h-7 rounded-lg bg-[#d8ec8d]/15 text-[#d8ec8d] flex items-center justify-center border border-[#d8ec8d]/25 group-hover/tile:bg-[#d8ec8d] group-hover/tile:text-[#171e00] transition-colors">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white group-hover/tile:text-[#d8ec8d] transition-colors font-sans flex items-center justify-between">
                    <span>Add Liquidity</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/tile:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-sans">UPI & Cards</span>
                </div>
              </Link>

              <Link
                href="/services-catalog"
                className="group/tile p-3 rounded-2xl bg-white/[0.02] hover:bg-[#d8ec8d]/10 border border-white/[0.08] hover:border-[#d8ec8d]/35 transition-all duration-200 flex flex-col justify-between h-24 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-7 h-7 rounded-lg bg-[#d8ec8d]/15 text-[#d8ec8d] flex items-center justify-center border border-[#d8ec8d]/25 group-hover/tile:bg-[#d8ec8d] group-hover/tile:text-[#171e00] transition-colors">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white group-hover/tile:text-[#d8ec8d] transition-colors font-sans flex items-center justify-between">
                    <span>Catalog</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/tile:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-sans">250+ routes</span>
                </div>
              </Link>

              <Link
                href="/support"
                className="group/tile p-3 rounded-2xl bg-white/[0.02] hover:bg-[#d8ec8d]/10 border border-white/[0.08] hover:border-[#d8ec8d]/35 transition-all duration-200 flex flex-col justify-between h-24 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-7 h-7 rounded-lg bg-[#d8ec8d]/15 text-[#d8ec8d] flex items-center justify-center border border-[#d8ec8d]/25 group-hover/tile:bg-[#d8ec8d] group-hover/tile:text-[#171e00] transition-colors">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white group-hover/tile:text-[#d8ec8d] transition-colors font-sans flex items-center justify-between">
                    <span>Support</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/tile:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-sans">24/7 priority</span>
                </div>
              </Link>
            </div>
          </BentoCard>
        </motion.div>

        {/* TILE 4: Activity & Velocity Chart (Col-Span 8 on LG) */}
        <motion.div variants={itemVariants} className="lg:col-span-8">
          <BentoCard className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#d8ec8d]" />
                    <span>Activity & Liquidity Velocity</span>
                  </span>
                  <p className="text-xs text-slate-400 font-sans">
                    Daily order dispatch volume and capital velocity across selected window.
                  </p>
                </div>

                {/* Animated Range Toggle with LayoutId Pill */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.08] self-start relative">
                  {(["7d", "30d"] as const).map((range) => {
                    const isActive = chartRange === range;
                    return (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setChartRange(range)}
                        className={`relative px-3 py-1 rounded-lg text-xs font-bold font-sans transition-colors z-10 ${
                          isActive ? "text-[#171e00]" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="bento-chart-range-pill"
                            className="absolute inset-0 rounded-lg bg-[#d8ec8d] -z-10 shadow-sm"
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        )}
                        <span>{range === "7d" ? "7 Days" : "30 Days"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Animated Bars */}
              <div className="pt-2 space-y-2">
                <div className="h-48 flex items-end justify-between gap-1 sm:gap-2 border-b border-white/[0.08] pb-2 relative">
                  {/* Subtle Background Guide Lines */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between opacity-15">
                    <div className="border-b border-white/20 w-full" />
                    <div className="border-b border-white/20 w-full" />
                    <div className="border-b border-white/20 w-full" />
                  </div>

                  {chartData.map((d, idx) => {
                    const heightPercent = Math.max(Math.round((d.count / maxChartCount) * 100), 6);
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center gap-1.5 group relative h-full justify-end z-10"
                      >
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPercent}%` }}
                          transition={{
                            duration: 0.6,
                            delay: idx * (chartRange === "7d" ? 0.05 : 0.015),
                            ease: "easeOut",
                          }}
                          className="w-full max-w-[32px] rounded-t-lg bg-[#d8ec8d]/20 border-t border-x border-[#d8ec8d]/40 group-hover:bg-[#d8ec8d] group-hover:border-[#d8ec8d] group-hover:shadow-[0_0_20px_rgba(216,236,141,0.35)] transition-colors cursor-pointer relative"
                        >
                          {/* Floating Glass Tooltip */}
                          <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 bg-[#1c1b1b] border border-[#d8ec8d]/30 px-3 py-1.5 rounded-xl text-[11px] font-mono text-white whitespace-nowrap shadow-2xl z-30 transition-all duration-200">
                            <div className="font-semibold">{d.count} Dispatched</div>
                            <div className="text-[#d8ec8d]">₹{d.spend.toFixed(2)}</div>
                          </div>
                        </motion.div>

                        {chartRange === "7d" && (
                          <span className="text-[10px] font-mono text-slate-500 truncate w-full text-center">
                            {d.date}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart Summary Footnote */}
            <div className="pt-3 mt-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-4">
                <span>
                  Window Orders:{" "}
                  <strong className="text-white">{totalPeriodOrders}</strong>
                </span>
                <span>
                  Window Outflow:{" "}
                  <strong className="text-[#d8ec8d]">₹{totalPeriodSpend.toFixed(2)}</strong>
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Peak Velocity: {maxChartCount} orders/day
              </span>
            </div>
          </BentoCard>
        </motion.div>

        {/* TILE 5: Social Channels Distribution (Col-Span 4 on LG) */}
        <motion.div variants={itemVariants} className="lg:col-span-4">
          <BentoCard className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#d8ec8d]" />
                  <span>Channel Share</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Click to filter
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mb-3">
                Real-time volume distributed across target social media networks.
              </p>

              {/* Channel Distribution Bars */}
              <div className="space-y-2.5">
                {platformStats.map((item) => {
                  const isSelected = selectedPlatform.toLowerCase() === item.platform;
                  return (
                    <button
                      key={item.platform}
                      type="button"
                      onClick={() => setSelectedPlatform(item.platform)}
                      className={`w-full text-left p-2 rounded-xl transition-all border ${
                        isSelected
                          ? "bg-[#d8ec8d]/15 border-[#d8ec8d]/40 shadow-sm"
                          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <div className="flex items-center gap-2">
                          <PlatformIcon platform={item.platform} size={14} useBrandColor={true} />
                          <span className="capitalize font-medium text-white font-sans">
                            {item.platform}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-slate-400">
                          <span className="text-white font-semibold">{item.count}</span>
                          <span className="text-[11px] text-slate-500">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.percentage}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-[#bccf74] to-[#d8ec8d]"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 mt-2 border-t border-white/[0.08] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedPlatform("ALL")}
                className="text-[11px] font-mono text-slate-400 hover:text-[#d8ec8d] transition-colors"
              >
                Reset to All Streams
              </button>
              <Link
                href="/services-catalog"
                className="text-[11px] font-sans font-semibold text-[#d8ec8d] hover:underline flex items-center gap-1"
              >
                <span>View All Services</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </BentoCard>
        </motion.div>

        {/* TILE 6: Real-Time Execution Ledger (Full Width Col-Span 12) */}
        <motion.div variants={itemVariants} className="lg:col-span-12">
          <BentoCard className="p-6 space-y-5">
            {/* Ledger Header & Interactive Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold tracking-wide text-white font-sans">
                    Real-Time Execution Ledger
                  </h2>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#d8ec8d]/10 text-[#d8ec8d] font-bold border border-[#d8ec8d]/20">
                    Live Stream
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  Cryptographically verified order dispatches scoped to your account.
                </p>
              </div>

              {/* Search & Channel Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by ID, service, target..."
                    className="w-full sm:w-60 pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#d8ec8d] transition-colors font-sans"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Platform Filter Tabs with LayoutId Animation */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 bg-black/40 p-1 rounded-xl border border-white/[0.08]">
                  {["ALL", "instagram", "youtube", "tiktok", "telegram", "twitter"].map((plat) => {
                    const isActive = selectedPlatform.toLowerCase() === plat.toLowerCase();
                    return (
                      <button
                        key={plat}
                        type="button"
                        onClick={() => setSelectedPlatform(plat)}
                        className={`relative px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors shrink-0 flex items-center gap-1.5 z-10 ${
                          isActive ? "text-[#171e00] font-bold" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="bento-orders-active-tab"
                            className="absolute inset-0 rounded-lg bg-[#d8ec8d] -z-10 shadow-sm"
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        )}
                        {plat !== "ALL" && (
                          <PlatformIcon
                            platform={plat}
                            size={13}
                            useBrandColor={!isActive}
                          />
                        )}
                        <span>{plat === "ALL" ? "All Streams" : plat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Orders Table */}
            {orders.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="No orders yet"
                description="You have not placed any orders yet. Place your first order to get started."
                actionText="Place your first order"
                actionHref="/new-order"
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                      <th className="py-3 px-3.5">Order ID</th>
                      <th className="py-3 px-3.5">Service</th>
                      <th className="py-3 px-3.5">Target Vector</th>
                      <th className="py-3 px-3.5">Progress / Remains</th>
                      <th className="py-3 px-3.5">Charge</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-xs">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400 font-mono">
                          No orders found matching the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.slice(0, 10).map((order) => {
                        const hasRemains =
                          order.remains !== null &&
                          order.remains !== undefined &&
                          order.quantity > 0;
                        const delivered = hasRemains
                          ? Math.max(0, order.quantity - (order.remains ?? 0))
                          : order.quantity;
                        const progressPct = hasRemains
                          ? Math.min(100, Math.round((delivered / order.quantity) * 100))
                          : order.status === "COMPLETED"
                          ? 100
                          : 50;

                        return (
                          <tr
                            key={order.id}
                            className="hover:bg-white/[0.03] transition-colors group/row"
                          >
                            <td className="py-3.5 px-3.5 font-mono font-semibold text-white whitespace-nowrap">
                              <span className="text-[#d8ec8d] mr-1 font-bold">#</span>
                              {order.id}
                            </td>

                            <td className="py-3.5 px-3.5">
                              <div
                                className="font-medium text-white max-w-xs truncate"
                                title={order.serviceName}
                              >
                                {order.serviceName}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <PlatformIcon platform={order.platform} size={13} useBrandColor={true} />
                                <span className="text-[10px] text-slate-400 uppercase font-mono">
                                  {order.platform}
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-3.5 font-mono text-slate-400">
                              <div className="flex items-center gap-1.5 max-w-[200px]">
                                <span className="truncate block" title={order.target}>
                                  {order.target}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(order.target, order.id)}
                                  className="text-slate-500 hover:text-[#d8ec8d] transition-colors p-0.5 rounded"
                                  title="Copy URL"
                                >
                                  {copiedId === order.id ? (
                                    <Check className="w-3 h-3 text-[#d8ec8d]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>

                            <td className="py-3.5 px-3.5 font-mono min-w-[130px]">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="text-white font-medium">
                                  {order.quantity.toLocaleString()}
                                </span>
                                {hasRemains && (
                                  <span className="text-slate-500 text-[10px]">
                                    Remains: {order.remains?.toLocaleString()}
                                  </span>
                                )}
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    order.status === "COMPLETED"
                                      ? "bg-emerald-400"
                                      : order.status === "IN_PROGRESS" || order.status === "PROCESSING"
                                      ? "bg-[#d8ec8d]"
                                      : "bg-slate-500"
                                  }`}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </td>

                            <td className="py-3.5 px-3.5 font-mono font-semibold text-white whitespace-nowrap">
                              ₹{order.charge.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>

                            <td className="py-3.5 px-3.5 whitespace-nowrap">
                              <StatusBadge status={order.status} />
                            </td>

                            <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {order.refillable && (
                                  <button
                                    type="button"
                                    onClick={() => handleRefill(order.id)}
                                    disabled={refillingId === order.id}
                                    className="px-2.5 py-1 rounded-lg bg-[#d8ec8d]/15 hover:bg-[#d8ec8d]/25 text-[#d8ec8d] text-xs font-medium transition-all flex items-center gap-1 hover:scale-[1.02] active:scale-[0.98]"
                                  >
                                    <RefreshCw
                                      className={`w-3 h-3 ${
                                        refillingId === order.id ? "animate-spin" : ""
                                      }`}
                                    />
                                    <span>Refill</span>
                                  </button>
                                )}
                                <Link
                                  href={`/new-order?serviceId=${order.serviceId}`}
                                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                  Reorder
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </BentoCard>
        </motion.div>
      </div>
    </motion.div>
  );
}
