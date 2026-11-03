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

export function CustomerBottomNav() {
  const pathname = usePathname();
  const { user } = useCustomer();

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "New Order",
      href: "/new-order",
      icon: PlusCircle,
      highlight: true,
    },
    {
      name: "My Packages",
      href: "/packages",
      icon: Boxes,
      badge: "Multi",
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
      pill: user?.balance !== undefined ? `₹${Math.floor(user.balance)}` : undefined,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-2xl border-t border-border px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),10px)] select-none shadow-lg transition-colors"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));

          if (item.highlight) {
            return (
              <Link
                key={item.name}
                href={item.href}
                className="relative -top-3 flex flex-col items-center group focus:outline-none"
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                    isActive
                      ? "bg-accent text-on-accent ring-4 ring-accent/20 shadow-glow"
                      : "bg-surface text-accent-text border border-border hover:bg-surface-raised"
                  }`}
                >
                  <item.icon className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span
                  className={`text-[10px] font-semibold mt-1 tracking-tight ${
                    isActive ? "text-accent-text" : "text-fg-muted group-hover:text-fg"
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
              className={`flex-1 flex flex-col items-center py-1 px-1 rounded-xl transition-all relative group focus:outline-none ${
                isActive ? "text-accent-text font-semibold" : "text-fg-muted hover:text-fg"
              }`}
            >
              <div className="relative">
                <item.icon className={`w-5 h-5 transition-transform group-active:scale-90 ${isActive ? "stroke-[2.2]" : "stroke-[1.7]"}`} />
                {item.badge && (
                  <span className="absolute -top-1 -right-3 text-[8px] font-mono font-bold bg-accent/20 text-accent-text px-1 rounded-full border border-accent/40">
                    {item.badge}
                  </span>
                )}
                {item.pill && (
                  <span className="absolute -top-1 -right-4 text-[8px] font-mono font-bold bg-surface-raised text-accent-text px-1 rounded-full border border-border tabular-nums">
                    {item.pill}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 font-medium tracking-tight">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
