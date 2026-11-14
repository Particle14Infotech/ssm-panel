"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useCustomer } from "@/context/CustomerContext";
import {
  LayoutDashboard,
  PlusCircle,
  Layers,
  ListOrdered,
  Bookmark,
  Boxes,
  Bot,
  Wallet,
  Receipt,
  HelpCircle,
  User,
  Settings,
  Key,
  LogOut,
} from "lucide-react";

export function CustomerSidebar() {
  const pathname = usePathname();
  const { user, logout } = useCustomer();

  const navGroups = [
    {
      label: "Platform",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "New Order", href: "/new-order", icon: PlusCircle },
        { name: "My Packages", href: "/packages", icon: Boxes },
        { name: "Services", href: "/services-catalog", icon: Layers },
        { name: "Orders", href: "/orders", icon: ListOrdered },
      ],
    },
    {
      label: "Financials",
      items: [
        { name: "Wallet", href: "/wallet", icon: Wallet },
      ],
    },
    {
      label: "Account & Support",
      items: [
        { name: "Support Tickets", href: "/support", icon: HelpCircle },
        { name: "Settings", href: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col justify-between bg-gradient-to-b from-white via-slate-50/70 to-slate-100/60 dark:from-surface dark:via-surface dark:to-surface border-r border-slate-200/90 dark:border-border h-full z-40 transition-colors duration-200 shadow-xs">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center border-b border-slate-200/90 dark:border-border shrink-0 bg-white/70 dark:bg-transparent backdrop-blur-md">
          <BrandLogo variant="combined" size={32} withLink href="/dashboard" />
        </div>

        {/* Grouped Nav Items */}
        <div className="px-3 py-6 space-y-6 flex-1 min-h-0 overflow-y-auto scrollbar-none">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 pb-1.5 text-[10.5px] uppercase font-mono tracking-wider text-slate-500 dark:text-fg-muted font-bold">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname?.startsWith(item.href));

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${isActive
                          ? "bg-gradient-to-r from-lime-300/40 via-lime-200/30 to-emerald-100/30 dark:bg-accent/15 border-l-[3px] border-[#658210] dark:border-accent text-slate-950 dark:text-fg shadow-xs font-bold"
                          : "text-slate-700 dark:text-fg-2 hover:text-slate-950 dark:hover:text-fg hover:bg-slate-100/90 dark:hover:bg-surface-raised"
                        }`}
                    >
                      <item.icon
                        className={`w-4 h-4 shrink-0 transition-colors ${isActive
                            ? "text-[#4D6010] dark:text-accent-text"
                            : "text-slate-500 dark:text-fg-muted group-hover:text-slate-900 dark:group-hover:text-fg"
                          }`}
                      />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
