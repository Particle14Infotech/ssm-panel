"use client";

import React, { useState, useEffect } from "react";
import { BRAND_NAME } from "@/lib/brand";
import {
  ShieldCheck,
  CreditCard,
  QrCode,
  Smartphone,
  Building2,
  Wallet,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Lock,
  ArrowRight,
  Info,
} from "lucide-react";
import { PaymentIcon } from "@/components/shared/PaymentIcon";
import { BrandLogo } from "@/components/shared/BrandLogo";

export interface CheckoutModalProps {
  isOpen: boolean;
  orderId: string;
  amountRupees: number;
  bonusRupees?: number;
  isTestMode?: boolean;
  onSuccess: (paymentId: string) => void;
  onFailure?: (error: string) => void;
  onClose: () => void;
}

type PaymentMethodType = "UPI" | "CARD" | "NETBANKING" | "WALLET";
type StepState = "SELECT_METHOD" | "PROCESSING" | "SUCCESS" | "FAILED";

export function SimulatedCheckoutModal({
  isOpen,
  orderId,
  amountRupees,
  bonusRupees = 0,
  isTestMode = true,
  onSuccess,
  onFailure,
  onClose,
}: CheckoutModalProps) {
  const [method, setMethod] = useState<PaymentMethodType>("UPI");
  const [step, setStep] = useState<StepState>("SELECT_METHOD");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [generatedPaymentId, setGeneratedPaymentId] = useState<string>("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // UPI State
  const [vpa, setVpa] = useState("success@test");
  const [showQr, setShowQr] = useState(false);

  // Card State
  const [cardNumber, setCardNumber] = useState("4111 1111 1111 1111");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("123");
  const [cardHolder, setCardHolder] = useState("Test Customer");

  // Netbanking / Wallet State
  const [selectedBank, setSelectedBank] = useState("HDFC");
  const [selectedWallet, setSelectedWallet] = useState("TestWallet");

  useEffect(() => {
    if (isOpen) {
      setStep("SELECT_METHOD");
      setErrorMessage("");
      setShowCancelConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Detect card brand
  const getCardBrand = (num: string) => {
    const clean = num.replace(/\s+/g, "");
    if (clean.startsWith("4")) return "Visa";
    if (/^5[1-5]/.test(clean)) return "Mastercard";
    if (/^6[0-9]/.test(clean)) return "RuPay";
    if (/^3[47]/.test(clean)) return "Amex";
    return "Card";
  };

  // Luhn Check Algorithm
  const isLuhnValid = (num: string) => {
    const clean = num.replace(/\s+/g, "");
    if (!/^\d+$/.test(clean) || clean.length < 13) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = clean.length - 1; i >= 0; i--) {
      let digit = parseInt(clean.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  };

  const handlePay = async () => {
    // Validation
    if (method === "UPI") {
      if (!vpa || !vpa.includes("@")) {
        setErrorMessage("Please enter a valid UPI VPA (e.g. success@test or yourname@bank).");
        return;
      }
    } else if (method === "CARD") {
      if (!isLuhnValid(cardNumber)) {
        setErrorMessage("Please enter a valid card number (Luhn checksum failed).");
        return;
      }
      if (!cardExpiry || !cardExpiry.includes("/")) {
        setErrorMessage("Expiry must be in MM/YY format.");
        return;
      }
      if (!cardCvv || cardCvv.length < 3) {
        setErrorMessage("Please enter a valid 3 or 4 digit CVV.");
        return;
      }
    }

    setErrorMessage("");
    setStep("PROCESSING");

    const isFailureTrigger =
      (method === "UPI" && vpa.toLowerCase().includes("fail")) ||
      (method === "CARD" && cardNumber.endsWith("0002"));

    const testOutcome = isFailureTrigger ? "failure" : "success";

    // Simulate realistic gateway round-trip delay
    setTimeout(async () => {
      try {
        const token = localStorage.getItem("authToken");
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

        const paymentId = isFailureTrigger
          ? `pay_fail_${Date.now()}`
          : `pay_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

        const res = await fetch(`${apiBase}/payments/verify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId,
            paymentId,
            method,
            testOutcome,
            signature: testOutcome === "failure" ? "test_failure_signature" : "test_success_signature",
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setGeneratedPaymentId(paymentId);
          setStep("SUCCESS");
          setTimeout(() => {
            onSuccess(paymentId);
          }, 2000);
        } else {
          setErrorMessage(data.message || "Payment declined by simulated bank.");
          setStep("FAILED");
          if (onFailure) onFailure(data.message || "Payment failed");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Network error while completing transaction.");
        setStep("FAILED");
        if (onFailure) onFailure(err.message);
      }
    }, 1400);
  };

  const handleCloseAttempt = () => {
    if (step === "PROCESSING") return;
    if (step === "SUCCESS") {
      onClose();
      return;
    }
    setShowCancelConfirm(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#131313] border border-white/10 rounded-t-3xl sm:rounded-3xl rounded-b-none sm:rounded-b-3xl w-full max-w-lg max-h-[92vh] sm:max-h-none shadow-[0_24px_64px_rgba(0,0,0,0.8)] overflow-y-auto relative">
        {/* Test Mode Ribbon */}
        {isTestMode && (
          <div className="bg-gradient-to-r from-amber-500/20 via-[#243100]/40 to-amber-500/20 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between text-[11px] font-mono text-amber-300">
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              TEST MODE — No Real Money Charged
            </span>
            <span className="text-white/60">Simulator v2</span>
          </div>
        )}

        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] uppercase tracking-widest font-mono text-[#D8EC8D] font-semibold flex items-center gap-1.5">
              <BrandLogo variant="icon" size={16} />
              <span>{BRAND_NAME} Secure Checkout</span>
            </div>
            <div className="text-xs text-slate-400 font-mono">Order ID: {orderId}</div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-light text-white font-mono tracking-tight">
              ₹{amountRupees.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            {bonusRupees > 0 && (
              <div className="text-[10px] font-mono text-emerald-400 font-semibold">
                + ₹{bonusRupees.toFixed(2)} Bonus Free
              </div>
            )}
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {step === "SELECT_METHOD" && (
            <>
              {/* Method Switcher Tabs */}
              <div className="grid grid-cols-4 gap-2 bg-white/5 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => { setMethod("UPI"); setErrorMessage(""); }}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl transition-all flex flex-col items-center gap-1.5 ${
                    method === "UPI"
                      ? "bg-[#D8EC8D] text-[#131313] shadow-sm font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <PaymentIcon method="UPI" size={16} />
                  <span>UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMethod("CARD"); setErrorMessage(""); }}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl transition-all flex flex-col items-center gap-1.5 ${
                    method === "CARD"
                      ? "bg-[#D8EC8D] text-[#131313] shadow-sm font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <PaymentIcon method="CARD" size={16} />
                  <span>Cards</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMethod("NETBANKING"); setErrorMessage(""); }}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl transition-all flex flex-col items-center gap-1.5 ${
                    method === "NETBANKING"
                      ? "bg-[#D8EC8D] text-[#131313] shadow-sm font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <PaymentIcon method="NETBANKING" size={16} />
                  <span>Netbanking</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMethod("WALLET"); setErrorMessage(""); }}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl transition-all flex flex-col items-center gap-1.5 ${
                    method === "WALLET"
                      ? "bg-[#D8EC8D] text-[#131313] shadow-sm font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <PaymentIcon method="WALLET" size={16} />
                  <span>Wallets</span>
                </button>
              </div>

              {/* UPI Form */}
              {method === "UPI" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Pay via UPI VPA or QR</span>
                    <button
                      type="button"
                      onClick={() => setShowQr(!showQr)}
                      className="text-[#D8EC8D] hover:underline inline-flex items-center gap-1 text-[11px]"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>{showQr ? "Enter VPA Instead" : "Show QR Code"}</span>
                    </button>
                  </div>

                  {showQr ? (
                    <div className="flex flex-col items-center justify-center p-6 bg-white/[0.03] border border-white/10 rounded-2xl space-y-3">
                      <div className="w-40 h-40 bg-white p-2 rounded-xl flex items-center justify-center shadow-lg">
                        <QrCode className="w-36 h-36 text-slate-900" />
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono text-center">
                        Scan with any test UPI app to simulate instant clearance.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
                          Virtual Payment Address (VPA)
                        </label>
                        <input
                          type="text"
                          value={vpa}
                          onChange={(e) => setVpa(e.target.value)}
                          placeholder="yourname@okhdfcbank"
                          className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none"
                        />
                      </div>

                      {/* Test VPA Quick-fill */}
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1.5">
                        <span className="text-[10px] text-slate-400 font-mono uppercase block">Test Simulators:</span>
                        <div className="flex gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setVpa("success@test")}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                          >
                            Pass: success@test
                          </button>
                          <button
                            type="button"
                            onClick={() => setVpa("failure@test")}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25"
                          >
                            Fail: failure@test
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Card Form */}
              {method === "CARD" && (
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] uppercase font-mono text-slate-400">Card Number</label>
                      <span className="text-[10px] text-[#D8EC8D] font-mono font-semibold">
                        {getCardBrand(cardNumber)}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4111 1111 1111 1111"
                      className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Expiry (MM/YY)</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="12/28"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono text-slate-400 block mb-1">CVV / CVC</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="123"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Test Card Quick Fills */}
                  <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block">Test Cards:</span>
                    <div className="flex gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setCardNumber("4111 1111 1111 1111");
                          setCardExpiry("12/28");
                          setCardCvv("123");
                        }}
                        className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      >
                        Pass: Visa 4111
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCardNumber("4000 0000 0000 0002");
                          setCardExpiry("12/28");
                          setCardCvv("123");
                        }}
                        className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30"
                      >
                        Fail: Decline 0002
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Netbanking Form */}
              {method === "NETBANKING" && (
                <div className="space-y-3 text-xs">
                  <label className="text-[10px] uppercase font-mono text-slate-400 block">Select Test Bank</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["HDFC Bank", "State Bank of India", "ICICI Bank", "Axis Bank"].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedBank(b)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          selectedBank === b
                            ? "bg-[#D8EC8D]/15 border-[#D8EC8D]/40 text-[#D8EC8D] font-semibold"
                            : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Wallets Form */}
              {method === "WALLET" && (
                <div className="space-y-3 text-xs">
                  <label className="text-[10px] uppercase font-mono text-slate-400 block">Select Digital Wallet</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Amazon Pay Test", "Paytm Simulator", "PhonePe Wallet", "MobiKwik Test"].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setSelectedWallet(w)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          selectedWallet === w
                            ? "bg-[#D8EC8D]/15 border-[#D8EC8D]/40 text-[#D8EC8D] font-semibold"
                            : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Pay Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePay}
                  className="w-full py-3.5 px-6 rounded-2xl btn-primary-gradient hover:brightness-105 text-[#171e00] font-bold text-sm shadow-[0_0_25px_rgba(216,236,141,0.25)] transition-all flex items-center justify-center gap-2"
                >
                  <span>Pay ₹{amountRupees.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleCloseAttempt}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Cancel payment
                </button>
              </div>
            </>
          )}

          {/* Processing Screen */}
          {step === "PROCESSING" && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#D8EC8D]/15 border border-[#D8EC8D]/30 flex items-center justify-center text-[#D8EC8D] shadow-[0_0_30px_rgba(216,236,141,0.25)]">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-white">Authorizing Payment...</h4>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Communicating with banking network. Please do not close or refresh this window.
                </p>
              </div>
            </div>
          )}

          {/* Success Screen */}
          {step === "SUCCESS" && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-semibold text-white">Payment Approved</h4>
                <p className="text-xs text-slate-400 font-mono">Reference: {generatedPaymentId}</p>
                <p className="text-xs text-emerald-300 font-medium pt-1">
                  ₹{amountRupees.toFixed(2)} credited to your wallet balance.
                </p>
              </div>
              <div className="text-[11px] text-slate-400 font-mono animate-pulse">
                Auto-redirecting back to wallet...
              </div>
            </div>
          )}

          {/* Failure Screen */}
          {step === "FAILED" && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
                <XCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-white">Payment Declined</h4>
                <p className="text-xs text-rose-300 max-w-xs">{errorMessage || "Transaction could not be completed."}</p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("SELECT_METHOD")}
                  className="px-5 py-2.5 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold shadow-md"
                >
                  Retry Payment
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cancellation Confirmation Overlay */}
        {showCancelConfirm && (
          <div className="absolute inset-0 bg-[#131313]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 z-20">
            <AlertCircle className="w-10 h-10 text-amber-400" />
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-white">Cancel payment?</h4>
              <p className="text-xs text-slate-400 max-w-xs">
                Are you sure you want to abort this deposit session? Any entered details will not be charged.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
              >
                Continue Payment
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
