"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { TransactionItem, calculateDepositBonus, PaymentMethod } from "@smm/contracts";
import {
  Wallet,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Download,
  AlertCircle,
  RefreshCw,
  FileText,
} from "lucide-react";

export default function WalletPage() {
  const { user, transactions, initiateDeposit, depositFunds } = useCustomer();
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("UPI");
  const [amount, setAmount] = useState<number>(1000);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successTxn, setSuccessTxn] = useState<{ bonus: number; total: number } | null>(null);
  const [invoiceModalTxn, setInvoiceModalTxn] = useState<TransactionItem | null>(null);

  const gateways = [
    {
      id: "UPI" as PaymentMethod,
      name: "UPI (Unified Payments Interface)",
      sub: "0% Transaction Fee • Instant (0–10s)",
      badge: "Fastest Method",
      icon: "⚡",
    },
    {
      id: "CARD" as PaymentMethod,
      name: "Credit / Debit Card",
      sub: "Visa, Mastercard, RuPay (3D Secure)",
      badge: "Protected Gateway",
      icon: "💳",
    },
    {
      id: "NETBANKING" as PaymentMethod,
      name: "Netbanking / IMPS",
      sub: "All Major Indian Commercial Banks",
      badge: "Direct Settlement",
      icon: "🏛️",
    },
  ];

  const presets = [500, 1000, 2500, 5000, 10000];

  const { bonusPercent, bonusAmount, totalCredit } = calculateDepositBonus(amount);

  const handleDeposit = async () => {
    if (amount <= 0) return;
    setIsProcessing(true);
    const result = await depositFunds(amount, selectedMethod);
    setIsProcessing(false);
    if (result && result.success) {
      setSuccessTxn({ bonus: result.bonus, total: result.total });
    }
  };

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Header Telemetry */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#DBEF90]">
              <span className="w-2 h-2 rounded-full bg-[#DBEF90] animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Financial Telemetry / Liquidity Balancing
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-3xl md:text-4xl font-light text-white tracking-tight">Wallet & Billing</h1>
              <span className="text-[#DBEF90] text-3xl font-light leading-none">*</span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Manage real-time balance liquidity, deposit bonus tiers, and downloadable GST invoice statements.
            </p>
          </div>
        </div>

        {/* Success Modal / Banner */}
        {successTxn && (
          <div className="bg-[#DBEF90]/15 border border-[#DBEF90]/40 rounded-3xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#DBEF90] text-[#2a3400] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Deposit Credited Successfully!</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  ₹{successTxn.total.toFixed(2)} (including ₹{successTxn.bonus.toFixed(2)} bonus) has been credited
                  instantly to your wallet.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSuccessTxn(null)}
              className="px-5 py-2 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110"
            >
              Continue
            </button>
          </div>
        )}

        {/* Dual Column: Balance Overview & Deposit Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Top Up Gateway Selector (7 cols) */}
          <div className="lg:col-span-7 glass-panel rounded-[2rem] p-6 md:p-8 space-y-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-light text-white">Add Funds to Liquidity Pool</h2>
                  <span className="text-[#DBEF90]">✦</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Select payment gateway and unlock instant Tier Deposit Bonuses.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-mono font-semibold">
                0% Gateway Surcharge
              </span>
            </div>

            {/* Gateway Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gateways.map((gw) => {
                const isSelected = selectedMethod === gw.id;
                return (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => setSelectedMethod(gw.id)}
                    className={`p-4 rounded-2xl text-left border transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "bg-[#d8ec8d]/10 border-[#DBEF90] shadow-[0_0_20px_rgba(219,239,144,0.15)]"
                        : "bg-surface-container-high/40 border-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{gw.icon}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                          isSelected ? "bg-[#DBEF90] text-[#2a3400]" : "bg-white/10 text-on-surface-variant"
                        }`}
                      >
                        {gw.badge}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{gw.name}</div>
                      <div className="text-[11px] text-on-surface-variant mt-0.5">{gw.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Amount Selection */}
            <div className="space-y-3 pt-2">
              <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold">
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
                  className="w-full bg-surface-container-highest/80 border border-white/10 focus:border-[#DBEF90] text-white font-mono text-2xl font-light pl-10 pr-4 py-3 rounded-2xl focus:outline-none transition-all"
                />
              </div>

              {/* Preset Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pt-1">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className={`px-4 py-1.5 rounded-full text-xs font-mono font-semibold transition-all shrink-0 ${
                      amount === preset
                        ? "bg-[#d8ec8d] text-[#2a3400]"
                        : "bg-surface-container-high text-on-surface-variant hover:text-white"
                    }`}
                  >
                    +₹{preset.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Bonus Banner */}
            <div className="bg-gradient-to-r from-[#FF1A8C]/20 via-[#BD0183]/15 to-transparent border border-[#FF1A8C]/30 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-[#FF80BF] shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">
                    {bonusPercent > 0 ? `${bonusPercent}% Tier Bonus Applied!` : "Deposit ₹500+ for 5% Bonus!"}
                  </div>
                  <div className="text-[11px] text-white/70">
                    You receive ₹{totalCredit.toFixed(2)} in total spendable credit.
                  </div>
                </div>
              </div>
              <span className="text-sm font-bold text-[#FF80BF] font-mono">+₹{bonusAmount.toFixed(2)} Free</span>
            </div>

            {/* Simulated Payment Gateway Interactive Box */}
            {selectedMethod === "UPI" && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-12 h-12 bg-[#201f1f] rounded-xl flex items-center justify-center shrink-0 border border-white/10">
                  <span className="text-2xl">⚡</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-white">Instant UPI Auto-Verification (VPA/Intent)</div>
                  <div className="text-on-surface-variant font-mono text-[11px]">Handles Google Pay, PhonePe, Paytm, BHIM</div>
                  <div className="text-emerald-400 font-mono text-[11px]">✦ Real-time webhooks auto-verify in &lt; 5 seconds</div>
                </div>
              </div>
            )}

            {/* Deposit CTA */}
            <button
              type="button"
              data-testid="deposit-submit-btn"
              onClick={handleDeposit}
              disabled={isProcessing || amount <= 0}
              className="w-full py-4 px-6 rounded-full bg-[#d8ec8d] text-[#2a3400] hover:brightness-110 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(219,239,144,0.3)] disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Liquidity Credit...</span>
                </>
              ) : (
                <>
                  <span>Deposit ₹{amount.toFixed(2)} & Claim +₹{bonusAmount.toFixed(2)} Bonus</span>
                  <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Right Column: Balance Summary & Tier Card (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Wallet Balance Hero Card */}
            <div className="glass-panel liquid-glass rounded-[2rem] p-6 md:p-8 space-y-6 relative overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-[#DBEF90]/10 blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-[#DBEF90]" />
                  <h3 className="text-lg font-light text-white">Current Balance</h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#DBEF90]/15 text-[#DBEF90] text-[10px] font-mono font-bold">
                  PRO_SCALE TIER
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono tracking-widest text-on-surface-variant">
                  Available Spending Liquidity
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extralight text-white font-mono tracking-tight">
                    ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-mono text-[#DBEF90]">INR</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
                <div className="bg-surface-container-high/40 rounded-2xl p-3.5">
                  <span className="text-[10px] text-on-surface-variant uppercase block">Total Lifetime Spent</span>
                  <span className="text-white font-bold text-sm">₹{user.totalSpent.toLocaleString()}</span>
                </div>
                <div className="bg-surface-container-high/40 rounded-2xl p-3.5">
                  <span className="text-[10px] text-on-surface-variant uppercase block">Total Orders</span>
                  <span className="text-white font-bold text-sm">{user.totalOrders} Orders</span>
                </div>
              </div>

              <div className="bg-surface-container-high/30 rounded-2xl p-4 space-y-2 text-xs text-on-surface-variant">
                <div className="flex items-center justify-between">
                  <span>Auto-Refill Threshold</span>
                  <span className="text-white font-mono font-semibold">₹500.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Invoice GST Rate</span>
                  <span className="text-white font-mono font-semibold">18% Input Tax Credit Eligible</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cluster Priority</span>
                  <span className="text-[#DBEF90] font-mono font-semibold">High Priority AP-S1</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Statements Table */}
        <div className="glass-panel rounded-[2rem] p-4 md:p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] overflow-hidden space-y-4">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                Transaction Statements & Invoices
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Downloadable PDF tax receipts and payment verification audit trail.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-on-surface-variant font-mono">
                  <th className="py-3 px-3">Transaction ID</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Method</th>
                  <th className="py-3 px-3">Amount Deposited</th>
                  <th className="py-3 px-3">Bonus Credited</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-3 font-mono font-bold text-white whitespace-nowrap">
                      <span className="text-[#DBEF90] mr-1">✦</span>
                      {txn.id}
                    </td>
                    <td className="py-4 px-3 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
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
                      ₹{txn.amount.toFixed(2)}
                    </td>
                    <td className="py-4 px-3 font-mono text-emerald-400 font-semibold">
                      +₹{txn.bonus.toFixed(2)}
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
                        className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#DBEF90]" />
                        <span>View Invoice</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {invoiceModalTxn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1c1b1b] border border-white/15 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-6 shadow-2xl relative text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-[#DBEF90] font-bold text-lg">✦</span>
                <div>
                  <h3 className="text-base font-bold text-white">TAX INVOICE / RECEIPT</h3>
                  <div className="text-[10px] font-mono text-on-surface-variant">
                    Invoice #{invoiceModalTxn.id}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInvoiceModalTxn(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-on-surface-variant"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 font-mono">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-on-surface-variant text-[10px] block">ISSUED TO</span>
                  <span className="text-white font-bold">{user.name}</span>
                  <div className="text-on-surface-variant">{user.email}</div>
                </div>
                <div className="text-right">
                  <span className="text-on-surface-variant text-[10px] block">ISSUED BY</span>
                  <span className="text-white font-bold">SMM PANEL PVT LTD</span>
                  <div className="text-on-surface-variant">GSTIN: 27AABCA1234F1Z8</div>
                </div>
              </div>

              <div className="bg-surface-container-high/40 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Payment Gateway</span>
                  <span className="text-white">{invoiceModalTxn.method}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Reference ID</span>
                  <span className="text-white truncate max-w-[200px]">{invoiceModalTxn.referenceId}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Date & Time</span>
                  <span className="text-white">{new Date(invoiceModalTxn.createdAt).toLocaleString()}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between text-white font-semibold">
                  <span>Base Amount</span>
                  <span>₹{invoiceModalTxn.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Promotional Tier Bonus</span>
                  <span>+₹{invoiceModalTxn.bonus.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between text-[#DBEF90] text-sm font-bold">
                  <span>Total Wallet Credit</span>
                  <span>₹{(invoiceModalTxn.amount + invoiceModalTxn.bonus).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  alert("Invoice PDF downloaded successfully!");
                  setInvoiceModalTxn(null);
                }}
                className="px-5 py-2.5 rounded-full bg-[#DBEF90] text-[#2a3400] font-bold text-xs hover:brightness-110 flex items-center gap-1.5 shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
