"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

interface WavePoint {
  time: string;
  value: number;
}

interface DeliveryRhythmWaveProps {
  data?: WavePoint[];
  metricLabel?: string;
}

export function DeliveryRhythmWave({
  data,
  metricLabel = "Views per hour",
}: DeliveryRhythmWaveProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { isDark } = useTheme();

  // Default 24h sine-wave rhythm data points matching the reference mockup curve
  const points = useMemo<WavePoint[]>(() => {
    if (data && data.length > 0) return data;
    const hours = [
      "12 AM", "2 AM", "4 AM", "6 AM", "8 AM", "10 AM",
      "12 PM", "2 PM", "4 PM", "6 PM", "8 PM", "10 PM", "12 AM"
    ];
    // Multi-peak rhythm like in mockup
    const values = [140, 260, 210, 110, 320, 520, 640, 430, 280, 560, 410, 240, 180];
    return hours.map((time, i) => ({ time, value: values[i] || 200 }));
  }, [data]);

  // SVG dimensions
  const width = 1000;
  const height = 200;
  const paddingX = 30;
  const paddingY = 36;

  const maxValue = useMemo(() => Math.max(...points.map((p) => p.value), 100), [points]);

  // Convert points to SVG coordinates
  const svgCoords = useMemo(() => {
    const stepX = (width - paddingX * 2) / (points.length - 1);
    const usableHeight = height - paddingY * 2;
    return points.map((p, i) => {
      const x = paddingX + i * stepX;
      const y = height - paddingY - (p.value / maxValue) * usableHeight;
      return { x, y, ...p };
    });
  }, [points, maxValue, width, height, paddingX, paddingY]);

  // Generate smooth cubic bezier curve
  const pathD = useMemo(() => {
    if (svgCoords.length === 0) return "";
    let d = `M ${svgCoords[0].x},${svgCoords[0].y}`;
    for (let i = 0; i < svgCoords.length - 1; i++) {
      const curr = svgCoords[i];
      const next = svgCoords[i + 1];
      const ctrlX1 = curr.x + (next.x - curr.x) / 2;
      const ctrlY1 = curr.y;
      const ctrlX2 = curr.x + (next.x - curr.x) / 2;
      const ctrlY2 = next.y;
      d += ` C ${ctrlX1},${ctrlY1} ${ctrlX2},${ctrlY2} ${next.x},${next.y}`;
    }
    return d;
  }, [svgCoords]);

  // Generate closed area path for gradient fill
  const areaD = useMemo(() => {
    if (svgCoords.length === 0) return "";
    const last = svgCoords[svgCoords.length - 1];
    const first = svgCoords[0];
    return `${pathD} L ${last.x},${height} L ${first.x},${height} Z`;
  }, [pathD, svgCoords, height]);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border relative overflow-hidden shadow-sm transition-colors">
      {/* Top Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-fg tracking-wide font-sans flex items-center gap-2 transition-colors">
            24h Delivery Rhythm Wave
          </h3>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center bg-slate-100 dark:bg-black/40 px-3 py-1 rounded-full border border-slate-200/80 dark:border-white/[0.06] transition-colors">
          <span className="w-2 h-2 rounded-full bg-[#d8ec8d] shadow-[0_0_8px_#d8ec8d] animate-pulse" />
          <span className="text-xs font-mono text-fg-2 font-medium">
            {metricLabel}
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="w-full relative overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 sm:h-52 select-none"
        >
          <defs>
            {/* Ambient Vertical Glow Gradient */}
            <linearGradient id="rhythmWaveGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d8ec8d" stopOpacity={isDark ? "0.35" : "0.45"} />
              <stop offset="60%" stopColor="#d8ec8d" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#d8ec8d" stopOpacity="0.0" />
            </linearGradient>

            {/* Glowing Drop-Shadow Filter */}
            <filter id="neonLimeFilter" x="-10%" y="-20%" width="120%" height="150%">
              <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="#d8ec8d" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Background Grid Lines (Horizontal) */}
          {[0.25, 0.5, 0.75].map((ratio, idx) => {
            const y = height * ratio;
            return (
              <line
                key={idx}
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                stroke={isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.06)"}
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill="url(#rhythmWaveGlow)" />

          {/* Animated Neon Wave Stroke */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="#b4cf47"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neonLimeFilter)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="dark:stroke-[#d8ec8d]"
          />

          {/* Interactive Data Dots */}
          {svgCoords.map((pt, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <g
                key={idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Invisible hover hotspot */}
                <circle cx={pt.x} cy={pt.y} r={14} fill="transparent" />

                {/* Visible node */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5.5 : 3}
                  fill={isDark ? "#ffffff" : "#171e00"}
                  stroke="#d8ec8d"
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  className="transition-all duration-200"
                />

                {/* Tooltip on Hover */}
                {isHovered && (
                  <g transform={`translate(${pt.x}, ${pt.y - 24})`}>
                    <rect
                      x="-45"
                      y="-20"
                      width="90"
                      height="24"
                      rx="6"
                      fill={isDark ? "#131313" : "#ffffff"}
                      stroke="#d8ec8d"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="-4"
                      textAnchor="middle"
                      fill={isDark ? "#ffffff" : "#0f172a"}
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {pt.value.toLocaleString()} views
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Timestamps X-Axis Strip */}
        <div className="flex justify-between items-center px-4 pt-2 border-t border-slate-100 dark:border-white/[0.05] text-[10px] sm:text-xs font-mono text-slate-500">
          {points.map((pt, i) => (
            <span
              key={i}
              className={`${i % 2 === 0 ? "block" : "hidden sm:block"} ${
                hoveredIndex === i ? "text-[#556910] dark:text-[#d8ec8d] font-bold" : ""
              }`}
            >
              {pt.time}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
