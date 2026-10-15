"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMotionPreference } from "../motion/useMotionPreference";
import { CrownModel } from "./objects/CrownModel";
import { FloatingMarginGlyphs } from "./objects/GenericGlyphs";
import { PlatformRing, PlatformId, LOGOS, getLogoGeometryStats } from "./objects/SocialLogos";

gsap.registerPlugin(ScrollTrigger);

export interface CrownSectionTarget {
  xPct: number;
  yPct: number;
  scale: number;
  opacity: number;
}

const SECTION_TARGETS: Record<string, CrownSectionTarget> = {
  right: { xPct: 0.72, yPct: 0.42, scale: 1.0, opacity: 1.0 },
  left: { xPct: 0.28, yPct: 0.5, scale: 1.0, opacity: 1.0 },
  center: { xPct: 0.5, yPct: 0.5, scale: 0.7, opacity: 0.5 },
  dim: { xPct: 0.5, yPct: 0.5, scale: 0.8, opacity: 0.15 },
};

/**
 * Desktop-only Bloom postprocessing using EffectComposer & UnrealBloomPass
 * Luminance threshold: 0.25, intensity: 0.9
 */
function DesktopBloom() {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.renderToScreen = true;

    const renderPass = new RenderPass(scene, camera);
    renderPass.clearAlpha = 0;
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.65,  // soft luminous bloom matching the reference halo
      0.45,  // radius
      0.72   // luminanceThreshold
    );
    composer.addPass(bloomPass);

    composerRef.current = composer;

    return () => {
      composer.dispose();
      composerRef.current = null;
    };
  }, [gl, scene, camera, size.width, size.height]);

  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render();
    }
  }, 1);

  return null;
}

