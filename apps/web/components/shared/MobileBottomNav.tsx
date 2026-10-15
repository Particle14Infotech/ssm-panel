"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Zap, PlusCircle, ListOrdered, Wallet } from "lucide-react";

export function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: Layers },
    { label: "Services", href: "/services-catalog", icon: Zap },
    { label: "New Order", href: "/new-order", icon: PlusCircle, isPrimary: true },
    { label: "Orders", href: "/orders", icon: ListOrdered },
    { label: "Wallet", href: "/wallet", icon: Wallet },
  ];

  return (
    <div className="md:hidden fixed bottom-3 inset-x-3 z-50 max-w-md mx-auto">
      <nav
        aria-label="Mobile Navigation"
        className="liquid-glass-pill p-1.5 rounded-full flex items-center justify-around shadow-[0_16px_36px_rgba(0,0,0,0.85)] border border-white/[0.12] border-t-white/[0.25]"
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.isPrimary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -my-2 group"
                aria-label={item.label}
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-700 via-blue-600 to-blue-400 p-[1.5px] shadow-[0_0_16px_rgba(37,99,235,0.4)] group-hover:scale-105 transition-transform">
                  <div className="w-full h-full bg-[#070B16] rounded-full flex items-center justify-center">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-full text-[10px] font-medium transition-all ${
                isActive
                  ? "text-blue-400 font-semibold bg-white/[0.08]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
