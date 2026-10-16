"use client";

import React, { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";
import { useMotionPreference } from "./useMotionPreference";

export function CustomCursor() {
  const { reduced, lowPower } = useMotionPreference();
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useSpring(0, { stiffness: 600, damping: 35 });
  const mouseY = useSpring(0, { stiffness: 600, damping: 35 });
  const dotX = useSpring(0, { stiffness: 1200, damping: 45 });
  const dotY = useSpring(0, { stiffness: 1200, damping: 45 });

  useEffect(() => {
    if (reduced || lowPower || typeof window === "undefined") return;

    // Check if touch device
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      dotX.set(e.clientX);
      dotY.set(e.clientY);
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.closest("button") ||
        target.closest("a") ||
        target.getAttribute("role") === "button"
      ) {
        setIsHovered(true);
      } else {
        setIsHovered(false);
      }
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [reduced, lowPower, isVisible, mouseX, mouseY, dotX, dotY]);

  if (reduced || lowPower || !isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {/* Outer subtle halo */}
      <motion.div
        style={{
          x: mouseX,
          y: mouseY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          scale: isHovered ? 1.8 : 1,
          backgroundColor: isHovered ? "rgba(59, 130, 246, 0.15)" : "rgba(255, 255, 255, 0.05)",
          borderColor: isHovered ? "rgba(59, 130, 246, 0.6)" : "rgba(255, 255, 255, 0.25)",
        }}
        transition={{ duration: 0.2 }}
        className="w-8 h-8 rounded-full border border-white/20 backdrop-blur-[1px] pointer-events-none"
      />
      {/* Center sharp dot */}
      <motion.div
        style={{
          x: dotX,
          y: dotY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          scale: isHovered ? 0.6 : 1,
          backgroundColor: isHovered ? "#3B82F6" : "#ffffff",
        }}
        className="w-1.5 h-1.5 rounded-full pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.8)]"
      />
    </div>
  );
}
