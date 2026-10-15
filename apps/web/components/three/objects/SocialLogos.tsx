"use client";

import React, { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Float, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import {
  siInstagram,
  siYoutube,
  siTelegram,
  siTiktok,
  siFacebook,
  siX,
} from "simple-icons";
import { BRAND } from "../brand";

export const LOGOS = {
  instagram: siInstagram,
  youtube: siYoutube,
  telegram: siTelegram,
  tiktok: siTiktok,
  facebook: siFacebook,
  x: siX,
} as const;

export type PlatformId = keyof typeof LOGOS;

export const OFFICIAL_PLATFORMS: Record<
  PlatformId,
  {
    name: string;
    bg: string;
    glow: string;
    iconColor: string;
    metalness: number;
    roughness: number;
    isInstagram?: boolean;
    isTiktok?: boolean;
  }
> = {
  instagram: {
    name: "Instagram",
    bg: "#E1306C",
    glow: "#E1306C",
    iconColor: "#FFFFFF",
    metalness: 0.1,
    roughness: 0.15,
    isInstagram: true,
  },
  youtube: {
    name: "YouTube",
    bg: "#FF0000",
    glow: "#FF0000",
    iconColor: "#FFFFFF",
    metalness: 0.05,
    roughness: 0.15,
  },
  facebook: {
    name: "Facebook",
    bg: "#1877F2",
    glow: "#1877F2",
    iconColor: "#FFFFFF",
    metalness: 0.05,
    roughness: 0.15,
  },
  x: {
    name: "X",
    bg: "#050608",
    glow: "#2A2E39",
    iconColor: "#FFFFFF",
    metalness: 0.7,
    roughness: 0.25,
  },
  telegram: {
    name: "Telegram",
    bg: "#24A1DE",
    glow: "#24A1DE",
    iconColor: "#FFFFFF",
    metalness: 0.05,
    roughness: 0.15,
  },
  tiktok: {
    name: "TikTok",
    bg: "#050505",
    glow: "#00F2FE",
    iconColor: "#FFFFFF",
    metalness: 0.4,
    roughness: 0.2,
    isTiktok: true,
  },
};

export function getLogoGeometryStats() {
  if (typeof window === "undefined") return {};
  const results: Record<string, { vertices: number; shapeCount: number; holeCount: number }> = {};
  for (const [name, icon] of Object.entries(LOGOS)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${icon.path}"/></svg>`;
    const data = new SVGLoader().parse(svg);
    const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelSegments: 3,
      curveSegments: 24,
    });
    results[name] = {
      vertices: geo.attributes.position.count,
      shapeCount: shapes.length,
      holeCount: shapes.reduce((acc, s) => acc + s.holes.length, 0),
    };
  }
  return results;
}

export function useLogoGeometry(path: string) {
  return useMemo(() => {
    if (typeof window === "undefined") {
      return new THREE.BufferGeometry();
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${path}"/></svg>`;
    const data = new SVGLoader().parse(svg);
    const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 3,
      curveSegments: 24,
    });
    geo.center();
    const s = (1.0 / 24) * 0.60;
    geo.scale(s, -s, s); // SVG y axis is inverted
    geo.computeVertexNormals();
    return geo;
  }, [path]);
}

function createInstagramTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Instagram official diagonal gradient
  const grad = ctx.createLinearGradient(0, 512, 512, 0);
  grad.addColorStop(0, "#FFDC80");
  grad.addColorStop(0.18, "#FCAF45");
  grad.addColorStop(0.38, "#F77737");
  grad.addColorStop(0.55, "#F56040");
  grad.addColorStop(0.72, "#FD1D1D");
  grad.addColorStop(0.86, "#E1306C");
  grad.addColorStop(0.94, "#C13584");
  grad.addColorStop(1.0, "#833AB4");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Radial highlight for authentic specular depth
  const rad = ctx.createRadialGradient(100, 420, 20, 100, 420, 400);
  rad.addColorStop(0, "rgba(255, 220, 128, 0.85)");
  rad.addColorStop(0.5, "rgba(252, 175, 69, 0.45)");
  rad.addColorStop(1, "rgba(131, 58, 180, 0)");
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function SocialChip({
  id,
  active = false,
  scale = 1,
}: {
  id: PlatformId;
  tintIndex?: number;
  active?: boolean;
  scale?: number;
}) {
  const geo = useLogoGeometry(LOGOS[id].path);
  const g = useRef<THREE.Group>(null!);
  const config = OFFICIAL_PLATFORMS[id];

  const instaTex = useMemo(() => {
    if (id === "instagram") return createInstagramTexture();
    return null;
  }, [id]);

  useFrame((_, dt) => {
    if (!g.current) return;
    const target = (active ? 1.15 : 1) * scale;
    g.current.scale.setScalar(THREE.MathUtils.damp(g.current.scale.x, target, 8, dt));
  });

  return (
    <group ref={g} name={`logo-${id}`}>
      {/* 1. Authentic Official Platform Tile */}
      <RoundedBox args={[0.96, 0.96, 0.14]} radius={0.24} smoothness={6}>
        {id === "instagram" && instaTex ? (
          <meshStandardMaterial
            map={instaTex}
            roughness={0.2}
            metalness={0.05}
          />
        ) : (
          <meshStandardMaterial
            color={config.bg}
            roughness={config.roughness}
            metalness={config.metalness}
          />
        )}
      </RoundedBox>

      {/* 2. Official Vector Logo Glyph (Pure Crisp White / Multi-tone for TikTok) */}
      {id === "tiktok" ? (
        <group position={[0, 0, 0.08]}>
          {/* Cyan layer offset */}
          <mesh geometry={geo} position={[-0.015, 0.012, -0.005]} scale={0.96}>
            <meshBasicMaterial color="#00F2FE" />
          </mesh>
          {/* Magenta layer offset */}
          <mesh geometry={geo} position={[0.015, -0.012, -0.005]} scale={0.96}>
            <meshBasicMaterial color="#FE2C55" />
          </mesh>
          {/* Crisp front white layer */}
          <mesh geometry={geo} position={[0, 0, 0.005]} scale={0.96}>
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
      ) : (
        <mesh geometry={geo} position={[0, 0, 0.08]} scale={0.96}>
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      )}
    </group>
  );
}

export function PlatformRing({
  radius = 3.3,
  onSelect,
  isMobile = false,
}: {
  radius?: number;
  onSelect?: (id: PlatformId) => void;
  isMobile?: boolean;
}) {
  const ring = useRef<THREE.Group>(null!);
  const allIds = Object.keys(LOGOS) as PlatformId[];
  const ids = isMobile ? (["instagram", "youtube", "telegram", "tiktok"] as PlatformId[]) : allIds;
  const [hover, setHover] = useState<PlatformId | null>(null);

  useFrame((_, dt) => {
    if (ring.current) {
      ring.current.rotation.y += dt * (hover ? 0.03 : 0.14);
    }
  });

  return (
    <group ref={ring} rotation={[0.32, 0, 0.06]} name="platform-ring">
      {ids.map((id, i) => {
        const a = (i / ids.length) * Math.PI * 2;
        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;

        const content = (
          <group
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(id);
              if (typeof document !== "undefined") document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHover(null);
              if (typeof document !== "undefined") document.body.style.cursor = "";
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(id);
            }}
          >
            <SocialChip id={id} tintIndex={i} active={hover === id} />
          </group>
        );

        return (
          <group key={id} position={[x, 0, z]}>
            <Billboard>
              {isMobile ? (
                content
              ) : (
                <Float speed={1.3} floatIntensity={0.3} rotationIntensity={0.08}>
                  {content}
                </Float>
              )}
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}
