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
  Wallet,
  Receipt,
  HelpCircle,
  User,
  Key,
  LogOut,
  Zap,
  Shield,
  ExternalLink,
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
        { name: "Packages", href: "/packages", icon: Boxes },
        { name: "Favorites", href: "/favorites", icon: Bookmark },
        { name: "Services", href: "/services-catalog", icon: Layers },
        { name: "Orders", href: "/orders", icon: ListOrdered },
      ],
    },
    {
      label: "Financials",
      items: [
        { name: "Add Funds", href: "/wallet", icon: Wallet },
        { name: "Transactions", href: "/transactions", icon: Receipt },
      ],
    },
    {
      label: "Account & Support",
      items: [
        { name: "Support Tickets", href: "/support", icon: HelpCircle },
        { name: "API & Profile", href: "/profile", icon: User },
        { name: "Reseller API", href: "/app/api", icon: Key },
      ],
    },
  ];

  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col justify-between bg-[#131313]/95 backdrop-blur-xl border-r border-white/10 min-h-screen sticky top-0 z-40">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center border-b border-white/10">
          <BrandLogo variant="combined" size={32} withLink href="/dashboard" />
        </div>

        {/* Grouped Nav Items */}
        <div className="px-3 py-6 space-y-6">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] uppercase font-mono tracking-widest text-slate-400 font-semibold">
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
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                        isActive
                          ? "bg-[#D8EC8D]/15 text-white shadow-sm"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                      }`}
                    >
                      {/* Left indicator for active item */}
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#D8EC8D] rounded-r" />
                      )}
                      <item.icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-[#D8EC8D]"
                            : "text-slate-400 group-hover:text-white"
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
      <div className="p-4 border-t border-white/10">
        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">
              {user.name || "Customer"}
            </div>
            <div className="text-[10px] text-slate-400 truncate font-mono">
              ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <button
            onClick={logout}
            title="Log Out"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
