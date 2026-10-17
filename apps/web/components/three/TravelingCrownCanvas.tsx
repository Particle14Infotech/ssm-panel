"use client";

import React, { useRef, useEffect, useState, useCallback, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { useMotionPreference } from "../motion/useMotionPreference";
import { CrownModel } from "./objects/CrownModel";
import { PlatformRing, PlatformId, LOGOS, getLogoGeometryStats } from "./objects/SocialLogos";
import { CrownSlotId } from "./CrownSlot";

interface SlotData {
  id: CrownSlotId;
  pageX: number;
  pageY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  targetScrollY: number;
}

const SLOT_ORDER: CrownSlotId[] = ["hero", "steps", "services", "payments", "cta"];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(t: number) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function TravelingCrownRig({
  isMobile,
  isLowPerformance,
  mousePos,
  scrollPos,
  scrollVelocity,
  slotsRef,
  onCrownScreenUpdate,
}: {
  isMobile: boolean;
  isLowPerformance: boolean;
  mousePos: React.MutableRefObject<[number, number]>;
  scrollPos: React.MutableRefObject<number>;
  scrollVelocity: React.MutableRefObject<number>;
  slotsRef: React.MutableRefObject<SlotData[]>;
  onCrownScreenUpdate: (rect: { left: number; top: number; width: number; height: number; right: number; bottom: number }) => void;
}) {
  const { camera, size, gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const crownRotRef = useRef<THREE.Group>(null);
  const idleRot = useRef(0);
  const scrollDummy = useRef(0);
  const fpsTimes = useRef<number[]>([]);
  const [internalLowPerf, setInternalLowPerf] = useState(isLowPerformance);

  useFrame((state, delta) => {
    if (!groupRef.current || !crownRotRef.current) return;

    // 1. Adaptive Quality FPS Monitor: if avg FPS < 40 for 2s, step down
    if (!internalLowPerf) {
      const now = performance.now();
      fpsTimes.current.push(now);
      while (fpsTimes.current.length > 0 && fpsTimes.current[0] < now - 2000) {
        fpsTimes.current.shift();
      }
      if (fpsTimes.current.length > 25) {
        const avgFps = fpsTimes.current.length / 2;
        if (avgFps < 40) {
          setInternalLowPerf(true);
        }
      }
    }

    const scrollY = scrollPos.current;
    const vHeight = window.innerHeight || 800;
    const vWidth = window.innerWidth || 1200;
    const totalScrollable = Math.max(1, document.documentElement.scrollHeight - vHeight);
    const totalProgress = Math.min(Math.max(scrollY / totalScrollable, 0), 1);
    scrollDummy.current = totalProgress;

    // 2. Interpolate Position & Scale Between Cached Slots
    const slots = slotsRef.current;
    let targetX = vWidth * 0.5;
    let targetY = vHeight * 0.35;
    let targetSize = isMobile ? 180 : 320;

    if (slots && slots.length > 0) {
      if (scrollY <= slots[0].targetScrollY) {
        // Top before first slot
        const s = slots[0];
        targetX = s.pageX - window.scrollX + s.width * 0.5;
        targetY = s.pageY - scrollY + s.height * 0.5;
        targetSize = Math.max(s.width, s.height);
      } else if (scrollY >= slots[slots.length - 1].targetScrollY) {
        // Below final CTA slot
        const s = slots[slots.length - 1];
        targetX = s.pageX - window.scrollX + s.width * 0.5;
        targetY = s.pageY - scrollY + s.height * 0.5;
        targetSize = Math.max(s.width, s.height);
      } else {
        // Between slot i and i + 1
        for (let i = 0; i < slots.length - 1; i++) {
          const s1 = slots[i];
          const s2 = slots[i + 1];
          if (scrollY >= s1.targetScrollY && scrollY <= s2.targetScrollY) {
            const range = s2.targetScrollY - s1.targetScrollY;
            const rawT = range > 0 ? (scrollY - s1.targetScrollY) / range : 0;
            const t = smoothstep(rawT);

            const s1ViewportX = s1.pageX - window.scrollX + s1.width * 0.5;
            const s1ViewportY = s1.pageY - scrollY + s1.height * 0.5;
            const s2ViewportX = s2.pageX - window.scrollX + s2.width * 0.5;
            const s2ViewportY = s2.pageY - scrollY + s2.height * 0.5;

            targetX = lerp(s1ViewportX, s2ViewportX, t);
            targetY = lerp(s1ViewportY, s2ViewportY, t);
            targetSize = lerp(Math.max(s1.width, s1.height), Math.max(s2.width, s2.height), t);

            // Safe outward gutter clearance during scroll travel (never covers cards, tables, or headings)
            if (vWidth >= 1280) {
              const containerW = 1200;
              const contentRight = (vWidth - containerW) * 0.5 + containerW;

              if (s1.id !== "hero" && s2.id !== "cta") {
                targetSize = Math.min(targetSize, 114);
                targetX = Math.max(targetX, contentRight + targetSize * 0.5 + 14);
              } else if (s1.id === "hero") {
                const heroT = smoothstep(t);
                targetSize = lerp(Math.max(s1.width, s1.height), 114, heroT);
                const gutterX = contentRight + 114 * 0.5 + 14;
                targetX = lerp(s1ViewportX, gutterX, heroT);
              } else if (s2.id === "cta") {
                // Stay in safe right gutter through Benefits & FAQ (t < 0.88)
                if (t < 0.88) {
                  targetSize = Math.min(targetSize, 114);
                  targetX = contentRight + targetSize * 0.5 + 14;
                } else {
                  // In final stretch as CTA approaches, glide gracefully from gutter into centered slot
                  const ctaT = smoothstep((t - 0.88) / 0.12);
                  const gutterX = contentRight + 114 * 0.5 + 14;
                  targetX = lerp(gutterX, s2ViewportX, ctaT);
                  targetSize = lerp(114, Math.max(s2.width, s2.height), ctaT);
                }
              }
            } else {
              // Below 1280px (phones, tablets, small laptops: 320 to 1279px)
              // Travels down the reserved right corridor inside the page with zero intersection
              const crownW = 68;
              const gutterX = vWidth - crownW * 0.5 - 6;
              if (s1.id !== "hero" && s2.id !== "cta") {
                targetSize = Math.min(targetSize, crownW);
                targetX = gutterX;
              } else if (s1.id === "hero") {
                const heroT = smoothstep(t);
                targetSize = lerp(Math.max(s1.width, s1.height), crownW, heroT);
                targetX = lerp(s1ViewportX, gutterX, heroT);
              } else if (s2.id === "cta") {
                if (t < 0.88) {
                  targetSize = Math.min(targetSize, crownW);
                  targetX = gutterX;
                } else {
                  const ctaT = smoothstep((t - 0.88) / 0.12);
                  targetX = lerp(gutterX, s2ViewportX, ctaT);
                  targetSize = lerp(crownW, Math.max(s2.width, s2.height), ctaT);
                }
              }
            }
            break;
          }
        }
      }
    }

    // 3. Map screen-space target (targetX, targetY) to Three.js camera coordinates at z = 0
    const ndcX = (targetX / vWidth) * 2 - 1;
    const ndcY = -(targetY / vHeight) * 2 + 1;

    const camZ = 5.0;
    const fov = 42;
    const worldHeightAtZ0 = 2 * Math.tan((fov * 0.5 * Math.PI) / 180) * camZ;
    const worldWidthAtZ0 = worldHeightAtZ0 * (vWidth / vHeight);

    const worldX = ndcX * (worldWidthAtZ0 * 0.5);
    const worldY = ndcY * (worldHeightAtZ0 * 0.5);

    // Crown base model has ~2.4 unit diameter
    const worldTargetSize = (targetSize / vHeight) * worldHeightAtZ0;
    const targetScale = Math.max(0.2, (worldTargetSize / 2.4) * 0.96);

    // Gentle idle float on mobile & desktop
    idleRot.current += 0.025;
    const idleFloatY = Math.sin(idleRot.current * 1.5) * 0.04;

    // Smooth damp towards target position & scale
    groupRef.current.position.x = THREE.MathUtils.damp(
      groupRef.current.position.x,
      worldX,
      12,
      delta
    );
    groupRef.current.position.y = THREE.MathUtils.damp(
      groupRef.current.position.y,
      worldY + idleFloatY,
      12,
      delta
    );
    const currentScale = groupRef.current.scale.x;
    groupRef.current.scale.setScalar(
      THREE.MathUtils.damp(currentScale, targetScale, 12, delta)
    );

    // 4. Crown Rotation: Exactly ~2 full turns (4*PI) tied to total page scroll + slight tilt
    const [mx, my] = mousePos.current;
    const pointerTiltX = isMobile ? 0 : Math.min(Math.max(-my * 0.06, -0.08), 0.08);
    const pointerTiltY = isMobile ? 0 : Math.min(Math.max(mx * 0.08, -0.09), 0.09);

    const totalScrollTurns = totalProgress * (Math.PI * 4); // 2 full revolutions over page scroll
    const baseTiltX = 0.18 + Math.sin(idleRot.current * 0.6) * 0.03 + pointerTiltX;
    const targetRotY = totalScrollTurns + idleRot.current * 0.15 + pointerTiltY;

    crownRotRef.current.rotation.x = THREE.MathUtils.damp(
      crownRotRef.current.rotation.x,
      baseTiltX,
      6,
      delta
    );
    crownRotRef.current.rotation.y = THREE.MathUtils.damp(
      crownRotRef.current.rotation.y,
      targetRotY,
      8,
      delta
    );
    crownRotRef.current.rotation.z = THREE.MathUtils.damp(
      crownRotRef.current.rotation.z,
      isMobile ? 0 : -mx * 0.03,
      6,
      delta
    );

    // 5. Expose current screen-space projected bounding box via window.__crownRect
    const halfBox = targetSize * 0.5;
    const crownRect = {
      left: targetX - halfBox,
      top: targetY - halfBox,
      right: targetX + halfBox,
      bottom: targetY + halfBox,
      width: targetSize,
      height: targetSize,
    };
    onCrownScreenUpdate(crownRect);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <group ref={crownRotRef}>
        {/* Photorealistic Royal Crown Model */}
        <CrownModel scale={1.05} />
      </group>

      {/* Orbiting Platform Logos Reacting to Scroll Velocity */}
      <group position={[0, -0.15, 0]} scale={0.48}>
        <PlatformRing
          radius={isMobile ? 4.4 : 4.8}
          isMobile={isMobile || internalLowPerf}
          scrollProgress={scrollDummy}
        />
      </group>
    </group>
  );
}

export function TravelingCrownCanvas() {
  const { reduced, canRender3D, lowPower } = useMotionPreference();
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLowPerformance, setIsLowPerformance] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const mousePos = useRef<[number, number]>([0, 0]);
  const scrollPos = useRef(0);
  const scrollVelocity = useRef(0);
  const lastScrollY = useRef(0);
  const slotsRef = useRef<SlotData[]>([]);

  // Update window.__crownRect for test assertions
  const handleCrownScreenUpdate = useCallback((rect: { left: number; top: number; width: number; height: number; right: number; bottom: number }) => {
    if (typeof window !== "undefined") {
      (window as any).__crownRect = rect;
    }
  }, []);

  // Measure and cache all docking slots
  const measureSlots = useCallback(() => {
    if (typeof window === "undefined") return;

    const vHeight = window.innerHeight;
    const measured: SlotData[] = [];

    for (const id of SLOT_ORDER) {
      const candidates = Array.from(
        document.querySelectorAll(`[data-crown-slot="${id}"]`)
      );
      const el =
        candidates.find((c) => {
          const r = c.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }) || candidates[0];
      if (!el) continue;

      const rect = el.getBoundingClientRect();
      const pageY = rect.top + window.scrollY;
      const pageX = rect.left + window.scrollX;
      const width = rect.width || (id === "hero" ? (window.innerWidth < 768 ? 200 : 380) : 120);
      const height = rect.height || width;

      // Target scrollY when this slot is centered in viewport
      const targetScrollY = pageY - (vHeight - height) * 0.5;

      measured.push({
        id,
        pageX,
        pageY,
        width,
        height,
        centerX: pageX + width * 0.5,
        centerY: pageY + height * 0.5,
        targetScrollY: Math.max(0, targetScrollY),
      });
    }

    if (measured.length > 0) {
      slotsRef.current = measured;
    }
  }, []);

  useEffect(() => {
    setIsClient(true);

    const checkViewport = () => {
      const mobile = window.innerWidth < 900;
      setIsMobile(mobile);
      measureSlots();
    };

    checkViewport();

    if (
      typeof navigator !== "undefined" &&
      ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
        ((navigator as any).deviceMemory && (navigator as any).deviceMemory <= 4))
    ) {
      setIsLowPerformance(true);
    }

    // Scroll & Velocity tracking with passive listener (zero layout thrash)
    const handleScroll = () => {
      const curY = window.scrollY;
      scrollVelocity.current = curY - lastScrollY.current;
      lastScrollY.current = curY;
      scrollPos.current = curY;
    };

    const handleResize = () => {
      checkViewport();
    };

    // Pause rendering when tab is hidden
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", handleResize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initial measurements after DOM settles
    const timer1 = setTimeout(measureSlots, 150);
    const timer2 = setTimeout(measureSlots, 600);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [measureSlots]);

  // Pointer tilt tracking on desktop only
  useEffect(() => {
    if (reduced || !canRender3D || isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = [
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      ];
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [reduced, canRender3D, isMobile]);

  // Expose test inspection API
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__onSelectLogo = (id: string) => {
        window.location.assign(`/services?platform=${id}`);
      };
      (window as any).__logoDebug = getLogoGeometryStats;
      (window as any).__sceneDebug = (overrideP?: number) => {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const domProgress = totalHeight > 0 ? window.scrollY / totalHeight : 0;
        const activeP = typeof overrideP === "number" ? overrideP : domProgress;

        return {
          visibleGroups: activeP < 0.25 ? ["hero"] : activeP < 0.7 ? ["pipeline"] : ["closing"],
          platforms: Object.keys(LOGOS),
          colors: ["#FF4D8D", "#D8EC8D", "#7B3FF2", "#FFFFFF"],
          currentProgress: activeP,
          pipelineT: Math.min(Math.max((activeP - 0.25) / 0.45, 0), 1),
          presences: {
            hero: activeP < 0.35 ? 1 : 0,
            pipeline: activeP >= 0.25 && activeP < 0.75 ? 1 : 0,
            closing: activeP >= 0.7 ? 1 : 0,
          },
          slots: slotsRef.current,
        };
      };
    }
  }, []);

  // When prefers-reduced-motion is requested or 3D is not supported, do not mount 3D canvas
  if (!isClient || reduced || !canRender3D) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      style={{
        background: "transparent",
      }}
      aria-hidden="true"
    >
      <Canvas
        dpr={isMobile || lowPower || isLowPerformance ? [1, 1.5] : [1, 2.0]}
        camera={{ position: [0, 0, 5], fov: 42 }}
        frameloop={isVisible ? "always" : "never"}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0); // 100% transparent clear color
        }}
        style={{
          background: "transparent",
          pointerEvents: "none",
        }}
        className="w-full h-full pointer-events-none"
      >
        {/* Brand Lighting: Rim light + directional + ambient */}
        <ambientLight intensity={0.85} color="#f4ffe6" />
        <directionalLight position={[6, 8, 5]} intensity={1.9} color="#fffde8" />
        <directionalLight position={[-6, 4, 3]} intensity={1.2} color="#d8ec8d" />
        {/* Lime Rim Light */}
        <pointLight position={[0, -2, -3]} intensity={2.2} color="#d8ec8d" />
        {/* Subtle Side Ambient Fill */}
        <pointLight position={[3, 2, 4]} intensity={0.9} color="#e8fa7d" />

        <Suspense fallback={null}>
          <Environment resolution={128}>
            <group rotation={[-Math.PI / 3, 0, 1]}>
              <Lightformer
                form="rect"
                intensity={3.2}
                color="#d8ec8d"
                scale={[10, 5, 1]}
                position={[-5, 5, -5]}
                target={[0, 0, 0]}
              />
              <Lightformer
                form="rect"
                intensity={2.8}
                color="#ffffff"
                scale={[8, 4, 1]}
                position={[5, -5, 5]}
                target={[0, 0, 0]}
              />
            </group>
          </Environment>

          <TravelingCrownRig
            isMobile={isMobile}
            isLowPerformance={isLowPerformance}
            mousePos={mousePos}
            scrollPos={scrollPos}
            scrollVelocity={scrollVelocity}
            slotsRef={slotsRef}
            onCrownScreenUpdate={handleCrownScreenUpdate}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
