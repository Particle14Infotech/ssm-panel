"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import {
  Wallet,
  Bell,
  Search,
  User,
  LogOut,
  Menu,
  X,
  Plus,
  Layers,
  ListOrdered,
  PlusCircle,
  HelpCircle,
  Receipt,
  Key,
  Boxes,
  Bookmark,
  ChevronDown,
  Settings,
} from "lucide-react";

export function CustomerHeader() {
  const pathname = usePathname();
  const { user, logout, mobileDrawerOpen, setMobileDrawerOpen } = useCustomer();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Auto-close drawer on route change (e.g. when tapping bottom nav)
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Toggle body class to coordinate mobile bottom nav hiding
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (mobileDrawerOpen) {
        document.body.classList.add("mobile-drawer-active");
      } else {
        document.body.classList.remove("mobile-drawer-active");
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("mobile-drawer-active");
      }
    };
  }, [mobileDrawerOpen]);

  const mobileNavLinks = [
    { name: "Dashboard", href: "/dashboard", icon: Layers },
    { name: "New Order", href: "/new-order", icon: PlusCircle },
    { name: "My Packages", href: "/packages", icon: Boxes },
    { name: "Services", href: "/services-catalog", icon: Layers },
    { name: "Orders", href: "/orders", icon: ListOrdered },
    { name: "Wallet", href: "/wallet", icon: Wallet },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <>
      <header className="h-16 shrink-0 bg-surface backdrop-blur-xl border-b border-border sticky top-0 z-50 px-3 sm:px-4 md:px-8 flex items-center justify-between gap-2 sm:gap-4 transition-colors shadow-xs text-fg">
        {/* Left: Mobile Menu Toggle & Brand / Search Bar */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-md">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center p-2 rounded-xl text-fg-muted hover:text-fg hover:bg-surface-raised transition-colors lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-focus shrink-0"
            aria-label="Open Navigation Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile Brand Logo & Title — always show name */}
          <div className="lg:hidden flex items-center shrink-0">
            <BrandLogo variant="combined" size={26} withLink href="/dashboard" textClassName="text-sm sm:text-base" />
          </div>

          {/* Quick Search */}
          <div className="relative w-full hidden sm:block">
            <Search className="w-4 h-4 text-slate-500 dark:text-fg-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search services, orders, IDs..."
              className="w-full bg-slate-100/90 dark:bg-surface-raised border border-slate-300/80 dark:border-border focus:border-[#4D6010] dark:focus:border-focus rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-fg placeholder:text-slate-500 dark:placeholder:text-fg-muted focus:outline-none transition-all shadow-2xs font-medium"
            />
          </div>
        </div>

        {/* Right: Balance Chip + Add Funds, Notifications, User Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Balance Chip (Hidden on mobile per Requirement 10, visible on md+) */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-slate-100 to-lime-50/70 dark:from-transparent dark:to-transparent dark:bg-surface-raised border border-slate-300/80 dark:border-border rounded-xl p-1 pr-1.5 pl-2.5 sm:pl-3 whitespace-nowrap transition-colors shadow-2xs">
            <div className="flex items-baseline gap-1 font-sans whitespace-nowrap">
              <span className="text-[10px] sm:text-[11px] text-slate-600 dark:text-fg-muted uppercase tracking-wide font-bold">Bal:</span>
              <span className="text-xs font-bold text-slate-950 dark:text-fg tabular-nums tracking-tight">
                ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Link
              href="/wallet"
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-accent text-on-accent hover:brightness-105 text-[10px] sm:text-[11px] font-bold transition-all shadow-glow whitespace-nowrap"
              aria-label="Add funds to wallet"
            >
              <Plus className="w-3 h-3" />
              <span className="hidden xs:inline">Add</span>
            </Link>
          </div>

          {/* Accessible Theme Toggle */}
          <ThemeToggle variant="compact" />

          {/* Notifications Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setUserDropdownOpen(false);
              }}
              aria-label="Notifications"
              className="p-2 rounded-xl text-fg-muted hover:text-fg hover:bg-surface-raised transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent absolute top-1.5 right-1.5 shadow-glow" />
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-surface border border-border text-fg rounded-2xl p-4 shadow-2xl z-50 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-semibold text-fg">Notifications</span>
                  <span className="text-[10px] font-mono text-accent-text">All caught up</span>
                </div>
                <div className="py-6 text-center space-y-1">
                  <p className="text-xs text-fg-2">No new alerts</p>
                  <p className="text-[11px] text-fg-muted">Order updates and balance alerts will appear here.</p>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown: Hidden on mobile per Requirement 3, placed inside hamburger drawer */}
          <div className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setNotificationsOpen(false);
              }}
              aria-label="User account menu"
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-surface-raised transition-colors"
            >
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-text text-xs font-semibold font-mono">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-fg-muted hidden sm:block" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-surface border border-border text-fg rounded-2xl p-2 shadow-2xl z-50 space-y-1">
                <div className="px-3 py-2 border-b border-border">
                  <div className="text-xs font-semibold text-fg truncate">{user.name}</div>
                  <div className="text-[10px] text-fg-muted truncate">{user.email}</div>
                </div>

                <Link
                  href="/settings"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-fg-2 hover:text-fg hover:bg-surface-raised transition-colors"
                >
                  <Settings className="w-4 h-4 text-fg-muted" />
                  <span>Account Settings</span>
                </Link>

                <Link
                  href="/wallet"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-fg-2 hover:text-fg hover:bg-surface-raised transition-colors"
                >
                  <Wallet className="w-4 h-4 text-fg-muted" />
                  <span>Billing & Wallet</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-danger hover:bg-danger-bg transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 text-danger" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Menu */}
          <div className="fixed top-0 bottom-0 left-0 w-72 bg-surface border-r border-border p-6 flex flex-col justify-between shadow-2xl z-[101]">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <BrandLogo variant="combined" size={28} withLink href="/dashboard" />
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-xl text-fg-muted hover:text-fg hover:bg-surface-raised focus:outline-none transition-colors"
                  aria-label="Close Navigation Drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Requirement 3: User Profile Card embedded inside Hamburger Drawer */}
              <div className="p-3.5 rounded-2xl bg-surface-raised border border-border flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-accent text-on-accent flex items-center justify-center text-sm font-bold font-mono shrink-0 shadow-sm">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-fg truncate">{user.name || "User"}</div>
                    <div className="text-[10px] text-fg-muted truncate">{user.email || ""}</div>
                  </div>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-2 rounded-xl text-fg-muted hover:text-fg hover:bg-surface border border-border transition-colors"
                  title="Account Settings"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </div>

              {/* Mobile Balance Pill */}
              <div className="p-3 rounded-2xl bg-surface-raised border border-border flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-fg-muted uppercase font-mono">Current Balance</div>
                  <div className="text-sm font-semibold text-fg font-mono tabular-nums">
                    ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <Link
                  href="/wallet"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="min-h-[44px] px-3.5 flex items-center justify-center rounded-xl bg-accent text-on-accent text-xs font-bold hover:brightness-105 transition-colors shadow-glow"
                >
                  Add Funds
                </Link>
              </div>

              {/* Mobile Nav Links */}
              <div className="space-y-1">
                {mobileNavLinks.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-accent/15 text-fg font-semibold border-l-2 border-accent"
                          : "text-fg-2 hover:text-fg hover:bg-surface-raised"
                      }`}
                    >
                      <item.icon className={`w-4 h-4 ${isActive ? "text-accent-text" : "text-fg-muted"}`} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => {
                setMobileDrawerOpen(false);
                logout();
              }}
              className="flex items-center gap-2 px-3 py-3 min-h-[44px] text-xs font-medium text-danger hover:bg-danger-bg rounded-xl"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
