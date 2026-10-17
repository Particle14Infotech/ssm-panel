"use client";

import React, { useRef } from "react";
import { PaymentIcon } from "@/components/shared/PaymentIcon";
import { CreditCard, RotateCcw, Activity, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
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

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"]);

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
      className={`rounded-3xl bg-[#1c1b1b]/80 border border-white/[0.1] backdrop-blur-2xl p-6 sm:p-8 shadow-2xl transition-colors hover:border-white/[0.22] relative overflow-hidden ${className}`}
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
      className="w-full py-16 sm:py-24 lg:py-28 bg-transparent relative"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Title Block */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
              <span className="w-2 h-2 rounded-full bg-[#d8ec8d]" />
              <span className="text-[13px] font-medium text-[#d8ec8d]">
                04 / 05 — Wallet & Payments
              </span>
            </div>
            <h2 className="text-[clamp(28px,3.8vw,48px)] font-semibold text-white tracking-[-0.02em] leading-tight mb-4">
              Direct INR payments & instant refunds
            </h2>
            <p className="text-base sm:text-lg text-[#A1A1AA] font-normal leading-relaxed">
              Top up your balance seamlessly in Indian Rupees. Unfulfilled balances automatically return to your wallet.
            </p>
          </div>

          <div className="hidden lg:flex items-center justify-end">
            <CrownSlot
              id="payments"
              className="w-28 h-28 pointer-events-none"
            />
          </div>
        </div>

        {/* Bento Grid: 1 Large tile + 2 Secondary tiles */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Tile 1: Pay in INR (Large Tile: 7 cols) */}
          <BentoCard className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-widest text-[#d8ec8d] font-mono px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08]">
                  INR Gateway
                </span>
                <span className="text-xs font-mono text-[#A1A1AA]">
                  Min. Deposit ₹100
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-3">
                Pay in INR
              </h3>
              <p className="text-sm sm:text-base text-[#A1A1AA] font-normal leading-relaxed mb-6">
                Instant wallet top-ups through official UPI apps, debit/credit cards, and RuPay. Zero exchange fees or conversion delays.
              </p>

              {/* Logo Plates Grid: 4 columns, light plates for dark logos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {supportedMethods.map((m) => (
                  <div
                    key={m.id}
                    className="h-16 flex items-center justify-start gap-2.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.2] transition-colors"
                  >
                    <div className="w-11 h-9 rounded-lg bg-white flex items-center justify-center p-1.5 shrink-0 shadow-sm">
                      <PaymentIcon method={m.id} size={22} />
                    </div>
                    <span className="text-xs font-medium text-white/90 truncate">
                      {m.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/[0.08] flex items-center gap-2 text-xs text-[#A1A1AA]">
              <ShieldCheck className="w-4 h-4 text-[#d8ec8d] shrink-0" />
              <span>PCI-DSS compliant encrypted transactions with 256-bit bank security.</span>
            </div>
          </BentoCard>

          {/* Right Column: 2 Stacked Tiles (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Tile 2: Automatic Refunds */}
            <BentoCard className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    <RotateCcw className="w-4 h-4 text-[#d8ec8d]" />
                  </div>
                  <span className="text-[11px] font-mono text-[#d8ec8d] px-2 py-0.5 rounded-full bg-white/[0.04]">
                    Automatic
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Automatic refunds
                </h3>
                <p className="text-sm text-[#A1A1AA] font-normal leading-relaxed">
                  If any order cannot be fully completed or is cancelled by the network, the unfulfilled amount is credited straight back to your wallet balance automatically.
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-xs text-white/70">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#d8ec8d]" />
                <span>Zero support tickets required for partial refunds.</span>
              </div>
            </BentoCard>

            {/* Tile 3: Live Tracking */}
            <BentoCard className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    <Activity className="w-4 h-4 text-[#d8ec8d]" />
                  </div>
                  <span className="text-[11px] font-mono text-white/60">
                    Real-time
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Live tracking
                </h3>
                <p className="text-sm text-[#A1A1AA] font-normal leading-relaxed mb-4">
                  Watch order status advance in real-time with continuous progress counters.
                </p>

                {/* Status-timeline illustration */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#d8ec8d] animate-pulse" />
                    <span className="text-xs font-mono text-white">In Progress</span>
                  </div>
                  <span className="text-xs font-mono text-[#d8ec8d]">
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
