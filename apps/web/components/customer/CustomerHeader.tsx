"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useCustomer } from "@/context/CustomerContext";
import {
  Sparkles,
  Zap,
  Wallet,
  Bell,
  User,
  Shield,
  Key,
  LogOut,
  PlusCircle,
  ListOrdered,
  Layers,
  HelpCircle,
  ChevronDown,
  ExternalLink,
  Menu,
  X,
  CreditCard,
  ArrowUpRight,
} from "lucide-react";

export function CustomerHeader() {
  const pathname = usePathname();
  const { user, logout } = useCustomer();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);

  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: Layers },
    { name: "Services", href: "/services-catalog", icon: Zap },
    { name: "New Order", href: "/new-order", icon: PlusCircle },
    { name: "Orders", href: "/orders", icon: ListOrdered },
    { name: "Wallet", href: "/wallet", icon: Wallet },
    { name: "Support", href: "/support", icon: HelpCircle },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0e0e0e]/85 backdrop-blur-xl border-b border-white/10 shadow-[0_1px_16px_rgba(0,0,0,0.6)]">
      <div className="h-20 max-w-[1560px] mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
        {/* Logo & Node Cluster Status */}
        <div className="flex items-center gap-4 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-full bg-surface-container-high border border-white/10 flex items-center justify-center transition-transform group-hover:scale-105">
              <Zap className="w-4 h-4 text-[#D8EC8D]" />
            </div>
            <div className="flex items-baseline">
              <span className="font-headline-lg text-lg uppercase tracking-wider text-white font-bold">
                AETHER
              </span>
              <span className="text-[#D8EC8D] text-lg font-light leading-none">*</span>
            </div>
          </Link>

          <div className="hidden 2xl:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high/80 border border-white/5 text-on-surface-variant text-xs">
            <span className="font-mono text-[#DBEF90] font-semibold">✦ LIVE</span>
            <span>AP-S1 Mumbai Node • 99.98% SLA</span>
          </div>
        </div>

        {/* Desktop Navigation Pill Bar with motion layoutId */}
        <nav className="hidden lg:flex items-center gap-1 p-1.5 rounded-full liquid-glass-pill relative">
          {navLinks.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-colors duration-200 flex items-center gap-1.5 z-10 ${
                  isActive
                    ? "text-[#171e00] font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="customerNavPill"
                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-[#DBEF90] shadow-[0_0_20px_rgba(219,239,144,0.3)] -z-10"
                  />
                )}
                <item.icon className={`w-3.5 h-3.5 ${isActive ? "text-[#171e00]" : "text-zinc-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions: Announcements, Balance, Profile Dropdown */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Announcements Trigger */}
          <button
            onClick={() => setAnnouncementsOpen(!announcementsOpen)}
            className="relative h-10 px-3 md:px-4 rounded-full liquid-glass-pill text-zinc-300 hover:text-white transition-all flex items-center gap-2"
            type="button"
          >
            <Sparkles className="w-4 h-4 text-[#DBEF90]" />
            <span className="hidden sm:inline text-xs uppercase tracking-wider font-medium font-mono">Updates</span>
            <span className="w-2 h-2 rounded-full bg-[#DBEF90] animate-pulse" />
          </button>

          {/* Balance Pill with Quick Deposit link */}
          <Link
            href="/wallet"
            className="h-10 px-3 md:px-4 rounded-full liquid-glass-pill hover:border-[#DBEF90]/40 flex items-center gap-2 group transition-all"
          >
            <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-mono">Bal</span>
            <span className="text-xs md:text-sm font-semibold text-[#DBEF90] group-hover:underline">
              ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#DBEF90] opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Profile Menu Trigger */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1 pl-2 rounded-full bg-surface-container-low border border-white/10 hover:bg-surface-container-high transition-all"
            >
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-[#DBEF90]/40"
              />
              <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant mr-1" />
            </button>

            {/* Profile Dropdown Box */}
            {userMenuOpen && (
              <div
                className="absolute right-0 mt-3 w-64 rounded-2xl bg-[#1c1b1b] border border-white/15 p-2 shadow-2xl z-50 backdrop-blur-2xl"
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <div className="text-xs font-semibold text-white truncate">{user.name}</div>
                  <div className="text-[11px] text-on-surface-variant truncate font-mono">{user.email}</div>
                  <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#DBEF90]/15 text-[#DBEF90] text-[10px] font-mono">
                    Tier: {user.tier}
                  </div>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-on-surface-variant hover:text-white hover:bg-white/5 transition-all"
                >
                  <User className="w-4 h-4 text-[#DBEF90]" />
                  <span>Profile & Security</span>
                </Link>

                <Link
                  href="/profile#api-keys"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-on-surface-variant hover:text-white hover:bg-white/5 transition-all"
                >
                  <Key className="w-4 h-4 text-purple-400" />
                  <span>API Credentials</span>
                </Link>

                <Link
                  href="/wallet"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-on-surface-variant hover:text-white hover:bg-white/5 transition-all"
                >
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span>Billing & Statements</span>
                </Link>

                <div className="my-1 border-t border-white/10" />

                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition-all text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Disconnect Session</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-full bg-surface-container-low border border-white/10 text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Announcements Modal / Drawer */}
      {announcementsOpen && (
        <div className="absolute top-20 left-0 right-0 bg-[#161616]/95 border-b border-white/15 px-4 py-4 md:px-8 shadow-2xl backdrop-blur-2xl">
          <div className="max-w-[1560px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start md:items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#DBEF90]/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-[#DBEF90]" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#DBEF90] uppercase tracking-wider">
                  Algorithmic Upgrade v4.9 Active
                </span>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Sub-second dispatch cluster connected. Instant Instagram Reels & TikTok FYP routing with zero drop
                  algorithm.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-center">
              <Link
                href="/new-order"
                onClick={() => setAnnouncementsOpen(false)}
                className="px-4 py-1.5 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110 transition-all"
              >
                Dispatch Test
              </Link>
              <button
                onClick={() => setAnnouncementsOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-on-surface-variant text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0e0e0e] border-b border-white/15 px-6 py-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {navLinks.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-3 rounded-2xl flex items-center gap-2.5 text-xs font-semibold ${
                    isActive
                      ? "bg-[#DBEF90] text-[#2a3400]"
                      : "bg-surface-container-low text-on-surface-variant hover:text-white"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
