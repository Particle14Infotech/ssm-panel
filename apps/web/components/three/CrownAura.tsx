"use client";

import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import Image from "next/image";

export interface CrownAuraProps {
  size?: "hero" | "card" | "icon";
  intensity?: number;
  interactive?: boolean;
  presence?: number;
  mousePos?: { current: [number, number] };
  calm?: boolean;
  className?: string;
}

/**
 * Procedural Real 3D Glass Crown geometry & materials matching the reference:
 * - 5 tall front spikes (middle one tallest)
 * - 4 shorter spikes behind
 * - 8-sided faceted bowl base (LatheGeometry)
 * - Translucent #DBEF90 glass with deep #243100 to #0b1200 olive core
 * - Bright glowing lime edge wireframe highlights and glowing tips
 */
export function CrownMesh({
  intensity = 1,
  presence = 1,
  mousePos,
  calm = false,
  scale = 1,
}: {
  intensity?: number;
  presence?: number;
  mousePos?: { current: [number, number] };
  calm?: boolean;
  scale?: number;
}) {
  const crownGroupRef = useRef<THREE.Group>(null);

  // 1. Base bowl: LatheGeometry from short profile, 8 radial segments with flat shading
  const { bowlGeometry, bowlEdges } = useMemo(() => {
    const points: THREE.Vector2[] = [
      new THREE.Vector2(0, -1.0),
      new THREE.Vector2(0.45, -0.85),
      new THREE.Vector2(0.85, -0.45),
      new THREE.Vector2(1.0, 0.15),
    ];
    const geo = new THREE.LatheGeometry(points, 8);
    geo.computeVertexNormals();
    const edges = new THREE.EdgesGeometry(geo, 15);
    return { bowlGeometry: geo, bowlEdges: edges };
  }, []);

  // 2. Inner dark core geometry (deep dark interior visible through glass)
  const coreGeometry = useMemo(() => {
    const points: THREE.Vector2[] = [
      new THREE.Vector2(0, -0.85),
      new THREE.Vector2(0.35, -0.7),
      new THREE.Vector2(0.68, -0.35),
      new THREE.Vector2(0.82, 0.05),
    ];
    const geo = new THREE.LatheGeometry(points, 8);
    geo.computeVertexNormals();
    return geo;
  }, []);

  // 3. Spikes: 9 4-sided pyramids (ConeGeometry radialSegments=4)
  // Front 5 spikes: angles spread across front arc, heights: 0.6, 0.78, 1.0, 0.78, 0.6
  // Back 4 spikes: higher on Y, heights: 0.7 each
  const spikeConfigs = useMemo(() => {
    // 5 front spikes
    const frontAngles = [-0.95, -0.48, 0, 0.48, 0.95];
    const frontHeights = [0.65, 0.85, 1.15, 0.85, 0.65];
    const frontLean = [-0.22, -0.1, 0, 0.1, 0.22];

    const frontSpikes = frontAngles.map((angle, i) => {
      const radius = 0.95;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius * 0.95;
      const height = frontHeights[i];
      const lean = frontLean[i];
      const geo = new THREE.ConeGeometry(0.34, height, 4);
      geo.computeVertexNormals();
      const edges = new THREE.EdgesGeometry(geo, 20);
      return {
        geo,
        edges,
        position: [x, 0.15 + height / 2 - 0.05, z] as [number, number, number],
        rotation: [0.08, angle, -lean] as [number, number, number],
        tipPosition: [x, 0.15 + height - 0.05, z] as [number, number, number],
        height,
      };
    });

    // 4 back spikes
    const backAngles = [-0.7, -0.24, 0.24, 0.7];
    const backHeights = [0.72, 0.75, 0.75, 0.72];
    const backLean = [-0.15, -0.06, 0.06, 0.15];

    const backSpikes = backAngles.map((angle, i) => {
      const radius = 0.92;
      const x = Math.sin(angle) * radius;
      const z = -Math.cos(angle) * radius * 0.85; // behind
      const height = backHeights[i];
      const lean = backLean[i];
      const geo = new THREE.ConeGeometry(0.32, height, 4);
      geo.computeVertexNormals();
      const edges = new THREE.EdgesGeometry(geo, 20);
      return {
        geo,
        edges,
        position: [x, 0.25 + height / 2, z] as [number, number, number],
        rotation: [-0.12, angle, -lean] as [number, number, number],
        tipPosition: [x, 0.25 + height, z] as [number, number, number],
        height,
      };
    });

    return [...frontSpikes, ...backSpikes];
  }, []);

  // Glass Material (translucent blue with deep dark attenuation)
  const glassMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: "#60A5FA",
      emissive: "#1E3A8A",
      emissiveIntensity: 0.35 * intensity,
      transmission: 0.82,
      thickness: 0.6,
      roughness: 0.18,
      ior: 1.35,
      attenuationColor: new THREE.Color("#070B16"),
      attenuationDistance: 1.2,
      transparent: true,
      opacity: 0.58 * presence,
      flatShading: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, [intensity, presence]);

  // Glowing Edge Material (blue-300, toneMapped=false for crisp bloom)
  const edgeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: "#93C5FD",
      transparent: true,
      opacity: 0.95 * presence * intensity,
      toneMapped: false,
    });
  }, [presence, intensity]);

  // Dark Inner Core Material
  const coreMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: "#02040A",
      emissive: "#070B16",
      emissiveIntensity: 0.25,
      roughness: 0.6,
      flatShading: true,
      side: THREE.BackSide,
    });
  }, []);

  // Tip Glow Material
  const tipGlowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: "#60A5FA",
      toneMapped: false,
      transparent: true,
      opacity: 0.9 * presence,
    });
  }, [presence]);

  // Tip point geometry
  const tipGeometry = useMemo(() => new THREE.SphereGeometry(0.035, 8, 8), []);

  useFrame((state) => {
    if (!crownGroupRef.current) return;
    const time = state.clock.getElapsedTime();
    const [tx, ty] = mousePos ? mousePos.current : [0, 0];

    // Calm motion: slow Y sway +/- 12 degrees (Math.PI * 0.067 rad) + pointer tilt max 6 deg
    const maxSway = calm ? 0.06 : 0.12;
    const swayY = Math.sin(time * 0.5) * maxSway;
    const pointerTiltX = ty * 0.08;
    const pointerTiltY = tx * 0.1;

    crownGroupRef.current.rotation.y = THREE.MathUtils.lerp(
      crownGroupRef.current.rotation.y,
      swayY + pointerTiltY,
      0.05
    );
    crownGroupRef.current.rotation.x = THREE.MathUtils.lerp(
      crownGroupRef.current.rotation.x,
      0.15 + pointerTiltX,
      0.05
    );
  });

  return (
    <group ref={crownGroupRef} scale={scale}>
      {/* 1. Base Bowl Glass Mesh */}
      <mesh geometry={bowlGeometry} material={glassMaterial} />
      <lineSegments geometry={bowlEdges} material={edgeMaterial} />

      {/* 2. Dark Olive Core (Deep interior visible through faces) */}
      <mesh geometry={coreGeometry} material={coreMaterial} />

      {/* 3. 9 Spikes with Glowing Edges & Bright Glowing Tips */}
      {spikeConfigs.map((spike, index) => (
        <group key={index} position={spike.position} rotation={spike.rotation}>
          <mesh geometry={spike.geo} material={glassMaterial} />
          <lineSegments geometry={spike.edges} material={edgeMaterial} />
          {/* Glowing tip */}
          <mesh position={[0, spike.height / 2, 0]} geometry={tipGeometry} material={tipGlowMaterial} />
        </group>
      ))}

      {/* Radiant ambient glow from crown center */}
      <pointLight color="#3B82F6" intensity={2.8 * presence * intensity} distance={8} position={[0, 0.2, 0]} />
      <pointLight color="#1E3A8A" intensity={1.5 * presence} distance={4} position={[0, -0.5, 0]} />
    </group>
  );
}

