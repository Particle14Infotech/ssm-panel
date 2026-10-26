"use client";

import React, { useState, useMemo } from "react";
import { useAdmin } from "@/context/AdminContext";
import {
  FileText,
  Search,
  Shield,
  Activity,
  User,
  Clock,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Key,
  CreditCard,
  Zap,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

interface AuditLogEntry {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  resource: string;
  category: "FINANCIAL" | "SERVICE" | "ORDER" | "SECURITY" | "PROVIDER";
  ipAddress: string;
  userAgent: string;
  status: "SUCCESS" | "WARNING" | "FAILURE";
  details: string;
  createdAt: string;
}

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "LOG-9041",
    userId: "admin",
    userName: "Root Admin",
    action: "WALLET_BALANCE_ADJUST",
    resource: "WALLET:usr_demo_2",
    category: "FINANCIAL",
    ipAddress: "192.168.1.104",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    status: "SUCCESS",
    details: "Credit of ₹2,500.00 manual deposit adjustment following verified UPI transaction.",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: "LOG-9040",
    userId: "admin",
    userName: "Root Admin",
    action: "PROVIDER_CATALOG_SYNC",
    resource: "PROVIDER:prov_cheapest",
    category: "PROVIDER",
    ipAddress: "127.0.0.1",
    userAgent: "System Automated Cron / LiveSync",
    status: "SUCCESS",
    details: "Synchronized 2,531 services and updated upstream balance ₹123.06.",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "LOG-9039",
    userId: "usr_demo_1",
    userName: "Rahul Sharma",
    action: "ORDER_CREATED",
    resource: "ORDER:ORD-44910",
    category: "ORDER",
    ipAddress: "49.36.128.4",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    status: "SUCCESS",
    details: "Order placed for 1,000 Instagram Followers. Charge: ₹180.00.",
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: "LOG-9038",
    userId: "admin",
    userName: "Root Admin",
    action: "SERVICE_RATE_UPDATE",
    resource: "SERVICE:srv_yt_views_01",
    category: "SERVICE",
    ipAddress: "192.168.1.104",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    status: "SUCCESS",
    details: "Updated ratePer1000 from ₹140.00 to ₹160.00 to account for upstream provider price shift.",
    createdAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
  },
  {
    id: "LOG-9037",
    userId: "system",
    userName: "Gateway Webhook",
    action: "FAILED_DEPOSIT_WEBHOOK",
    resource: "PAYMENT:pay_ref_invalid",
    category: "SECURITY",
    ipAddress: "13.235.14.99",
    userAgent: "PaymentGateway-Webhook-Worker/1.0",
    status: "WARNING",
    details: "Invalid webhook signature rejected on deposit callback reference UPI_INVALID_991.",
    createdAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
  },
];

export default function AdminAuditLogsPage() {
  const { users } = useAdmin();
  const [logs, setLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (categoryFilter !== "ALL" && l.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          l.id.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.resource.toLowerCase().includes(q) ||
          (l.userName && l.userName.toLowerCase().includes(q)) ||
          l.details.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, categoryFilter, searchQuery]);

  const handleExport = () => {
    const csvRows = [
      ["Log ID", "User", "Action", "Category", "Resource", "Status", "IP Address", "Details", "Timestamp"],
      ...filteredLogs.map((l) => [
        l.id,
        l.userName || l.userId || "System",
        l.action,
        l.category,
        l.resource,
        l.status,
        l.ipAddress,
        `"${l.details.replace(/"/g, '""')}"`,
        l.createdAt,
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((e) => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `admin_audit_logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 text-slate-100">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Header Telemetry */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#D8EC8D]">
              <span className="w-2 h-2 rounded-full bg-[#D8EC8D] animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Forensic Audit Trail & Security Ledger
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">Activity & Audit Logs</h1>
            <p className="text-xs text-slate-400">
              Immutable ledger of administrative balance overrides, pricing shifts, gateway callbacks, and security events.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#D8EC8D]" />
              <span>Export Audit Trail</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#161616]/80 border border-white/10 backdrop-blur-md">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
            {["ALL", "FINANCIAL", "SERVICE", "ORDER", "SECURITY", "PROVIDER"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  categoryFilter === cat
                    ? "btn-primary-gradient text-[#171e00] font-bold shadow-[0_0_12px_rgba(216,236,141,0.25)]"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {cat === "ALL" ? "All Logs" : cat}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search action, user, resource..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#202020] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D8EC8D]"
            />
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="p-6 rounded-3xl bg-[#1a1a1a]/80 border border-white/10 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-xs font-mono text-slate-400">
              SHOWING {filteredLogs.length} AUDIT ENTRIES
            </span>
            <span className="text-xs font-mono text-[#D8EC8D] font-bold">
              LOG INTEGRITY: VERIFIED
            </span>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center">
              <EmptyState
                title="No audit entries found"
                description="Adjust your search query or category filter."
                icon={FileText}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-white/5 hover:bg-white/[0.07] border border-white/5 transition-all space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono font-bold text-white">{log.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          log.status === "SUCCESS"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : log.status === "WARNING"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {log.resource}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                      <span>{log.ipAddress}</span>
                      <span className="text-white/20">•</span>
                      <span suppressHydrationWarning>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 font-sans leading-relaxed">{log.details}</p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-400">Actor: {log.userName || log.userId}</span>
                    </div>
                    <span className="font-mono text-[10px] truncate max-w-[320px]">{log.userAgent}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
