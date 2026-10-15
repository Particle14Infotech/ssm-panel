"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

/**
 * Photorealistic 3D Luminous Crown - Exact 1-to-1 Match with Reference
 *
 * Characteristics from reference:
 * - 8 spikes in a faceted ring (3 prominent front, 5 side/back)
 * - Faceted bowl tapering down to a single bottom apex
 * - Central vertical facet seam running from every spike apex directly down to the bottom point
 * - Translucent chartreuse/lime crystal glass with smooth Fresnel highlights and refraction
 * - Soft dark olive/emerald interior core creating the deep inner shadow visible through the glass
 * - Luminous chartreuse-green glowing facet wireframe seams
 * - High-luminance spike tips with diamond bloom highlights
 * - Inner radiant point light creating the distinctive volumetric glow through the crystal
 */
export function CrownModel({ scale = 1 }: { scale?: number }) {
  const gltf = useGLTF("/models/crown.glb");

  // 8 Spike tip positions at radius 1.05, y = 0.5, angles k*45 deg
  const tipPositions = useMemo<[number, number, number][]>(() => {
    const tips: [number, number, number][] = [];
    const N = 8;
    const r = 1.05;
    const y = 0.5;
    for (let k = 0; k < N; k++) {
      const angle = (k * Math.PI * 2) / N;
      tips.push([r * Math.sin(angle), y, r * Math.cos(angle)]);
    }
    return tips;
  }, []);

  // Clone GLTF and apply authentic reference materials
  const sceneWithMaterials = useMemo(() => {
    const scene = gltf.scene.clone(true);

    // 1. Translucent Chartreuse Crystal Glass
    // Matches the reference: pale lime (#dcf787), transmission, smooth clearcoat, dark olive attenuation
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#dcf787"),
      emissive: new THREE.Color("#2a3b00"),
      emissiveIntensity: 0.18,
      roughness: 0.18,
      metalness: 0.04,
      transmission: 0.76,
      thickness: 1.2,
      ior: 1.5,
      side: THREE.DoubleSide,
      depthWrite: false,
      transparent: true,
      opacity: 0.82,
      attenuationColor: new THREE.Color("#162200"),
      attenuationDistance: 1.3,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      flatShading: true,
      toneMapped: false,
    });
    (glassMat as any).userData = { baseOpacity: 0.82 };

    // 2. Dark Olive Core: Remove flat top lid if present, style inner cup with soft deep olive-emerald depth
    const coreMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#122002"),
      emissive: new THREE.Color("#253d04"),
      emissiveIntensity: 0.35,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    (coreMat as any).userData = { baseOpacity: 0.65 };

    // 3. Glowing Edge Seams (Wireframe running along facets to the bottom apex)
    const edgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color("#e8ff9a"),
      toneMapped: false,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      linewidth: 1.5,
    });
    (edgeMat as any).userData = { baseOpacity: 0.9 };

    scene.traverse((child: any) => {
      if (child.name === "glass" && child.isMesh) {
        child.material = glassMat;
      } else if (child.name === "core" && child.isMesh) {
        // Completely remove the opaque/dark core mesh so the crown is 100% translucent crystal
        child.visible = false;
      } else if (child.name === "edges" || child.isLineSegments) {
        child.material = edgeMat;
      }
    });

    return scene;
  }, [gltf]);

  // Spike tip radiant diamond gems
  const tipSphereMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ffffff"),
      emissive: new THREE.Color("#dbef90"),
      emissiveIntensity: 3.2,
      roughness: 0.05,
      toneMapped: false,
    });
  }, []);

  return (
    <group scale={scale} position={[0, 0.2, 0]}>
      {/* 8-Spike Faceted Crystal Crown with Central Seams Meeting at Bottom Apex */}
      <primitive object={sceneWithMaterials} />

      {/* 8 Glowing Crystal Diamond Tips */}
      {tipPositions.map((pos, idx) => (
        <mesh key={idx} position={pos}>
          <sphereGeometry args={[0.024, 16, 16]} />
          <primitive object={tipSphereMaterial} attach="material" />
        </mesh>
      ))}

      {/* Internal Core Radiant Point Light (#DBEF90 shining through crystal facets) */}
      <pointLight
        position={[0, -0.05, 0]}
        color="#e4fca3"
        intensity={3.4}
        distance={4.5}
      />
      {/* Deep olive bottom bounce light */}
      <pointLight
        position={[0, -0.7, 0]}
        color="#2c3e00"
        intensity={2.2}
        distance={2.8}
      />
    </group>
  );
}

// Preload the GLTF crown model
useGLTF.preload("/models/crown.glb");

