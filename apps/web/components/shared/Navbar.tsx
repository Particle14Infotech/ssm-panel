"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { landingContent } from "@/content/landing";
import { Menu, X, ArrowRight, ShieldCheck, Zap } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on path change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#131313]/90 backdrop-blur-xl border-b border-white/10 shadow-2xl py-3"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Brand Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-primary group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed rounded-lg"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#bd0183] via-[#ffafd5] to-[#d8ec8d] p-[1.5px] flex items-center justify-center">
              <div className="w-full h-full bg-[#131313] rounded-full flex items-center justify-center">
                <Zap className="w-4 h-4 text-[#d8ec8d] group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-heading font-bold text-xl uppercase tracking-wider text-white">
                {landingContent.brand.name}
              </span>
              <span className="text-[#d8ec8d] text-xl font-black leading-none select-none">*</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            aria-label="Main Navigation"
            className="hidden md:flex items-center bg-[#201f1f]/80 p-1.5 rounded-full border border-white/10 backdrop-blur-md gap-1"
          >
            {landingContent.navigation.links.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-1.5 rounded-full text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-[#353534] text-white font-medium shadow-sm"
                      : "text-[#c7c8b6] hover:text-white hover:bg-[#2a2a2a]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Header Actions */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Live Telemetry Pill */}
            <div className="flex items-center gap-2 bg-[#201f1f]/80 border border-white/10 rounded-full px-3.5 py-1.5 text-xs text-[#c7c8b6]">
              <span className="w-2 h-2 rounded-full bg-[#d8ec8d] animate-pulse" />
              <span className="font-mono text-[#d8ec8d]">Cluster Active</span>
              <span className="text-white/30">•</span>
              <span className="font-mono">14ms</span>
            </div>

            {/* Auth CTAs */}
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
            >
              {landingContent.navigation.cta.login}
            </Link>

            <Link
              href="/register"
              className="px-5 py-2 rounded-full bg-gradient-to-r from-[#d8ec8d] to-[#bccf74] text-[#171e00] text-sm font-semibold hover:shadow-[0_0_24px_rgba(216,236,141,0.45)] hover:scale-[1.02] transition-all flex items-center gap-1.5 group"
            >
              <span>{landingContent.navigation.cta.register}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/login"
              className="px-3 py-1.5 text-xs font-medium text-white/90 bg-[#201f1f] border border-white/10 rounded-full"
            >
              Sign In
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full bg-[#201f1f] text-white/80 hover:text-white border border-white/10 focus:outline-none"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#131313]/95 backdrop-blur-2xl pt-24 px-6 flex flex-col justify-between pb-8 md:hidden">
          <div className="flex flex-col gap-3">
            <div className="text-xs uppercase tracking-widest text-[#d8ec8d] font-mono mb-2">
              Navigation Menu
            </div>
            {landingContent.navigation.links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-lg py-2 border-b border-white/10 flex items-center justify-between ${
                  pathname === item.href ? "text-[#d8ec8d] font-semibold" : "text-white/80"
                }`}
              >
                <span>{item.label}</span>
                <ArrowRight className="w-4 h-4 opacity-50" />
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3 pt-6">
            <div className="flex items-center justify-between text-xs text-[#c7c8b6] bg-[#201f1f] p-3 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#d8ec8d] animate-pulse" />
                <span>Node 08-Alpha Live</span>
              </div>
              <span className="font-mono text-[#d8ec8d]">99.98% SLA</span>
            </div>

            <Link
              href="/register"
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#d8ec8d] to-[#bccf74] text-[#171e00] font-bold text-center shadow-lg"
            >
              {landingContent.navigation.cta.register}
            </Link>
            <Link
              href="/login"
              className="w-full py-3 rounded-full bg-[#201f1f] text-white font-medium text-center border border-white/10"
            >
              {landingContent.navigation.cta.login}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
