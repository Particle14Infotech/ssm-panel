"use client";

import React from "react";
import Link from "next/link";
import { GlassCard } from "@/components/shared/GlassCard";
import { ShieldCheck, AlertCircle, RefreshCw, PlusCircle, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";

interface StickySummaryProps {
  serviceName: string;
  targetUrl: string;
  quantity: number;
  ratePer1000: number;
  totalCharge: number;
  walletBalance: number;
  isQuoting: boolean;
  isSubmitting: boolean;
  quoteStale: boolean;
  onRefreshQuote: () => void;
  onSubmit: () => void;
  consent: boolean;
  onConsentChange: (c: boolean) => void;
  dripDetails?: {
    runs: number;
    intervalHours: number;
  };
  customCommentsCount?: number;
}

export function StickySummary({
  serviceName,
  targetUrl,
  quantity,
  ratePer1000,
  totalCharge,
  walletBalance,
  isQuoting,
  isSubmitting,
  quoteStale,
  onRefreshQuote,
  onSubmit,
  consent,
  onConsentChange,
  dripDetails,
  customCommentsCount,
}: StickySummaryProps) {
  const isBalanceSufficient = walletBalance >= totalCharge;
  const shortfall = Math.max(0, totalCharge - walletBalance);
  const balanceAfterOrder = Math.max(0, walletBalance - totalCharge);

  return (
    <div className="w-full space-y-4">
      <GlassCard className="p-5 md:p-6 border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-[#111317]/90 backdrop-blur-xl relative overflow-hidden shadow-sm dark:shadow-none transition-colors rounded-2xl">
        {/* Glow ambient accent */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        <h3 className="font-bold text-xs tracking-wider uppercase text-fg-muted flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
          <span>ORDER SUMMARY</span>
          {quoteStale && (
            <button
              type="button"
              onClick={onRefreshQuote}
              className="text-[11px] text-[#D8EC8D] hover:underline flex items-center gap-1 font-normal lowercase"
            >
              <RefreshCw className="w-3 h-3" />
              <span>refresh quote</span>
            </button>
          )}
        </h3>

        <div className="py-3 space-y-3 text-xs">
          {/* Service Name */}
          <div className="space-y-0.5">
            <span className="text-[11px] text-fg-muted">Service</span>
            <div className="text-fg font-medium line-clamp-2 leading-snug">
              {serviceName || "Select a service to begin"}
            </div>
          </div>

          {/* Target Link */}
          <div className="space-y-0.5">
            <span className="text-[11px] text-fg-muted">Target link</span>
            <div className="text-fg-2 font-mono text-[11px] truncate bg-slate-100 dark:bg-white/[0.03] p-1.5 rounded-lg border border-slate-200 dark:border-white/5">
              {targetUrl ? targetUrl : <span className="text-slate-400 italic">Not specified</span>}
            </div>
          </div>

          {/* Breakdown Rows */}
          <div className="pt-2 border-t border-slate-200/80 dark:border-white/5 space-y-1.5 text-fg-muted text-xs">
            <div className="flex justify-between items-center">
              <span>Quantity</span>
              <span className="text-fg font-semibold font-mono">
                {formatIndianNumber(quantity)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span>Rate per 1,000</span>
              <span className="text-fg font-mono">₹{ratePer1000.toFixed(2)}</span>
            </div>

            {Boolean(customCommentsCount && customCommentsCount > 0) && (
              <div className="flex justify-between items-center text-[#171e00] dark:text-[#D8EC8D]">
                <span className="font-medium">Custom comments</span>
                <span className="font-mono font-semibold text-[11px] px-2 py-0.5 rounded-md bg-[#D8EC8D]/20 border border-[#D8EC8D]/40">
                  {customCommentsCount} {customCommentsCount === 1 ? "line" : "lines"}
                </span>
              </div>
            )}

            {dripDetails && dripDetails.runs > 1 && (
              <div className="flex justify-between items-center text-[#D8EC8D]">
                <span>Drip Delivery</span>
                <span className="font-mono text-[11px]">
                  {dripDetails.runs} runs × {dripDetails.intervalHours}h
                </span>
              </div>
            )}

            {/* Delivery Pace & Estimated Finish */}
            {quantity > 0 && (() => {
              const paceCap = 150;
              const isDrip = Boolean(dripDetails && dripDetails.runs > 1);
              const durHours = isDrip
                ? Math.max(1, (dripDetails?.runs || 1) * (dripDetails?.intervalHours || 1))
                : Math.max(1, Math.ceil(quantity / paceCap));
              const pace = Math.min(paceCap, Math.max(1, Math.round(quantity / durHours)));
              const estDate = new Date(Date.now() + durHours * 60 * 60 * 1000);
              const isSpread = quantity > paceCap || isDrip;

              return (
                <div className="pt-2 border-t border-slate-200/80 dark:border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-fg-muted">Delivery pace</span>
                    <span className="font-mono font-semibold text-fg">up to {pace} per hour</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-fg-muted">Estimated finish</span>
                    <span className="font-mono font-semibold text-[#D8EC8D]">
                      {estDate.toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {isSpread && (
                    <div className="p-2 rounded-lg bg-white/[0.03] border border-border text-[11px] text-slate-300 flex items-start gap-1.5 leading-tight">
                      <Clock className="w-3.5 h-3.5 text-[#D8EC8D] shrink-0 mt-0.5" />
                      <span>To keep delivery at or below {pace} per hour, this order will take about {durHours} hours.</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Total Charge & Balances */}
          <div className="pt-2 border-t border-slate-200/80 dark:border-white/5 space-y-2">
            <div>
              <span className="text-[11px] text-fg-muted block">Total charge</span>
              <span className="text-2xl font-black text-fg tracking-tight font-mono">
                {isQuoting ? (
                  <span className="text-slate-500 animate-pulse text-sm">Calculating...</span>
                ) : (
                  `₹${totalCharge.toFixed(2)}`
                )}
              </span>
            </div>

            <div className="space-y-1 pt-1 text-xs">
              <div className="flex justify-between items-center text-fg-muted">
                <span>Wallet balance</span>
                <span className="font-mono text-fg font-medium">₹{walletBalance.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-fg-muted">Balance after order</span>
                <span className={`font-mono font-semibold ${isBalanceSufficient ? "text-[#D8EC8D]" : "text-warning"}`}>
                  ₹{balanceAfterOrder.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Insufficient Balance Notice */}
          {!isBalanceSufficient && totalCharge > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span>
                  Needs <strong>₹{shortfall.toFixed(2)}</strong> more in wallet to place this order.
                </span>
              </div>
              <Link
                href={`/wallet?amount=${Math.ceil(shortfall)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-[11px] transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Funds (Keeps Draft)</span>
              </Link>
            </div>
          )}

          {/* Before you order Checklist */}
          <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-black/30 border border-slate-200 dark:border-white/5 space-y-1.5 text-[11px]">
            <span className="font-semibold text-fg-2 block">Before you order:</span>
            <div className="flex items-center gap-1.5 text-fg-muted">
              <span className={`w-1.5 h-1.5 rounded-full ${targetUrl ? "bg-[#D8EC8D]" : "bg-amber-400"}`} />
              <span>{targetUrl ? "Destination link specified" : "Enter a destination link"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-fg-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D8EC8D]" />
              <span>The account or post must be public</span>
            </div>
          </div>

          {/* Compliance & Consent */}
          <label className="flex items-start gap-2 pt-1 cursor-pointer select-none text-[11px] text-fg-muted leading-tight">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => onConsentChange(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 dark:border-white/20 bg-transparent text-[#D8EC8D] focus:ring-[#D8EC8D]"
            />
            <span>
              I understand delivery is made through providers and that platform rules and risks apply. We do not verify account ownership.
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          disabled={!consent || !isBalanceSufficient || quoteStale || isSubmitting || isQuoting || totalCharge <= 0 || !targetUrl}
          onClick={onSubmit}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 mt-2 ${
            !consent || !isBalanceSufficient || quoteStale || isSubmitting || isQuoting || totalCharge <= 0 || !targetUrl
              ? "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-300 dark:border-white/5"
              : "bg-[#D8EC8D] text-[#171e00] hover:bg-[#cbe07a] shadow-[0_0_20px_rgba(216,236,141,0.35)] cursor-pointer active:scale-[0.98]"
          }`}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Processing Order...</span>
            </>
          ) : (
            <>
              <span>Place order - ₹{totalCharge.toFixed(2)}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Footnote Notice */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/5 mt-3 space-y-1 text-[10px] text-slate-500 leading-normal">
          <p>If an order is cancelled or only partly delivered, the unused amount returns to your wallet.</p>
          <p>Your order is sent for delivery right after you confirm.</p>
        </div>
      </GlassCard>

      {/* Safety & Compliance badge */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 text-[11px] text-fg-muted">
        <ShieldCheck className="w-4 h-4 text-[#D8EC8D] shrink-0" />
        <span>Authoritative server quotation with locked ledger accounting.</span>
      </div>
    </div>
  );
}
