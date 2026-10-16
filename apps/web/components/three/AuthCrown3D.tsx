"use client";

import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import Image from "next/image";
import { useMotionPreference } from "../motion/useMotionPreference";
import { CrownModel } from "./objects/CrownModel";
import { PlatformRing } from "./objects/SocialLogos";

/**
 * 3D Crown Rig for Auth / Standalone Viewports
 * Rotates smoothly in 3D with idle drift and mouse parallax
 */
function AuthCrownRig({
  mousePos,
  intensity = 1,
}: {
  mousePos: React.MutableRefObject<[number, number]>;
  intensity?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const crownRotRef = useRef<THREE.Group>(null);
  const rotY = useRef(0);

  useFrame((_, delta) => {
    if (!crownRotRef.current || !groupRef.current) return;

    // Smooth continuous 3D rotation
    rotY.current += 0.35 * delta;

    const [mx, my] = mousePos.current;

    // Smooth mouse tilt & parallax
    crownRotRef.current.rotation.y = THREE.MathUtils.damp(
      crownRotRef.current.rotation.y,
      rotY.current + mx * 0.45,
      4,
      delta
    );

    // Frontal tilt towards camera (approx 18 degrees + subtle mouse Y tilt)
    crownRotRef.current.rotation.x = THREE.MathUtils.damp(
      crownRotRef.current.rotation.x,
      0.32 - my * 0.25,
      4,
      delta
    );

    // Slight bank on X movement
    crownRotRef.current.rotation.z = THREE.MathUtils.damp(
      crownRotRef.current.rotation.z,
      -mx * 0.12,
      4,
      delta
    );
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.2}>
        <group ref={crownRotRef} position={[0, -0.05, 0]}>
          <CrownModel scale={0.78} />
        </group>
      </Float>

      {/* Orbiting 3D Social Logos with safe, unclipped radius inside the boundary */}
      <group position={[0, -0.15, 0]} scale={0.44}>
        <PlatformRing radius={2.8} isMobile={false} />
      </group>

      {/* Radiant particle sparkle field around the crown */}
      <Sparkles
        count={20}
        scale={[2.5, 2.5, 2.5]}
        size={1.6}
        speed={0.18}
        color="#DBEF90"
        opacity={0.35}
      />
    </group>
  );
}

export function AuthCrown3D({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { reduced, canRender3D, lowPower } = useMotionPreference();
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    setIsClient(true);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    mousePos.current = [x, y];
  };

  const handleMouseLeave = () => {
    mousePos.current = [0, 0];
  };

  const shouldUseFallback = !isClient || reduced || !canRender3D || lowPower;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative select-none flex items-center justify-center ${className}`}
    >
      {/* Radial soft blue atmospheric backlight */}
      <div className="absolute inset-0 bg-blue-600/15 blur-[80px] rounded-full pointer-events-none -z-10" />

      {shouldUseFallback ? (
        <div className="w-full h-full flex items-center justify-center p-4">
          <Image
            src="/brand/crown@2x.webp"
            alt="SMM Panel 3D Glass Crown emblem"
            width={400}
            height={400}
            priority
            className="w-full h-full object-contain mix-blend-screen drop-shadow-[0_0_40px_rgba(37,99,235,0.25)] pointer-events-none"
          />
        </div>
      ) : (
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 5.4], fov: 36 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.15,
          }}
          className="w-full h-full pointer-events-none"
        >
          {/* Studio specular rim & fill lighting */}
          <ambientLight intensity={0.65} color="#ffffff" />
          {/* Key bright light from top-right */}
          <directionalLight position={[6, 9, 6]} intensity={2.2} color="#f0f9ff" />
          {/* Secondary fill light from front-left */}
          <directionalLight position={[-6, 4, 3]} intensity={1.4} color="#93c5fd" />
          {/* Sharp rim backlight for glass edge dispersion */}
          <directionalLight position={[0, -5, -4]} intensity={2.0} color="#1d4ed8" />
          {/* Subtle cool underglow */}
          <pointLight position={[0, -2, 2]} intensity={2.5} color="#1e3a8a" />

          <React.Suspense fallback={null}>
            <AuthCrownRig mousePos={mousePos} />
          </React.Suspense>
        </Canvas>
      )}
    </div>
  );
}
