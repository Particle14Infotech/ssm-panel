"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ForgotPasswordInputSchema, ForgotPasswordInput } from "@smm/contracts";
import { Zap, ArrowRight, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordInputSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setServerError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSubmitted(true);
    } catch (err: any) {
      setServerError("Failed to send reset email. Please try again.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 py-32 relative overflow-hidden bg-[#131313]">
      <div className="absolute top-1/4 -left-20 w-96 h-96 rounded-full bg-[#243100]/40 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-[#bd0183]/15 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <BrandLogo variant="combined" size={38} withLink href="/" />
          </div>
          <h1 className="font-heading text-2xl font-light text-white">Reset Password</h1>
          <p className="text-xs text-[#c7c8b6] mt-1 font-mono">
            Single-Use Expiring Recovery Protocol
          </p>
        </div>

        <div className="glass-panel rounded-3xl p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-[#D8EC8D]/15 text-[#D8EC8D] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="font-heading text-xl font-medium text-white mb-2">Check Your Inbox</h2>
              <p className="text-xs text-[#c7c8b6] leading-relaxed mb-6">
                If an account exists with this email address, a secure reset token has been dispatched.
              </p>
              <Link
                href="/login"
                className="w-full py-3 rounded-full bg-[#201f1f] text-white text-xs font-semibold hover:bg-[#2a2a2a] transition-all inline-block"
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {serverError && (
                <div className="p-4 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 text-[#ffb4ab] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-[#c7c8b6] block mb-1.5">
                  Account Email Address <span className="text-[#D8EC8D]">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-[#c7c8b6]" />
                  <input
                    type="email"
                    {...register("email")}
                    placeholder="user@example.com"
                    className="w-full bg-[#131313] text-white text-sm pl-10 pr-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#D8EC8D]/50"
                  />
                </div>
                {errors.email && (
                  <span className="text-xs text-[#ffb4ab] mt-1 block">{errors.email.message}</span>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-full btn-primary-gradient text-[#171e00] font-bold text-sm shadow-[0_0_25px_rgba(216,236,141,0.25)] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                <span>{isSubmitting ? "Transmitting..." : "Send Reset Token"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-white/10 text-center text-xs text-[#c7c8b6]">
            Remember your credentials?{" "}
            <Link href="/login" className="text-[#D8EC8D] font-bold hover:underline">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
