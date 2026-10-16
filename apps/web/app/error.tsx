"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception safely without leaking sensitive payload data
    console.error("Application runtime error encountered:", error?.message || "Unknown");
  }, [error]);

  return (
    <div className="min-h-screen bg-[#131313] text-zinc-300 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 flex flex-col items-center text-center justify-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-6 shadow-lg shadow-rose-500/10">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-xs font-mono text-[#D8EC8D] uppercase tracking-widest mb-4">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          HTTP 500 • Server Execution Error
        </div>

        <h1 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mb-4">
          Unexpected <span className="text-[#D8EC8D] font-normal">System Anomaly</span>
        </h1>

        <p className="text-zinc-400 text-sm sm:text-base max-w-lg mb-8 leading-relaxed font-light">
          An unhandled fault occurred while processing your request. Our telemetry logging service has flagged this incident for review.
        </p>

        {error?.digest && (
          <div className="mb-8 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs text-zinc-400">
            Error Reference Digest: <span className="text-[#D8EC8D]">{error.digest}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#D8EC8D] to-[#BEF264] text-[#171e00] font-bold text-sm transition-all shadow-lg shadow-[#D8EC8D]/25 hover:brightness-105"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Operation</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white text-sm font-medium transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Return to Homepage</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