function CrownRig({
  mousePos,
  scrollProgress,
  scrollVelocity,
  currentTarget,
  isLowPerformance,
  isMobile,
  onSelect,
}: {
  mousePos: React.MutableRefObject<[number, number]>;
  scrollProgress: React.MutableRefObject<number>;
  scrollVelocity: React.MutableRefObject<number>;
  currentTarget: React.MutableRefObject<CrownSectionTarget>;
  isLowPerformance: boolean;
  isMobile: boolean;
  onSelect?: (id: PlatformId) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const crownRotRef = useRef<THREE.Group>(null);
  const opacityRef = useRef(1);
  const { viewport } = useThree();

  // Rotation states
  const rotY = useRef(0);
  const prevP = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current || !crownRotRef.current) return;

    // 1. Position & Scale tweening based on current target
    const target = currentTarget.current;
    // Map xPct (0 -> 1) to viewport 3D coordinates: (-viewport.width/2 to +viewport.width/2)
    const target3dX = (target.xPct - 0.5) * viewport.width;
    const target3dY = (0.5 - target.yPct) * viewport.height;
    const targetScale = target.scale * (viewport.width < 8 ? 0.7 : 1.15);

    groupRef.current.position.x = THREE.MathUtils.damp(
      groupRef.current.position.x,
      target3dX,
      3.5,
      delta
    );
    groupRef.current.position.y = THREE.MathUtils.damp(
      groupRef.current.position.y,
      target3dY,
      3.5,
      delta
    );
    groupRef.current.position.z = THREE.MathUtils.damp(
      groupRef.current.position.z,
      0,
      3.5,
      delta
    );
    groupRef.current.scale.setScalar(
      THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, 3.5, delta)
    );

    // 2. Controlled Multi-Axis Rotation & Fluid Scroll Response
    // Idle gentle spin: 0.18 rad/s
    const idleDelta = 0.18 * delta;

    // Scroll coupling: full 360-degree rotation across page scroll + velocity response
    const currentP = scrollProgress.current;
    const scrollDelta = (currentP - prevP.current) * Math.PI * 4;
    prevP.current = currentP;

    // Smooth scroll velocity influence
    const v = scrollVelocity.current;

    // Cap angular velocity to ensure buttery smoothness without erratic spinning
    const maxAngularDelta = 0.4;
    const clampedScrollDelta = THREE.MathUtils.clamp(
      scrollDelta,
      -maxAngularDelta,
      maxAngularDelta
    );

    rotY.current += idleDelta + clampedScrollDelta;

    // Pointer parallax tilt (horizontal: Y-axis rotation, vertical: subtle banking)
    const [mx, my] = mousePos.current;
    const pointerTiltY = mx * 0.14; // subtle mouse yaw
    const pointerTiltX = -my * 0.08; // subtle mouse pitch

    // Dynamic bank on rapid scroll (rolls slightly into scroll direction)
    const scrollRoll = THREE.MathUtils.clamp(v * 0.04, -0.15, 0.15);

    // X tilt: 8 deg base tilt (0.14 rad) matching the exact reference angle where front spikes sit lower than back peaks
    crownRotRef.current.rotation.x = THREE.MathUtils.damp(
      crownRotRef.current.rotation.x,
      0.14 + pointerTiltX,
      4,
      delta
    );

    // Y rotation: idle + scroll delta + pointer tilt
    crownRotRef.current.rotation.y = THREE.MathUtils.damp(
      crownRotRef.current.rotation.y,
      rotY.current + pointerTiltY,
      5,
      delta
    );

    // Z rotation: dynamic scroll banking roll + pointer banking
    crownRotRef.current.rotation.z = THREE.MathUtils.damp(
      crownRotRef.current.rotation.z,
      scrollRoll - mx * 0.06,
      4,
      delta
    );

    // 3. Opacity damp
    opacityRef.current = THREE.MathUtils.damp(
      opacityRef.current,
      target.opacity,
      4,
      delta
    );

    // Apply opacity to children materials
    crownRotRef.current.traverse((child: any) => {
      if (child.isMesh && child.material) {
        if (child.material.transparent) {
          child.material.opacity = (child.userData.baseOpacity ?? 0.5) * opacityRef.current;
        }
      }
      if (child.isLineSegments && child.material) {
        child.material.opacity = (child.userData.baseOpacity ?? 0.95) * opacityRef.current;
      }
    });
  });

  return (
    <group ref={groupRef}>
      <group ref={crownRotRef}>
        <CrownModel scale={1.35} />
      </group>

      {/* Real 3D Social Media Platform Logos Orbiting around Crown Base */}
      <group position={[0, -1.3, 0]} scale={0.55}>
        <PlatformRing
          radius={isMobile ? 2.8 : 3.4}
          onSelect={onSelect}
          isMobile={isMobile}
        />
      </group>

      {/* Tiny floating lime sparkles: count 30, size 2, speed 0.2, color #DBEF90, opacity 0.4 */}
      {!isLowPerformance && (
        <Sparkles
          count={30}
          scale={[2.5, 2.5, 2.5]}
          size={2}
          speed={0.2}
          color="#DBEF90"
          opacity={0.4}
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

  const mousePos = useRef<[number, number]>([0, 0]);
  const scrollProgress = useRef(0);
  const scrollVelocity = useRef(0);
  const currentTarget = useRef<CrownSectionTarget>(SECTION_TARGETS.right);

  const handleSelectPlatform = (id: PlatformId) => {
    router.push(`/services?platform=${id}`);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__onSelectLogo = handleSelectPlatform;
      (window as any).__logoDebug = getLogoGeometryStats;
      (window as any).__sceneDebug = (overrideP?: number) => {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const domProgress = totalHeight > 0 ? window.scrollY / totalHeight : 0;
        const activeP = typeof overrideP === "number" ? overrideP : scrollProgress.current > 0 ? scrollProgress.current : domProgress;
        return {
          visibleGroups: ["hero"],
          platforms: Object.keys(LOGOS),
          colors: ["#FF4D8D", "#D8EC8D", "#7B3FF2", "#FFFFFF"],
          currentProgress: activeP,
          pipelineT: THREE.MathUtils.clamp((activeP - 0.32) / 0.40, 0, 1),
          presences: { hero: 1, pipeline: 0, closing: 0 },
        };
      };
    }
  }, []);

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

  // Pointer & Scroll coupling with GSAP ScrollTrigger
  useEffect(() => {
    if (reduced || !canRender3D || isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = [
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      ];
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    let lastScrollY = window.scrollY;
    let lastScrollTime = performance.now();

    // ScrollTrigger to read data-crown attribute from landing sections
    const triggers: ScrollTrigger[] = [];
    const sections = document.querySelectorAll("[data-crown]");

    sections.forEach((sec) => {
      const mode = (sec.getAttribute("data-crown") || "right") as keyof typeof SECTION_TARGETS;
      const targetConfig = SECTION_TARGETS[mode] || SECTION_TARGETS.right;

      const trigger = ScrollTrigger.create({
        trigger: sec,
        start: "top 60%",
        end: "bottom 40%",
        onEnter: () => {
          currentTarget.current = targetConfig;
        },
        onEnterBack: () => {
          currentTarget.current = targetConfig;
        },
      });
      triggers.push(trigger);
    });

    // Page overall scroll tracking
    const overallTrigger = ScrollTrigger.create({
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6,
      onUpdate: (self) => {
        scrollProgress.current = self.progress;

        const now = performance.now();
        const dt = (now - lastScrollTime) / 1000;
        const currentY = window.scrollY;
        if (dt > 0.01) {
          const dy = currentY - lastScrollY;
          scrollVelocity.current = THREE.MathUtils.clamp(dy / (dt * 1000), -5, 5);
          lastScrollY = currentY;
          lastScrollTime = now;
        }
      },
    });
    triggers.push(overallTrigger);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      triggers.forEach((t) => t.kill());
    };
  }, [reduced, canRender3D, isMobile]);

  // Fallback check: static crown.webp for reduced motion, mobile under 768 px, no WebGL
  const shouldUseFallback =
    !isClient || reduced || !canRender3D || isMobile || lowPower;

  if (shouldUseFallback) {
    return (
      <div
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        aria-hidden="true"
        data-testid="crown-stage-fallback"
      >
        {/* Ambient subtle glow */}
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-[#243100]/25 blur-[140px] rounded-full pointer-events-none" />

        {/* Mobile/Reduced-motion static image shown once in Hero only without rectangular box */}
        <div
          className="absolute top-28 right-4 sm:right-12 w-[280px] sm:w-[340px] h-[280px] sm:h-[340px] pointer-events-none flex items-center justify-center"
          style={{
            maskImage: "radial-gradient(closest-side, #000 64%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(closest-side, #000 64%, transparent 100%)",
          }}
        >
          <Image
            src="/brand/crown@2x.webp"
            alt="SMM Panel 3D metallic crown emblem"
            width={340}
            height={340}
            priority
            className="w-full h-full object-contain mix-blend-screen pointer-events-none"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-black"
      aria-hidden="true"
      data-testid="crown-stage-container"
    >
      {/* Delicate dark olive haze behind crown */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#243100]/20 blur-[160px] rounded-full pointer-events-none -z-10" />

      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 4.8], fov: 42 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        className="w-full h-full"
      >
        {/* Ambient & directional lighting with studio glass highlights */}
        <ambientLight intensity={0.7} color="#ffffff" />
        <directionalLight position={[6, 9, 6]} intensity={2.0} color="#f0fec2" />
        <directionalLight position={[-6, 4, 3]} intensity={1.3} color="#bef264" />
        <pointLight position={[0, -2, 2]} intensity={2.0} color="#243100" />
        <pointLight position={[-4, 4, -2]} intensity={1.4} color="#BEF264" />

        {/* Floating generic margin glyphs */}
        <FloatingMarginGlyphs isMobile={isMobile} />

        {/* Animated & Scroll-Coupled Crown Rig with Orbiting Platform Logos */}
        <CrownRig
          mousePos={mousePos}
          scrollProgress={scrollProgress}
          scrollVelocity={scrollVelocity}
          currentTarget={currentTarget}
          isLowPerformance={isLowPerformance}
          isMobile={isMobile}
          onSelect={handleSelectPlatform}
        />

        {/* Bloom postprocessing (desktop only, lowPower disabled) */}
        {!isLowPerformance && !isMobile && <DesktopBloom />}
      </Canvas>
    </div>
  );
}
