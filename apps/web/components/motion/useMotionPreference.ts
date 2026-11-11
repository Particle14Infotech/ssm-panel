"use client";

import { useState, useEffect } from "react";

export interface MotionPreference {
  reduced: boolean;
  lowPower: boolean;
  canRender3D: boolean;
}

function isWebGLSupported(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
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
    const webglOk = isWebGLSupported();

    // Check prefers-reduced-motion
    if (typeof window !== "undefined" && window.matchMedia) {
      const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      reduced = motionQuery.matches;

      const handleMotionChange = (e: MediaQueryListEvent) => {
        setPref((prev) => ({
          ...prev,
          reduced: e.matches,
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

    setPref({
      reduced,
      lowPower,
      canRender3D: webglOk,
    });
  }, []);

  return pref;
}
