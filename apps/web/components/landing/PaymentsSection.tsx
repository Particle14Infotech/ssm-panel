"use client";

import React, { useRef } from "react";
import { PaymentIcon } from "@/components/shared/PaymentIcon";
import { CreditCard, RotateCcw, Activity, ShieldCheck, CheckCircle2 } from "lucide-react";
import { CrownSlot } from "@/components/three/CrownSlot";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

function BentoCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 200, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 200, damping: 20 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["3deg", "-3deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-3deg", "3deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={`rounded-2xl sm:rounded-3xl bg-surface/80 dark:bg-surface-glass border border-border backdrop-blur-xl p-5 sm:p-6 shadow-xl transition-all hover:border-accent/40 relative overflow-hidden ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function PaymentsSection() {
  const supportedMethods = [
    { id: "upi", name: "UPI" },
    { id: "gpay", name: "Google Pay" },
    { id: "phonepe", name: "PhonePe" },
    { id: "paytm", name: "Paytm" },
    { id: "visa", name: "Visa" },
    { id: "mastercard", name: "Mastercard" },
    { id: "rupay", name: "RuPay" },
    { id: "netbanking", name: "Netbanking" },
  ];

  return (
    <section
      id="payments"
      className="w-full py-10 sm:py-14 lg:py-16 bg-transparent relative"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Title Block - Compact & balanced */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="max-w-xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-3">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-semibold text-accent-text uppercase tracking-wider">
                04 / 05 — Wallet & Payments
              </span>
            </div>
            <h2 className="text-[clamp(24px,3vw,38px)] font-bold text-fg tracking-[-0.02em] leading-tight mb-2">
              Direct INR payments & instant refunds
            </h2>
            <p className="text-sm sm:text-base text-fg-muted font-normal leading-relaxed">
              Top up your balance seamlessly in Indian Rupees. Unfulfilled balances automatically return to your wallet.
            </p>
          </div>

          <div className="hidden lg:flex items-center justify-end">
            <CrownSlot
              id="payments"
              className="w-24 h-24 pointer-events-none"
            />
          </div>
        </div>

        {/* Bento Grid: 1 Large tile + 2 Secondary tiles - Reduced height */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* Tile 1: Pay in INR (Large Tile: 7 cols) */}
          <BentoCard className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-widest text-accent-text font-mono px-2.5 py-0.5 rounded-md bg-accent/10 border border-accent/20 font-bold">
                  INR Gateway
                </span>
                <span className="text-xs font-mono text-fg-muted">
                  Min. Deposit ₹100
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-fg mb-1.5">
                Pay in INR
              </h3>
              <p className="text-xs sm:text-sm text-fg-muted font-normal leading-relaxed mb-4">
                Instant wallet top-ups through official UPI apps, debit/credit cards, and RuPay. Zero exchange fees or conversion delays.
              </p>

              {/* Logo Plates Grid: 4 columns, compact & crisp */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {supportedMethods.map((m) => (
                  <div
                    key={m.id}
                    className="h-11 sm:h-12 flex items-center justify-start gap-2 p-1.5 rounded-xl bg-surface-raised/70 dark:bg-white/[0.04] border border-border hover:border-accent/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center p-1 shrink-0 shadow-xs">
                      <PaymentIcon method={m.id} size={18} />
                    </div>
                    <span className="text-xs font-semibold text-fg truncate">
                      {m.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-border flex items-center gap-2 text-[11px] text-fg-muted">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>PCI-DSS compliant encrypted transactions with 256-bit bank security.</span>
            </div>
          </BentoCard>

          {/* Right Column: 2 Stacked Tiles (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            
            {/* Tile 2: Automatic Refunds */}
            <BentoCard className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
                    <RotateCcw className="w-3.5 h-3.5 text-accent-text" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-accent-text px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                    Automatic
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-fg mb-1">
                  Automatic refunds
                </h3>
                <p className="text-xs text-fg-muted font-normal leading-relaxed">
                  If any order cannot be fully completed or is cancelled by the network, the unfulfilled amount is credited straight back to your wallet balance automatically.
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border flex items-center gap-1.5 text-[11px] text-fg-muted">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Zero support tickets required for partial refunds.</span>
              </div>
            </BentoCard>

            {/* Tile 3: Live Tracking */}
            <BentoCard className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5 text-accent-text" />
                  </div>
                  <span className="text-[10px] font-mono text-fg-muted">
                    Real-time
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-fg mb-1">
                  Live tracking
                </h3>
                <p className="text-xs text-fg-muted font-normal leading-relaxed mb-3">
                  Watch order status advance in real-time with continuous progress counters.
                </p>

                {/* Status-timeline illustration */}
                <div className="p-2.5 rounded-xl bg-surface-raised/70 dark:bg-white/[0.03] border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span className="text-xs font-mono font-semibold text-fg">In Progress</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-accent-text">
                    940 / 1,000 delivered
                  </span>
                </div>
              </div>
            </BentoCard>

          </div>

        </div>
      </div>
    </section>
  );
}
