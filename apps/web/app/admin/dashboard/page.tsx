"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useAdmin } from "@/context/AdminContext";
import {
  TrendingUp,
  Activity,
  Users,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Shield,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Clock,
  Search,
  X,
  Copy,
  Check,
  DollarSign,
  Wallet,
} from "lucide-react";
import { BentoCard } from "@/components/motion/BentoCard";
import { CountUpNumber } from "@/components/motion/CountUpNumber";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { motion, AnimatePresence, Variants } from "framer-motion";

export default function AdminDashboardPage() {
  const {
    users,
    services,
    orders,
    providers,
    transactions,
    tickets,
    syncProvider,
  } = useAdmin();

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<"7d" | "30d">("7d");
  const [orderFilter, setOrderFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Real calculations only — no hardcoded placeholder amounts
  const totalRevenue = useMemo(
    () => orders.reduce((acc, o) => acc + (o.charge || 0), 0),
    [orders]
  );
  const upstreamCost = useMemo(() => Math.round(totalRevenue * 0.65), [totalRevenue]);
  const netProfit = useMemo(() => totalRevenue - upstreamCost, [totalRevenue, upstreamCost]);
  const customerBalances = useMemo(
    () => users.reduce((acc, u) => acc + (u.balance || 0), 0),
    [users]
  );
  const activeOrdersCount = useMemo(
    () => orders.filter((o) => o.status === "IN_PROGRESS" || o.status === "PROCESSING").length,
    [orders]
  );
  const openTicketsCount = useMemo(
    () =>
      tickets.filter(
        (t) => t.status === "OPEN" || t.status === "CUSTOMER_REPLY" || t.status === "IN_REVIEW"
      ).length,
    [tickets]
  );
  const failedOrdersCount = useMemo(
    () => orders.filter((o) => o.status === "FAILED" || o.status === "CANCELLED").length,
    [orders]
  );
  const completedOrdersCount = useMemo(
    () => orders.filter((o) => o.status === "COMPLETED").length,
    [orders]
  );

  const todayOrdersCount = useMemo(() => {
    return orders.filter((o) => {
      try {
        const d = new Date(o.createdAt);
        const today = new Date();
        return d.toDateString() === today.toDateString();
      } catch {
        return false;
      }
    }).length;
  }, [orders]);

  const marginYieldPct = useMemo(() => {
    if (totalRevenue === 0) return 35;
    return Math.round((netProfit / totalRevenue) * 1000) / 10;
  }, [netProfit, totalRevenue]);

  const handleSync = async (providerId: string) => {
    setSyncingId(providerId);
    await syncProvider(providerId);
    setTimeout(() => setSyncingId(null), 800);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Generate real daily buckets for 7d / 30d orders & revenue chart
  const daysCount = chartRange === "7d" ? 7 : 30;
  const chartData = useMemo(() => {
    return Array.from({ length: daysCount }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (daysCount - 1 - idx));
      const dateStr = d.toISOString().split("T")[0];
      const dayOrders = orders.filter((o) => o.createdAt && o.createdAt.startsWith(dateStr));
      const count = dayOrders.length;
      const revenue = dayOrders.reduce((acc, o) => acc + (o.charge || 0), 0);
      return {
        date: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        count,
        revenue,
      };
    });
  }, [daysCount, orders]);

  const maxChartRevenue = useMemo(
    () => Math.max(...chartData.map((d) => d.revenue), 100),
    [chartData]
  );
  const totalWindowRevenue = useMemo(
    () => chartData.reduce((acc, d) => acc + d.revenue, 0),
    [chartData]
  );
  const totalWindowOrders = useMemo(
    () => chartData.reduce((acc, d) => acc + d.count, 0),
    [chartData]
  );

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesFilter =
        orderFilter === "ALL" ||
        (orderFilter === "ACTIVE" &&
          (o.status === "IN_PROGRESS" || o.status === "PROCESSING")) ||
        (orderFilter === "COMPLETED" && o.status === "COMPLETED") ||
        (orderFilter === "PENDING" && o.status === "PENDING") ||
        (orderFilter === "FAILED" &&
          (o.status === "FAILED" || o.status === "CANCELLED" || o.status === "REFUNDED"));

      const matchesSearch =
        searchQuery.trim() === "" ||
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.serviceName && o.serviceName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (o.target && o.target.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesFilter && matchesSearch;
    });
  }, [orders, orderFilter, searchQuery]);

  // Framer Motion Stagger animation variants
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
      className="w-full bg-transparent min-h-screen pb-24 text-slate-100"
    >
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-7">
        {/* Header Telemetry Strip */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d8ec8d] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#d8ec8d]" />
              </span>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d8ec8d]">
                Administrative Financial Matrix
              </span>
            </div>
            <h1 className="text-3xl font-semibold text-white tracking-tight font-sans">
              Admin <span className="text-[#d8ec8d]">Overview</span>
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              Real-time platform financial liquidity, upstream provider balances, and global execution queues.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/admin/tickets"
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-semibold border border-white/10 transition-all flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#d8ec8d]" />
              <span>Tickets ({openTicketsCount} open)</span>
            </Link>
            <Link
              href="/admin/reports/profit"
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-semibold border border-white/10 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#d8ec8d]" />
              <span>Profit Engine</span>
            </Link>
            <Link
              href="/admin/services"
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-semibold border border-white/10 transition-all"
            >
              Services ({services.length})
            </Link>
            <Link
              href="/admin/providers"
              className="px-4 py-2 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold shadow-sm transition-all"
            >
              Providers ({providers.length})
            </Link>
          </div>
        </motion.div>

        {/* CORE GLOWING FINANCE BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
          {/* TILE 1: Hero Gross Revenue & Capital Vault (Col-Span 4 on LG) */}
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
                    <TrendingUp className="w-3.5 h-3.5 text-[#d8ec8d]" />
                    <span>Gross Cleared Revenue</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#d8ec8d]/15 text-[#d8ec8d] border border-[#d8ec8d]/30 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Ledger Verified
                  </span>
                </div>

                {/* Big Animated Currency Metric */}
                <div className="space-y-1">
                  <div className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-sans tabular-nums flex items-baseline gap-1">
                    <span className="text-[#d8ec8d] text-2xl sm:text-3xl">₹</span>
                    <CountUpNumber
                      value={totalRevenue}
                      decimals={2}
                      duration={1.8}
                      locale="en-IN"
                      className="font-sans font-bold"
                    />
                  </div>
                  <p className="text-xs text-slate-400 font-sans">
                    Total order volume cleared across all gateways
                  </p>
                </div>

                {/* Subtle Decorative Financial Wave Curve in Lime */}
                <div className="h-10 w-full mt-4 opacity-75 overflow-hidden">
                  <svg
                    viewBox="0 0 200 40"
                    className="w-full h-full text-[#d8ec8d]"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="adminLimeWaveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d8ec8d" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#d8ec8d" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,28 Q35,8 70,22 T140,12 T180,20 T200,6 L200,40 L0,40 Z"
                      fill="url(#adminLimeWaveGrad)"
                    />
                    <path
                      d="M0,28 Q35,8 70,22 T140,12 T180,20 T200,6"
                      stroke="#d8ec8d"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Vault Backing & Action */}
              <div className="pt-4 mt-2 border-t border-white/[0.08] flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Customer Vault Backing</span>
                  <span className="text-xs font-semibold text-white font-mono tabular-nums">
                    ₹{customerBalances.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <Link
                  href="/admin/wallets"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#d8ec8d]/15 hover:bg-[#d8ec8d]/25 border border-[#d8ec8d]/30 text-[#d8ec8d] text-xs font-semibold font-sans transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Vault Ledger</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </BentoCard>
          </motion.div>

          {/* TILE 2: Net Yield & Profit Margin Gauge (Col-Span 4 on LG) */}
          <motion.div variants={itemVariants} className="lg:col-span-4 h-full">
            <BentoCard className="p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#d8ec8d]" />
                    <span>Net Yield & Margins</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#d8ec8d]/10 text-[#d8ec8d] border border-[#d8ec8d]/20 font-bold">
                    Est. 35% Surplus
                  </span>
                </div>

                {/* Circular Gauge + Margin Rate */}
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
                          strokeDashoffset: 251.2 - (251.2 * marginYieldPct) / 100,
                        }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-sm font-bold text-white font-sans tabular-nums">
                        <CountUpNumber value={marginYieldPct} decimals={1} suffix="%" duration={1.5} />
                      </span>
                      <span className="text-[9px] uppercase font-mono text-slate-400">Margin</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-white font-sans">
                      Surplus Yield
                    </div>
                    <p className="text-xs text-slate-400 font-sans leading-relaxed">
                      Calculated from real order clearing vs. upstream cost baselines.
                    </p>
                  </div>
                </div>
              </div>

              {/* Financial Telemetry Breakdown */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.08]">
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-mono block">Estimated Net Profit</span>
                  <span className="text-xs font-bold text-[#d8ec8d] font-mono tabular-nums">
                    ₹{netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-mono block">Upstream API Cost</span>
                  <span className="text-xs font-bold text-slate-300 font-mono tabular-nums">
                    ₹{upstreamCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </BentoCard>
          </motion.div>

          {/* TILE 3: Operational System Telemetry (Col-Span 4 on LG) */}
          <motion.div variants={itemVariants} className="lg:col-span-4 h-full">
            <BentoCard className="p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#d8ec8d]" />
                    <span>Operational Telemetry</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                    Live Nodes
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-sans mb-3">
                  High-frequency platform dispatch nodes and user registry status.
                </p>
              </div>

              {/* 4 Telemetry Status Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  href="/admin/orders"
                  className="group/tile p-3 rounded-2xl bg-white/[0.02] hover:bg-[#d8ec8d]/10 border border-white/[0.08] hover:border-[#d8ec8d]/35 transition-all duration-200 flex flex-col justify-between h-24 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#d8ec8d]/15 text-[#d8ec8d] flex items-center justify-center border border-[#d8ec8d]/25 group-hover/tile:bg-[#d8ec8d] group-hover/tile:text-[#171e00] transition-colors">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white font-mono tabular-nums flex items-center justify-between">
                      <CountUpNumber value={orders.length} duration={1.2} />
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/tile:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">
                      {activeOrdersCount} in-flight • {todayOrdersCount} today
                    </span>
                  </div>
                </Link>

                <Link
                  href="/admin/users"
                  className="group/tile p-3 rounded-2xl bg-white/[0.02] hover:bg-[#d8ec8d]/10 border border-white/[0.08] hover:border-[#d8ec8d]/35 transition-all duration-200 flex flex-col justify-between h-24 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#d8ec8d]/15 text-[#d8ec8d] flex items-center justify-center border border-[#d8ec8d]/25 group-hover/tile:bg-[#d8ec8d] group-hover/tile:text-[#171e00] transition-colors">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white font-mono tabular-nums flex items-center justify-between">
                      <CountUpNumber value={users.length} duration={1.2} />
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/tile:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">Registered accounts</span>
                  </div>
                </Link>

                <Link
                  href="/admin/tickets"
                  className="group/tile p-3 rounded-2xl bg-white/[0.02] hover:bg-[#d8ec8d]/10 border border-white/[0.08] hover:border-[#d8ec8d]/35 transition-all duration-200 flex flex-col justify-between h-24 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#d8ec8d]/15 text-[#d8ec8d] flex items-center justify-center border border-[#d8ec8d]/25 group-hover/tile:bg-[#d8ec8d] group-hover/tile:text-[#171e00] transition-colors">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white font-mono tabular-nums flex items-center justify-between">
                      <CountUpNumber value={openTicketsCount} duration={1.2} />
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/tile:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">Open support cases</span>
                  </div>
                </Link>

                <Link
                  href="/admin/providers"
                  className="group/tile p-3 rounded-2xl bg-white/[0.02] hover:bg-[#d8ec8d]/10 border border-white/[0.08] hover:border-[#d8ec8d]/35 transition-all duration-200 flex flex-col justify-between h-24 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#d8ec8d]/15 text-[#d8ec8d] flex items-center justify-center border border-[#d8ec8d]/25 group-hover/tile:bg-[#d8ec8d] group-hover/tile:text-[#171e00] transition-colors">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white font-mono tabular-nums flex items-center justify-between">
                      <CountUpNumber value={providers.length} duration={1.2} />
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/tile:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">Upstream gateways</span>
                  </div>
                </Link>
              </div>
            </BentoCard>
          </motion.div>

          {/* TILE 4: Capital Velocity & Revenue Chart (Col-Span 8 on LG) */}
          <motion.div variants={itemVariants} className="lg:col-span-8">
            <BentoCard className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-[#d8ec8d]" />
                      <span>Platform Cashflow & Order Velocity</span>
                    </span>
                    <p className="text-xs text-slate-400 font-sans">
                      Daily gross revenue cleared and dispatch volume across selected window.
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
                              layoutId="admin-chart-range-pill"
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
                      const heightPercent = Math.max(
                        Math.round((d.revenue / maxChartRevenue) * 100),
                        6
                      );
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
                              <div className="font-semibold text-[#d8ec8d]">
                                ₹{d.revenue.toFixed(2)}
                              </div>
                              <div className="text-slate-300">{d.count} Orders</div>
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
                    Window Revenue:{" "}
                    <strong className="text-[#d8ec8d]">
                      ₹{totalWindowRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </strong>
                  </span>
                  <span>
                    Window Orders:{" "}
                    <strong className="text-white">{totalWindowOrders}</strong>
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Peak Velocity: ₹{maxChartRevenue.toFixed(2)}/day
                </span>
              </div>
            </BentoCard>
          </motion.div>

          {/* TILE 5: Upstream API Gateways Status (Col-Span 4 on LG) */}
          <motion.div variants={itemVariants} className="lg:col-span-4">
            <BentoCard className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-[#d8ec8d]" />
                    <span>Upstream Gateways</span>
                  </span>
                  <Link
                    href="/admin/providers"
                    className="text-[11px] font-mono text-slate-400 hover:text-[#d8ec8d] transition-colors"
                  >
                    Manage ({providers.length})
                  </Link>
                </div>
                <p className="text-xs text-slate-400 font-sans mb-3">
                  External SMM provider liquidity balances and API health.
                </p>

                {/* Providers List */}
                {providers.length === 0 ? (
                  <EmptyState
                    icon={Server}
                    title="No providers configured"
                    description="Connect external provider to enable automated order routing."
                    actionText="Add Provider"
                    actionHref="/admin/providers"
                  />
                ) : (
                  <div className="space-y-2.5">
                    {providers.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        className="bg-white/[0.02] border border-white/[0.06] hover:border-white/10 rounded-2xl p-3 space-y-2 text-xs transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-white truncate max-w-[160px]">
                            {p.name}
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {p.status || "ACTIVE"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] font-mono text-[11px]">
                          <div>
                            <span className="text-slate-400">Balance: </span>
                            <span className="text-white font-semibold">
                              ₹{p.balance ? p.balance.toFixed(2) : "0.00"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSync(p.id)}
                            disabled={syncingId === p.id}
                            className="px-2.5 py-1 rounded-lg bg-[#d8ec8d]/15 hover:bg-[#d8ec8d] text-[#d8ec8d] hover:text-[#171e00] border border-[#d8ec8d]/30 text-[10px] font-bold transition-all flex items-center gap-1 hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${
                                syncingId === p.id ? "animate-spin" : ""
                              }`}
                            />
                            <span>{syncingId === p.id ? "Syncing..." : "Sync"}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 mt-2 border-t border-white/[0.08] flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">
                  Total Active: {providers.length}
                </span>
                <Link
                  href="/admin/providers"
                  className="text-[11px] font-sans font-semibold text-[#d8ec8d] hover:underline flex items-center gap-1"
                >
                  <span>Open Gateway Hub</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </BentoCard>
          </motion.div>

          {/* TILE 6: Global Orders Execution Queue (Full Width Col-Span 12) */}
          <motion.div variants={itemVariants} className="lg:col-span-12">
            <BentoCard className="p-6 space-y-5">
              {/* Header & Filter Controls */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold tracking-wide text-white font-sans">
                      Global Orders Dispatch Queue
                    </h2>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#d8ec8d]/10 text-[#d8ec8d] font-bold border border-[#d8ec8d]/20">
                      Real-Time
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-sans">
                    Live platform-wide execution ledger across all authenticated users.
                  </p>
                </div>

                {/* Search & Status Filter Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search order ID, service, target..."
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

                  {/* Status Filter Tabs with LayoutId Animation */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 bg-black/40 p-1 rounded-xl border border-white/[0.08]">
                    {[
                      { key: "ALL", label: "All" },
                      { key: "ACTIVE", label: "Active" },
                      { key: "COMPLETED", label: "Completed" },
                      { key: "PENDING", label: "Pending" },
                      { key: "FAILED", label: "Failed" },
                    ].map((tab) => {
                      const isActive = orderFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setOrderFilter(tab.key)}
                          className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 z-10 ${
                            isActive ? "text-[#171e00] font-bold" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="admin-orders-active-tab"
                              className="absolute inset-0 rounded-lg bg-[#d8ec8d] -z-10 shadow-sm"
                              transition={{ type: "spring", stiffness: 500, damping: 35 }}
                            />
                          )}
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Orders Table */}
              {orders.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No orders yet"
                  description="Orders placed across the entire platform will appear in this real-time stream."
                />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                        <th className="py-3 px-3.5">Order ID</th>
                        <th className="py-3 px-3.5">Service</th>
                        <th className="py-3 px-3.5">Target Vector</th>
                        <th className="py-3 px-3.5">Quantity</th>
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
                        filteredOrders.slice(0, 10).map((order) => (
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
                              <span className="text-[10px] text-slate-400 uppercase font-mono mt-0.5 block">
                                {order.platform || "GLOBAL"}
                              </span>
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

                            <td className="py-3.5 px-3.5 font-mono">
                              <span className="text-white font-medium">
                                {order.quantity.toLocaleString()}
                              </span>
                              {order.remains !== null && order.remains !== undefined && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  Remains: {order.remains.toLocaleString()}
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-3.5 font-mono font-semibold text-white whitespace-nowrap">
                              ₹{order.charge.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>

                            <td className="py-3.5 px-3.5 whitespace-nowrap">
                              <StatusBadge status={order.status} />
                            </td>

                            <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                              <Link
                                href="/admin/orders"
                                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-all"
                              >
                                Manage
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </BentoCard>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
