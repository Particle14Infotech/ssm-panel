"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { BRAND_NAME } from "@/lib/brand";
import {
  Wallet,
  Bell,
  Search,
  User,
  LogOut,
  Menu,
  X,
  Plus,
  Shield,
  Layers,
  ListOrdered,
  PlusCircle,
  HelpCircle,
  Receipt,
  Key,
  ChevronDown,
} from "lucide-react";

export function CustomerHeader() {
  const pathname = usePathname();
  const { user, logout } = useCustomer();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const mobileNavLinks = [
    { name: "Dashboard", href: "/dashboard", icon: Layers },
    { name: "New Order", href: "/new-order", icon: PlusCircle },
    { name: "Services", href: "/services-catalog", icon: Layers },
    { name: "Orders", href: "/orders", icon: ListOrdered },
    { name: "Add Funds", href: "/wallet", icon: Wallet },
    { name: "Transactions", href: "/transactions", icon: Receipt },
    { name: "Support Tickets", href: "/support", icon: HelpCircle },
    { name: "API & Profile", href: "/profile", icon: User },
    { name: "Reseller API", href: "/app/api", icon: Key },
  ];

  return (
    <>
      <header className="h-16 bg-[#131313]/90 backdrop-blur-xl border-b border-white/10 sticky top-0 z-30 px-4 md:px-8 flex items-center justify-between gap-4">
        {/* Left: Mobile Menu Toggle & Search Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8EC8D]"
            aria-label="Open Navigation Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Quick Search */}
          <div className="relative w-full hidden sm:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search services, orders, IDs..."
              className="w-full bg-white/[0.03] border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Right: Balance Chip + Add Funds, Notifications, User Menu */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Balance Chip */}
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl p-1 pr-1.5 pl-3">
            <div className="flex items-baseline gap-1.5 font-sans">
              <span className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">Bal:</span>
              <span className="text-xs font-semibold text-white tabular-nums tracking-tight">
                ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Link
              href="/wallet"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg btn-primary-gradient hover:brightness-105 text-[#171e00] text-[11px] font-bold transition-all shadow-sm"
            >
              <Plus className="w-3 h-3" />
              <span>Add funds</span>
            </Link>
          </div>

          {/* Notifications Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setUserDropdownOpen(false);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#D8EC8D] absolute top-1.5 right-1.5" />
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-[#131313] border border-white/15 rounded-2xl p-4 shadow-2xl z-50 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-semibold text-white">Notifications</span>
                  <span className="text-[10px] font-mono text-[#D8EC8D]">All caught up</span>
                </div>
                <div className="py-6 text-center space-y-1">
                  <p className="text-xs text-slate-300">No new alerts</p>
                  <p className="text-[11px] text-slate-400">Order updates and balance alerts will appear here.</p>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div className="w-8 h-8 rounded-xl bg-[#D8EC8D]/15 border border-[#D8EC8D]/30 flex items-center justify-center text-[#D8EC8D] text-xs font-semibold font-mono">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#131313] border border-white/15 rounded-2xl p-2 shadow-2xl z-50 space-y-1">
                <div className="px-3 py-2 border-b border-white/10">
                  <div className="text-xs font-semibold text-white truncate">{user.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Account & Profile</span>
                </Link>

                <Link
                  href="/wallet"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Wallet className="w-4 h-4 text-slate-400" />
                  <span>Billing & Wallet</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Menu */}
          <div className="fixed top-0 bottom-0 left-0 w-72 bg-[#131313] border-r border-white/10 p-6 flex flex-col justify-between shadow-2xl z-50">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-white text-base tracking-tight">
                  {BRAND_NAME}
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 focus:outline-none"
                  aria-label="Close Navigation Drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Balance Pill */}
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Current Balance</div>
                  <div className="text-sm font-semibold text-white font-mono">
                    ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <Link
                  href="/wallet"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="min-h-[44px] px-3.5 flex items-center justify-center rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold hover:brightness-105 transition-colors"
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
                          ? "bg-[#D8EC8D]/15 text-white"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <item.icon className="w-4 h-4 text-[#D8EC8D]" />
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
              className="flex items-center gap-2 px-3 py-3 min-h-[44px] text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded-xl"
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
