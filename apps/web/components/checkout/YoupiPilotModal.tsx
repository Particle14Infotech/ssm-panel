"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, AlertTriangle, CheckCircle2, Shield, MessageSquare, RefreshCw } from "lucide-react";

interface YoupiPilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderRef: string;
  amountRupees: number;
  initialQueuePosition?: number;
  initialExpiresAt?: string;
  checkoutUrl?: string;
  receivingUpiId?: string;
  onSuccess: (paymentId: string) => void;
}

export function YoupiPilotModal({
  isOpen,
  onClose,
  orderRef,
  amountRupees,
  initialQueuePosition = 0,
  initialExpiresAt,
  checkoutUrl,
  receivingUpiId = "merchant@upi",
  onSuccess
}: YoupiPilotModalProps) {
  const [status, setStatus] = useState<string>("AWAITING_PAYMENT");
  const [queuePosition, setQueuePosition] = useState<number>(initialQueuePosition);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);
  const [maskedUtr, setMaskedUtr] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [requestId, setRequestId] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;

    if (initialExpiresAt) {
      const remaining = Math.max(0, Math.floor((new Date(initialExpiresAt).getTime() - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    } else {
      setSecondsRemaining(300);
    }

    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus("EXPIRED");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/payments/youpi/status/${orderRef}`, {
          headers: { "Content-Type": "application/json" }
        });
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          setQueuePosition(data.queuePosition || 0);
          if (data.maskedUtr) setMaskedUtr(data.maskedUtr);
          if (data.status === "CREDITED") {
            clearInterval(pollInterval);
            clearInterval(timer);
            setTimeout(() => onSuccess(orderRef), 1200);
          }
        }
      } catch (err: any) {
        setRequestId(`req_${Math.random().toString(36).slice(2, 8)}`);
      }
    }, 4000);

    return () => {
      clearInterval(timer);
      clearInterval(pollInterval);
    };
  }, [isOpen, orderRef, initialExpiresAt]);

  const formatCountdown = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Pilot Payment Method
              </span>
              <h2 className="text-lg font-bold mt-1">UPI Wallet Top-Up</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Single-Slot Queue Indicator */}
          {queuePosition > 0 && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 text-sm text-blue-300">
              <Clock className="w-5 h-5 shrink-0 text-blue-400 animate-pulse" />
              <div>
                <p className="font-medium">Another payment is in progress, position {queuePosition}</p>
                <p className="text-xs text-blue-400/80">Your payment slot will activate automatically as soon as the prior slot completes.</p>
              </div>
            </div>
          )}

          {/* Amount and Expiry Bar */}
          <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Total Top-Up Amount</p>
              <p className="text-2xl font-bold text-white">₹{amountRupees.toLocaleString("en-IN")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Session Window</p>
              <p className={`text-base font-mono font-semibold ${secondsRemaining < 60 ? "text-red-400" : "text-amber-300"}`}>
                {formatCountdown(secondsRemaining)}
              </p>
            </div>
          </div>

          {/* Receiving Details */}
          <div className="mt-4 p-3 bg-slate-800/30 rounded-xl border border-slate-700/30 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Receiving UPI VPA:</span>
              <span className="font-mono text-slate-200 font-semibold">{receivingUpiId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Reference Number:</span>
              <span className="font-mono text-slate-300">{orderRef}</span>
            </div>
            {maskedUtr && (
              <div className="flex justify-between">
                <span className="text-slate-400">Detected Bank UTR:</span>
                <span className="font-mono text-emerald-400 font-semibold">{maskedUtr}</span>
              </div>
            )}
          </div>

          {/* Dynamic Scannable UPI QR Code */}
          <div className="mt-4 flex flex-col items-center justify-center p-4 bg-slate-900/60 border border-slate-700/50 rounded-2xl">
            <div className="w-44 h-44 bg-white p-2 rounded-xl flex items-center justify-center shadow-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=168x168&data=${encodeURIComponent(
                  `upi://pay?pa=${receivingUpiId}&pn=SMM_Panel&am=${amountRupees}&cu=INR&tr=${orderRef}`
                )}`}
                alt="Real UPI Payment QR Code"
                className="w-40 h-40 rounded-lg object-contain"
              />
            </div>
            <p className="mt-2 text-xs text-slate-300 font-medium">Scan with PhonePe, Google Pay, Paytm, or BHIM</p>
            <a
              href={`upi://pay?pa=${receivingUpiId}&pn=SMM_Panel&am=${amountRupees}&cu=INR&tr=${orderRef}`}
              className="mt-1 text-[11px] text-[#D8EC8D] hover:underline font-mono"
            >
              📱 Or tap to open UPI App on this device
            </a>
          </div>

          {/* Status Timeline */}
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Payment Timeline</p>
            <div className="grid grid-cols-4 gap-1 text-[11px] text-center font-medium">
              <div className={`p-1.5 rounded-lg border ${status === "AWAITING_PAYMENT" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-slate-800/50 text-slate-400 border-slate-700/30"}`}>
                1. Awaiting
              </div>
              <div className={`p-1.5 rounded-lg border ${status === "OBSERVED" ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "bg-slate-800/50 text-slate-400 border-slate-700/30"}`}>
                2. Payment seen
              </div>
              <div className={`p-1.5 rounded-lg border ${status === "CONFIRMED" ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" : "bg-slate-800/50 text-slate-400 border-slate-700/30"}`}>
                3. Bank check
              </div>
              <div className={`p-1.5 rounded-lg border ${status === "CREDITED" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-slate-800/50 text-slate-400 border-slate-700/30"}`}>
                4. Credited
              </div>
            </div>
          </div>

          {/* MANDATORY RULE 7 COPY */}
          <div className="mt-4 p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Confirmation can take a few hours. Your wallet is credited after the payment is confirmed against the bank record.
            </p>
          </div>

          {/* Error Message with Request ID & Retry */}
          {errorMessage && (
            <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center justify-between">
              <div>
                <p className="font-semibold">{errorMessage}</p>
                {requestId && <p className="text-[10px] text-rose-400/80">Ref ID: {requestId}</p>}
              </div>
              <button
                onClick={() => setErrorMessage("")}
                className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded text-rose-200 transition"
              >
                Retry
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <a
              href={`/app/support?ref=${encodeURIComponent(orderRef)}`}
              className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Contact support with this reference
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 rounded-xl transition text-slate-200"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

