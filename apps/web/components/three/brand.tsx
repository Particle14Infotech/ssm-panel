"use client";
import React from "react";
import * as THREE from "three";

export const BRAND = {
  lime: "#D8EC8D",
  accent: "#BEF264",
  pink: "#FF4D8D",
  purple: "#7B3FF2",
  white: "#ffffff",
  dark: "#131313",
  bright: "#D8EC8D",
  glow: "#BEF264",
  blue: "#D8EC8D", // Redirect legacy blue keys to lime
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
