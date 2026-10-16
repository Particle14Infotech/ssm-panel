"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Zap, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function VerifyPage() {
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length >= 6) {
      setVerified(true);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 py-32 relative overflow-hidden bg-[#131313]">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 p-[1.5px] flex items-center justify-center">
              <div className="w-full h-full bg-[#131313] rounded-full flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <span className="font-heading font-bold text-2xl tracking-wider text-white">
              SMM PANEL
            </span>
          </Link>
          <h1 className="font-heading text-2xl font-light text-white">Two-Factor Authentication</h1>
          <p className="text-xs text-[#c7c8b6] mt-1 font-mono">
            Enter the 6-digit TOTP code from your authenticator app.
          </p>
        </div>

        <div className="glass-panel rounded-3xl p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
          {verified ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="font-heading text-xl font-medium text-white mb-2">Session Verified</h2>
              <p className="text-xs text-[#c7c8b6] mb-6">
                Security clearance verified. Redirecting to workspace...
              </p>
              <Link
                href="/app"
                className="w-full py-3 rounded-full bg-blue-600 text-white font-bold text-xs inline-block"
              >
                Enter Platform
              </Link>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="flex flex-col gap-5">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#c7c8b6] block mb-2 text-center">
                  Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full bg-[#131313] text-white text-2xl text-center tracking-[0.5em] px-4 py-3 rounded-xl border border-white/10 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={code.length < 6}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 text-white font-bold text-sm hover:shadow-[0_0_24px_rgba(37,99,235,0.25)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>Authorize Login</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
