"use client";

import React from "react";
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
  MessageSquare,
  BarChart3,
  Settings,
  FileText,
  Boxes,
  X,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useAdmin } from "@/context/AdminContext";

interface AdminSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const ADMIN_NAV_SECTIONS = [
  {
    title: "Operations",
    items: [
      { name: "Dashboard", href: "/admin/dashboard", icon: Layers },
      { name: "Orders Ledger", href: "/admin/orders", icon: ListOrdered },
      { name: "Support Tickets", href: "/admin/tickets", icon: MessageSquare },
    ],
  },
  {
    title: "Catalog & Pricing",
    items: [
      { name: "Service Matrix", href: "/admin/services", icon: Zap },
      { name: "Combo Packages", href: "/admin/combos", icon: Boxes },
      { name: "Categories", href: "/admin/categories", icon: Tag },
      { name: "Coupons & Promos", href: "/admin/coupons", icon: Tag },
    ],
  },
  {
    title: "Users & Settlement",
    items: [
      { name: "User Directory", href: "/admin/users", icon: Users },
      { name: "Wallets & Liability", href: "/admin/wallets", icon: CreditCard },
      { name: "Payment Audits", href: "/admin/payments", icon: CreditCard },
    ],
  },
  {
    title: "System & Routing",
    items: [
      { name: "API Providers", href: "/admin/providers", icon: Server },
      { name: "Analytics & Reports", href: "/admin/reports", icon: BarChart3 },
      { name: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
      { name: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export function AdminSidebar({ mobileOpen, onCloseMobile }: AdminSidebarProps) {
  const pathname = usePathname();
  const { logout } = useAdmin();

  const navContent = (
    <div className="flex flex-col h-full bg-surface border-r border-border select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-border">
        <BrandLogo variant="combined" size={28} withLink href="/admin/dashboard" showPulse={false} />
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-raised transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5 scrollbar-thin scrollbar-thumb-border">
        {ADMIN_NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <h4 className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-fg-muted/70">
              {section.title}
            </h4>
            <div className="space-y-0.5 pt-1">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin/dashboard" && pathname?.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-accent to-[#bccf74] text-on-accent font-bold shadow-[0_4px_16px_rgba(212,245,95,0.25)]"
                        : "text-fg-muted font-medium hover:text-fg hover:bg-surface-raised"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive ? "text-on-accent" : "text-fg-muted group-hover:text-accent-text"
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Info & Sign Out */}
      <div className="p-3 border-t border-border bg-surface-raised/40 space-y-2">
        <div className="text-[11px] font-mono text-fg-muted flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-accent-text" />
            <span className="font-semibold text-fg">v2.4 Prod Admin</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-accent-text font-bold">
            ONLINE
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            logout();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-danger bg-danger-bg hover:bg-danger hover:text-white transition-all border border-danger/20 cursor-pointer active:scale-98"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Admin Session</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-40">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
