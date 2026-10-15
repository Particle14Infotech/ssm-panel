"use client";

import React, { useRef, useEffect, useState, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import { useMotionPreference } from "../motion/useMotionPreference";
import { DepthPlane } from "./CrownDepth";
import {
  PlatformRing,
  SocialChip,
  LOGOS,
  PlatformId,
  getLogoGeometryStats,
} from "./objects/SocialLogos";
import { FloatingMarginGlyphs } from "./objects/GenericGlyphs";
import { OrderJourney } from "./objects/OrderJourney";
import { stageStore, type StageId } from "./stage";

gsap.registerPlugin(ScrollTrigger);

// Stage presence calculation: 1. Hero -> 2. Pipeline (How It Works) -> 3. Closing
function computePresences(p: number) {
  // 1. Hero: 0.0 -> 0.35 (crossfade 0.25 -> 0.35)
  let hero = 0;
  if (p <= 0.25) hero = 1;
  else if (p < 0.35) hero = 1 - (p - 0.25) / 0.10;

  // 2. Pipeline (Order Journey): 0.25 -> 0.80 (crossfade in 0.25->0.35, out 0.70->0.80)
  let pipeline = 0;
  if (p >= 0.25 && p < 0.35) pipeline = (p - 0.25) / 0.10;
  else if (p >= 0.35 && p <= 0.70) pipeline = 1;
  else if (p > 0.70 && p < 0.80) pipeline = 1 - (p - 0.70) / 0.10;

  // 3. Closing: 0.70 -> 1.0 (crossfade in 0.70->0.80)
  let closing = 0;
  if (p >= 0.70 && p < 0.80) closing = (p - 0.70) / 0.10;
  else if (p >= 0.80) closing = 1;

  return {
    hero: THREE.MathUtils.clamp(hero, 0, 1),
    pipeline: THREE.MathUtils.clamp(pipeline, 0, 1),
    closing: THREE.MathUtils.clamp(closing, 0, 1),
  };
}

function SceneController({
  scrollProgress,
  mousePos,
  onFirstRender,
  isMobile,
  onSelectPlatform,
}: {
  scrollProgress: { current: number };
  mousePos: { current: [number, number] };
  onFirstRender: () => void;
  isMobile: boolean;
  onSelectPlatform: (id: PlatformId) => void;
}) {
  const { camera } = useThree();
  const renderedRef = useRef(false);
  const [presences, setPresences] = useState({ hero: 1, pipeline: 0, closing: 0 });

  const platformIds = useMemo(() => Object.keys(LOGOS) as PlatformId[], []);

  useFrame((state) => {
    if (!renderedRef.current) {
      renderedRef.current = true;
      onFirstRender();
    }

    const p = scrollProgress.current;
    const [targetX, targetY] = mousePos.current;

    // Camera position & parallax (responsive, zero lag)
    const targetZ = THREE.MathUtils.lerp(6, 4.8, p);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.12);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX * 0.25, 0.1);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, -targetY * 0.18, 0.1);
    camera.lookAt(0, 0, 0);

    // Update stages and pipeline timeline (t: 0 -> 1 across pipeline section)
    const currentPresences = computePresences(p);
    setPresences(currentPresences);

    const pipeT = THREE.MathUtils.clamp((p - 0.32) / 0.40, 0, 1);
    stageStore.setPipelineT(pipeT);
    stageStore.setStage(
      currentPresences.hero > 0.5 ? "hero" : currentPresences.pipeline > 0.5 ? "pipeline" : "closing"
    );

    // Debug API for verification assertions
    if (typeof window !== "undefined") {
      (window as any).__onSelectLogo = onSelectPlatform;
      (window as any).__logoDebug = getLogoGeometryStats;

      (window as any).__sceneDebug = (overrideP?: number) => {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const domProgress = totalHeight > 0 ? window.scrollY / totalHeight : 0;
        const activeP =
          typeof overrideP === "number"
            ? overrideP
            : scrollProgress.current > 0
            ? scrollProgress.current
            : domProgress;

        const computed = computePresences(activeP);
        const visibleGroups: string[] = [];
        if (computed.hero > 0.01) visibleGroups.push("hero");
        if (computed.pipeline > 0.01) visibleGroups.push("pipeline");
        if (computed.closing > 0.01) visibleGroups.push("closing");

        return {
          visibleGroups,
          platforms: platformIds,
          colors: ["#FF4D8D", "#D8EC8D", "#7B3FF2", "#FFFFFF"],
          currentProgress: activeP,
          pipelineT: THREE.MathUtils.clamp((activeP - 0.32) / 0.40, 0, 1),
          presences: computed,
        };
      };
    }
  });

  return (
    <>
      {/* Brand Color Lighting (Pink, Lime, Purple, White) */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[10, 10, 5]} intensity={1.6} color="#FFFFFF" />
      <pointLight position={[-8, -5, -4]} intensity={2.8} color="#FF4D8D" />
      <pointLight position={[8, -8, 6]} intensity={2.2} color="#D8EC8D" />
      <pointLight position={[0, 10, -5]} intensity={2.0} color="#7B3FF2" />

      <Suspense fallback={null}>
        {/* Brand Environment with Lightformers */}
        <Environment resolution={256}>
          <group rotation={[-Math.PI / 3, 0, 1]}>
            <Lightformer
              form="rect"
              intensity={3.5}
              color="#1877F2"
              scale={[10, 5, 1]}
              position={[-5, 5, -5]}
              target={[0, 0, 0]}
            />
            <Lightformer
              form="rect"
              intensity={4.0}
              color="#D8EC8D"
              scale={[10, 5, 1]}
              position={[5, -5, 5]}
              target={[0, 0, 0]}
            />
            <Lightformer
              form="ring"
              intensity={2.8}
              color="#7B3FF2"
              scale={8}
              position={[0, 8, -2]}
              target={[0, 0, 0]}
            />
          </group>
        </Environment>

        {/* Margin Glyphs (Generic platform glyphs, strictly in margins, max 2) */}
        <FloatingMarginGlyphs isMobile={isMobile} />

        {/* 1. Hero Stage: Platform logos circling directly around the centered Crown */}
        {presences.hero > 0.01 && (
          <group position={[0, -2.15, 0.2]} scale={isMobile ? 0.6 : 0.78}>
            <PlatformRing
              radius={isMobile ? 2.5 : 3.55}
              onSelect={onSelectPlatform}
              isMobile={isMobile}
            />
          </group>
        )}

        {/* 2. Pipeline Stage: 5-Step Order Journey (Desktop: right 55%, Mobile: top 40vh scale 0.7) */}
        {presences.pipeline > 0.01 && (
          <group
            position={isMobile ? [0, 1.2, 0] : [1.4, -0.2, 0]}
            scale={isMobile ? 0.6 : 0.85}
          >
            <OrderJourney />
          </group>
        )}

        {/* 3. Closing Stage: Depth-Crown (matching Hero Image 1) + 3 Small Static Logo Chips */}
        {presences.closing > 0.01 && (
          <group position={[isMobile ? 0 : 2.0, -0.5, -1.0]}>
            <DepthPlane mousePos={mousePos} size="card" />
            <group position={[0, -1.2, 0.4]} scale={0.45}>
              <group position={[-1.2, 0, 0]}>
                <SocialChip id="instagram" tintIndex={0} />
              </group>
              <group position={[0, 0, 0]}>
                <SocialChip id="youtube" tintIndex={1} />
              </group>
              <group position={[1.2, 0, 0]}>
                <SocialChip id="telegram" tintIndex={2} />
              </group>
            </group>
          </group>
        )}

      </Suspense>
    </>
  );
}

