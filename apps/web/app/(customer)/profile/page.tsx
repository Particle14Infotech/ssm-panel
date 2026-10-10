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
  Smartphone,
  Globe,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Code,
  Terminal,
  LogOut,
} from "lucide-react";

export default function ProfileSecurityPage() {
  const { user, updateProfile, regenerateApiKey } = useCustomer();

  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [webhookUrl, setWebhookUrl] = useState(user.webhookUrl || "");
  const [ipWhitelist, setIpWhitelist] = useState(user.ipWhitelist.join(", "));
  const [twoFactor, setTwoFactor] = useState(user.twoFactorEnabled);
  const [notifications, setNotifications] = useState(user.notificationPreferences);

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
      notificationPreferences: notifications,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleRegenKey = () => {
    if (confirm("Are you sure you want to regenerate your API Key? Any existing bot or webhook integrations using the previous key will cease working immediately.")) {
      regenerateApiKey();
      alert("New API Key generated successfully!");
    }
  };

  const handleCopyKey = () => {
    if (user.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 1500);
    }
  };

  const curlSnippet = `curl -X POST https://api.aethersmm.com/v1/orders/create \\
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
    <div className="w-full bg-[#0e0e0e] min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Header Telemetry */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#DBEF90]">
              <span className="w-2 h-2 rounded-full bg-[#DBEF90] animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Identity & Cryptographic Security Parameters
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-3xl md:text-4xl font-light text-white tracking-tight">Profile & Security</h1>
              <span className="text-[#DBEF90] text-3xl font-light leading-none">*</span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Manage high-frequency API credentials, 2-Factor authentication, and edge webhook routing.
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="bg-[#DBEF90]/15 border border-[#DBEF90]/40 rounded-2xl p-4 text-[#DBEF90] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Profile and security preferences updated successfully!</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Account Profile & Preferences (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Account Information Form */}
            <form
              onSubmit={handleSaveProfile}
              className="bg-[#1c1b1b]/80 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 md:p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-[#DBEF90]/40"
                  />
                  <div>
                    <h2 className="text-base font-semibold text-white">{user.name}</h2>
                    <div className="text-xs text-on-surface-variant font-mono">{user.email}</div>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-[#DBEF90]/15 text-[#DBEF90] text-[10px] font-mono font-bold">
                      TIER: {user.tier}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold block mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-surface-container-highest border border-white/10 focus:border-[#DBEF90] rounded-2xl px-4 py-2.5 text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold block mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-surface-container-highest border border-white/10 focus:border-[#DBEF90] rounded-2xl px-4 py-2.5 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold block mb-1">
                    Outgoing Webhook URL
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://yourdomain.com/api/webhooks/smm"
                    className="w-full bg-surface-container-highest border border-white/10 focus:border-[#DBEF90] rounded-2xl px-4 py-2.5 text-white font-mono focus:outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold block mb-1">
                    Authorized IP Whitelist (Comma-separated CIDRs)
                  </label>
                  <input
                    type="text"
                    value={ipWhitelist}
                    onChange={(e) => setIpWhitelist(e.target.value)}
                    placeholder="103.21.144.0/24, 45.112.8.19"
                    className="w-full bg-surface-container-highest border border-white/10 focus:border-[#DBEF90] rounded-2xl px-4 py-2.5 text-white font-mono focus:outline-none text-xs"
                  />
                </div>

                {/* Notifications Toggles */}
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="text-xs font-semibold text-white">Alerts & Notification Telemetry</div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white">Order Status Updates</div>
                      <div className="text-[11px] text-on-surface-variant">Instant emails on order complete or partial refund</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.orderUpdates}
                      onChange={(e) =>
                        setNotifications({ ...notifications, orderUpdates: e.target.checked })
                      }
                      className="w-4 h-4 accent-[#DBEF90] rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white">Low Balance Alert Threshold</div>
                      <div className="text-[11px] text-on-surface-variant">Notify when balance drops below ₹500.00</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.lowBalanceAlert}
                      onChange={(e) =>
                        setNotifications({ ...notifications, lowBalanceAlert: e.target.checked })
                      }
                      className="w-4 h-4 accent-[#DBEF90] rounded"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110 shadow-md"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>

            {/* Password Management */}
            <form
              onSubmit={handlePasswordChange}
              className="bg-[#1c1b1b]/80 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 md:p-8 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <Lock className="w-4 h-4 text-[#DBEF90]" />
                <h3 className="text-sm font-semibold text-white">Update Security Password</h3>
              </div>

              {passwordMsg && (
                <div
                  className={`p-3 rounded-xl ${
                    passwordMsg.error ? "bg-rose-500/15 text-rose-300" : "bg-[#DBEF90]/15 text-[#DBEF90]"
                  }`}
                >
                  {passwordMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-on-surface-variant font-mono uppercase block mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currPassword}
                    onChange={(e) => setCurrPassword(e.target.value)}
                    required
                    className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-on-surface-variant font-mono uppercase block mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-on-surface-variant font-mono uppercase block mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-surface-container-highest border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: API Credentials & 2FA (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* API Key Management Box */}
            <div
              id="api-keys"
              className="bg-[#1c1b1b]/90 border border-white/15 backdrop-blur-2xl rounded-3xl p-6 md:p-8 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-semibold text-white">Live API Credentials</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-[10px] font-mono">
                  v1 Endpoint
                </span>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed">
                Connect external bots, resale panels, and automated scripts with sub-second API latency.
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
                  <span>SECRET API KEY</span>
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-[#DBEF90] hover:underline"
                  >
                    {showApiKey ? "Hide Key" : "Reveal Key"}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-black/50 border border-white/10 p-3 rounded-2xl font-mono text-xs text-white">
                  <span className="truncate mr-2">
                    {showApiKey ? user.apiKey : "••••••••••••••••••••••••••••••••••••••••"}
                  </span>
                  <button
                    onClick={handleCopyKey}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-[#DBEF90] hover:text-black transition-colors shrink-0"
                    title="Copy API Key"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRegenKey}
                  className="px-4 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate Key</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyCurl}
                  className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Terminal className="w-3.5 h-3.5 text-[#DBEF90]" />
                  <span>{copiedCurl ? "Copied curl!" : "Copy curl Example"}</span>
                </button>
              </div>

              {/* cURL Snippet Box */}
              <div className="bg-black/60 border border-white/5 rounded-2xl p-3 text-[11px] font-mono text-white/80 overflow-x-auto space-y-1">
                <div className="text-[#DBEF90] text-[10px] uppercase font-bold">Quick Bot Sample:</div>
                <pre className="whitespace-pre-wrap">{curlSnippet}</pre>
              </div>
            </div>

            {/* 2FA Card */}
            <div className="bg-[#1c1b1b]/90 border border-white/15 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">Two-Factor Auth (2FA)</h4>
                    <p className="text-[11px] text-on-surface-variant">Authenticator app TOTP security</p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                    twoFactor ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-on-surface-variant"
                  }`}
                >
                  {twoFactor ? "ENABLED" : "DISABLED"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
