"use client";

import React, { useMemo } from "react";
import * as THREE from "three";

/**
 * Photorealistic Royal King's Crown (Coronet)
 *
 * Design Architecture:
 * 1. Wide Circular Base Band:
 *    - Heavy double-moulded gold-metal circlet with upper and lower raised beaded rims.
 *    - 18 embedded small, tasteful emerald gems (alternating diamond octahedrons and round cabochons).
 * 2. 6 Distinct Symmetrical Royal Fleur-de-lis Pointed Tips:
 *    - Authentic regal coronet peaks evenly spaced at 60° rotational symmetry.
 *    - Graceful outward royal flare (tapered waist, scalloped lateral wings, central spear crest).
 *    - Inset diamond filigree cutout in each crest with an embedded glowing emerald below.
 *    - Polished pearl sphere seated atop each of the 6 pointed tips.
 * 3. 100% Hollow / Empty Interior:
 *    - Completely open interior; metallic inner walls of the back band are visible.
 *    - Zero human/statue silhouette, dome, cone, arches, or interior obstructions.
 * 4. Controlled Lighting & Materials:
 *    - Dark metallic gold with subtle lime-green ambient sheen.
 *    - Controlled emissive accents on gems and tips (no overexposed white hotspots or glare).
 *    - No artificial straight wireframe connecting peaks across mid-air.
 */
