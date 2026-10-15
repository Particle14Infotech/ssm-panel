"use client";

import { useState, useEffect } from "react";

export interface MotionPreference {
  reduced: boolean;
  lowPower: boolean;
  canRender3D: boolean;
}

export function useMotionPreference(): MotionPreference {
  const [pref, setPref] = useState<MotionPreference>({
    reduced: false,
    lowPower: false,
    canRender3D: true,
  });

  useEffect(() => {
    let reduced = false;
    let lowPower = false;

    // Check prefers-reduced-motion
    if (typeof window !== "undefined" && window.matchMedia) {
      const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      reduced = motionQuery.matches;

      const handleMotionChange = (e: MediaQueryListEvent) => {
        setPref((prev) => ({
          ...prev,
          reduced: e.matches,
          canRender3D: !e.matches,
        }));
      };
      motionQuery.addEventListener("change", handleMotionChange);
    }

    // Check low-power signals
    if (typeof navigator !== "undefined") {
      const connection = (navigator as any).connection;
      if (connection && connection.saveData === true) {
        lowPower = true;
      }
    }

    if (reduced) {
      console.info("[3D fallback] prefers-reduced-motion enabled by user");
    }
    if (lowPower) {
      console.info("[3D fallback] low-power/Save-Data mode active - rendering at dpr 1.0");
    }

    setPref({
      reduced,
      lowPower,
      canRender3D: !reduced,
    });
  }, []);

  return pref;
}