export function Landing3DCanvas() {
  const { canRender3D, reduced, lowPower } = useMotionPreference();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const scrollProgress = useRef({ current: 0 });
  const mousePos = useRef<[number, number]>([0, 0]);
  const handleSelectPlatform = (id: PlatformId) => {
    if (typeof window !== "undefined") {
      window.location.assign(`/services?platform=${id}`);
    }
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (reduced || !canRender3D) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = [
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      ];
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    const st = ScrollTrigger.create({
      start: "top top",
      end: "bottom bottom",
      scrub: 0.15,
      onUpdate: (self) => {
        scrollProgress.current.current = self.progress;
      },
    });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      st.kill();
    };
  }, [canRender3D, reduced]);

  if (reduced || !canRender3D) {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-tr from-[#FF4D8D]/15 via-[#D8EC8D]/10 to-[#7B3FF2]/10 blur-[140px] rounded-full" />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Static poster fading out immediately on first frame */}
      <div
        className={`absolute inset-0 bg-[#0e0e0e] transition-opacity duration-200 pointer-events-none z-20 ${
          isLoaded ? "opacity-0" : "opacity-100"
        }`}
      />

      <Canvas
        dpr={lowPower || isMobile ? [1, 1] : [1, 1.35]}
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        className="w-full h-full"
      >
        <SceneController
          scrollProgress={scrollProgress.current}
          mousePos={mousePos}
          onFirstRender={() => setIsLoaded(true)}
          isMobile={isMobile}
          onSelectPlatform={handleSelectPlatform}
        />
      </Canvas>
    </div>
  );
}
