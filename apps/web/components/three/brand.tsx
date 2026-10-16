"use client";
import React from "react";
import * as THREE from "three";

export const BRAND = {
  blue: "#2563EB",
  bright: "#3B82F6",
  glow: "#60A5FA",
  white: "#FFFFFF",
  dark: "#02040A",
  // Legacy alias redirects for safety
  lime: "#3B82F6",
  accent: "#60A5FA",
  pink: "#3B82F6",
  purple: "#2563EB",
} as const;

export function Brand({
  color = BRAND.bright,
  glow = 0.2,
  roughness = 0.25,
  metalness = 0.1,
  clearcoat = 0.8,
  transmission = 0,
  opacity = 1,
  transparent = false,
}: {
  color?: string;
  glow?: number;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  transmission?: number;
  opacity?: number;
  transparent?: boolean;
}) {
  return (
    <meshPhysicalMaterial
      color={color}
      emissive={color}
      emissiveIntensity={glow}
      roughness={roughness}
      metalness={metalness}
      clearcoat={clearcoat}
      transmission={transmission}
      opacity={opacity}
      transparent={transparent || opacity < 1}
      side={THREE.DoubleSide}
    />
  );
}
