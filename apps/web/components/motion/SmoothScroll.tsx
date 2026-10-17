"use client";

import React, { useEffect, useRef } from "react";
import Lenis from "lenis";
import { useReducedMotion } from "framer-motion";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    // If reduced motion is requested, maintain standard native browser scrolling
    if (shouldReduceMotion) return;

    // Detect touch-only device (disable smooth virtual scroll on touch to preserve native fling & gestures)
    const isTouchOnly =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0) &&
      window.innerWidth < 1024;

    if (isTouchOnly) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      syncTouch: false, // native touch scrolling
      touchMultiplier: 1.0,
    });

    lenisRef.current = lenis;

    // RequestAnimationFrame loop
    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    // Keep anchor links working smoothly with sticky nav offset
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (href && href.startsWith("#") && href.length > 1) {
        const elem = document.querySelector(href);
        if (elem) {
          e.preventDefault();
          lenis.scrollTo(elem as HTMLElement, { offset: -90 });
        }
      }
    };
    document.addEventListener("click", handleAnchorClick);

    // Stop Lenis while modals/drawers are open (observing body overflow or modal elements)
    const observer = new MutationObserver(() => {
      const isModalOpen =
        document.body.style.overflow === "hidden" ||
        document.querySelector('[role="dialog"]') !== null ||
        document.querySelector("[data-state='open']") !== null;

      if (isModalOpen) {
        lenis.stop();
      } else {
        lenis.start();
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "class"],
      subtree: true,
    });

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("click", handleAnchorClick);
      observer.disconnect();
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [shouldReduceMotion]);

  return <>{children}</>;
}
