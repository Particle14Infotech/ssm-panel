"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { CountUpNumber } from "@/components/motion/CountUpNumber";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ref = searchParams.get("ref") || "DEP-SAMPLE";
  const { verifyDeposit, user } = useCustomer();

  const [status, setStatus] = useState<"POLLING" | "SUCCESS" | "FAILED">("POLLING");
  const [creditAmount, setCreditAmount] = useState<number>(0);
  const [bonusAmount, setBonusAmount] = useState<number>(0);

  useEffect(() => {
    let active = true;

    const timer = setTimeout(async () => {
      try {
        const result = await verifyDeposit(ref);
        if (active) {
          if (result && result.success && result.session) {
            setCreditAmount(result.session.amount);
            setBonusAmount(result.session.bonusAmount);
            setStatus("SUCCESS");
          } else {
            setStatus("FAILED");
          }
        }
      } catch (e) {
        if (active) setStatus("FAILED");
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="w-full bg-[#1c1b1b] border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-xl text-center">
        {status === "POLLING" && (
          <div className="flex flex-col items-center py-6">
            <Loader2 className="w-12 h-12 text-[#D8EC8D] animate-spin mb-4" />
            <h2 className="text-2xl font-light text-white mb-2">Verifying Payment Session...</h2>
            <p className="text-xs font-mono text-[#c7c8b6]">
              Polling gateway ledger for Ref ID: <span className="text-[#D8EC8D]">{ref}</span>
            </p>
          </div>
        )}

        {status === "SUCCESS" && (
          <div className="flex flex-col items-center py-4">
            <div className="w-16 h-16 rounded-full bg-[#D8EC8D]/15 text-[#D8EC8D] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(216,236,141,0.25)]">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#201f1f] text-xs font-mono text-[#D8EC8D] mb-4 border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Deposit Ledger Confirmed</span>
            </div>

            <h1 className="text-3xl font-light text-white mb-2">Funds Credited Successfully!</h1>
            <p className="text-sm text-[#c7c8b6] font-light mb-6">
              Your deposit and applicable tier bonus have been credited to your internal liquidity balance.
            </p>

            <div className="w-full bg-[#201f1f] rounded-2xl p-4 mb-6 text-left border border-white/5 space-y-2 font-mono text-xs">
              <div className="flex justify-between text-[#c7c8b6]">
                <span>Deposit Base:</span>
                <span className="text-white">₹{creditAmount.toFixed(2)}</span>
              </div>
              {bonusAmount > 0 && (
                <div className="flex justify-between text-[#D8EC8D]">
                  <span>Tier Bonus Credit:</span>
                  <span>+₹{bonusAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-bold text-white">
                <span>New Wallet Balance:</span>
                <span className="text-[#D8EC8D]">
                  ₹<CountUpNumber value={user.balance} decimals={2} />
                </span>
              </div>
            </div>

            <Link
              href="/app/new-order"
              className="w-full py-3.5 rounded-full btn-primary-gradient text-[#171e00] font-bold text-sm shadow-[0_0_24px_rgba(216,236,141,0.25)] transition-all flex items-center justify-center gap-2"
            >
              <span>Place First Order</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {status === "FAILED" && (
          <div className="flex flex-col items-center py-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h1 className="text-2xl font-light text-white mb-2">Payment Verification Incomplete</h1>
            <p className="text-sm text-[#c7c8b6] font-light mb-6">
              The gateway session could not be completed or was cancelled. No funds were debited from your account.
            </p>

            <Link
              href="/app/wallet"
              className="w-full py-3.5 rounded-full bg-[#201f1f] text-white hover:bg-white hover:text-black transition-all text-sm font-semibold"
            >
              Try Another Payment Method
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WalletVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-[50vh] flex items-center justify-center text-white font-mono text-xs">
          Loading verification...
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
