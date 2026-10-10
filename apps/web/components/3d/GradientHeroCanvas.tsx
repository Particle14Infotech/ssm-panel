"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Float } from "@react-three/drei";
import * as THREE from "three";

function AnimatedMeshOrb({ isHovered }: { isHovered: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.x = t * 0.12;
    meshRef.current.rotation.y = t * 0.18;
    
    if (materialRef.current) {
      materialRef.current.distort = THREE.MathUtils.lerp(
        materialRef.current.distort,
        isHovered ? 0.55 : 0.38,
        0.05
      );
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.6} floatIntensity={0.8}>
      <mesh ref={meshRef} scale={2.4}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          ref={materialRef}
          color="#ffafd5"
          emissive="#bd0183"
          emissiveIntensity={0.4}
          roughness={0.15}
          metalness={0.85}
          distort={0.4}
          speed={2.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>
    </Float>
  );
}

function FallbackStaticVisual() {
  return (
    <div className="relative w-full h-full min-h-[380px] flex items-center justify-center pointer-events-none">
      <div className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-[#bd0183] via-[#ffafd5] to-[#ffd5e6] opacity-60 blur-3xl animate-pulse-slow" />
      <div className="relative w-56 h-56 rounded-full bg-gradient-to-br from-[#ffd5e6]/80 via-[#ffafd5]/60 to-[#bd0183] border border-white/30 shadow-[0_0_50px_rgba(189,1,131,0.4)] backdrop-blur-md flex items-center justify-center">
        <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-[#201f1f] to-[#353534] border border-white/20 flex items-center justify-center">
          <span className="text-[#d8ec8d] font-bold text-2xl tracking-widest font-mono">✦ AETHER</span>
        </div>
      </div>
    </div>
  );
}

export function GradientHeroCanvas() {
  const [mounted, setMounted] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    // Check prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReducedMotion(true);
    }

    // Check WebGL availability
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) {
        setHasWebGL(false);
      }
    } catch (e) {
      setHasWebGL(false);
    }

    // Intersection Observer to pause when off-screen
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  if (!mounted || reducedMotion || !hasWebGL) {
    return (
      <div ref={containerRef} className="w-full h-full min-h-[380px]">
        <FallbackStaticVisual />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] cursor-grab active:cursor-grabbing"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background ambient light mesh */}
      <div className="absolute inset-0 pointer-events-none bg-radial-glow flex items-center justify-center">
        <div className="w-80 h-80 rounded-full bg-[#bd0183]/20 blur-[90px]" />
        <div className="w-64 h-64 rounded-full bg-[#d8ec8d]/15 blur-[80px]" />
      </div>

      {isVisible && (
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 5.5], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          className="w-full h-full"
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffffff" />
          <pointLight position={[-10, -10, -5]} intensity={2} color="#bd0183" />
          <pointLight position={[5, -5, 5]} intensity={1.5} color="#d8ec8d" />

          <Suspense fallback={null}>
            <AnimatedMeshOrb isHovered={isHovered} />
          </Suspense>
        </Canvas>
      )}

      {/* Interactive Micro Badge */}
      <div className="absolute bottom-4 right-4 z-10 px-3 py-1.5 rounded-full bg-surface-container-low/80 backdrop-blur-md border border-white/10 text-xs font-mono text-[#d8ec8d] flex items-center gap-2 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-[#d8ec8d] animate-ping" />
        <span>Shader Dynamic Mesh • 60 FPS</span>
      </div>
    </div>
  );
}
