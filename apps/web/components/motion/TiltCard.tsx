"use client";

import React, { useRef, useState } from "react";
import { motion, useSpring } from "framer-motion";
import { useMotionPreference } from "./useMotionPreference";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glowColor?: string;
}

export function TiltCard({
  children,
  className = "",
  maxTilt = 6,
  glowColor = "rgba(216, 236, 141, 0.15)",
}: TiltCardProps) {
  const { reduced, lowPower } = useMotionPreference();
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, opacity: 0 });

  const rotateX = useSpring(0, { stiffness: 600, damping: 24 });
  const rotateY = useSpring(0, { stiffness: 600, damping: 24 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced || lowPower || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rX = -((y - centerY) / centerY) * maxTilt;
    const rY = ((x - centerX) / centerX) * maxTilt;

    rotateX.set(rX);
    rotateY.set(rY);
    setMousePos({ x, y, opacity: 1 });
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    setMousePos((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <motion.div
      ref={cardRef}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden transition-all duration-300 ${className}`}
    >
      {/* Specular hairline inner edge reflection */}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]" />

      {/* Moving radial glow highlight & specular reflection */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 rounded-[inherit]"
        style={{
          opacity: mousePos.opacity,
          background: `radial-gradient(450px circle at ${mousePos.x}px ${mousePos.y}px, ${glowColor}, transparent 65%)`,
        }}
      />
      {children}
    </motion.div>
  );
}
