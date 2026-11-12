"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { landingContent } from "@/content/landing";
import { Menu, X, ArrowRight, LayoutDashboard, Shield } from "lucide-react";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { getAuthToken } from "@/lib/auth-session";

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{ isAuthenticated: boolean; isAdmin: boolean }>({
    isAuthenticated: false,
    isAdmin: false,
  });
  const lastScrollY = useRef(0);

  // Sync session state on mount and storage changes
  useEffect(() => {
    const checkAuth = () => {
      const token = getAuthToken();
      const role = typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
      setSessionInfo({
        isAuthenticated: Boolean(token),
        isAdmin: role === "ADMIN",
      });
    };
    checkAuth();
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 40);

      // At top of page (hero), no nav link should be active
      if (currentScrollY < 120) {
        setActiveSection(null);
      }

      if (currentScrollY > 160 && currentScrollY > lastScrollY.current + 10) {
        setHidden(true);
      } else if (currentScrollY < lastScrollY.current - 10) {
        setHidden(false);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Section observer for landing page active link
  useEffect(() => {
    if (pathname !== "/") {
      setActiveSection(null);
      return;
    }

    const sections = ["services", "pricing", "work", "faq"];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-30% 0px -50% 0px" }
    );

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <ScrollProgress />
      <motion.header
        initial={{ y: 0 }}
        animate={{ y: hidden ? -100 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-surface/90 backdrop-blur-xl border-b border-border shadow-2xl py-3"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Brand Logo */}
          <BrandLogo variant="combined" size={34} withLink href="/" />

          {/* Desktop Navigation Links */}
          <nav
            aria-label="Main Navigation"
            className="hidden md:flex items-center p-1 rounded-xl bg-surface-raised border border-border gap-1 relative"
            onMouseLeave={() => setHoveredLink(null)}
          >
            {landingContent.navigation.links.map((item) => {
              const sectionMatch = item.href.replace("/", "");
              const isSectionActive = pathname === "/" && activeSection === sectionMatch;
              const isRouteActive = pathname === item.href;
              const isActive = isSectionActive || isRouteActive;
              const isHovered = hoveredLink === item.href;

              return (
                <Link
                  key={item.href}
                  href={pathname === "/" ? `#${sectionMatch}` : item.href}
                  onMouseEnter={() => setHoveredLink(item.href)}
                  className={`relative px-4 py-2.5 min-h-[44px] flex items-center rounded-lg text-sm transition-colors duration-200 z-10 ${
                    isActive ? "text-fg font-semibold" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {(isActive || isHovered) && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className={`absolute inset-0 rounded-lg -z-10 ${
                        isActive ? "bg-surface border border-border" : "bg-surface/50"
                      }`}
                    />
                  )}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Header Actions */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle variant="compact" />

            {sessionInfo.isAuthenticated ? (
              <MagneticButton>
                <Link
                  href={sessionInfo.isAdmin ? "/admin/dashboard" : "/wallet"}
                  className="h-11 min-h-[44px] px-5 rounded-xl bg-accent text-on-accent text-sm font-semibold hover:brightness-105 transition-all flex items-center gap-1.5 shadow-glow focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {sessionInfo.isAdmin ? (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Admin Console</span>
                    </>
                  ) : (
                    <>
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Dashboard</span>
                    </>
                  )}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </MagneticButton>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2.5 min-h-[44px] flex items-center text-sm font-medium text-fg-muted hover:text-fg transition-colors"
                >
                  {landingContent.navigation.cta.login}
                </Link>

                <MagneticButton>
                  <Link
                    href="/register"
                    className="h-11 min-h-[44px] px-5 rounded-xl bg-accent text-on-accent text-sm font-semibold hover:brightness-105 transition-all flex items-center gap-1.5 shadow-glow focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span>{landingContent.navigation.cta.register}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </MagneticButton>
              </>
            )}
          </div>

          {/* Mobile Menu Button with >= 44px tap targets */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle variant="compact" />

            {sessionInfo.isAuthenticated ? (
              <Link
                href={sessionInfo.isAdmin ? "/admin/dashboard" : "/wallet"}
                className="min-h-[44px] px-3.5 py-2 flex items-center justify-center text-xs font-semibold text-on-accent bg-accent rounded-xl shadow-sm"
              >
                {sessionInfo.isAdmin ? "Admin" : "Dashboard"}
              </Link>
            ) : (
              <Link
                href="/login"
                className="min-h-[44px] px-3.5 py-2 flex items-center justify-center text-xs font-medium text-fg bg-surface-raised border border-border rounded-xl"
              >
                Sign In
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-xl bg-surface-raised text-fg hover:text-fg border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-surface/98 backdrop-blur-2xl pt-24 px-6 flex flex-col justify-between pb-8 md:hidden"
          >
            <div className="flex flex-col gap-2">
              <div className="text-xs uppercase tracking-widest text-accent-text font-mono mb-2 font-bold">
                Menu
              </div>
              {landingContent.navigation.links.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i }}
                >
                  <Link
                    href={item.href}
                    className={`text-lg py-3 min-h-[44px] border-b border-border flex items-center justify-between ${
                      pathname === item.href ? "text-accent-text font-semibold" : "text-fg-2"
                    }`}
                  >
                    <span>{item.label}</span>
                    <ArrowRight className="w-4 h-4 opacity-50" />
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-col gap-3 pt-6">
              {sessionInfo.isAuthenticated ? (
                <Link
                  href={sessionInfo.isAdmin ? "/admin/dashboard" : "/wallet"}
                  className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-accent text-on-accent font-semibold text-center shadow-glow"
                >
                  {sessionInfo.isAdmin ? <Shield className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                  <span>{sessionInfo.isAdmin ? "Go to Admin Console" : "Go to Customer Dashboard"}</span>
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="w-full h-12 flex items-center justify-center rounded-xl bg-accent text-on-accent font-semibold text-center shadow-glow"
                  >
                    {landingContent.navigation.cta.register}
                  </Link>
                  <Link
                    href="/login"
                    className="w-full h-12 flex items-center justify-center rounded-xl bg-surface-raised text-fg font-medium text-center border border-border"
                  >
                    {landingContent.navigation.cta.login}
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
