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
  MessageSquare,
  LogOut,
  BarChart3,
  Settings,
  FileText,
} from "lucide-react";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { useAdmin } from "@/context/AdminContext";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

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
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl border-b border-border shadow-lg">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-2">
        {/* Top Header Row */}
        <div className="h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BrandLogo variant="combined" size={30} withLink href="/admin/dashboard" />

            <div className="h-4 w-px bg-border hidden sm:block" />

            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-raised border border-border text-fg-2 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shadow-glow" />
              <span className="text-[10px] uppercase tracking-widest text-accent-text font-bold">
                ROOT ADMIN CONSOLE
              </span>
              <span className="text-fg-muted/40">•</span>
              <span className="text-[11px] text-fg-muted">System Active</span>
              {process.env.NEXT_PUBLIC_SIMULATE_UPSTREAM_ORDERS === "true" && (
                <>
                  <span className="text-fg-muted/40">•</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    SIMULATION
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Functional Live Sync Button */}
            <button
              type="button"
              onClick={handleLiveSync}
              disabled={isSyncing}
              className={`px-3.5 py-1.5 rounded-full bg-surface-raised border border-border text-xs font-mono flex items-center gap-2 transition-all hover:border-accent/40 active:scale-95 cursor-pointer ${
                isSyncing ? "opacity-75 cursor-wait" : ""
              }`}
              title="Sync platform metrics, orders, and upstream provider balances"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-accent-text ${isSyncing ? "animate-spin" : ""}`} />
              <span className="text-accent-text font-semibold">
                {isSyncing ? "Syncing..." : syncSuccess ? "Synced" : "Live Sync"}
              </span>
              {syncSuccess && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />}
            </button>

            {/* Accessible Theme Toggle */}
            <ThemeToggle variant="compact" />

            {/* Admin Avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-fg leading-tight">Administrator</span>
                <span className="text-[10px] text-accent-text font-mono">Super Admin</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-accent text-on-accent shadow-glow flex items-center justify-center font-bold text-xs">
                AD
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              className="px-3 py-1.5 rounded-full border border-danger/30 bg-danger-bg text-danger hover:bg-danger hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ml-1"
              title="Sign out of Admin Console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-xl bg-surface-raised border border-border text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label="Toggle admin navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Bottom Nav Row */}
        <div className="hidden lg:flex items-center gap-1.5 pt-2 pb-1 overflow-x-auto scrollbar-none border-t border-border mt-1">
          {adminNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? "bg-accent text-on-accent font-bold shadow-glow"
                    : "text-fg-muted hover:text-fg hover:bg-surface-raised"
                }`}
              >
                <item.icon className={`w-3.5 h-3.5 ${isActive ? "text-on-accent" : "text-fg-muted"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-surface border-t border-border px-2 py-4 grid grid-cols-2 gap-2 mt-2">
            {adminNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold ${
                    isActive
                      ? "bg-accent text-on-accent font-bold shadow-glow"
                      : "bg-surface-raised text-fg-muted hover:text-fg"
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
              className="col-span-2 mt-2 p-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold border border-danger/30 bg-danger-bg text-danger hover:bg-danger hover:text-white transition-all cursor-pointer"
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
