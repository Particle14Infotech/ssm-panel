"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useCustomer } from "@/context/CustomerContext";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import {
  LayoutDashboard,
  PlusCircle,
  Layers,
  ListOrdered,
  Bookmark,
  Boxes,
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
        { name: "Favorites", href: "/favorites", icon: Bookmark },
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
    <aside className="w-64 shrink-0 hidden lg:flex flex-col justify-between bg-surface border-r border-border h-full z-40 transition-colors duration-200">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-border shrink-0">
          <BrandLogo variant="combined" size={32} withLink href="/dashboard" />
          <ThemeToggle variant="compact" />
        </div>

        {/* Grouped Nav Items */}
        <div className="px-3 py-6 space-y-6 flex-1 min-h-0 overflow-y-auto scrollbar-none">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] uppercase font-mono tracking-widest text-fg-muted font-semibold">
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
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${isActive
                          ? "bg-accent/15 text-fg shadow-sm font-semibold border-l-2 border-accent"
                          : "text-fg-2 hover:text-fg hover:bg-surface-raised"
                        }`}
                    >
                      <item.icon
                        className={`w-4 h-4 shrink-0 transition-colors ${isActive
                            ? "text-accent-text"
                            : "text-fg-muted group-hover:text-fg"
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

      {/* Bottom User Area */}
      <div className="p-4 border-t border-border shrink-0">
        <div className="p-3 rounded-2xl bg-surface-raised border border-border flex items-center justify-between gap-3 transition-colors">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-fg truncate">
              {user.name || "Customer"}
            </div>
            <div className="text-[10px] text-accent-text truncate font-mono font-bold tabular-nums">
              ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <button
            onClick={logout}
            title="Log Out"
            className="p-2 rounded-xl text-fg-muted hover:text-danger hover:bg-danger-bg transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
