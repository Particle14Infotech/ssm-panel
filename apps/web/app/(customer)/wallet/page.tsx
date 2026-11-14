"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { TransactionItem, calculateDepositBonus, PaymentMethod } from "@smm/contracts";
import { BRAND_NAME } from "@/lib/brand";
import { SimulatedCheckoutModal } from "@/components/checkout/SimulatedCheckoutModal";
import { YoupiPilotModal } from "@/components/checkout/YoupiPilotModal";
import {
  Wallet,
  Receipt,
  ArrowUpRight,
  Sparkles,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Download,
  AlertCircle,
  RefreshCw,
  FileText,
  Lock,
  ExternalLink,
  X,
  Zap,
} from "lucide-react";
import { PaymentIcon } from "@/components/shared/PaymentIcon";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { motion } from "framer-motion";
import { formatTxnId, formatInvoiceId } from "@/lib/utils";

export default function WalletPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get("tab") === "transactions" ? "transactions" : "add_funds";
  const [walletTab, setWalletTab] = useState<"add_funds" | "transactions">(initialTab);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "transactions") {
      setWalletTab("transactions");
    } else if (tab === "add_funds" || tab === "deposit") {
      setWalletTab("add_funds");
    }
  }, [searchParams]);

  const { user, transactions, initiateDeposit, refreshData } = useCustomer();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | "YOUPI_PILOT">("UPI");
  const [amount, setAmount] = useState<number>(1000);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState<boolean>(false);
  const [activeOrderId, setActiveOrderId] = useState<string>("");
  const [successTxn, setSuccessTxn] = useState<{ paymentId: string; amount: number } | null>(null);
  const [invoiceModalTxn, setInvoiceModalTxn] = useState<TransactionItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [youpiEligible, setYoupiEligible] = useState<boolean>(false);
  const [youpiData, setYoupiData] = useState<any>(null);
  const [youpiModalOpen, setYoupiModalOpen] = useState<boolean>(false);
  const [youpiSession, setYoupiSession] = useState<{
    orderRef: string;
    amountRupees: number;
    checkoutUrl?: string;
    queuePosition?: number;
    expiresAt?: string;
    receivingUpiId?: string;
  } | null>(null);

  useEffect(() => {
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    if (isLocalhost) {
      setYoupiEligible(true);
      setYoupiData({ eligible: true, orderRefPrefix: "youpi_local" });
    }

    fetch("/api/v1/payments/youpi/eligibility")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.eligible) {
          setYoupiEligible(true);
          setYoupiData(data);
        }
      })
      .catch(() => {});
  }, []);

  const gateways = [
    {
      id: "UPI" as PaymentMethod,
      name: "UPI Direct",
      shortName: "UPI / QR",
      sub: "Instant (0–5s) • 0% Fee",
      badge: "Fast",
      min: 100,
      max: 50000,
    },
    ...(youpiEligible
      ? [
          {
            id: "YOUPI_PILOT" as const,
            name: "UPI (Pilot Mode)",
            shortName: "Pilot",
            sub: "Confirmation in 10-30 mins",
            badge: "Pilot",
            min: 100,
            max: 5000,
          },
        ]
      : []),
    {
      id: "CARD" as PaymentMethod,
      name: "Cards (Visa / MC / RuPay)",
      shortName: "Cards",
      sub: "Debit & Credit Cards • 0% Surcharge",
      badge: "Secure",
      min: 100,
      max: 50000,
    },
    {
      id: "NETBANKING" as PaymentMethod,
      name: "Net Banking (All Banks)",
      shortName: "Net Banking",
      sub: "IMPS, NEFT & 50+ Banks",
      badge: "Direct",
      min: 100,
      max: 50000,
    },
  ];

  const activeGateway = gateways.find((g) => g.id === selectedMethod) || gateways[0];

  // Presets as requested in Phase 5: ₹100, ₹500, ₹1,000, ₹5,000
  const presets = [100, 500, 1000, 5000];

  const { bonusPercent, bonusAmount, totalCredit } = calculateDepositBonus(amount);

  const handleOpenCheckout = async () => {
    if (amount <= 0 || isNaN(amount)) {
      setErrorMessage("Please enter a valid deposit amount.");
      return;
    }
    if (amount < 100) {
      setErrorMessage("Minimum deposit is ₹100.");
      return;
    }

    if (selectedMethod === "YOUPI_PILOT") {
      if (amount > 5000) {
        setErrorMessage("UPI (Pilot) method is currently capped at ₹5,000 per transaction.");
        return;
      }
      setErrorMessage("");
      setIsProcessing(true);
      try {
        let session: any = null;
        try {
          const res = await fetch("/api/v1/payments/youpi/initiate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount }),
          });
          if (res.ok) {
            session = await res.json();
          }
        } catch {}

        if (!session) {
          const isLocalhost =
            typeof window !== "undefined" &&
            (window.location.hostname === "localhost" ||
              window.location.hostname === "127.0.0.1");
          if (isLocalhost) {
            session = {
              orderRef: `youpi_local_${Date.now()}`,
              amountRupees: amount,
              queuePosition: 1,
              expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              receivingUpiId: "bholu@upi",
            };
          } else {
            throw new Error("Could not reach UPI pilot gateway.");
          }
        }

        setYoupiSession({
          orderRef: session.orderRef,
          amountRupees: session.amountRupees,
          checkoutUrl: session.checkoutUrl,
          queuePosition: session.queuePosition,
          expiresAt: session.expiresAt,
          receivingUpiId: session.receivingUpiId || "bholu@upi",
        });
        setYoupiModalOpen(true);
      } catch (err: any) {
        setErrorMessage(err.message || "Could not initiate UPI pilot payment.");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);

    try {
      const session = await initiateDeposit({
        amount,
        method: selectedMethod,
      });

      const orderId = session.sessionId || session.referenceId || `order_${Date.now()}`;
      setActiveOrderId(orderId);
      setCheckoutModalOpen(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Could not initiate payment session.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckoutSuccess = async (paymentId: string) => {
    setCheckoutModalOpen(false);
    setSuccessTxn({ paymentId, amount });
    await refreshData();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full bg-white dark:bg-[#131313] min-h-screen pb-36 sm:pb-24 text-fg"
    >
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Header with Top Transaction History Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-fg tracking-tight">Wallet & Transactions</h1>
            <p className="text-xs text-fg-muted">
              Add spendable funds, choose payment methods, and inspect transaction statements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWalletTab(walletTab === "transactions" ? "add_funds" : "transactions")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                walletTab === "transactions"
                  ? "bg-accent text-on-accent shadow-glow font-bold"
                  : "bg-surface-raised border border-border text-fg hover:border-accent/40"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>{walletTab === "transactions" ? "Back to Deposit" : "Transaction History"}</span>
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {successTxn && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-5 text-white flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-success flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-fg">Deposit Credited Successfully!</h3>
                <p className="text-xs text-fg-2 mt-0.5">
                  Payment <span className="font-mono text-emerald-300">{successTxn.paymentId}</span> for ₹{successTxn.amount.toFixed(2)} has been credited.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSuccessTxn(null)}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Primary View: Balance Card + Deposit Methods */}
        {walletTab === "add_funds" && (
          <div className="space-y-6">
            {/* Requirement 5: Current Balance directly underneath main headline */}
            <div className="bg-surface border border-border rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-fg-muted block">
                  Available Spending Liquidity
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-light text-fg font-mono tracking-tight">
                    ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-mono text-accent-text font-bold">INR</span>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
                <div className="bg-surface-raised border border-border rounded-xl px-3.5 py-2">
                  <span className="text-[10px] text-fg-muted uppercase block">Total Spent</span>
                  <span className="text-fg font-bold text-sm">₹{user.totalSpent.toLocaleString("en-IN")}</span>
                </div>
                <div className="bg-surface-raised border border-border rounded-xl px-3.5 py-2">
                  <span className="text-[10px] text-fg-muted uppercase block">Total Orders</span>
                  <span className="text-fg font-bold text-sm">{user.totalOrders}</span>
                </div>
              </div>
            </div>

            {/* Deposit Method & Amount Selector (Streamlined without fluff) */}
            <div className="bg-surface border border-border rounded-3xl p-5 sm:p-7 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-fg">Choose Deposit Amount & Method</h2>
                  <p className="text-xs text-fg-muted mt-0.5">
                    Automated balance crediting with zero gateway processing surcharge.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-success text-[10px] font-mono font-bold">
                  0% Fee
                </span>
              </div>

              {/* Compact Active Method Spotlight Card */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-accent/15 via-accent/5 to-transparent border border-accent/40 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 shadow-xs">
                    <PaymentIcon method={activeGateway.id} size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-bold text-fg tracking-tight truncate">
                        {activeGateway.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-[#D8EC8D] text-[#131313] shrink-0">
                        {activeGateway.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-fg-muted font-mono truncate mt-0.5">
                      Min: ₹{activeGateway.min.toLocaleString("en-IN")} • Max: ₹{activeGateway.max.toLocaleString("en-IN")} • {activeGateway.sub}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-accent-text font-semibold shrink-0">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <span>0% Fee Verified</span>
                </div>
              </div>

              {/* Horizontal Method Selector Tabs */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {gateways.map((gw) => {
                  const isSelected = selectedMethod === gw.id;
                  return (
                    <button
                      key={gw.id}
                      type="button"
                      onClick={() => setSelectedMethod(gw.id)}
                      className={`py-2 px-2.5 rounded-xl border text-center transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? "bg-accent/20 border-accent text-fg font-bold shadow-xs ring-1 ring-accent/30"
                          : "bg-surface-raised border-border text-fg-muted hover:text-fg hover:border-accent/40"
                      }`}
                    >
                      <PaymentIcon method={gw.id} size={16} />
                      <span className="text-xs font-semibold tracking-tight truncate">
                        {gw.shortName}
                      </span>
                    </button>
                  );
                })}
              </div>

            {/* Amount Selection */}
            <div className="space-y-3 pt-2">
              <label className="text-[11px] uppercase tracking-wider text-fg-muted font-mono font-semibold">
                Deposit Amount (INR)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-medium text-fg-muted font-mono">
                  ₹
                </span>
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-surface-raised border border-border focus:border-accent text-fg font-mono text-2xl font-bold pl-10 pr-4 py-3 rounded-2xl focus:outline-none transition-all"
                />
              </div>

              {/* Preset Chips: ₹100, ₹500, ₹1000, ₹5000 */}
              <div className="flex items-center gap-2 overflow-x-auto pt-1">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all shrink-0 ${
                      amount === preset
                        ? "bg-[#D8EC8D] text-[#131313] shadow-md shadow-[#D8EC8D]/20 font-bold"
                        : "bg-surface-raised text-slate-700 text-fg-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10"
                    }`}
                  >
                    ₹{preset.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Bonus Banner */}
            <div className="bg-gradient-to-r from-[#243100]/40 via-[#D8EC8D]/10 to-transparent border border-accent/30 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-[#D8EC8D] shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-fg">
                    {bonusPercent > 0 ? `${bonusPercent}% Tier Bonus Applied!` : "Deposit ₹500+ to unlock 5% Bonus!"}
                  </div>
                  <div className="text-[11px] text-fg-2">
                    You receive ₹{totalCredit.toFixed(2)} total spendable credit.
                  </div>
                </div>
              </div>
              <span className="text-sm font-bold text-[#D8EC8D] font-mono">+₹{bonusAmount.toFixed(2)}</span>
            </div>

            {/* Error Display */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Deposit CTA */}
            <button
              type="button"
              data-testid="deposit-submit-btn"
              onClick={handleOpenCheckout}
              disabled={isProcessing || amount <= 0}
              className="w-full py-4 px-6 rounded-2xl btn-primary-gradient hover:brightness-105 active:scale-[0.99] text-[#171e00] font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Preparing Payment Order...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Pay Securely ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
        )}

        {/* Requirement 6: Transactions Statements Table only rendered on click ("transactions" tab) */}
        {walletTab === "transactions" && (
        <div className="bg-surface border border-border rounded-3xl p-4 md:p-6 shadow-sm overflow-hidden space-y-4">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-fg">
                Recent Transaction Statements
              </h2>
              <p className="text-xs text-fg-muted mt-0.5">
                Downloadable tax receipts and ledger verification audit trail.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWalletTab("add_funds")}
              className="text-xs text-accent-text hover:underline"
            >
              Back to Deposit
            </button>
          </div>

          <div className="overflow-x-auto">
            {transactions.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-border flex items-center justify-center mx-auto text-slate-400">
                  <Wallet className="w-6 h-6" />
                </div>
                <p className="text-sm text-fg-2">No deposit transactions yet</p>
                <p className="text-xs text-slate-500">Add funds using UPI or Card to get started.</p>
              </div>
            ) : (
              <>
                {/* MOBILE TRANSACTIONS CARDS (< md) */}
                <div className="block md:hidden space-y-3">
                  {transactions.map((txn) => (
                    <div
                      key={txn.id}
                      className="p-4 rounded-2xl bg-white/[0.02] border border-border space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2.5">
                        <span className="font-mono text-xs font-bold text-fg">
                          {formatTxnId(txn.id)}
                        </span>
                        {txn.status === "SUCCESS" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Failed
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-lg font-bold font-mono text-[#D8EC8D]">
                            +₹{txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-fg-2">
                            <PaymentIcon method={txn.method} size={16} />
                            <span>{txn.method}</span>
                          </div>
                        </div>

                        <div className="text-right space-y-2">
                          <div className="text-[11px] font-mono text-slate-400">
                            {new Date(txn.createdAt).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <button
                            onClick={() => setInvoiceModalTxn(txn)}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-fg text-xs font-medium transition-all inline-flex items-center gap-1.5 border border-slate-200/60 dark:border-white/5"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#D8EC8D]" />
                            <span>Receipt</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* DESKTOP TRANSACTIONS TABLE (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                        <th className="py-3 px-3">Transaction ID</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Method</th>
                        <th className="py-3 px-3">Amount Deposited</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {transactions.map((txn) => (
                        <tr key={txn.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-3 font-mono font-semibold text-fg whitespace-nowrap">
                            {formatTxnId(txn.id)}
                          </td>
                          <td className="py-4 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {new Date(txn.createdAt).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-4 px-3 font-medium text-fg">
                            <div className="flex items-center gap-2">
                              <PaymentIcon method={txn.method} size={18} />
                              <span>{txn.method}</span>
                            </div>
                          </td>
                          <td className="py-4 px-3 font-mono font-semibold text-[#D8EC8D] whitespace-nowrap">
                            ₹{txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-3 whitespace-nowrap">
                            {txn.status === "SUCCESS" ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Success
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => setInvoiceModalTxn(txn)}
                              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-fg text-xs font-medium transition-all inline-flex items-center gap-1.5 border border-slate-200/60 dark:border-white/5"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#D8EC8D]" />
                              <span>View Receipt</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Razorpay-style Simulated Checkout Modal */}
      <SimulatedCheckoutModal
        isOpen={checkoutModalOpen}
        orderId={activeOrderId}
        amountRupees={amount}
        bonusRupees={bonusAmount}
        isTestMode={true}
        onSuccess={handleCheckoutSuccess}
        onFailure={(err) => setErrorMessage(err)}
        onClose={() => setCheckoutModalOpen(false)}
      />

      {/* YouPI Pilot UPI Modal */}
      {youpiSession && (
        <YoupiPilotModal
          isOpen={youpiModalOpen}
          onClose={() => setYoupiModalOpen(false)}
          orderRef={youpiSession.orderRef}
          amountRupees={youpiSession.amountRupees}
          checkoutUrl={youpiSession.checkoutUrl}
          initialQueuePosition={youpiSession.queuePosition}
          initialExpiresAt={youpiSession.expiresAt}
          receivingUpiId={youpiSession.receivingUpiId}
          onSuccess={(paymentId) => {
            setYoupiModalOpen(false);
            setSuccessTxn({ paymentId, amount });
            refreshData();
          }}
        />
      )}

      {/* Invoice Modal (Bottom Sheet on Mobile, Centered on Desktop) */}
      {invoiceModalTxn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#1c1b1b] border border-border rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 md:p-8 max-w-lg w-full space-y-5 sm:space-y-6 shadow-2xl relative text-xs max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <BrandLogo variant="icon" size={28} />
                <div>
                  <h3 className="text-base font-semibold text-fg">{BRAND_NAME} Tax Invoice</h3>
                  <div className="text-[10px] font-mono text-slate-400">
                    Receipt {formatInvoiceId(invoiceModalTxn.id)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInvoiceModalTxn(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400"
                aria-label="Close invoice"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 font-mono">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 text-[10px] block">ISSUED TO</span>
                  <span className="text-fg font-bold">{user.name}</span>
                  <div className="text-slate-400 text-[11px]">{user.email}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">ISSUED BY</span>
                  <span className="text-fg font-bold">{BRAND_NAME} PVT LTD</span>
                  <div className="text-slate-400 text-[11px]">GSTIN: 27AABCA1234F1Z8</div>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-slate-200/60 dark:border-white/5 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Payment Gateway</span>
                  <span className="text-fg">{invoiceModalTxn.method}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Reference ID</span>
                  <span className="text-fg truncate max-w-[200px]">{invoiceModalTxn.referenceId}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Date & Time</span>
                  <span className="text-fg">{new Date(invoiceModalTxn.createdAt).toLocaleString()}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-fg font-semibold">
                  <span>Base Amount</span>
                  <span>₹{invoiceModalTxn.amount.toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-[#D8EC8D] text-sm font-bold">
                  <span>Total Wallet Credit</span>
                  <span>₹{invoiceModalTxn.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-5 py-2.5 rounded-xl btn-primary-gradient text-[#171e00] font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#D8EC8D]/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Print / Download Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

