"use client";

import React, { useState } from "react";
import { useCustomer } from "@/context/CustomerContext";
import {
  User,
  Shield,
  Key,
  Copy,
  Check,
  RefreshCw,
  Lock,
  Code,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { FormField } from "@/components/shared/FormField";

export default function ProfileSecurityPage() {
  const { user, updateProfile, regenerateApiKey } = useCustomer();

  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [webhookUrl, setWebhookUrl] = useState(user.webhookUrl || "");
  const [ipWhitelist, setIpWhitelist] = useState(user.ipWhitelist.join(", "));
  const [twoFactor, setTwoFactor] = useState(user.twoFactorEnabled);

  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Password Change
  const [currPassword, setCurrPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name,
      phone,
      webhookUrl,
      ipWhitelist: ipWhitelist.split(",").map((s) => s.trim()).filter(Boolean),
      twoFactorEnabled: twoFactor,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleRegenKey = () => {
    if (confirm("Are you sure you want to regenerate your API Key? Any existing bot or webhook integrations using the previous key will cease working immediately.")) {
      regenerateApiKey();
    }
  };

  const handleCopyKey = () => {
    if (user.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 1500);
    }
  };

  const curlSnippet = `curl -X POST https://api.smmpanel.io/v1/orders/create \\
  -H "Authorization: Bearer ${user.apiKey || "YOUR_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{"serviceId": "1042", "target": "https://instagram.com/growth", "quantity": 1000}'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlSnippet);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 1500);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPasswordMsg({ text: "Password must be at least 8 characters.", error: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "Passwords do not match.", error: true });
      return;
    }

    setPasswordMsg({ text: "Password updated successfully!", error: false });
    setCurrPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setPasswordMsg(null), 3000);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#D8EC8D]">
            <span className="w-2 h-2 rounded-full bg-[#D8EC8D] animate-pulse" />
            <span className="uppercase tracking-widest font-semibold">Account Governance</span>
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">Profile & API Security</h1>
          <p className="text-xs text-slate-400">
            Manage your credentials, authorized IP whitelist, and programmatic API access.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Profile parameters updated successfully.</span>
        </div>
      )}

      {/* 2-Column Split: Profile Settings (7 cols) + API / Security (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Profile Details (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSaveProfile} className="glass-panel p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#D8EC8D]/15 border border-[#D8EC8D]/30 flex items-center justify-center text-[#D8EC8D] text-base font-bold font-mono">
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">{user.name}</h2>
                  <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-[#D8EC8D]/15 text-[#D8EC8D] text-[10px] font-mono font-bold">
                    TIER: {user.tier}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Full Name">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                  />
                </FormField>

                <FormField label="Phone Number (Optional)">
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-mono"
                  />
                </FormField>
              </div>

              <FormField label="Outgoing Webhook URL" helperText="Order status transitions will be dispatched to this webhook.">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://yourdomain.com/api/webhooks/smm"
                  className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none"
                />
              </FormField>

              <FormField label="Authorized IP Whitelist" helperText="Comma-separated IP addresses allowed to call the API.">
                <input
                  type="text"
                  value={ipWhitelist}
                  onChange={(e) => setIpWhitelist(e.target.value)}
                  placeholder="127.0.0.1, 192.168.1.1"
                  className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none"
                />
              </FormField>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-white/10">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold shadow-[0_0_15px_rgba(216,236,141,0.25)] transition-all"
              >
                Save Preferences
              </button>
            </div>
          </form>

          {/* Change Password Panel */}
          <form onSubmit={handlePasswordChange} className="glass-panel p-6 md:p-8 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Update Password
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Current Password">
                <input
                  type="password"
                  value={currPassword}
                  onChange={(e) => setCurrPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                />
              </FormField>

              <FormField label="New Password">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                />
              </FormField>

              <FormField label="Confirm Password">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-[#D8EC8D]/50 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                />
              </FormField>
            </div>

            {passwordMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  passwordMsg.error
                    ? "bg-rose-500/15 border border-rose-500/30 text-rose-300"
                    : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                }`}
              >
                {passwordMsg.error ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all"
              >
                Change Password
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: API Keys & Developer Telemetry (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <GlassCard className="p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#D8EC8D]" />
                <h3 className="text-base font-semibold text-white">Programmatic API Key</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#D8EC8D]/15 text-[#D8EC8D] text-[10px] font-mono font-semibold">
                REST v1
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-mono text-slate-400 block">Active API Secret</label>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 font-mono text-xs">
                <span className="flex-1 truncate text-white">
                  {showApiKey
                    ? user.apiKey || "smm_live_49f8a209bca7"
                    : "•".repeat(24)}
                </span>
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-slate-400 hover:text-white"
                  title={showApiKey ? "Hide Key" : "Reveal Key"}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="text-slate-400 hover:text-white"
                  title="Copy Key"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleRegenKey}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/30 text-rose-300 text-xs font-semibold transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate API Key</span>
              </button>
            </div>

            {/* Quick Curl Snippet */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>cURL Quick Reference</span>
                <button onClick={handleCopyCurl} className="hover:text-white">
                  {copiedCurl ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-[#131313] border border-white/5 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
                {curlSnippet}
              </pre>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
