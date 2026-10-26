"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterInputSchema, RegisterInput } from "@smm/contracts";
import { Zap, ArrowRight, Lock, User, Mail, AlertCircle, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";

import dynamic from "next/dynamic";
import { getApiBase } from "@/lib/api-base";

const DynamicAuthCrown = dynamic(
  () => import("@/components/three/AuthCrown3D").then((m) => m.AuthCrown3D),
  { ssr: false }
);

export default function RegisterPage() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterInputSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      termsAccepted: false,
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    setServerError(null);
    try {
      const apiBase = getApiBase();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          username: data.username,
          email: data.email,
          password: data.password,
        }),
        signal: controller.signal,
      }).catch((fetchErr) => {
        console.error("Register fetch network error:", fetchErr);
        return null;
      });

      clearTimeout(timeoutId);

      if (!res) {
        throw new Error("Unable to reach authentication server. Please check your network connection.");
      }

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.message || "Registration could not be completed. Please try again.");
      }

      const json = await res.json();
      if (json.token && typeof window !== "undefined") {
        localStorage.clear();
        localStorage.setItem("authToken", json.token);
        if (json.user) {
          localStorage.setItem("authUser", JSON.stringify(json.user));
        }

        const role = json.user?.role || "CUSTOMER";
        document.cookie = `authToken=${encodeURIComponent(json.token)}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `userRole=${encodeURIComponent(role)}; path=/; max-age=604800; SameSite=Lax`;

        window.location.href = "/app/dashboard";
        return;
      }
      window.location.href = "/app/dashboard";
    } catch (err: any) {
      setServerError(err.message || "Registration could not be completed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-12 py-12 md:py-20 relative overflow-hidden bg-[#131313]">
      <div className="absolute top-1/4 -left-20 w-96 h-96 rounded-full bg-[#243100]/40 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-[#bd0183]/15 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[#d8ec8d]/10 blur-[160px] pointer-events-none -z-10" />

      {/* Unified Outer Frame with Clean Boundaries */}
      <div className="w-full max-w-6xl rounded-3xl p-6 sm:p-10 lg:p-12 bg-[#191919]/60 border border-white/[0.08] backdrop-blur-2xl shadow-[0_32px_64px_rgba(0,0,0,0.7)] relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: 3D Rotating Crown & Benefits showcase on desktop */}
        <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left justify-center px-2">
          <div className="mb-4">
            <BrandLogo variant="combined" size={38} withLink href="/" />
          </div>

          {/* Real 3D Rotating Crown Showcase */}
          <div className="w-full max-w-[280px] sm:max-w-[320px] aspect-square relative my-1 flex items-center justify-center">
            <DynamicAuthCrown className="w-full h-full" size="md" />
          </div>

          <div className="mt-3">
            <span className="text-[11px] uppercase tracking-widest font-mono text-[#D8EC8D] font-semibold block mb-0.5">
              Institutional Infrastructure
            </span>
            <p className="text-xs text-zinc-400 font-light max-w-xs leading-relaxed">
              Direct double-entry wallet generation, live order queue tracking, and access to over 500+ active service endpoints.
            </p>
          </div>
        </div>

        {/* Right Column: Register Card */}
        <div className="lg:col-span-7 w-full max-w-xl mx-auto">
          <div className="text-center lg:text-left mb-6">
            <h1 className="font-heading text-2xl sm:text-3xl font-light text-white">Create New Account</h1>
            <p className="text-xs text-[#c7c8b6] mt-1 font-mono">
              Direct Access • Automated Wallet Generation
            </p>
          </div>

          <div className="rounded-3xl p-6 sm:p-8 bg-[#1c1b1b]/90 border border-white/10 backdrop-blur-2xl shadow-[0_24px_50px_rgba(0,0,0,0.6)]">
          {serverError && (
            <div className="mb-6 p-4 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 text-[#ffb4ab] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} action="#" method="POST" className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#c7c8b6] block mb-1.5">
                  Full Name <span className="text-[#D8EC8D]">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3 text-[#c7c8b6]" />
                  <input
                    type="text"
                    {...register("name")}
                    placeholder="Elena Rostova"
                    className="w-full bg-[#131313] text-white text-sm pl-10 pr-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#D8EC8D]/50"
                  />
                </div>
                {errors.name && (
                  <span className="text-xs text-[#ffb4ab] mt-1 block">{errors.name.message}</span>
                )}
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#c7c8b6] block mb-1.5">
                  Username <span className="text-[#D8EC8D]">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3 text-[#c7c8b6]" />
                  <input
                    type="text"
                    {...register("username")}
                    placeholder="elena_growth"
                    className="w-full bg-[#131313] text-white text-sm pl-10 pr-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#D8EC8D]/50"
                  />
                </div>
                {errors.username && (
                  <span className="text-xs text-[#ffb4ab] mt-1 block">
                    {errors.username.message}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-[#c7c8b6] block mb-1.5">
                Email Address <span className="text-[#D8EC8D]">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-[#c7c8b6]" />
                <input
                  type="email"
                  {...register("email")}
                  placeholder="elena@example.com"
                  className="w-full bg-[#131313] text-white text-sm pl-10 pr-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#D8EC8D]/50"
                />
              </div>
              {errors.email && (
                <span className="text-xs text-[#ffb4ab] mt-1 block">{errors.email.message}</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#c7c8b6] block mb-1.5">
                  Password <span className="text-[#D8EC8D]">*</span>
                </label>
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
                  Confirm Password <span className="text-[#D8EC8D]">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[#c7c8b6]" />
                  <input
                    type="password"
                    {...register("confirmPassword")}
                    placeholder="••••••••••••"
                    className="w-full bg-[#131313] text-white text-sm pl-10 pr-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#D8EC8D]/50"
                  />
                </div>
                {errors.confirmPassword && (
                  <span className="text-xs text-[#ffb4ab] mt-1 block">
                    {errors.confirmPassword.message}
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  {...register("termsAccepted")}
                  className="w-4 h-4 mt-0.5 rounded bg-[#131313] border-white/20 text-[#D8EC8D] focus:ring-0"
                />
                <span className="text-xs text-[#c7c8b6]">
                  I agree to the{" "}
                  <Link href="/legal/terms" className="text-[#D8EC8D] underline">
                    Terms of Service
                  </Link>{" "}
                  and acknowledge that service availability depends on provider conditions.
                </span>
              </label>
              {errors.termsAccepted && (
                <span className="text-xs text-[#ffb4ab] mt-1 block">
                  {errors.termsAccepted.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-full btn-primary-gradient text-[#171e00] font-bold text-sm shadow-[0_0_25px_rgba(216,236,141,0.25)] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              <span>{isSubmitting ? "Creating Account..." : "Complete Registration"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10 text-center text-xs text-[#c7c8b6]">
            Already have an account?{" "}
            <Link href="/login" className="text-[#D8EC8D] font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

