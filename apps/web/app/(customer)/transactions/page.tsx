"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import { BRAND_NAME } from "@/lib/brand";
import {
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Search,
  Download,
  Filter,
  PlusCircle,
  FileText,
  Printer,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PaymentIcon } from "@/components/shared/PaymentIcon";
import { motion } from "framer-motion";
import { formatTxnId } from "@/lib/utils";

export default function TransactionsPage() {
  const { user, transactions } = useCustomer();
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [receiptTxn, setReceiptTxn] = useState<any | null>(null);

  const filtered = transactions.filter((t) => {
    if (selectedType !== "ALL" && t.status !== selectedType && t.method !== selectedType) {
      return false;
    }
    if (
      searchQuery &&
      !t.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.referenceId.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header Clean (Badge removed) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-white">Transaction Ledger</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically audited append-only accounting. Every credit and debit is immutable.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Balance:</span>
            <span className="text-sm font-bold text-[#D8EC8D] font-mono">
              ₹{user.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <Link
            href="/wallet"
            className="px-4 py-2 rounded-xl btn-primary-gradient text-[#171e00] font-bold text-xs hover:brightness-105 shadow-sm transition-all flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Funds</span>
          </Link>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#1c1b1b] border border-white/10 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Txn ID or Ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-400/50 focus:outline-none focus:border-[#D8EC8D]/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {["ALL", "SUCCESS", "PENDING", "UPI", "CARD", "NETBANKING"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-all ${
                selectedType === type
                  ? "bg-[#D8EC8D] text-[#131313] font-bold"
                  : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1c1b1b] border border-white/10 rounded-3xl overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
        {transactions.length === 0 ? (
          <div className="py-6">
            <EmptyState
              icon={CreditCard}
              title="No transactions yet"
              description="Your wallet and ledger are clean. Add funds to initiate your first balance credit."
              actionText="Add funds to get started"
              actionHref="/wallet"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-[#131313] text-slate-400 text-[11px] uppercase tracking-wider font-mono border-b border-white/10">
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Reference ID</th>
                  <th className="py-3 px-4">Method / Channel</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4 text-right">Bonus Credit</th>
                  <th className="py-3 px-4 text-right">Net Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-xs">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No ledger entries found matching filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((tx) => {
                    const isCredit = tx.amount >= 0;
                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 text-white font-semibold flex items-center gap-1.5">
                          {isCredit ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          <span>{formatTxnId(tx.id)}</span>
                        </td>
                        <td className="py-3 px-4 text-white">
                          <div className="flex items-center gap-1.5">
                            <PaymentIcon method={tx.method} size={15} />
                            <span>{tx.method}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4 text-right text-[#D8EC8D]">
                          {tx.bonus > 0 ? `+₹${tx.bonus.toFixed(2)}` : "—"}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold tabular-nums ${isCredit ? "text-emerald-400" : "text-rose-400"}`}>
                          {isCredit ? `+₹${tx.amount.toFixed(2)}` : `-₹${Math.abs(tx.amount).toFixed(2)}`}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setReceiptTxn(tx)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all inline-flex items-center gap-1 text-[11px]"
                            title="Download / View Receipt"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Branded Downloadable Receipt Modal */}
      {receiptTxn && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1c1b1b] border border-white/15 rounded-3xl p-6 md:p-8 max-w-md w-full space-y-6 shadow-2xl relative text-left">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D8EC8D]" />
                <h3 className="text-lg font-semibold text-white tracking-tight">{BRAND_NAME}</h3>
              </div>
              <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                Payment Receipt
              </span>
            </div>

            {/* Receipt Body */}
            <div className="space-y-4 text-xs font-mono">
              <div className="bg-white/[0.03] rounded-2xl p-4 space-y-2.5">
                <div className="flex justify-between text-slate-400">
                  <span>Receipt Number</span>
                  <span className="text-white font-semibold">RCPT-{receiptTxn.id.substring(0, 10).toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Payment Reference</span>
                  <span className="text-white">{receiptTxn.referenceId}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Date & Time</span>
                  <span className="text-white">
                    {new Date(receiptTxn.createdAt).toLocaleDateString("en-IN")} {new Date(receiptTxn.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Payment Method</span>
                  <span className="text-white font-bold">{receiptTxn.method}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between text-slate-400">
                  <span>Amount Deposited</span>
                  <span className="text-white tabular-nums">₹{Math.abs(receiptTxn.amount).toFixed(2)}</span>
                </div>
                {receiptTxn.bonus > 0 && (
                  <div className="flex justify-between text-[#D8EC8D]">
                    <span>Promotional Bonus</span>
                    <span className="tabular-nums">+ ₹{receiptTxn.bonus.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 flex justify-between items-baseline">
                  <span className="text-white font-bold">Total Credited</span>
                  <span className="text-lg font-bold text-emerald-400 tabular-nums">
                    ₹{(Math.abs(receiptTxn.amount) + (receiptTxn.bonus || 0)).toFixed(2)} INR
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-slate-400 leading-relaxed text-center">
                This is a system-generated electronic receipt issued by {BRAND_NAME}.
                Cryptographically audited and recorded on immutable ledger.
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setReceiptTxn(null)}
                className="px-5 py-2 rounded-xl btn-primary-gradient text-[#171e00] font-bold text-xs shadow-md transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
