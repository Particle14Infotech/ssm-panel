"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMotionPreference } from "../motion/useMotionPreference";
import { CrownModel } from "./objects/CrownModel";
import { PlatformRing, PlatformId, LOGOS, getLogoGeometryStats } from "./objects/SocialLogos";

export type CrownSectionTarget = "hero" | "benefits" | "services" | "work" | "pricing" | "faq" | "contact";

function ContainedCrownRig({
  mousePos,
  isLowPerformance,
  isMobile,
  onSelect,
  isIntersecting,
}: {
  mousePos: React.MutableRefObject<[number, number]>;
  isLowPerformance: boolean;
  isMobile: boolean;
  onSelect?: (id: PlatformId) => void;
  isIntersecting: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const crownRotRef = useRef<THREE.Group>(null);
  const rotY = useRef(0);
  const scrollDummy = useRef(0);

  useFrame((_, delta) => {
    if (!isIntersecting || !crownRotRef.current || !groupRef.current) return;

    // Gentle float and rotation
    rotY.current += 0.22 * delta;

    // Subtle pointer parallax tilt
    const [mx, my] = mousePos.current;
    const pointerTiltY = mx * 0.12;
    const pointerTiltX = -my * 0.08;

    crownRotRef.current.rotation.x = THREE.MathUtils.damp(
      crownRotRef.current.rotation.x,
      0.18 + pointerTiltX,
      4,
      delta
    );

    crownRotRef.current.rotation.y = THREE.MathUtils.damp(
      crownRotRef.current.rotation.y,
      rotY.current + pointerTiltY,
      5,
      delta
    );

    crownRotRef.current.rotation.z = THREE.MathUtils.damp(
      crownRotRef.current.rotation.z,
      -mx * 0.05,
      4,
      delta
    );

    // Subtle breathing float on Y
    groupRef.current.position.y = Math.sin(rotY.current * 0.8) * 0.06;
  });

  return (
    <group ref={groupRef} position={[0, -0.05, 0]}>
      <group ref={crownRotRef}>
        <CrownModel scale={0.88} />
      </group>

      {/* Orbiting 3D Social Media Platform Logos */}
      <group position={[0, -0.15, 0]} scale={0.44}>
        <PlatformRing
          radius={isMobile ? 2.3 : 2.9}
          onSelect={onSelect}
          isMobile={isMobile}
          scrollProgress={scrollDummy}
        />
      </group>

      {/* Minimal, restrained lime sparkles contained tightly inside the crown */}
      {!isLowPerformance && (
        <Sparkles
          count={10}
          scale={[1.8, 1.8, 1.8]}
          size={1.0}
          speed={0.12}
          color="#DBEF90"
          opacity={0.20}
        />
      )}
    </group>
  );
}

export function CrownStage() {
  const router = useRouter();
  const { reduced, canRender3D, lowPower } = useMotionPreference();
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLowPerformance, setIsLowPerformance] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef<[number, number]>([0, 0]);

  const handleSelectPlatform = useCallback((id: PlatformId) => {
    router.push(`/services?platform=${id}`);
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__onSelectLogo = handleSelectPlatform;
      (window as any).__logoDebug = getLogoGeometryStats;
      (window as any).__sceneDebug = () => ({
        visibleGroups: ["hero"],
        platforms: Object.keys(LOGOS),
        colors: ["#FF4D8D", "#D8EC8D", "#7B3FF2", "#FFFFFF"],
        currentProgress: 0,
        pipelineT: 0,
        presences: { hero: 1, pipeline: 0, closing: 0 },
      });
    }
  }, [handleSelectPlatform]);

  useEffect(() => {
    setIsClient(true);
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport, { passive: true });

    if (
      typeof navigator !== "undefined" &&
      navigator.hardwareConcurrency &&
      navigator.hardwareConcurrency <= 4
    ) {
      setIsLowPerformance(true);
    }

    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // IntersectionObserver to pause rendering when offscreen
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isClient]);

  // Gentle mouse parallax inside container
  useEffect(() => {
    if (reduced || !canRender3D || isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const inX = (e.clientX - rect.left) / rect.width;
      const inY = (e.clientY - rect.top) / rect.height;
      if (inX >= 0 && inX <= 1 && inY >= 0 && inY <= 1) {
        mousePos.current = [(inX - 0.5) * 2, (0.5 - inY) * 2];
      } else {
        mousePos.current = [0, 0];
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [reduced, canRender3D, isMobile]);

  const shouldUseFallback =
    !isClient || reduced || !canRender3D || isMobile || lowPower;

  if (shouldUseFallback) {
    return (
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] sm:aspect-square max-w-[460px] mx-auto pointer-events-none select-none z-0 flex items-center justify-center overflow-hidden"
        aria-hidden="true"
        data-testid="crown-stage-fallback"
      >
        {/* Soft contained ambient olive glow */}
        <div className="absolute inset-4 bg-[#243100]/25 blur-[90px] rounded-full pointer-events-none" />

        <div className="relative w-[240px] sm:w-[320px] h-[240px] sm:h-[320px] pointer-events-none flex items-center justify-center">
          <Image
            src="/brand/crown-royal@2x.webp"
            alt="SMM Panel 3D royal king's crown emblem"
            width={320}
            height={320}
            priority
            className="w-full h-full object-contain mix-blend-screen pointer-events-none select-none"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] sm:aspect-square max-w-[460px] mx-auto pointer-events-none select-none z-0 overflow-hidden"
      aria-hidden="true"
      data-testid="crown-stage-container"
    >
      {/* Soft contained ambient olive glow strictly inside stage */}
      <div className="absolute inset-6 bg-[#243100]/20 blur-[100px] rounded-full pointer-events-none -z-10" />

      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 4.5], fov: 42 }}
        frameloop={isIntersecting ? "always" : "never"}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
        }}
        className="w-full h-full pointer-events-none"
      >
        <ambientLight intensity={0.8} color="#f4ffe6" />
        <directionalLight position={[5, 6, 4]} intensity={1.8} color="#fffde8" />
        <directionalLight position={[-5, 3, 2]} intensity={1.1} color="#d4f768" />
        <pointLight position={[2, 1, 3]} intensity={1.0} color="#e8fa7d" />
        <pointLight position={[-3, 2, -1]} intensity={0.7} color="#90e628" />

        <ContainedCrownRig
          mousePos={mousePos}
          isLowPerformance={isLowPerformance}
          isMobile={isMobile}
          onSelect={handleSelectPlatform}
          isIntersecting={isIntersecting}
        />
      </Canvas>
    </div>
  );
}
