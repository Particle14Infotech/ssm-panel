"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCustomer } from "@/context/CustomerContext";
import {
  User,
  Shield,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Laptop,
  HelpCircle,
  MessageSquare,
  Plus,
  ArrowRight,
  Clock,
} from "lucide-react";
import { FormField } from "@/components/shared/FormField";
import { useTheme } from "@/context/ThemeContext";

export default function SettingsPage() {
  const { user, updateProfile, tickets } = useCustomer();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<"profile" | "security" | "preferences" | "support">("profile");

  // Profile Form State
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [twoFactor, setTwoFactor] = useState(user.twoFactorEnabled);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Password State
  const [currPassword, setCurrPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name,
      phone,
      twoFactorEnabled: twoFactor,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-mono text-accent-text">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="uppercase tracking-widest font-semibold">Account Governance</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-fg tracking-tight">Settings</h1>
        <p className="text-xs text-fg-muted">
          Manage your account profile, credentials, security preferences, and display theme.
        </p>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Settings updated successfully.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "profile"
              ? "bg-accent/15 text-accent-text border border-accent/30 shadow-xs"
              : "text-fg-muted hover:text-fg hover:bg-surface-raised"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile & Account</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "security"
              ? "bg-accent/15 text-accent-text border border-accent/30 shadow-xs"
              : "text-fg-muted hover:text-fg hover:bg-surface-raised"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Security & Login</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "preferences"
              ? "bg-accent/15 text-accent-text border border-accent/30 shadow-xs"
              : "text-fg-muted hover:text-fg hover:bg-surface-raised"
          }`}
        >
          <Moon className="w-4 h-4" />
          <span>Preferences & Theme</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("support")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "support"
              ? "bg-accent/15 text-accent-text border border-accent/30 shadow-xs"
              : "text-fg-muted hover:text-fg hover:bg-surface-raised"
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Support Tickets</span>
        </button>
      </div>

      {/* Tab 1: Profile & Account */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveProfile} className="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-text text-base font-bold font-mono">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div>
                <h2 className="text-base font-semibold text-fg">{user.name}</h2>
                <div className="text-xs text-fg-muted font-mono">{user.email}</div>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-accent/15 text-accent-text text-[10px] font-mono font-bold">
                  TIER: {user.tier}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-raised border border-border focus:border-accent/60 rounded-xl px-3.5 py-2.5 text-xs text-fg focus:outline-none"
              />
            </FormField>
            <FormField label="Email Address">
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full bg-surface-raised/40 border border-border rounded-xl px-3.5 py-2.5 text-xs text-fg-muted cursor-not-allowed opacity-70"
              />
            </FormField>
            <FormField label="Phone / WhatsApp Number">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-surface-raised border border-border focus:border-accent/60 rounded-xl px-3.5 py-2.5 text-xs text-fg focus:outline-none"
              />
            </FormField>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-accent text-on-accent font-bold text-xs uppercase tracking-wider hover:brightness-105 active:scale-95 transition-all shadow-md"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === "security" && (
        <div className="space-y-6">
          <form onSubmit={handlePasswordChange} className="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <Lock className="w-5 h-5 text-accent-text" />
              <h2 className="text-base font-semibold text-fg">Change Password</h2>
            </div>

            {passwordMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  passwordMsg.error
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                }`}
              >
                {passwordMsg.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <div className="space-y-4 max-w-md">
              <FormField label="Current Password">
                <input
                  type="password"
                  value={currPassword}
                  onChange={(e) => setCurrPassword(e.target.value)}
                  className="w-full bg-surface-raised border border-border focus:border-accent/60 rounded-xl px-3.5 py-2.5 text-xs text-fg focus:outline-none"
                />
              </FormField>

              <FormField label="New Password">
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-surface-raised border border-border focus:border-accent/60 rounded-xl px-3.5 py-2.5 text-xs text-fg focus:outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>

              <FormField label="Confirm New Password">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-surface-raised border border-border focus:border-accent/60 rounded-xl px-3.5 py-2.5 text-xs text-fg focus:outline-none"
                />
              </FormField>
            </div>

            <div className="pt-4 border-t border-border">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-accent text-on-accent font-bold text-xs uppercase tracking-wider hover:brightness-105 active:scale-95 transition-all shadow-md"
              >
                Update Password
              </button>
            </div>
          </form>

          {/* 2FA Toggle */}
          <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-fg">Two-Factor Authentication (2FA)</h3>
                <p className="text-xs text-fg-muted mt-0.5">
                  Require an authenticator app code during sign in for enhanced wallet protection.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={twoFactor}
                  onChange={(e) => setTwoFactor(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Preferences & Theme */}
      {activeTab === "preferences" && (
        <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <Moon className="w-5 h-5 text-accent-text" />
            <h2 className="text-base font-semibold text-fg">Interface Theme</h2>
          </div>

          <p className="text-xs text-fg-muted">
            Select your preferred color mode for dashboard charts, metrics, and navigation.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                theme === "dark"
                  ? "bg-accent/15 border-accent text-fg shadow-sm"
                  : "bg-surface-raised border-border text-fg-muted hover:text-fg hover:border-slate-400"
              }`}
            >
              <Moon className="w-5 h-5 text-accent-text" />
              <div>
                <div className="text-xs font-bold text-fg">Dark Theme</div>
                <div className="text-[10px] text-fg-muted">Deep contrast & lime accents</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                theme === "light"
                  ? "bg-accent/15 border-accent text-fg shadow-sm"
                  : "bg-surface-raised border-border text-fg-muted hover:text-fg hover:border-slate-400"
              }`}
            >
              <Sun className="w-5 h-5 text-accent-text" />
              <div>
                <div className="text-xs font-bold text-fg">Light Theme</div>
                <div className="text-[10px] text-fg-muted">Bright & clean interface</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTheme("system")}
              className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                theme === "system"
                  ? "bg-accent/15 border-accent text-fg shadow-sm"
                  : "bg-surface-raised border-border text-fg-muted hover:text-fg hover:border-slate-400"
              }`}
            >
              <Laptop className="w-5 h-5 text-accent-text" />
              <div>
                <div className="text-xs font-bold text-fg">System Match</div>
                <div className="text-[10px] text-fg-muted">Follow OS appearance</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Support Tickets (Requirement 7) */}
      {activeTab === "support" && (
        <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-lg font-semibold text-fg">Support & Help Desk</h2>
              <p className="text-xs text-fg-muted mt-0.5">
                Track your active dispute tickets, order queries, and service refills.
              </p>
            </div>
            <Link
              href="/support"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-on-accent text-xs font-bold shadow-glow hover:brightness-105 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Ticket</span>
            </Link>
          </div>

          {/* Active Tickets List */}
          <div className="space-y-3">
            {tickets && tickets.length > 0 ? (
              tickets.map((t: any) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl bg-surface-raised border border-border flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-accent-text">{t.id}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent-text uppercase font-semibold">
                        {t.status || "OPEN"}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-fg truncate">{t.subject || t.title || "Support Query"}</div>
                    <div className="text-[11px] text-fg-muted flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "Recent"}</span>
                    </div>
                  </div>
                  <Link
                    href={`/support`}
                    className="p-2 rounded-xl text-fg-muted hover:text-fg hover:bg-surface border border-border shrink-0"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))
            ) : (
              <div className="py-10 text-center space-y-3 bg-surface-raised/40 rounded-2xl border border-dashed border-border">
                <div className="w-10 h-10 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto text-accent-text">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-fg">No active support tickets</p>
                  <p className="text-[11px] text-fg-muted">Need help with an order or payment? Open a ticket directly.</p>
                </div>
                <Link
                  href="/support"
                  className="inline-flex items-center gap-1.5 text-xs text-accent-text font-semibold hover:underline pt-1"
                >
                  <span>Open Full Support Hub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
