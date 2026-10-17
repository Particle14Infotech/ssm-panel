"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  Users,
  Zap,
  ListOrdered,
  CreditCard,
  Server,
  Tag,
  RefreshCw,
  Menu,
  X,
  Check,
  MessageSquare,
  LogOut,
  BarChart3,
  Settings,
  FileText,
} from "lucide-react";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { useAdmin } from "@/context/AdminContext";

export function AdminHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const { refreshAdminData, syncProvider, providers, logout } = useAdmin();

  const handleLiveSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncSuccess(false);
    try {
      await refreshAdminData();
      if (providers && providers.length > 0) {
        await Promise.allSettled(providers.map((p) => syncProvider(p.id)));
      }
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch {
      // Handled gracefully
    } finally {
      setIsSyncing(false);
    }
  };

  const adminNav = [
    { name: "Dashboard", href: "/admin/dashboard", icon: Layers },
    { name: "Orders Ledger", href: "/admin/orders", icon: ListOrdered },
    { name: "Service Matrix", href: "/admin/services", icon: Zap },
    { name: "Categories", href: "/admin/categories", icon: Tag },
    { name: "User Directory", href: "/admin/users", icon: Users },
    { name: "Wallets & Liability", href: "/admin/wallets", icon: CreditCard },
    { name: "API Providers", href: "/admin/providers", icon: Server },
    { name: "Payment Audits", href: "/admin/payments", icon: CreditCard },
    { name: "Coupons & Promos", href: "/admin/coupons", icon: Tag },
    { name: "Support Tickets", href: "/admin/tickets", icon: MessageSquare },
    { name: "Reports", href: "/admin/reports", icon: BarChart3 },
    { name: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
    { name: "Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#131313]/90 backdrop-blur-xl border-b border-white/10 shadow-[0_1px_16px_rgba(0,0,0,0.7)]">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-2">
        {/* Top Header Row */}
        <div className="h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BrandLogo variant="combined" size={30} withLink href="/admin/dashboard" />

            <div className="h-4 w-px bg-white/15 hidden sm:block" />

            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full liquid-glass-pill text-slate-300 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D8EC8D] animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-[#D8EC8D] font-bold">
                ROOT ADMIN CONSOLE
              </span>
              <span className="text-white/20">•</span>
              <span className="text-[11px]">System Active</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Functional Live Sync Button */}
            <button
              type="button"
              onClick={handleLiveSync}
              disabled={isSyncing}
              className={`px-3.5 py-1.5 rounded-full liquid-glass-pill text-xs font-mono flex items-center gap-2 transition-all hover:border-[#D8EC8D]/50 hover:bg-white/5 active:scale-95 cursor-pointer ${
                isSyncing ? "opacity-75 cursor-wait" : ""
              }`}
              title="Sync platform metrics, orders, and upstream provider balances"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#D8EC8D] ${isSyncing ? "animate-spin" : ""}`} />
              <span className="text-[#D8EC8D] font-semibold">
                {isSyncing ? "Syncing..." : syncSuccess ? "Synced ✓" : "Live Sync"}
              </span>
              {syncSuccess && <span className="w-1.5 h-1.5 rounded-full bg-[#D8EC8D] animate-ping" />}
            </button>

            {/* Admin Avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-white leading-tight">Administrator</span>
                <span className="text-[10px] text-[#D8EC8D] font-mono">Super Admin</span>
              </div>
              <div className="w-8 h-8 rounded-xl btn-primary-gradient text-[#171e00] flex items-center justify-center font-bold text-xs">
                AD
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              className="px-3 py-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-white hover:border-rose-500/50 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ml-1"
              title="Sign out of Admin Console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8EC8D]"
              aria-label="Toggle admin navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Bottom Nav Row */}
        <div className="hidden lg:flex items-center gap-1.5 pt-2 pb-1 overflow-x-auto scrollbar-none border-t border-white/5 mt-1">
          {adminNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? "btn-primary-gradient text-[#171e00] font-bold shadow-[0_0_15px_rgba(216,236,141,0.25)]"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className={`w-3.5 h-3.5 ${isActive ? "text-[#171e00]" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#131313] border-t border-white/15 px-2 py-4 grid grid-cols-2 gap-2 mt-2">
            {adminNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold ${
                    isActive
                      ? "btn-primary-gradient text-[#171e00] font-bold"
                      : "bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="col-span-2 mt-2 p-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-white transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out (Admin Logout)</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
