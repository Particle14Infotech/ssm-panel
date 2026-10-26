"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginInputSchema, LoginInput } from "@smm/contracts";
import { Zap, ArrowRight, Lock, User, AlertCircle, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import dynamic from "next/dynamic";
import { getApiBase } from "@/lib/api-base";

const DynamicAuthCrown = dynamic(
  () => import("@/components/three/AuthCrown3D").then((m) => m.AuthCrown3D),
  { ssr: false }
);

export default function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: {
      usernameOrEmail: "",
      password: "",
      twoFactorCode: "",
    },
  });

  const establishSession = (userObj: any, tokenStr?: string) => {
    const token = tokenStr || `jwt_demo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const role = userObj.role || "CUSTOMER";

    if (typeof window !== "undefined") {
      localStorage.clear();
      localStorage.setItem("authToken", token);
      localStorage.setItem("authUser", JSON.stringify(userObj));

      // Set cookie for Next.js middleware and SSR
      document.cookie = `authToken=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `userRole=${encodeURIComponent(role)}; path=/; max-age=604800; SameSite=Lax`;

      if (role === "ADMIN") {
        window.location.href = "/admin/dashboard";
      } else {
        window.location.href = "/app/dashboard";
      }
    }
  };

  const handleQuickDemoLogin = (email: string) => {
    if (email.includes("admin")) {
      establishSession({
        id: "usr_admin_001",
        email: "admin@smm-panel.io",
        name: "System Administrator",
        role: "ADMIN",
        tier: "ENTERPRISE",
        balance: 100000.0,
      });
      return;
    }

    if (email.includes("bholu")) {
      establishSession({
        id: "usr_bholu_customer",
        email: "bholu@gmail.com",
        name: "Bholu",
        role: "CUSTOMER",
        tier: "PRO_SCALE",
        balance: 1068.61,
      });
      return;
    }

    // Default Alex Vance
    establishSession({
      id: "usr_998124smm",
      email: "alex.vance@smm-panel.io",
      name: "Alex Vance",
      role: "CUSTOMER",
      tier: "PRO_SCALE",
      balance: 2450.0,
    });
  };

  const onSubmit = async (data: LoginInput) => {
    setServerError(null);
    const email = data.usernameOrEmail.toLowerCase().trim();

    try {
      const apiBase = getApiBase();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.usernameOrEmail,
          password: data.password,
        }),
        signal: controller.signal,
      }).catch((fetchErr) => {
        console.error("Login fetch network error:", fetchErr);
        return null;
      });

      clearTimeout(timeoutId);

      if (res) {
        if (res.ok) {
          const json = await res.json();
          if (json.token) {
            establishSession(json.user || { email, role: "CUSTOMER" }, json.token);
            return;
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          setServerError(errorData.message || "Invalid email or password.");
          return;
        }
      }

      setServerError("Unable to reach authentication server. Please check your network connection.");
    } catch (err: any) {
      setServerError(err?.message || "Invalid email or password.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-12 py-12 md:py-20 relative overflow-hidden bg-[#131313]">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 rounded-full bg-[#243100]/40 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-[#bd0183]/15 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[#d8ec8d]/10 blur-[160px] pointer-events-none -z-10" />

      {/* Unified Outer Frame with Clean Boundaries */}
      <div className="w-full max-w-5xl rounded-3xl p-6 sm:p-10 lg:p-12 bg-[#191919]/60 border border-white/[0.08] backdrop-blur-2xl shadow-[0_32px_64px_rgba(0,0,0,0.7)] relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: 3D Rotating Crown & Brand showcase on desktop */}
        <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left justify-center px-2">
          <div className="mb-4">
            <BrandLogo variant="combined" size={38} withLink href="/" />
          </div>

          {/* Real 3D Rotating Crown Showcase with perfect proportional dimensions */}
          <div className="w-full max-w-[280px] sm:max-w-[320px] aspect-square relative my-1 flex items-center justify-center">
            <DynamicAuthCrown className="w-full h-full" size="md" />
          </div>

          <div className="mt-3">
            <span className="text-[11px] uppercase tracking-widest font-mono text-[#D8EC8D] font-semibold block mb-0.5">
              High-Frequency Network
            </span>
            <p className="text-xs text-zinc-400 font-light max-w-xs leading-relaxed">
              Direct API routing, automated balance reconciliation, and real-time execution across global providers.
            </p>
          </div>
        </div>

        {/* Right Column: Sign In Card */}
        <div className="lg:col-span-7 w-full max-w-md mx-auto">
          <div className="text-center lg:text-left mb-6">
            <h1 className="font-heading text-2xl sm:text-3xl font-light text-white">Sign In to Platform</h1>
            <p className="text-xs text-[#c7c8b6] mt-1 font-mono">
              Direct Access • Automated Session Validation
            </p>
          </div>

          <div className="rounded-3xl p-6 sm:p-8 bg-[#1c1b1b]/90 border border-white/10 backdrop-blur-2xl shadow-[0_24px_50px_rgba(0,0,0,0.6)]">
            
            {/* 1-Click Fast Demo Login Selector */}
            <div className="mb-5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-[#D8EC8D] font-semibold">
                  <Zap className="w-3.5 h-3.5 text-[#D8EC8D]" />
                  <span>1-Click Demo Accounts</span>
                </span>
                <span className="text-[10px] text-white/50">Quick Access</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin("bholu@gmail.com")}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-[#D8EC8D]/15 hover:border-[#D8EC8D]/40 border border-white/5 text-left transition-all cursor-pointer group"
                >
                  <div className="text-xs font-semibold text-white group-hover:text-[#D8EC8D] flex items-center justify-between">
                    <span>Bholu</span>
                    <span className="text-[9px] font-mono px-1 rounded bg-[#D8EC8D]/20 text-[#D8EC8D]">Customer</span>
                  </div>
                  <div className="text-[11px] text-[#D8EC8D] font-mono font-bold mt-0.5">₹1,068.61</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin("alex.vance@smm-panel.io")}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-[#D8EC8D]/15 hover:border-[#D8EC8D]/40 border border-white/5 text-left transition-all cursor-pointer group"
                >
                  <div className="text-xs font-semibold text-white group-hover:text-[#D8EC8D] flex items-center justify-between">
                    <span>Alex Vance</span>
                    <span className="text-[9px] font-mono px-1 rounded bg-[#D8EC8D]/20 text-[#D8EC8D]">Customer</span>
                  </div>
                  <div className="text-[11px] text-[#D8EC8D] font-mono font-bold mt-0.5">₹2,450.00</div>
                </button>
              </div>
            </div>

            {serverError && (
              <div className="mb-6 p-4 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 text-[#ffb4ab] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#c7c8b6] block mb-1.5">
                  Username or Email <span className="text-[#D8EC8D]">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3 text-[#c7c8b6]" />
                  <input
                    type="text"
                    {...register("usernameOrEmail")}
                    placeholder="bholu@gmail.com or alex.vance@smm-panel.io"
                    className="w-full bg-[#131313] text-white text-sm pl-10 pr-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#D8EC8D]/50"
                  />
                </div>
                {errors.usernameOrEmail && (
                  <span className="text-xs text-[#ffb4ab] mt-1 block">
                    {errors.usernameOrEmail.message}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-[#c7c8b6]">
                    Password <span className="text-[#D8EC8D]">*</span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-[#D8EC8D] hover:underline font-mono"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[#c7c8b6]" />
                  <input
                    type="password"
                    {...register("password")}
                    placeholder="••••••••••••"
                    className="w-full bg-[#131313] text-white text-sm pl-10 pr-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#D8EC8D]/50"
                  />
                </div>
                {errors.password && (
                  <span className="text-xs text-[#ffb4ab] mt-1 block">
                    {errors.password.message}
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#c7c8b6] block mb-1.5">
                  2FA Code (If enabled)
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 absolute left-3.5 top-3 text-[#c7c8b6]" />
                  <input
                    type="text"
                    maxLength={6}
                    {...register("twoFactorCode")}
                    placeholder="6-digit authenticator code"
                    className="w-full bg-[#131313] text-white text-sm pl-10 pr-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#D8EC8D]/50 font-mono tracking-widest"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-full btn-primary-gradient text-[#171e00] font-bold text-sm shadow-[0_0_25px_rgba(216,236,141,0.25)] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 cursor-pointer"
              >
                <span>{isSubmitting ? "Authenticating..." : "Sign In to Account"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-xs text-[#c7c8b6]">
              <span>Need administrator access?</span>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("admin@smm-panel.io")}
                className="text-[#D8EC8D] font-mono hover:underline font-semibold cursor-pointer"
              >
                Demo Admin Login &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
