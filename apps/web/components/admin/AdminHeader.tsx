"use client";

import React, { useState } from "react";
import {
  RefreshCw,
  Menu,
  LogOut,
  ShieldCheck,
} from "lucide-react";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { useAdmin } from "@/context/AdminContext";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

interface AdminHeaderProps {
  onMenuToggle?: () => void;
}

export function AdminHeader({ onMenuToggle }: AdminHeaderProps) {
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

  return (
    <header className="sticky top-0 z-30 h-16 bg-surface/90 backdrop-blur-xl border-b border-border shadow-sm flex items-center justify-between px-4 sm:px-6">
      {/* Left side: Mobile Toggle & Context */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-xl bg-surface-raised border border-border text-fg hover:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="Toggle admin navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="lg:hidden">
          <BrandLogo variant="combined" size={26} withLink href="/admin/dashboard" />
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-fg-muted">
          <ShieldCheck className="w-4 h-4 text-accent-text" />
          <span className="font-semibold text-fg">Admin Command Center</span>
          <span className="text-border">•</span>
          <span className="text-fg-muted">Real-time Operations</span>
        </div>
      </div>

      {/* Right side: Live Sync, Theme Toggle, Profile, Logout */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Functional Live Sync Button */}
        <button
          type="button"
          onClick={handleLiveSync}
          disabled={isSyncing}
          className={`px-3 py-1.5 rounded-full bg-surface-raised border border-border text-xs font-mono flex items-center gap-2 transition-all hover:border-accent/40 active:scale-95 cursor-pointer ${
            isSyncing ? "opacity-75 cursor-wait" : ""
          }`}
          title="Sync platform metrics, orders, and upstream provider balances"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-accent-text ${isSyncing ? "animate-spin" : ""}`} />
          <span className="text-accent-text font-semibold hidden sm:inline">
            {isSyncing ? "Syncing..." : syncSuccess ? "Synced" : "Live Sync"}
          </span>
          {syncSuccess && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />}
        </button>

        {/* Theme Toggle */}
        <ThemeToggle variant="compact" />

        {/* Admin Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-fg leading-tight">Administrator</span>
            <span className="text-[10px] text-accent-text font-mono">Super Admin</span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-accent text-on-accent shadow-glow flex items-center justify-center font-bold text-xs select-none">
            AD
          </div>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={logout}
          className="px-3 py-1.5 rounded-full border border-danger/30 bg-danger-bg text-danger hover:bg-danger hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          title="Sign out of Admin Console"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
