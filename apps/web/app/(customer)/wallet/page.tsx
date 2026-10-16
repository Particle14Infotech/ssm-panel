"use client";

import React, { useState } from "react";
import { useCustomer } from "@/context/CustomerContext";
import { TransactionItem, calculateDepositBonus, PaymentMethod } from "@smm/contracts";
import { BRAND_NAME } from "@/lib/brand";
import { SimulatedCheckoutModal } from "@/components/checkout/SimulatedCheckoutModal";
import {
  Wallet,
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
} from "lucide-react";
import { PaymentIcon } from "@/components/shared/PaymentIcon";

export default function WalletPage() {
  const { user, transactions, initiateDeposit, refreshData } = useCustomer();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("UPI");
  const [amount, setAmount] = useState<number>(1000);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState<boolean>(false);
  const [activeOrderId, setActiveOrderId] = useState<string>("");
  const [successTxn, setSuccessTxn] = useState<{ paymentId: string; amount: number } | null>(null);
  const [invoiceModalTxn, setInvoiceModalTxn] = useState<TransactionItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const gateways = [
    {
      id: "UPI" as PaymentMethod,
      name: "UPI (Unified Payments Interface)",
      sub: "0% Transaction Fee • Instant (0–5s)",
      badge: "Fastest Clearance",
    },
    {
      id: "CARD" as PaymentMethod,
      name: "Credit / Debit Card",
      sub: "Visa, Mastercard, RuPay (3D Secure)",
      badge: "Secure Vault",
    },
    {
      id: "NETBANKING" as PaymentMethod,
      name: "Netbanking / IMPS",
      sub: "All Major Indian Commercial Banks",
      badge: "Direct Settlement",
    },
  ];

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
    <div className="w-full bg-[#02040A] min-h-screen pb-24 text-slate-100">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Header Telemetry */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Financial Operations & Liquidity
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">Add Funds & Billing</h1>
            </div>
            <p className="text-xs text-slate-400">
              Add spendable liquidity, unlock tier bonus credits, and view verified payment receipts.
            </p>
          </div>
        </div>

        {/* Global Test Mode Notice */}
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="font-semibold block text-white">Test Mode Active — Simulator Gateway</span>
              <span className="text-slate-400 text-[11px]">
                No real card or bank funds will be charged. Use test simulators like <span className="font-mono text-amber-300">success@test</span> or card ending in <span className="font-mono text-amber-300">4111</span>.
              </span>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-semibold">
            SIMULATED GATEWAY
          </span>
        </div>

        {/* Success Banner */}
        {successTxn && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Deposit Credited Successfully!</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Payment <span className="font-mono text-emerald-300">{successTxn.paymentId}</span> for ₹{successTxn.amount.toFixed(2)} has been verified and added to your balance.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSuccessTxn(null)}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Dual Column: Balance Overview & Deposit Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Top Up Gateway Selector (7 cols) */}
          <div className="lg:col-span-7 bg-[#070B16] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-medium text-white">Choose Deposit Amount & Method</h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Instant balance crediting with zero gateway processing surcharge.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-semibold">
                0% Fee
              </span>
            </div>

            {/* Gateway Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {gateways.map((gw) => {
                const isSelected = selectedMethod === gw.id;
                return (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => setSelectedMethod(gw.id)}
                    className={`p-4 rounded-2xl text-left border transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "bg-blue-600/15 border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                        : "bg-white/[0.02] border-white/5 hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <PaymentIcon method={gw.id} size={24} />
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                          isSelected ? "bg-blue-600 text-white" : "bg-white/10 text-slate-400"
                        }`}
                      >
                        {gw.badge}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{gw.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{gw.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Amount Selection */}
            <div className="space-y-3 pt-2">
              <label className="text-[11px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                Deposit Amount (INR)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-light text-white font-mono">
                  ₹
                </span>
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 focus:border-blue-500 text-white font-mono text-2xl font-light pl-10 pr-4 py-3 rounded-2xl focus:outline-none transition-all"
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
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    ₹{preset.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Bonus Banner */}
            <div className="bg-gradient-to-r from-blue-600/20 via-blue-500/10 to-transparent border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">
                    {bonusPercent > 0 ? `${bonusPercent}% Tier Bonus Applied!` : "Deposit ₹500+ to unlock 5% Bonus!"}
                  </div>
                  <div className="text-[11px] text-slate-300">
                    You receive ₹{totalCredit.toFixed(2)} total spendable credit.
                  </div>
                </div>
              </div>
              <span className="text-sm font-bold text-blue-400 font-mono">+₹{bonusAmount.toFixed(2)}</span>
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
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:brightness-110 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(37,99,235,0.4)] disabled:opacity-50"
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

          {/* Right Column: Balance Summary & Tier Card (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Wallet Balance Hero Card */}
            <div className="bg-[#070B16] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-medium text-white">Current Balance</h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 text-[10px] font-mono font-bold">
                  INR WALLET
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
                  Available Spending Liquidity
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extralight text-white font-mono tracking-tight">
                    ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-mono text-blue-400">INR</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5">
                  <span className="text-[10px] text-slate-400 uppercase block">Total Spent</span>
                  <span className="text-white font-bold text-sm">₹{user.totalSpent.toLocaleString("en-IN")}</span>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5">
                  <span className="text-[10px] text-slate-400 uppercase block">Total Orders</span>
                  <span className="text-white font-bold text-sm">{user.totalOrders} Orders</span>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Settlement SLA</span>
                  <span className="text-emerald-400 font-mono font-semibold">Instant Clearance</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>GST Invoice</span>
                  <span className="text-white font-mono font-semibold">Automated Download</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Security</span>
                  <span className="text-blue-400 font-mono font-semibold">256-bit SSL Encrypted</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Statements Table */}
        <div className="bg-[#070B16] border border-white/10 rounded-3xl p-4 md:p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] overflow-hidden space-y-4">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                Recent Transaction Statements
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Downloadable tax receipts and ledger verification audit trail.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {transactions.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                  <Wallet className="w-6 h-6" />
                </div>
                <p className="text-sm text-slate-300">No deposit transactions yet</p>
                <p className="text-xs text-slate-500">Add funds using UPI or Card to get started.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
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
                      <td className="py-4 px-3 font-mono font-semibold text-white whitespace-nowrap">
                        <span className="text-blue-400 mr-1.5 font-bold">#</span>
                        {txn.id}
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
                      <td className="py-4 px-3 font-medium text-white">{txn.method}</td>
                      <td className="py-4 px-3 font-mono font-semibold text-white">
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
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-all inline-flex items-center gap-1.5 border border-white/5"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                          <span>View Receipt</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
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

      {/* Invoice Modal */}
      {invoiceModalTxn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#070B16] border border-white/15 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-6 shadow-2xl relative text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{BRAND_NAME} Tax Invoice</h3>
                  <div className="text-[10px] font-mono text-slate-400">
                    Receipt #{invoiceModalTxn.id}
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
                  <span className="text-white font-bold">{user.name}</span>
                  <div className="text-slate-400 text-[11px]">{user.email}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">ISSUED BY</span>
                  <span className="text-white font-bold">{BRAND_NAME} PVT LTD</span>
                  <div className="text-slate-400 text-[11px]">GSTIN: 27AABCA1234F1Z8</div>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Payment Gateway</span>
                  <span className="text-white">{invoiceModalTxn.method}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Reference ID</span>
                  <span className="text-white truncate max-w-[200px]">{invoiceModalTxn.referenceId}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Date & Time</span>
                  <span className="text-white">{new Date(invoiceModalTxn.createdAt).toLocaleString()}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between text-white font-semibold">
                  <span>Base Amount</span>
                  <span>₹{invoiceModalTxn.amount.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between text-blue-400 text-sm font-bold">
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
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Print / Download Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

