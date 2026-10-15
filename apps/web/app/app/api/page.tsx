"use client";

import React, { useState } from "react";
import { useCustomer } from "@/context/CustomerContext";
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  ShieldCheck,
  Layers,
  Code2,
  ExternalLink,
  Zap,
} from "lucide-react";

export default function ResellerApiPage() {
  const { user, regenerateApiKey } = useCustomer();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"SERVICES" | "ORDER" | "STATUS" | "BALANCE">("SERVICES");

  const apiKey = user.apiKey || "aeth_live_9842a1b7c89f0234de1";

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#d8ec8d] animate-pulse" />
            <span className="text-xs uppercase tracking-widest font-mono text-[#d8ec8d]">
              Developer & Reseller Gateway
            </span>
          </div>
          <h1 className="text-3xl font-light text-white mt-1">Reseller API v2</h1>
          <p className="text-xs text-[#c7c8b6] mt-0.5">
            Integrate high-frequency programmatic order dispatch directly into your platform.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-mono bg-[#201f1f] text-cyan-300 border border-cyan-500/20">
            Rate Limit: 60 req/min
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-mono bg-[#201f1f] text-[#d8ec8d] border border-[#d8ec8d]/20">
            99.98% SLA
          </span>
        </div>
      </div>

      {/* API Key Box */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-medium">
            <Key className="w-5 h-5 text-[#d8ec8d]" />
            <span>Active Secret Key</span>
          </div>
          <button
            onClick={regenerateApiKey}
            className="px-3 py-1 rounded-full bg-[#201f1f] hover:bg-[#2a2a2a] text-xs font-mono text-[#c7c8b6] hover:text-white flex items-center gap-1.5 transition-all border border-white/10"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Roll Key</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 bg-[#131313] p-3 rounded-2xl border border-white/10 font-mono text-xs">
          <span className="text-[#d8ec8d] truncate">{apiKey}</span>
          <button
            onClick={handleCopy}
            className="p-2 rounded-xl bg-[#201f1f] hover:bg-[#2a2a2a] text-white flex items-center gap-1.5 shrink-0 transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        <p className="text-[11px] text-[#c7c8b6] font-light">
          Authenticate requests by providing your API key via the HTTP Header <code className="text-[#d8ec8d] bg-black/40 px-1.5 py-0.5 rounded">x-api-key: {apiKey.substring(0, 12)}...</code> or standard payload token.
        </p>
      </div>

      {/* Interactive Docs & Snippets */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-[#d8ec8d]" />
            <h2 className="text-lg font-medium text-white">Endpoint Reference</h2>
          </div>

          {/* Endpoint Tabs */}
          <div className="flex items-center gap-1 bg-[#131313] p-1 rounded-full border border-white/10">
            {[
              { id: "SERVICES", label: "GET /services" },
              { id: "ORDER", label: "POST /orders/create" },
              { id: "STATUS", label: "GET /orders/:id" },
              { id: "BALANCE", label: "GET /wallet/balance" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1 rounded-full text-xs font-mono transition-all ${
                  activeTab === tab.id
                    ? "bg-[#d8ec8d] text-[#171e00] font-bold"
                    : "text-[#c7c8b6] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: GET /services */}
        {activeTab === "SERVICES" && (
          <div className="space-y-4">
            <div className="text-xs text-[#c7c8b6]">
              Retrieve the live service catalog with real-time rates per 1,000 and minimum/maximum limits.
            </div>
            <div className="bg-[#131313] p-4 rounded-2xl border border-white/10 font-mono text-xs text-white overflow-x-auto">
              <span className="text-purple-400">curl</span> -X GET http://localhost:4000/api/v1/services \<br />
              &nbsp;&nbsp;-H <span className="text-emerald-400">&quot;x-api-key: {apiKey}&quot;</span>
            </div>
          </div>
        )}

        {/* Tab 2: POST /orders/create */}
        {activeTab === "ORDER" && (
          <div className="space-y-4">
            <div className="text-xs text-[#c7c8b6]">
              Submit a programmatic order dispatch with idempotency protection.
            </div>
            <div className="bg-[#131313] p-4 rounded-2xl border border-white/10 font-mono text-xs text-white overflow-x-auto">
              <span className="text-purple-400">curl</span> -X POST http://localhost:4000/api/v1/orders/create \<br />
              &nbsp;&nbsp;-H <span className="text-emerald-400">&quot;Content-Type: application/json&quot;</span> \<br />
              &nbsp;&nbsp;-H <span className="text-emerald-400">&quot;x-api-key: {apiKey}&quot;</span> \<br />
              &nbsp;&nbsp;-d <span className="text-amber-300">{`'{\n  "serviceId": "srv-01",\n  "target": "https://instagram.com/p/C123456789",\n  "quantity": 2500,\n  "idempotencyKey": "order_uuid_10293"\n}'`}</span>
            </div>
          </div>
        )}

        {/* Tab 3: GET /orders/:id */}
        {activeTab === "STATUS" && (
          <div className="space-y-4">
            <div className="text-xs text-[#c7c8b6]">
              Check remaining count, start count, and status of an active order.
            </div>
            <div className="bg-[#131313] p-4 rounded-2xl border border-white/10 font-mono text-xs text-white overflow-x-auto">
              <span className="text-purple-400">curl</span> -X GET http://localhost:4000/api/v1/orders/ORD-98421 \<br />
              &nbsp;&nbsp;-H <span className="text-emerald-400">&quot;x-api-key: {apiKey}&quot;</span>
            </div>
          </div>
        )}

        {/* Tab 4: GET /wallet/balance */}
        {activeTab === "BALANCE" && (
          <div className="space-y-4">
            <div className="text-xs text-[#c7c8b6]">
              Fetch your real-time available wallet balance and currency.
            </div>
            <div className="bg-[#131313] p-4 rounded-2xl border border-white/10 font-mono text-xs text-white overflow-x-auto">
              <span className="text-purple-400">curl</span> -X GET http://localhost:4000/api/v1/wallet/balance \<br />
              &nbsp;&nbsp;-H <span className="text-emerald-400">&quot;x-api-key: {apiKey}&quot;</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
