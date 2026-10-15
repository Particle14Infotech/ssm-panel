"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ContactMessageSchema, ContactMessageInput } from "@smm/contracts";
import { landingContent } from "@/content/landing";
import { Send, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";

export function ContactSection() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactMessageInput>({
    resolver: zodResolver(ContactMessageSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
      company: "",
      _hp: "",
    },
  });

  const onSubmit = async (data: ContactMessageInput) => {
    setServerError(null);
    try {
      // Simulate API submission
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSubmitted(true);
      reset();
    } catch (err: any) {
      setServerError("Failed to send message. Please try again or email us directly.");
    }
  };

  return (
    <section id="contact" data-crown="dim" className="w-full py-24 bg-transparent relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Info Column */}
          <RevealOnScroll className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-xs font-mono text-[#D8EC8D] uppercase tracking-widest mb-4 backdrop-blur-md">
                {landingContent.contact.badge}
              </div>
              <h2 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mb-4 leading-tight">
                {landingContent.contact.title}
              </h2>
              <p className="text-base text-zinc-400 font-light leading-relaxed mb-8">
                {landingContent.contact.description}
              </p>
            </div>

            <div className="flex flex-col gap-4 p-6 rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] bg-zinc-950/45 border border-white/[0.14] backdrop-blur-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-[#DBEF90] backdrop-blur-md">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-zinc-300 font-mono block">Direct Inquiries</span>
                  <span className="text-sm font-semibold text-white">
                    {landingContent.contact.email}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.08] text-xs text-zinc-300 font-mono">
                {landingContent.contact.responsePromise}
              </div>
            </div>
          </RevealOnScroll>

          {/* Right Form Column */}
          <RevealOnScroll delay={0.15} className="lg:col-span-7 rounded-3xl p-8 bg-gradient-to-b from-white/[0.08] to-white/[0.02] bg-zinc-950/45 border border-white/[0.14] backdrop-blur-2xl shadow-[0_24px_50px_rgba(0,0,0,0.6)]">
            {submitted ? (
              <div className="py-12 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#D8EC8D]/20 text-[#D8EC8D] flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-heading text-2xl font-light text-white mb-2">
                  Message Sent Successfully
                </h3>
                <p className="text-sm text-zinc-300 max-w-md mb-6">
                  Thank you for reaching out. Our support team has received your inquiry
                  and will respond promptly.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2.5 rounded-full bg-white/[0.08] text-white text-xs font-semibold hover:bg-gradient-to-r hover:from-[#D8EC8D] hover:to-[#BEF264] hover:text-[#121b00] transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                {/* Honeypot hidden field */}
                <input type="text" {...register("_hp")} className="hidden" tabIndex={-1} />

                {serverError && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{serverError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-1.5">
                      Your Name <span className="text-[#D8EC8D]">*</span>
                    </label>
                    <input
                      type="text"
                      {...register("name")}
                      placeholder="Elena Rostova"
                      className="w-full bg-black/40 text-white text-sm px-4 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#D8EC8D]"
                    />
                    {errors.name && (
                      <span className="text-xs text-red-400 mt-1 block">
                        {errors.name.message}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-1.5">
                      Email Address <span className="text-[#D8EC8D]">*</span>
                    </label>
                    <input
                      type="email"
                      {...register("email")}
                      placeholder="elena@example.com"
                      className="w-full bg-black/40 text-white text-sm px-4 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#D8EC8D]"
                    />
                    {errors.email && (
                      <span className="text-xs text-red-400 mt-1 block">
                        {errors.email.message}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-1.5">
                      Subject <span className="text-[#FF4D8D]">*</span>
                    </label>
                    <input
                      type="text"
                      {...register("subject")}
                      placeholder="Agency Integration Inquiry"
                      className="w-full bg-black/40 text-white text-sm px-4 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#FF4D8D]"
                    />
                    {errors.subject && (
                      <span className="text-xs text-red-400 mt-1 block">
                        {errors.subject.message}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-1.5">
                      Company / Organization (Optional)
                    </label>
                    <input
                      type="text"
                      {...register("company")}
                      placeholder="OmniGrowth Labs"
                      className="w-full bg-black/40 text-white text-sm px-4 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#FF4D8D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Message Details <span className="text-[#FF4D8D]">*</span>
                  </label>
                  <textarea
                    rows={4}
                    {...register("message")}
                    placeholder="Describe your requirements, monthly volumes, or technical question..."
                    className="w-full bg-black/40 text-white text-sm px-4 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:border-[#FF4D8D] resize-none"
                  />
                  {errors.message && (
                    <span className="text-xs text-red-400 mt-1 block">
                      {errors.message.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#D8EC8D] to-[#BEF264] text-[#121b00] font-bold text-sm hover:shadow-[0_0_24px_rgba(216,236,141,0.4)] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? "Dispatching..." : "Transmit Inquiry"}</span>
                </button>
              </form>
            )}
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
