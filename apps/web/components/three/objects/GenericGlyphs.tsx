"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

export type GlyphType = "video" | "message" | "camera";

export function GenericPlatformGlyph({
  type,
  scale = 1,
  active = false,
}: {
  type: GlyphType;
  scale?: number;
  active?: boolean;
}) {
  const g = useRef<THREE.Group>(null!);

  useFrame((_, dt) => {
    if (!g.current) return;
    const target = (active ? 1.15 : 1) * scale;
    g.current.scale.setScalar(THREE.MathUtils.damp(g.current.scale.x, target, 8, dt));
  });

  return (
    <group ref={g} name={`generic-glyph-${type}`}>
      {/* Dark frosted glass backing tile */}
      <RoundedBox args={[0.9, 0.9, 0.12]} radius={0.2} smoothness={4}>
        <meshPhysicalMaterial
          color="#070B16"
          emissive="#1E3A8A"
          emissiveIntensity={0.2}
          roughness={0.4}
          metalness={0.2}
          clearcoat={0.8}
          transparent
          opacity={0.85}
        />
      </RoundedBox>

      {/* Generic minimal geometric symbol overlay */}
      {type === "video" && (
        /* Minimal play triangle */
        <mesh position={[0.04, 0, 0.08]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.22, 0.38, 3]} />
          <meshStandardMaterial
            color="#3B82F6"
            emissive="#3B82F6"
            emissiveIntensity={0.4}
            roughness={0.3}
          />
        </mesh>
      )}

      {type === "message" && (
        /* Minimal chat bubble */
        <group position={[0, 0, 0.08]}>
          <mesh>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial
              color="#3B82F6"
              emissive="#3B82F6"
              emissiveIntensity={0.35}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[-0.14, -0.14, 0]} rotation={[0, 0, Math.PI / 4]}>
            <coneGeometry args={[0.08, 0.18, 3]} />
            <meshStandardMaterial
              color="#3B82F6"
              emissive="#3B82F6"
              emissiveIntensity={0.35}
              roughness={0.3}
            />
          </mesh>
        </group>
      )}

      {type === "camera" && (
        /* Minimal camera/social outline aperture */
        <group position={[0, 0, 0.08]}>
          <mesh>
            <torusGeometry args={[0.2, 0.045, 12, 24]} />
            <meshStandardMaterial
              color="#3B82F6"
              emissive="#3B82F6"
              emissiveIntensity={0.35}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshStandardMaterial
              color="#FFFFFF"
              emissive="#FFFFFF"
              emissiveIntensity={0.3}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

/**
 * FloatingMarginGlyphs:
 * At most 2 floating generic platform glyphs placed strictly in the far margins,
 * never overlapping the crown, content cards or text.
 */
export function FloatingMarginGlyphs({ isMobile = false }: { isMobile?: boolean }) {
  if (isMobile) return null; // Avoid mobile clutter; strictly in desktop margins

  return (
    <group name="margin-glyphs">
      {/* Left Far Margin: Video Glyph */}
      <group position={[-5.4, 1.2, -1.2]}>
        <Float speed={1.1} floatIntensity={0.25} rotationIntensity={0.12}>
          <GenericPlatformGlyph type="video" scale={0.65} />
        </Float>
      </group>

      {/* Right Far Margin: Message Glyph */}
      <group position={[5.4, 0.8, -1.0]}>
        <Float speed={1.2} floatIntensity={0.3} rotationIntensity={0.1}>
          <GenericPlatformGlyph type="message" scale={0.6} />
        </Float>
      </group>
    </group>
  );
}