/**
 * Atmospheric light rays behind crown
 */
export function CrownAtmosphere() {
  const rayGeometry = useMemo(() => new THREE.PlaneGeometry(6, 12), []);
  const rayMaterial1 = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#3B82F6",
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );
  const rayMaterial2 = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#1E3A8A",
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  return (
    <group position={[0, 0, -1.8]} name="crown-atmosphere">
      <mesh geometry={rayGeometry} material={rayMaterial1} rotation={[0, 0, Math.PI / 4.2]} position={[-1.2, 1, 0]} />
      <mesh geometry={rayGeometry} material={rayMaterial2} rotation={[0, 0, -Math.PI / 5]} position={[1.5, 0.5, 0]} />
      {/* Tiny floating dust particles */}
      <Sparkles count={40} scale={[4.5, 4.5, 3]} size={2} speed={0.2} color="#60A5FA" opacity={0.45} />
    </group>
  );
}

/**
 * Static Crown Fallback Image component for mobile, low-power & reduced motion
 */
export function CrownFallbackImage({ className = "" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center pointer-events-none select-none ${className}`}>
      <Image
        src="/brand/crown-fallback.webp"
        alt="SMM Panel glass crown atmospheric visualization"
        width={720}
        height={720}
        priority
        className="w-full h-full object-contain mix-blend-screen opacity-90 drop-shadow-[0_0_50px_rgba(37,99,235,0.25)]"
      />
    </div>
  );
}

/**
 * Unified CrownAura export for hero, cards, and icons
 */
export function CrownAura({
  size = "hero",
  intensity = 1,
  interactive = true,
  presence = 1,
  mousePos,
  calm = false,
  className = "",
}: CrownAuraProps) {
  if (size === "icon") {
    return (
      <div className={`w-12 h-12 relative flex items-center justify-center ${className}`}>
        <Image
          src="/brand/crown-fallback.webp"
          alt="SMM Crown insignia"
          width={48}
          height={48}
          className="w-full h-full object-contain mix-blend-screen opacity-85"
        />
      </div>
    );
  }

  // Inside Canvas context, renders the CrownMesh directly with Float wrapper
  return (
    <Float
      speed={calm ? 0.8 : 1.1}
      rotationIntensity={calm ? 0.15 : 0.25}
      floatIntensity={calm ? 0.25 : 0.4}
    >
      <group>
        <CrownAtmosphere />
        <CrownMesh
          intensity={intensity}
          presence={presence}
          mousePos={mousePos}
          calm={calm}
          scale={size === "card" ? 0.95 : 1.25}
        />
      </group>
    </Float>
  );
}
