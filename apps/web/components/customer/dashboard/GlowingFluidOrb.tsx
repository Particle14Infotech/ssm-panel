"use client";

import React from "react";
import { motion } from "framer-motion";

interface GlowingFluidOrbProps {
  size?: number;
  className?: string;
  delay?: number;
  variant?: 1 | 2 | 3;
}

export function GlowingFluidOrb({
  size = 110,
  className = "",
  delay = 0,
  variant = 1,
}: GlowingFluidOrbProps) {
  // Distinct fluid paths matching the reference mockup
  const paths = {
    1: "M 85,35 C 135,18 178,48 175,95 C 172,142 135,172 90,165 C 45,158 22,122 30,80 C 38,38 45,48 85,35 Z",
    2: "M 95,30 C 145,22 180,65 165,115 C 150,165 95,178 55,152 C 15,126 22,65 58,42 C 72,33 82,31 95,30 Z",
    3: "M 105,32 C 142,20 175,55 160,95 C 180,132 142,175 100,162 C 60,175 25,135 45,95 C 28,58 65,25 105,32 Z",
  };

  const selectedPath = paths[variant] || paths[1];
  const uniqueId = `fluid-${variant}-${delay}`.replace(/\./g, "-");

  return (
    <div
      className={`relative flex items-center justify-center pointer-events-none select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer Ambient Volumetric Glow */}
      <motion.div
        animate={{
          scale: [1, 1.18, 1],
          opacity: [0.35, 0.65, 0.35],
        }}
        transition={{
          duration: 4.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        }}
        className="absolute inset-0 rounded-full bg-[#d8ec8d] blur-[28px] -z-10"
      />

      {/* SVG 3D Fluid Mesh */}
      <motion.svg
        viewBox="0 0 200 200"
        className="w-full h-full filter drop-shadow-[0_0_24px_rgba(216,236,141,0.7)]"
        animate={{
          rotate: [0, 6, -5, 0],
          scale: [1, 1.05, 0.96, 1],
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        }}
      >
        <defs>
          {/* Volumetric Radial Lighting Gradient */}
          <radialGradient id={`volumetricGrad-${uniqueId}`} cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#f7ffc8" />
            <stop offset="28%" stopColor="#d8ec8d" />
            <stop offset="68%" stopColor="#9cb33e" />
            <stop offset="95%" stopColor="#435212" />
            <stop offset="100%" stopColor="#252f08" />
          </radialGradient>

          {/* Smooth Rim Light Gradient */}
          <linearGradient id={`rimLight-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="45%" stopColor="#d8ec8d" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
          </linearGradient>

          {/* Specular Glaze Highlight */}
          <radialGradient id={`specular-${uniqueId}`} cx="40%" cy="30%" r="35%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#f4ffba" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#d8ec8d" stopOpacity="0.0" />
          </radialGradient>
        </defs>

        {/* Base Fluid Body */}
        <path
          d={selectedPath}
          fill={`url(#volumetricGrad-${uniqueId})`}
        />

        {/* Rim Light / Depth Layer */}
        <path
          d={selectedPath}
          fill={`url(#rimLight-${uniqueId})`}
          style={{ mixBlendMode: "overlay" }}
        />

        {/* Specular Highlight Point */}
        <ellipse
          cx="88"
          cy="68"
          rx="34"
          ry="20"
          fill={`url(#specular-${uniqueId})`}
          transform="rotate(-20 88 68)"
        />
      </motion.svg>
    </div>
  );
}
