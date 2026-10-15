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
  Shield,
  Activity,
  ArrowUpRight,
  ExternalLink,
  Menu,
  X,
  Bell,
  RefreshCw,
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0e0e0e]/90 backdrop-blur-xl border-b border-white/10 shadow-[0_1px_16px_rgba(0,0,0,0.7)]">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-2">
        {/* Top Header Row */}
        <div className="h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full bg-surface-container-high border border-white/15 flex items-center justify-center">
                <Zap className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex items-baseline">
                <span className="font-headline-lg text-lg uppercase tracking-wider text-white font-bold">
                  {BRAND_NAME}
                </span>
                <span className="text-blue-400 text-lg font-light leading-none">*</span>
              </div>
            </Link>

            <div className="h-4 w-px bg-white/15 hidden sm:block" />

            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full liquid-glass-pill text-zinc-300 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#DBEF90] animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-[#DBEF90] font-bold">
                ROOT ADMIN CONSOLE
              </span>
              <span className="text-white/20">•</span>
              <span className="text-[11px]">v4.9 Cluster Optimal</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-pill text-xs font-mono">
              <RefreshCw className="w-3 h-3 text-[#DBEF90]" />
              <span className="text-[#DBEF90] font-bold">Live Sync</span>
              <span className="text-white">14ms</span>
            </div>

            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 rounded-full liquid-glass-pill text-white text-xs font-semibold flex items-center gap-1.5 transition-all hover:border-[#DBEF90]/40"
            >
              <span>Customer View</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#DBEF90]" />
            </Link>

            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-white leading-tight">Operator Alpha</span>
                <span className="text-[10px] text-[#DBEF90] font-mono">Super Admin</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#d8ec8d] text-[#2a3400] flex items-center justify-center font-bold text-xs">
                OA
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-full bg-surface-container-low border border-white/10 text-white"
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
                    ? "bg-[#d8ec8d] text-[#2a3400] font-bold shadow-[0_0_15px_rgba(219,239,144,0.3)]"
                    : "text-on-surface-variant hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className={`w-3.5 h-3.5 ${isActive ? "text-[#2a3400]" : "text-on-surface-variant"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0e0e0e] border-t border-white/15 px-2 py-4 grid grid-cols-2 gap-2 mt-2">
            {adminNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold ${
                    isActive
                      ? "bg-[#d8ec8d] text-[#2a3400]"
                      : "bg-surface-container-low text-on-surface-variant hover:text-white"
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