export function CrownModel({ scale = 1.0 }: { scale?: number }) {
  // 1. Refined, Controlled Materials
  const materials = useMemo(() => {
    // A. Luminous Royal Gold with vibrant electric-lime sheen
    const royalGold = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#e8d672"),
      emissive: new THREE.Color("#2d4205"),
      emissiveIntensity: 0.28,
      metalness: 0.82,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.95,
      side: THREE.DoubleSide,
    });
    (royalGold as any).userData = { baseOpacity: 1.0 };

    // B. Bright Glowing Gemstones (Vivid lime emeralds)
    const gemEmerald = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#cbf736"),
      emissive: new THREE.Color("#62b810"),
      emissiveIntensity: 0.95,
      metalness: 0.10,
      roughness: 0.06,
      transmission: 0.35,
      thickness: 0.5,
      ior: 1.6,
      toneMapped: true,
    });

    // C. Polished Peak Tip Pearls (Bright luminous jewel pearls)
    const pearlTip = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#f6fceb"),
      emissive: new THREE.Color("#88c924"),
      emissiveIntensity: 0.65,
      roughness: 0.12,
      metalness: 0.20,
      toneMapped: true,
    });

    return {
      royalGold,
      gemEmerald,
      pearlTip,
    };
  }, []);

  // 2. Base Circlet Band Geometry (Double-moulded with raised top & bottom rims)
  const circletGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(1.08, -0.15),
      new THREE.Vector2(1.18, -0.15),
      new THREE.Vector2(1.22, -0.12),
      new THREE.Vector2(1.18, -0.09),
      new THREE.Vector2(1.17,  0.00),
      new THREE.Vector2(1.18,  0.09),
      new THREE.Vector2(1.22,  0.12),
      new THREE.Vector2(1.18,  0.15),
      new THREE.Vector2(1.08,  0.15),
      new THREE.Vector2(1.08, -0.15),
    ];
    const geo = new THREE.LatheGeometry(pts, 64);
    geo.computeVertexNormals();
    return geo;
  }, []);

  // 3. Circlet Band Gemstones (18 evenly spaced small gems: alternating diamond & round)
  const circletGems = useMemo(() => {
    const gems: {
      type: "diamond" | "round";
      pos: [number, number, number];
      rot: [number, number, number];
    }[] = [];
    const count = 18;
    const r = 1.205;
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count;
      const x = r * Math.sin(angle);
      const z = r * Math.cos(angle);
      gems.push({
        type: i % 2 === 0 ? "diamond" : "round",
        pos: [x, 0, z],
        rot: [0, angle, 0],
      });
    }
    return gems;
  }, []);

  // 4. Symmetrical Royal Pointed Fleuron Tip Shape (Single Crown Point)
  const pointGeo = useMemo(() => {
    const shape = new THREE.Shape();
    // Base width: x from -0.25 to +0.25
    shape.moveTo(-0.25, 0);
    shape.lineTo(0.25, 0);

    // Right waist curve: tapers slightly inward
    shape.quadraticCurveTo(0.22, 0.16, 0.18, 0.30);

    // Right floral wing/acanthus fleuron flare: curves outward gracefully
    shape.bezierCurveTo(0.32, 0.44, 0.30, 0.64, 0.15, 0.76);

    // Right spear crest: tapers smoothly to the pointed apex
    shape.quadraticCurveTo(0.08, 0.92, 0.0, 1.15);

    // Left spear crest (symmetrical)
    shape.quadraticCurveTo(-0.08, 0.92, -0.15, 0.76);

    // Left floral wing/acanthus fleuron flare
    shape.bezierCurveTo(-0.30, 0.64, -0.32, 0.44, -0.18, 0.30);

    // Left waist curve
    shape.quadraticCurveTo(-0.22, 0.16, -0.25, 0);

    // Inset gothic diamond / trefoil cutout in center of fleuron
    const hole = new THREE.Path();
    hole.moveTo(0, 0.40);
    hole.lineTo(0.065, 0.54);
    hole.lineTo(0, 0.68);
    hole.lineTo(-0.065, 0.54);
    hole.lineTo(0, 0.40);
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.014,
      bevelSegments: 3,
      curveSegments: 20,
    });
    geo.computeVertexNormals();
    return geo;
  }, []);

  // 5. 6 Symmetrical Pointed Tips Config (60° rotational symmetry with outward regal flare)
  const crownPoints = useMemo(() => {
    const items: {
      pos: [number, number, number];
      rot: [number, number, number];
      tipPos: [number, number, number];
      gemPos: [number, number, number];
    }[] = [];
    const count = 6;
    const rBase = 1.155;
    const baseY = 0.14;
    const outwardTilt = -0.09; // outward flare angle (~5.2 degrees)

    for (let k = 0; k < count; k++) {
      const angle = Math.PI / 2 + (k * Math.PI * 2) / count;
      const x = rBase * Math.cos(angle);
      const z = rBase * Math.sin(angle);
      const rotY = -angle + Math.PI / 2;

      // Tip calculation accounting for outward tilt
      const tipHeight = 1.15 * Math.cos(outwardTilt);
      const tipOutwardShift = 1.15 * Math.sin(-outwardTilt);
      const rTip = rBase + tipOutwardShift;
      const tipX = rTip * Math.cos(angle);
      const tipZ = rTip * Math.sin(angle);
      const tipY = baseY + tipHeight;

      // Gem position in fleuron waist
      const gemHeight = 0.22 * Math.cos(outwardTilt);
      const gemOutwardShift = 0.22 * Math.sin(-outwardTilt) + 0.03;
      const rGem = rBase + gemOutwardShift;
      const gemX = rGem * Math.cos(angle);
      const gemZ = rGem * Math.sin(angle);
      const gemY = baseY + gemHeight;

      items.push({
        pos: [x, baseY, z],
        rot: [outwardTilt, rotY, 0],
        tipPos: [tipX, tipY, tipZ],
        gemPos: [gemX, gemY, gemZ],
      });
    }
    return items;
  }, []);

  return (
    <group scale={scale} position={[0, -0.32, 0]}>
      {/* 1. Base Circlet Band */}
      <mesh geometry={circletGeo} material={materials.royalGold} />

      {/* 2. Embedded Circlet Gemstones (18 Small, Tasteful Gems) */}
      {circletGems.map((gem, idx) => (
        <group key={`circlet-gem-${idx}`} position={gem.pos} rotation={gem.rot}>
          {gem.type === "diamond" ? (
            <mesh
              rotation={[Math.PI / 4, 0, Math.PI / 4]}
              material={materials.gemEmerald}
            >
              <octahedronGeometry args={[0.038, 0]} />
            </mesh>
          ) : (
            <mesh material={materials.gemEmerald}>
              <sphereGeometry args={[0.032, 16, 16]} />
            </mesh>
          )}
        </group>
      ))}

      {/* 3. 6 Symmetrical Pointed Tips with Empty/Open Interior */}
      {crownPoints.map((point, idx) => (
        <group key={`point-${idx}`} position={point.pos} rotation={point.rot}>
          <mesh geometry={pointGeo} material={materials.royalGold} />
        </group>
      ))}

      {/* 4. Small Glowing Emerald Gemstones Mounted on Each Peak Waist */}
      {crownPoints.map((point, idx) => (
        <mesh
          key={`point-gem-${idx}`}
          position={point.gemPos}
          rotation={[Math.PI / 4, 0, Math.PI / 4]}
          material={materials.gemEmerald}
        >
          <octahedronGeometry args={[0.034, 0]} />
        </mesh>
      ))}

      {/* 5. Polished Pearl Spheres on all 6 Peak Tips */}
      {crownPoints.map((point, idx) => (
        <mesh key={`tip-pearl-${idx}`} position={point.tipPos}>
          <sphereGeometry args={[0.042, 16, 16]} />
          <primitive object={materials.pearlTip} attach="material" />
        </mesh>
      ))}

      {/* 6. Luminous Ambient Interior Illumination */}
      {/* Radiant inner emerald illumination on back wall */}
      <pointLight
        position={[0, 0.40, 0]}
        color="#a2f026"
        intensity={0.45}
        distance={2.2}
      />
      {/* Golden-lime bottom bounce light */}
      <pointLight
        position={[0, -0.30, 0]}
        color="#304806"
        intensity={0.55}
        distance={2.0}
      />
    </group>
  );
}
