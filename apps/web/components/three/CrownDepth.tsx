"use client";

import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { Sparkles } from "@react-three/drei";
import Image from "next/image";
import { useMotionPreference } from "../motion/useMotionPreference";

export interface CrownDepthProps {
  size?: "hero" | "card";
  className?: string;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uColorMap;
  uniform sampler2D uDepthMap;
  uniform vec2 uPointer;
  uniform float uStrength;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    // 1. Idle sway (+/- 0.01 UV with 8s period)
    float idleX = sin(uTime * 0.785) * 0.007;
    float idleY = cos(uTime * 0.785) * 0.005;

    // 2. Sample depth map to calculate parallax displacement
    vec4 depthTex = texture2D(uDepthMap, vUv);
    float depth = depthTex.r;

    // 3. Offset UV by (depth - 0.5) * strength * pointerVector
    vec2 parallax = (depth - 0.5) * uStrength * (uPointer + vec2(idleX, idleY));
    vec2 displacedUv = clamp(vUv + parallax, 0.0, 1.0);

    // 4. Sample pure original color without color distortion
    vec4 color = texture2D(uColorMap, displacedUv);

    gl_FragColor = color;
  }
`;

export function DepthPlane({
  mousePos,
  size = "hero",
  onReady,
}: {
  mousePos: React.MutableRefObject<[number, number]>;
  size?: "hero" | "card";
  onReady?: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const colorMap = useLoader(THREE.TextureLoader, "/brand/crown.webp");
  const depthMap = useLoader(THREE.TextureLoader, "/brand/crown-depth.webp");

  useEffect(() => {
    if (colorMap && depthMap) {
      colorMap.minFilter = THREE.LinearFilter;
      colorMap.magFilter = THREE.LinearFilter;
      depthMap.minFilter = THREE.LinearFilter;
      depthMap.magFilter = THREE.LinearFilter;
      onReady?.();
    }
  }, [colorMap, depthMap, onReady]);

  const uniforms = useMemo(() => {
    return {
      uColorMap: { value: colorMap },
      uDepthMap: { value: depthMap },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uStrength: { value: 0.025 },
      uTime: { value: 0 },
    };
  }, [colorMap, depthMap]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const [tx, ty] = mousePos.current;

    // Smoothly damp pointer coordinates for silky parallax
    const targetX = tx * 0.8;
    const targetY = ty * 0.8;

    uniforms.uPointer.value.x = THREE.MathUtils.damp(
      uniforms.uPointer.value.x,
      targetX,
      6,
      delta
    );
    uniforms.uPointer.value.y = THREE.MathUtils.damp(
      uniforms.uPointer.value.y,
      targetY,
      6,
      delta
    );
    const elapsedTime = state.clock.getElapsedTime();
    uniforms.uTime.value = elapsedTime;

    // Continuous 3D rotation and organic sway
    meshRef.current.rotation.y = Math.sin(elapsedTime * 0.5) * 0.18 + (targetX * 0.15);
    meshRef.current.rotation.x = Math.cos(elapsedTime * 0.4) * 0.08 - (targetY * 0.12);
    meshRef.current.rotation.z = Math.sin(elapsedTime * 0.3) * 0.04;
  });

  const planeSize = size === "hero" ? 5.2 : 3.8;

  return (
    <group>
      <mesh ref={meshRef}>
        <planeGeometry args={[planeSize, planeSize, 32, 32]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent={true}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Delicate floating ambient sparkles */}
      <Sparkles
        count={30}
        scale={[planeSize * 0.9, planeSize * 0.9, 1.5]}
        size={2}
        speed={0.25}
        color="#DBEF90"
        opacity={0.4}
      />
    </group>
  );
}

export function CrownDepth({ size = "hero", className = "" }: CrownDepthProps) {
  const { reduced, canRender3D } = useMotionPreference();
  const [isClient, setIsClient] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLowPower, setIsLowPower] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const mousePos = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    setIsClient(true);
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport, { passive: true });

    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
      setIsLowPower(true);
    }

    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // IntersectionObserver to pause rendering when offscreen
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
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

  const shouldUseStaticOnly = !isClient || reduced || !canRender3D || isMobile || isLowPower;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative select-none flex items-center justify-center ${className}`}
      style={{
        maskImage: "radial-gradient(closest-side, #000 62%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(closest-side, #000 62%, transparent 100%)",
      }}
    >
      {/* Soft olive radial glow behind it */}
      <div className="absolute inset-0 bg-[#243100]/35 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Static Image (Loaded first for 0 layout shift and instant LCP) */}
      <Image
        src="/brand/crown.webp"
        alt="SMM Panel Glass Crown"
        width={size === "hero" ? 640 : 380}
        height={size === "hero" ? 640 : 380}
        priority={size === "hero"}
        className={`w-full h-full object-contain mix-blend-screen transition-opacity duration-700 pointer-events-none ${
          canvasReady && !shouldUseStaticOnly ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* R3F Depth-Parallax Canvas */}
      {!shouldUseStaticOnly && (
        <div
          className={`absolute inset-0 transition-opacity duration-700 mix-blend-screen ${
            canvasReady ? "opacity-100" : "opacity-0"
          }`}
        >
          <Canvas
            dpr={[1, 1.5]}
            frameloop={isVisible ? "always" : "demand"}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
            }}
            camera={{ position: [0, 0, 5], fov: 45 }}
            className="w-full h-full pointer-events-none"
          >
            <React.Suspense fallback={null}>
              <DepthPlane
                mousePos={mousePos}
                size={size}
                onReady={() => setCanvasReady(true)}
              />
            </React.Suspense>
          </Canvas>
        </div>
      )}
    </div>
  );
}
