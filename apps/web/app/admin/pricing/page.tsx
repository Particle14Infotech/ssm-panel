"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getAuthToken } from "@/lib/auth-session";
import { GlassCard } from "@/components/shared/GlassCard";
import {
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  ArrowRight,
  ShieldAlert,
  Inbox,
  Check,
  X,
  RotateCcw,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export default function AdminPricingPage() {
  const [activeTab, setActiveTab] = useState<"settings" | "simulator" | "pending" | "bulk">("settings");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Settings State
  const [settings, setSettings] = useState({
    usdInrRate: 85.0,
    providerCurrency: "USD",
    fxRateUpdatedAt: new Date().toISOString(),
    paymentFeePercent: 2.36,
    minMarginPercent: 20.0,
    minProfitPer1k: 5.0,
    roundingStep: 0.5,
    minOrderCharge: 1.0,
    priceChangeAlertPercent: 10.0,
    autoDeactivateBelowCost: true,
    dripSurchargePercent: 0.0,
    marginTiers: [
      { maxCostINR: 100, marginPercent: 80 },
      { maxCostINR: 500, marginPercent: 55 },
      { maxCostINR: 9999999, marginPercent: 35 },
    ],
  });

  // What-If Simulator State
  const [simCost, setSimCost] = useState<number>(60);
  const [simQty, setSimQty] = useState<number>(1000);
  const [simResult, setSimResult] = useState<any | null>(null);

  // Pending Changes State
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);

  // Bulk Margin State
  const [bulkPlatform, setBulkPlatform] = useState<string>("ALL");
  const [bulkMarginPercent, setBulkMarginPercent] = useState<number>(60);
  const [bulkPreview, setBulkPreview] = useState<any | null>(null);

  // Fetch Settings
  const fetchSettings = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/admin/pricing/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // Fallback to default
    } finally {
      setLoading(false);
    }
  };

  // Fetch Pending
  const fetchPending = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/pricing/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingChanges(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchSettings();
    fetchPending();
  }, []);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/admin/pricing/settings`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Pricing engine parameters updated successfully." });
        await fetchSettings();
      } else {
        setMessage({ type: "error", text: "Failed to update pricing settings." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Network error" });
    } finally {
      setSaving(false);
    }
  };

  // Run What-If Simulation
  const handleSimulate = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/pricing/what-if`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ costINR: simCost, quantity: simQty }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
      }
    } catch {}
  }, [simCost, simQty]);

  useEffect(() => {
    handleSimulate();
  }, [handleSimulate]);

  // Approve Pending Change
  const handleApprovePending = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/pricing/pending/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchPending();
      }
    } catch {}
  };

  // Reject Pending Change
  const handleRejectPending = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/pricing/pending/${id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchPending();
      }
    } catch {}
  };

  // Preview Bulk Margin
  const handlePreviewBulk = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/pricing/bulk-margin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: bulkPlatform === "ALL" ? undefined : bulkPlatform,
          marginPercent: bulkMarginPercent,
          previewOnly: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBulkPreview(data);
      }
    } catch {}
  };

  // Apply Bulk Margin
  const handleApplyBulk = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/pricing/bulk-margin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: bulkPlatform === "ALL" ? undefined : bulkPlatform,
          marginPercent: bulkMarginPercent,
          previewOnly: false,
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Bulk margin rules successfully applied to catalog services." });
        setBulkPreview(null);
      }
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Pricing & Profit Engine</h1>
        <p className="text-sm text-slate-400 mt-1">
          Automated margin tiers, currency conversion, loss guardrails, and what-if simulation.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        {[
          { id: "settings", label: "Pricing Rules & FX", icon: Sliders },
          { id: "simulator", label: "What-If Simulator", icon: TrendingUp },
          { id: "pending", label: `Pending Approvals (${pendingChanges.length})`, icon: Inbox },
          { id: "bulk", label: "Bulk Repricing Tool", icon: Percent },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                isActive
                  ? "bg-[#D8EC8D]/15 text-[#D8EC8D] border border-[#D8EC8D]/40"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SETTINGS */}
      {activeTab === "settings" && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* FX & Conversion Card */}
            <GlassCard className="p-5 rounded-2xl border-white/10 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#D8EC8D]" />
                <span>Currency & Exchange Rate</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">USD to INR Exchange Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.usdInrRate}
                    onChange={(e) => setSettings({ ...settings, usdInrRate: parseFloat(e.target.value) || 85.0 })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white font-mono focus:outline-none focus:border-[#D8EC8D]"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Used to convert upstream provider costs in USD to INR.
                  </span>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Payment Gateway Fee (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.paymentFeePercent}
                    onChange={(e) => setSettings({ ...settings, paymentFeePercent: parseFloat(e.target.value) || 2.36 })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white font-mono focus:outline-none focus:border-[#D8EC8D]"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Deducted from profit reports to reflect merchant fees (default 2.36%).
                  </span>
                </div>
              </div>
            </GlassCard>

            {/* Guardrails & Floors */}
            <GlassCard className="p-5 rounded-2xl border-white/10 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                <span>Floors & Guardrails</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Minimum Margin Floor (%)</label>
                  <input
                    type="number"
                    value={settings.minMarginPercent}
                    onChange={(e) => setSettings({ ...settings, minMarginPercent: parseFloat(e.target.value) || 20 })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Minimum Profit Floor / 1k (₹)</label>
                  <input
                    type="number"
                    value={settings.minProfitPer1k}
                    onChange={(e) => setSettings({ ...settings, minProfitPer1k: parseFloat(e.target.value) || 5 })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Price Change Alert Threshold (%)</label>
                  <input
                    type="number"
                    value={settings.priceChangeAlertPercent}
                    onChange={(e) =>
                      setSettings({ ...settings, priceChangeAlertPercent: parseFloat(e.target.value) || 10 })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white font-mono focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Catalog sync changes above this % are held for review.
                  </span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Margin Tiers by Cost Band */}
          <GlassCard className="p-5 rounded-2xl border-white/10 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#D8EC8D]" />
              <span>Cost Band Margin Tiers</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="text-slate-400">Cost &lt; ₹100</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={settings.marginTiers[0]?.marginPercent || 80}
                    onChange={(e) => {
                      const updated = [...settings.marginTiers];
                      updated[0].marginPercent = parseFloat(e.target.value) || 80;
                      setSettings({ ...settings, marginTiers: updated });
                    }}
                    className="w-20 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-center"
                  />
                  <span className="text-slate-400">% margin</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="text-slate-400">Cost ₹100 - ₹500</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={settings.marginTiers[1]?.marginPercent || 55}
                    onChange={(e) => {
                      const updated = [...settings.marginTiers];
                      updated[1].marginPercent = parseFloat(e.target.value) || 55;
                      setSettings({ ...settings, marginTiers: updated });
                    }}
                    className="w-20 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-center"
                  />
                  <span className="text-slate-400">% margin</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="text-slate-400">Cost &gt; ₹500</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={settings.marginTiers[2]?.marginPercent || 35}
                    onChange={(e) => {
                      const updated = [...settings.marginTiers];
                      updated[2].marginPercent = parseFloat(e.target.value) || 35;
                      setSettings({ ...settings, marginTiers: updated });
                    }}
                    className="w-20 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-center"
                  />
                  <span className="text-slate-400">% margin</span>
                </div>
              </div>
            </div>
          </GlassCard>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl btn-primary-gradient text-[#171e00] font-bold text-xs shadow-md hover:brightness-105 active:scale-[0.99] transition-all flex items-center gap-2"
          >
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Pricing Settings</span>
          </button>
        </form>
      )}

      {/* TAB 2: WHAT-IF SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          <GlassCard className="p-6 rounded-2xl border-white/10 space-y-4">
            <h3 className="text-sm font-semibold text-white">Simulation Inputs</h3>
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Provider Cost per 1,000 (INR)</label>
                <input
                  type="number"
                  value={simCost}
                  onChange={(e) => setSimCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Order Quantity</label>
                <input
                  type="number"
                  value={simQty}
                  onChange={(e) => setSimQty(parseInt(e.target.value, 10) || 1000)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white font-mono focus:outline-none"
                />
              </div>
            </div>
          </GlassCard>

          {simResult && (
            <GlassCard className="p-6 rounded-2xl border-white/10 space-y-4 bg-white/[0.02]">
              <h3 className="text-sm font-semibold text-white">Calculated Pricing & Margins</h3>
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Selling Rate per 1k</span>
                  <span className="text-[#D8EC8D] font-bold">₹{simResult.sellingRatePer1k.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Customer Charge</span>
                  <span className="text-white font-bold">₹{simResult.customerCharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Provider Cost</span>
                  <span className="text-rose-300">- ₹{simResult.estimatedProviderCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Gateway Fee (est. 2.36%)</span>
                  <span className="text-rose-300">- ₹{simResult.paymentFeeEstimate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 pt-2 font-bold">
                  <span className="text-white">Estimated Net Profit</span>
                  <span className="text-emerald-400">₹{simResult.estimatedNetProfit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-400">
                  <span>Net Margin</span>
                  <span>{simResult.netMarginPercent.toFixed(1)}%</span>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* TAB 3: PENDING APPROVALS */}
      {activeTab === "pending" && (
        <div className="space-y-4 max-w-4xl">
          {pendingChanges.length === 0 ? (
            <GlassCard className="p-8 text-center text-xs text-slate-500 rounded-2xl border-white/5">
              No pending price changes awaiting approval. All services within normal variance.
            </GlassCard>
          ) : (
            pendingChanges.map((pending) => (
              <GlassCard key={pending.id} className="p-5 rounded-2xl border-white/10 flex items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-white">{pending.service?.name}</div>
                  <div className="flex items-center gap-3 font-mono text-slate-400 text-[11px]">
                    <span>Old Cost: ₹{Number(pending.oldCostINR).toFixed(2)}</span>
                    <ArrowRight className="w-3 h-3 text-slate-600" />
                    <span className="text-amber-400">New Cost: ₹{Number(pending.newCostINR).toFixed(2)}</span>
                    <span>·</span>
                    <span>Change: {pending.changePercent.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRejectPending(pending.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprovePending(pending.id)}
                    className="px-3 py-1.5 rounded-lg btn-primary-gradient text-[#171e00] text-xs font-bold transition-all"
                  >
                    Approve
                  </button>
                </div>
              </GlassCard>
            ))
          )}
        </div>
      )}

      {/* TAB 4: BULK MARGIN TOOL */}
      {activeTab === "bulk" && (
        <div className="space-y-6 max-w-4xl">
          <GlassCard className="p-6 rounded-2xl border-white/10 space-y-4">
            <h3 className="text-sm font-semibold text-white">Bulk Repricing Tool</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Target Platform</label>
                <select
                  value={bulkPlatform}
                  onChange={(e) => setBulkPlatform(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#191919] border border-white/10 text-white focus:outline-none"
                >
                  <option value="ALL">All Platforms</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="TELEGRAM">Telegram</option>
                  <option value="X">X (Twitter)</option>
                  <option value="FACEBOOK">Facebook</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">New Margin Override (%)</label>
                <input
                  type="number"
                  value={bulkMarginPercent}
                  onChange={(e) => setBulkMarginPercent(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handlePreviewBulk}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors"
              >
                Preview Diff
              </button>
              {bulkPreview && (
                <button
                  type="button"
                  onClick={handleApplyBulk}
                  className="px-4 py-2 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold transition-all"
                >
                  Confirm & Apply to {bulkPreview.count} Services
                </button>
              )}
            </div>
          </GlassCard>

          {bulkPreview && (
            <GlassCard className="p-6 rounded-2xl border-white/10 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Previewing Changes ({bulkPreview.count} services)</span>
                <span className="text-[#D8EC8D] font-mono">Margin: +{bulkMarginPercent}%</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {bulkPreview.items?.map((item: any) => (
                  <div
                    key={item.serviceId}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs font-mono"
                  >
                    <span className="text-slate-300 truncate max-w-[200px]">{item.serviceName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">₹{item.oldSellRate.toFixed(2)}</span>
                      <ArrowRight className="w-3 h-3 text-slate-600" />
                      <span className="text-[#D8EC8D] font-bold">₹{item.newSellRate.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
}
