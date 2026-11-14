"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  FileText,
  Lock,
  Power,
  Sliders,
  DollarSign,
  X
} from "lucide-react";

export default function AdminYoupiPilotPage() {
  const [topUps, setTopUps] = useState<any[]>([]);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [confirmReason, setConfirmReason] = useState<{ [id: string]: string }>({});
  const [rejectReason, setRejectReason] = useState<{ [id: string]: string }>({});
  const [csvText, setCsvText] = useState<string>("");
  const [importResult, setImportResult] = useState<any>(null);
  const [ackStatement, setAckStatement] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<string>("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [topUpsRes, reportRes, settingsRes] = await Promise.all([
        fetch("/api/v1/admin/youpi/topups"),
        fetch("/api/v1/admin/youpi/reports/daily"),
        fetch("/api/v1/admin/youpi/settings")
      ]);

      if (topUpsRes.ok) setTopUps(await topUpsRes.json());
      if (reportRes.ok) setDailyReport(await reportRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
    } catch (err: any) {
      console.error("Failed to load YouPI admin data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConfirm = async (id: string) => {
    const reason = confirmReason[id];
    if (!reason || reason.trim().length < 10) {
      alert("A valid justification reason of at least 10 characters is required.");
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/youpi/topups/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to confirm top-up");
      setActionMessage(`Top-up ${id.slice(0, 8)} successfully confirmed.`);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async (id: string) => {
    const reason = rejectReason[id];
    if (!reason || reason.trim().length < 10) {
      alert("A valid rejection reason of at least 10 characters is required.");
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/youpi/topups/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject top-up");
      setActionMessage(`Top-up ${id.slice(0, 8)} marked rejected.`);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) {
      alert("Please enter bank statement CSV text.");
      return;
    }
    try {
      const res = await fetch("/api/v1/admin/youpi/statements/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Statement import failed");
      setImportResult(data);
      setCsvText("");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleKillSwitch = async () => {
    if (!settings) return;
    const nextKillSwitch = !settings.killSwitch;
    try {
      const res = await fetch("/api/v1/admin/youpi/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ killSwitch: nextKillSwitch })
      });
      if (res.ok) {
        setSettings(await res.json());
        setActionMessage(`Kill switch ${nextKillSwitch ? "ACTIVATED" : "DEACTIVATED"}.`);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAcknowledge = async () => {
    if (!ackStatement.trim() || ackStatement.trim().length < 20) {
      alert("Acknowledgement statement must be at least 20 characters.");
      return;
    }
    try {
      const res = await fetch("/api/v1/admin/youpi/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement: ackStatement })
      });
      if (res.ok) {
        setSettings(await res.json());
        setAckStatement("");
        setActionMessage("Compliance acknowledgement successfully recorded.");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Header Telemetry */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                YouPI-PG Self-Hosted UPI Pilot Control
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">UPI Pilot Gateway Review & Reconciliation</h1>
            <p className="text-xs text-on-surface-variant">
              Reconcile observed payments, import downloaded bank CSVs, configure pilot caps, and manage emergency kill switch.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-2xl bg-surface-container-highest/60 hover:bg-surface-container-highest border border-white/5 text-white transition flex items-center gap-2 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>

            {settings && (
              <button
                onClick={handleToggleKillSwitch}
                className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition ${
                  settings.killSwitch
                    ? "bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>Kill Switch: {settings.killSwitch ? "ACTIVE (PAUSED)" : "STANDBY (ACTIVE)"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Banner */}
        {actionMessage && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs text-blue-300 flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage("")} className="text-blue-400 hover:text-blue-200 transition-colors ml-4 p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Daily Summary Metrics */}
        {dailyReport && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="glass-panel p-4 rounded-3xl border border-white/5">
              <p className="text-xs text-on-surface-variant font-mono">Today Initiated</p>
              <p className="text-2xl font-light text-white mt-1">{dailyReport.summary.initiated}</p>
            </div>
            <div className="glass-panel p-4 rounded-3xl border border-white/5">
              <p className="text-xs text-blue-400 font-mono">Observed (Pending)</p>
              <p className="text-2xl font-light text-blue-300 mt-1">{dailyReport.summary.observed}</p>
            </div>
            <div className="glass-panel p-4 rounded-3xl border border-white/5">
              <p className="text-xs text-emerald-400 font-mono">Credited</p>
              <p className="text-2xl font-light text-emerald-300 mt-1">{dailyReport.summary.credited}</p>
            </div>
            <div className="glass-panel p-4 rounded-3xl border border-white/5">
              <p className="text-xs text-red-400 font-mono">Suspicious</p>
              <p className="text-2xl font-light text-red-300 mt-1">{dailyReport.summary.suspicious}</p>
            </div>
            <div className="glass-panel p-4 rounded-3xl border border-white/5">
              <p className="text-xs text-[#D8EC8D] font-mono">Credited Volume</p>
              <p className="text-2xl font-light text-[#D8EC8D] mt-1">₹{dailyReport.summary.creditedRupees.toLocaleString("en-IN")}</p>
            </div>
          </div>
        )}

        {/* Pilot Acknowledgement Form (If Unacknowledged) */}
        {settings && !settings.pilotAcknowledgement?.confirmedAt && (
          <div className="glass-panel p-6 rounded-3xl border border-amber-500/20 bg-amber-500/5 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Pilot Compliance Acknowledgement Required</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Before the YouPI pilot method can be enabled, an authorized administrator must record formal confirmation of legal, banking, and settlement risk review.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={ackStatement}
                onChange={e => setAckStatement(e.target.value)}
                placeholder="I confirm bank, legal and compliance review for the YouPI pilot..."
                className="flex-1 bg-surface-container-highest/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30"
              />
              <button
                onClick={handleAcknowledge}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs rounded-xl transition"
              >
                Sign & Record
              </button>
            </div>
          </div>
        )}

        {/* Bank Statement CSV Import Card */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#D8EC8D]" />
                Bank Statement CSV Import & Reconciliation
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Paste official bank statement CSV rows to auto-match UTR and amount against observed payments.
              </p>
            </div>
            {importResult && (
              <span className="text-xs font-mono px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                Matched: {importResult.matchedCount} | Unmatched: {importResult.unmatchedCount}
              </span>
            )}
          </div>

          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            rows={3}
            placeholder="Date,UTR,Amount&#10;2026-11-04,123456789012,500.00"
            className="w-full bg-surface-container-highest/80 border border-white/5 focus:border-[#D8EC8D]/50 rounded-2xl p-3 text-xs text-white font-mono placeholder:text-white/20"
          />

          <div className="flex justify-end">
            <button
              onClick={handleImportCsv}
              className="px-4 py-2 rounded-xl bg-[#D8EC8D] hover:bg-[#c9dd7b] text-slate-900 font-bold text-xs transition"
            >
              Import & Reconcile Statement
            </button>
          </div>
        </div>

        {/* Top-Up Review Queue */}
        <div className="glass-panel rounded-3xl border border-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Pilot Top-Up Review Queue ({topUps.length})
            </h2>
            <span className="text-xs text-on-surface-variant font-mono">
              Rule 6: Wallet credit strictly requires RECONCILED webhook or explicit Admin Confirm
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-on-surface-variant font-mono uppercase text-[10px]">
                  <th className="py-2.5 px-3">Order Ref</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Masked UTR</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topUps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-on-surface-variant">
                      No pilot top-ups recorded yet.
                    </td>
                  </tr>
                ) : (
                  topUps.map(t => (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition">
                      <td className="py-3 px-3 font-mono text-white font-medium">{t.orderRef}</td>
                      <td className="py-3 px-3 font-mono text-on-surface-variant">{t.userId.slice(0, 10)}...</td>
                      <td className="py-3 px-3 font-bold text-white">₹{t.amountRupees.toFixed(2)}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === "CREDITED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : t.status === "OBSERVED"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : t.status === "SUSPICIOUS"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">{t.maskedUtr || "None"}</td>
                      <td className="py-3 px-3 text-on-surface-variant">{new Date(t.createdAt).toLocaleTimeString()}</td>
                      <td className="py-3 px-3 text-right space-x-2">
                        {t.status !== "CREDITED" && t.status !== "REJECTED" && (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="Reason (>=10 chars)"
                              value={confirmReason[t.id] || ""}
                              onChange={e => setConfirmReason({ ...confirmReason, [t.id]: e.target.value })}
                              className="bg-surface-container-highest border border-white/5 rounded-lg px-2 py-1 text-[11px] text-white w-32"
                            />
                            <button
                              onClick={() => handleConfirm(t.id)}
                              className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-[11px] font-bold transition"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleReject(t.id)}
                              className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-[11px] font-bold transition"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {t.status === "CREDITED" && (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Reconciled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

