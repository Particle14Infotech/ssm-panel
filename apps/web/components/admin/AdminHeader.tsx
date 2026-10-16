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
  ExternalLink,
  Menu,
  X,
} from "lucide-react";

import { BRAND_NAME } from "@/lib/brand";

export function AdminHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#02040A]/90 backdrop-blur-xl border-b border-white/10 shadow-[0_1px_16px_rgba(0,0,0,0.7)]">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-2">
        {/* Top Header Row */}
        <div className="h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex items-baseline">
                <span className="font-heading text-lg uppercase tracking-wider text-white font-bold">
                  {BRAND_NAME}
                </span>
                <span className="text-blue-400 text-lg font-light leading-none">*</span>
              </div>
            </Link>

            <div className="h-4 w-px bg-white/15 hidden sm:block" />

            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full liquid-glass-pill text-slate-300 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">
                ROOT ADMIN CONSOLE
              </span>
              <span className="text-white/20">•</span>
              <span className="text-[11px]">System Active</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-pill text-xs font-mono">
              <RefreshCw className="w-3 h-3 text-blue-400" />
              <span className="text-blue-400 font-semibold">Live Sync</span>
            </div>

            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 rounded-full liquid-glass-pill text-white text-xs font-semibold flex items-center gap-1.5 transition-all hover:border-blue-500/40"
            >
              <span>Customer View</span>
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
            </Link>

            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-white leading-tight">Administrator</span>
                <span className="text-[10px] text-blue-400 font-mono">Super Admin</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                AD
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                    ? "bg-blue-600 text-white font-bold shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#02040A] border-t border-white/15 px-2 py-4 grid grid-cols-2 gap-2 mt-2">
            {adminNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
