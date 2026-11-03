"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { Link as LinkIcon, ArrowRight } from "lucide-react";

export function DashboardHeaderBar() {
  const { user } = useCustomer();
  const router = useRouter();
  const [targetLink, setTargetLink] = useState("");

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLink.trim()) return;
    router.push(`/new-order?target=${encodeURIComponent(targetLink.trim())}`);
  };

  const firstName = user?.name ? user.name.split(" ")[0] : "Customer";

  return (
    <div className="space-y-3 pt-1 pb-2">
      {/* Top Greeting & Quick Search Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left Greeting */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-fg tracking-tight font-sans transition-colors">
            Welcome back, {firstName}
          </h1>
          <p className="text-xs text-fg-muted mt-0.5">
            Monitor your active campaigns, execution ledgers, and delivery cadence.
          </p>
        </div>

        {/* Quick Target Link Bar (Sleek Glass Bar) */}
        <form
          onSubmit={handleQuickSubmit}
          className="relative flex items-center w-full lg:max-w-md bg-surface-raised border border-border focus-within:border-focus rounded-2xl p-1 pr-2 transition-all shadow-sm"
        >
          <div className="pl-3 pr-2 text-fg-muted flex items-center shrink-0">
            <LinkIcon className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={targetLink}
            onChange={(e) => setTargetLink(e.target.value)}
            placeholder="Quick Target Link: https://..."
            className="w-full bg-transparent text-fg text-xs placeholder:text-fg-muted focus:outline-none font-mono py-1"
          />
          <button
            type="submit"
            disabled={!targetLink.trim()}
            className="px-3 py-1 rounded-xl bg-accent hover:brightness-105 disabled:opacity-35 text-on-accent text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
          >
            <span>Order</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>
      </div>
    </div>
  );
}
