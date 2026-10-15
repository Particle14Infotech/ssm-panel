"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginInputSchema, LoginInput } from "@smm/contracts";
import { Zap, ArrowRight, Lock, User, AlertCircle, ShieldCheck } from "lucide-react";

import dynamic from "next/dynamic";

const DynamicAuthCrown = dynamic(
  () => import("@/components/three/AuthCrown3D").then((m) => m.AuthCrown3D),
  { ssr: false }
);

export default function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: {
      usernameOrEmail: "",
      password: "",
      twoFactorCode: "",
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setServerError(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.usernameOrEmail,
          password: data.password,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.message || "Invalid credentials or server unavailable.");
      }

      const json = await res.json();
      if (json.token && typeof window !== "undefined") {
        // Clear old customer/admin cache
        localStorage.clear();
        localStorage.setItem("authToken", json.token);
        if (json.user) {
          localStorage.setItem("authUser", JSON.stringify(json.user));
        }

        // Set secure cookies for SSR / middleware
        const role = json.user?.role || "CUSTOMER";
        document.cookie = `authToken=${encodeURIComponent(json.token)}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `userRole=${encodeURIComponent(role)}; path=/; max-age=604800; SameSite=Lax`;

        if (role === "ADMIN") {
          window.location.href = "/admin/dashboard";
        } else {
          window.location.href = "/app/dashboard";
        }
        return;
      }
      window.location.href = "/app/dashboard";
    } catch (err: any) {
      setServerError(err.message || "Invalid credentials or server unavailable.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-12 py-12 md:py-20 relative overflow-hidden bg-[#131313]">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 rounded-full bg-[#bd0183]/15 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-[#d8ec8d]/15 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[#243100]/20 blur-[160px] pointer-events-none -z-10" />

      {/* Unified Outer Frame with Clean Boundaries */}
      <div className="w-full max-w-5xl rounded-3xl p-6 sm:p-10 lg:p-12 bg-[#191919]/60 border border-white/[0.08] backdrop-blur-2xl shadow-[0_32px_64px_rgba(0,0,0,0.7)] relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: 3D Rotating Crown & Brand showcase on desktop */}
        <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left justify-center px-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#bd0183] to-[#d8ec8d] p-[1.5px] flex items-center justify-center shadow-lg">
              <div className="w-full h-full bg-[#131313] rounded-full flex items-center justify-center">
                <Zap className="w-4 h-4 text-[#d8ec8d] group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-heading font-bold text-xl tracking-wider text-white">
                SMM PANEL
              </span>
              <span className="text-[#d8ec8d] font-bold text-xl">*</span>
            </div>
          </Link>

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
              Direct Access • Instant Session Verification
            </p>
          </div>

          <div className="rounded-3xl p-6 sm:p-8 bg-[#1c1b1b]/90 border border-white/10 backdrop-blur-2xl shadow-[0_24px_50px_rgba(0,0,0,0.6)]">
          {serverError && (
            <div className="mb-6 p-4 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 text-[#ffb4ab] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[#c7c8b6] block mb-1.5">
                Username or Email <span className="text-[#d8ec8d]">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3 text-[#c7c8b6]" />
                <input
                  type="text"
                  {...register("usernameOrEmail")}
                  placeholder="admin or user@domain.com"
                  className="w-full bg-[#131313] text-white text-sm pl-10 pr-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#d8ec8d]"
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
                  Password <span className="text-[#d8ec8d]">*</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#d8ec8d] hover:underline font-mono"
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
                  className="w-full bg-[#131313] text-white text-sm pl-10 pr-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#d8ec8d]"
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
                  className="w-full bg-[#131313] text-white text-sm pl-10 pr-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#d8ec8d] font-mono tracking-widest"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#d8ec8d] via-[#bccf74] to-[#d8ec8d] text-[#171e00] font-bold text-sm hover:shadow-[0_0_24px_rgba(216,236,141,0.4)] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              <span>{isSubmitting ? "Authenticating..." : "Sign In to Account"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10 text-center text-xs text-[#c7c8b6]">
            Don&apos;t have an account yet?{" "}
            <Link href="/register" className="text-[#d8ec8d] font-bold hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

