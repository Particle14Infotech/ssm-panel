"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Boxes,
  ListOrdered,
  Wallet,
} from "lucide-react";
import { useCustomer } from "@/context/CustomerContext";
import { formatIndianNumber } from "@/lib/numberFormat";

export function CustomerBottomNav() {
  const pathname = usePathname();
  const { user, mobileDrawerOpen, setMobileDrawerOpen } = useCustomer();

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "My Packages",
      href: "/packages",
      icon: Boxes,
    },
    {
      name: "New Order",
      href: "/new-order",
      icon: PlusCircle,
      highlight: true,
    },
    {
      name: "Orders",
      href: "/orders",
      icon: ListOrdered,
    },
    {
      name: "Wallet",
      href: "/wallet",
      icon: Wallet,
      isWallet: true,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className={`lg:hidden fixed bottom-3 left-3 right-3 sm:left-auto sm:right-auto sm:w-[440px] sm:left-1/2 sm:-translate-x-1/2 z-40 bg-surface/85 dark:bg-[#10140b]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-full px-2 py-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.65)] select-none transition-all duration-300 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] ${
        mobileDrawerOpen ? "translate-y-28 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="flex items-center justify-around w-full gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));

          if (item.highlight) {
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileDrawerOpen(false)}
                className="flex flex-col items-center group focus:outline-none"
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                    isActive
                      ? "bg-accent text-on-accent ring-2 ring-accent/30 shadow-[0_0_16px_rgba(216,236,141,0.35)]"
                      : "bg-surface text-accent-text border border-border hover:bg-surface-raised"
                  }`}
                >
                  <item.icon className="w-5 h-5 stroke-[2.3]" />
                </div>
                <span
                  className={`text-[9px] font-semibold mt-0.5 tracking-tight ${
                    isActive ? "text-accent-text font-bold" : "text-fg-muted group-hover:text-fg"
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileDrawerOpen(false)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all relative group focus:outline-none ${
                isActive
                  ? "bg-accent/15 dark:bg-[#D8EC8D]/15 text-accent-text border border-accent/30 dark:border-[#D8EC8D]/30 shadow-[0_0_12px_rgba(216,236,141,0.18)]"
                  : "text-fg-muted hover:text-fg hover:bg-surface-raised/50"
              }`}
            >
              <div className="relative flex flex-col items-center">
                <item.icon
                  className={`w-4 h-4 transition-transform group-active:scale-90 ${
                    isActive ? "stroke-[2.2] text-accent-text" : "stroke-[1.7]"
                  }`}
                />
              </div>

              {item.isWallet && user?.balance !== undefined ? (
                <span className="text-[9px] font-mono font-bold text-accent-text mt-0.5 tracking-tight truncate max-w-[56px] leading-tight">
                  ₹{formatIndianNumber(Math.floor(user.balance))}
                </span>
              ) : (
                <span className="text-[9px] mt-0.5 font-medium tracking-tight truncate max-w-[60px] leading-tight">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
