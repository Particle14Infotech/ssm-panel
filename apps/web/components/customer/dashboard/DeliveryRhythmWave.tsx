"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { ChevronDown, Check } from "lucide-react";

export type TimeframeMode = "day" | "week" | "month";

export interface WavePoint {
  time: string;
  value: number;
  fullDate?: string;
}

interface DeliveryRhythmWaveProps {
  orders?: any[];
  data?: WavePoint[];
  metricLabel?: string;
  initialTimeframe?: TimeframeMode;
}

const TIMEFRAME_OPTIONS: {
  id: TimeframeMode;
  label: string;
  shortLabel: string;
  cadenceLabel: string;
  description: string;
}[] = [
  {
    id: "day",
    label: "Day View",
    shortLabel: "24h Live",
    cadenceLabel: "Deliveries per hour",
    description: "24h window ending Now",
  },
  {
    id: "week",
    label: "Week View",
    shortLabel: "7 Days",
    cadenceLabel: "Deliveries per day",
    description: "Last 7 days ending Today",
  },
  {
    id: "month",
    label: "Month View",
    shortLabel: "30 Days",
    cadenceLabel: "Deliveries per week",
    description: "Last 30 days ending Today",
  },
];

export function DeliveryRhythmWave({
  orders,
  data,
  metricLabel,
  initialTimeframe = "day",
}: DeliveryRhythmWaveProps) {
  const [mounted, setMounted] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeframeMode>(initialTimeframe);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { isDark } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on outside click or escape key press
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen]);

  const currentOption = useMemo(
    () => TIMEFRAME_OPTIONS.find((opt) => opt.id === timeframe) || TIMEFRAME_OPTIONS[0],
    [timeframe]
  );

  // Dynamically compute wave data points based on user's real orders and selected timeframe
  const points = useMemo<WavePoint[]>(() => {
    // If explicit static data override is passed and no orders
    if ((!orders || orders.length === 0) && data && data.length > 0) {
      return data;
    }

    // Use current client time once mounted; fallback to deterministic reference date during SSR
    const now = mounted ? new Date() : new Date("2026-11-15T00:00:00.000Z");

    if (timeframe === "day") {
      // 13 slots of 2 hours covering the last 24 hours, ending at Now (Real-time synchronization)
      const slots: { label: string; fullDate: string; start: number; end: number }[] = [];
      for (let i = 12; i >= 0; i--) {
        const slotTime = new Date(now.getTime() - i * 2 * 3600 * 1000);
        const isNow = i === 0;
        const timeStr = slotTime.toLocaleTimeString([], { hour: "numeric", hour12: true });
        const label = isNow ? "Now" : timeStr;
        const fullDate = isNow
          ? `Current Time (${timeStr})`
          : slotTime.toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });

        slots.push({
          label,
          fullDate,
          start: slotTime.getTime() - 3600 * 1000,
          end: slotTime.getTime() + 3600 * 1000,
        });
      }

      const buckets = new Array(slots.length).fill(0);
      if (orders && orders.length > 0) {
        orders.forEach((o) => {
          if (!o?.createdAt) return;
          const orderTime = new Date(o.createdAt).getTime();
          for (let i = 0; i < slots.length; i++) {
            if (orderTime >= slots[i].start && orderTime < slots[i].end) {
              buckets[i] += Number(o.quantity) || 100;
              break;
            }
          }
        });
      }

      return slots.map((s, i) => ({
        time: s.label,
        value: buckets[i],
        fullDate: s.fullDate,
      }));
    }

    if (timeframe === "week") {
      // 7 daily slots covering the last 7 calendar days, ending Today
      const slots: { label: string; fullDate: string; start: number; end: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const start = d.getTime();
        const end = start + 24 * 3600 * 1000;
        const isToday = i === 0;
        const dayName = d.toLocaleDateString([], { weekday: "short" });
        const label = isToday ? "Today" : dayName;
        const fullDate = d.toLocaleDateString([], {
          weekday: "long",
          month: "short",
          day: "numeric",
        });

        slots.push({
          label,
          fullDate,
          start,
          end,
        });
      }

      const buckets = new Array(slots.length).fill(0);
      if (orders && orders.length > 0) {
        orders.forEach((o) => {
          if (!o?.createdAt) return;
          const orderTime = new Date(o.createdAt).getTime();
          for (let i = 0; i < slots.length; i++) {
            if (orderTime >= slots[i].start && orderTime < slots[i].end) {
              buckets[i] += Number(o.quantity) || 100;
              break;
            }
          }
        });
      }

      return slots.map((s, i) => ({
        time: s.label,
        value: buckets[i],
        fullDate: s.fullDate,
      }));
    }

    // timeframe === "month"
    // 6 intervals of 5 days covering the last 30 days, ending Today
    const slots: { label: string; fullDate: string; start: number; end: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 5 * 24 * 3600 * 1000);
      const isToday = i === 0;
      const label = isToday ? "Today" : d.toLocaleDateString([], { month: "short", day: "numeric" });
      const end = d.getTime();
      const start = end - 5 * 24 * 3600 * 1000;
      const fullDate = isToday
        ? "Last 5 Days (Up to Today)"
        : `${new Date(start).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })} - ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;

      slots.push({
        label,
        fullDate,
        start,
        end,
      });
    }

    const buckets = new Array(slots.length).fill(0);
    if (orders && orders.length > 0) {
      orders.forEach((o) => {
        if (!o?.createdAt) return;
        const orderTime = new Date(o.createdAt).getTime();
        for (let i = 0; i < slots.length; i++) {
          if (orderTime >= slots[i].start && orderTime <= slots[i].end) {
            buckets[i] += Number(o.quantity) || 100;
            break;
          }
        }
      });
    }

    return slots.map((s, i) => ({
      time: s.label,
      value: buckets[i],
      fullDate: s.fullDate,
    }));
  }, [orders, data, timeframe, mounted]);

  // SVG dimensions
  const width = 1000;
  const height = 200;
  const paddingX = 30;
  const paddingY = 36;

  const maxValue = useMemo(() => Math.max(...points.map((p) => p.value), 100), [points]);

  // Convert points to SVG coordinates
  const svgCoords = useMemo(() => {
    if (points.length < 2) return [];
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

  const activeTitle = useMemo(() => {
    if (timeframe === "day") return "24h Delivery Rhythm Wave";
    if (timeframe === "week") return "7-Day Delivery Rhythm Wave";
    return "30-Day Delivery Rhythm Wave";
  }, [timeframe]);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border relative overflow-visible shadow-sm transition-colors">
      {/* Top Header & Dropdown Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-fg tracking-wide font-sans flex items-center gap-2 transition-colors">
            {activeTitle}
          </h3>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-accent-text border border-emerald-500/30 shrink-0">
            {timeframe === "day" ? "Real-Time Sync" : "Historical"}
          </span>
        </div>

        {/* Dropdown Filter where 'views per hour' was */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-surface-raised hover:bg-slate-200/80 dark:hover:bg-surface border border-slate-300/80 dark:border-border transition-all cursor-pointer font-mono text-xs text-slate-900 dark:text-fg select-none shadow-2xs"
            aria-expanded={isDropdownOpen}
            aria-haspopup="listbox"
            aria-label="Select delivery rhythm timeframe"
          >
            <span className="w-2 h-2 rounded-full bg-[#d8ec8d] shadow-[0_0_8px_#d8ec8d] animate-pulse shrink-0" />
            <span className="font-bold text-slate-900 dark:text-fg">{currentOption.label}</span>
            <span className="text-[10px] text-slate-500 dark:text-fg-muted font-normal hidden sm:inline">
              ({metricLabel || currentOption.cadenceLabel})
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 dark:text-fg-muted transition-transform duration-200 ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isDropdownOpen && (
            <div
              role="listbox"
              aria-label="Timeframe options"
              className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-56 rounded-2xl bg-white dark:bg-surface-raised border border-slate-200/90 dark:border-border shadow-2xl backdrop-blur-xl p-1.5 z-40 space-y-1"
            >
              {TIMEFRAME_OPTIONS.map((opt) => {
                const isSelected = timeframe === opt.id;
                return (
                  <button
                    key={opt.id}
                    role="option"
                    aria-selected={isSelected}
                    type="button"
                    onClick={() => {
                      setTimeframe(opt.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#d8ec8d]/20 text-[#3d4d0c] dark:text-[#d8ec8d] font-bold border border-[#d8ec8d]/40"
                        : "text-slate-700 dark:text-fg-2 hover:bg-slate-100 dark:hover:bg-surface hover:text-slate-950 dark:hover:text-fg"
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-fg">
                        {opt.label}
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#4D6010] dark:text-accent-text" />}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-fg-muted font-normal mt-0.5">
                        {opt.description}
                      </div>
                    </div>
                    <span className="text-[9px] font-semibold text-slate-400 dark:text-fg-subtle shrink-0 ml-2">
                      {opt.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="w-full relative overflow-visible">
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
            key={timeframe}
            d={pathD}
            fill="none"
            stroke="#b4cf47"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neonLimeFilter)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
            className="dark:stroke-[#d8ec8d]"
          />

          {/* Interactive Data Dots */}
          {svgCoords.map((pt, idx) => {
            const isHovered = hoveredIndex === idx;
            const isLast = idx === svgCoords.length - 1;
            return (
              <g
                key={idx}
                tabIndex={0}
                role="button"
                aria-label={`${pt.time}: ${pt.value.toLocaleString()} units`}
                className="cursor-pointer focus:outline-none"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => setHoveredIndex((prev) => (prev === idx ? null : idx))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setHoveredIndex((prev) => (prev === idx ? null : idx));
                  }
                }}
              >
                {/* Invisible hover hotspot */}
                <circle cx={pt.x} cy={pt.y} r={16} fill="transparent" />

                {/* Visible node */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : isLast ? 4.5 : 3}
                  fill={isDark ? "#ffffff" : "#171e00"}
                  stroke="#d8ec8d"
                  strokeWidth={isHovered ? 2.5 : isLast ? 2 : 1.5}
                  className="transition-all duration-200"
                />

                {/* Tooltip on Hover */}
                {isHovered && (
                  <g
                    transform={`translate(${Math.max(60, Math.min(width - 60, pt.x))}, ${Math.max(
                      30,
                      pt.y - 28
                    )})`}
                  >
                    <rect
                      x="-55"
                      y="-22"
                      width="110"
                      height="26"
                      rx="6"
                      fill={isDark ? "#131313" : "#ffffff"}
                      stroke="#d8ec8d"
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y="-10"
                      textAnchor="middle"
                      fill={isDark ? "#d8ec8d" : "#4D6010"}
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {pt.time}
                    </text>
                    <text
                      x="0"
                      y="1"
                      textAnchor="middle"
                      fill={isDark ? "#ffffff" : "#0f172a"}
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {pt.value.toLocaleString()} units
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Timestamps X-Axis Strip with exact SVG coordinate alignment */}
        <div
          suppressHydrationWarning
          className="relative w-full h-8 pt-2 border-t border-slate-100 dark:border-white/[0.05] text-[10px] sm:text-xs font-mono text-slate-500 dark:text-fg-muted select-none"
        >
          {points.map((pt, i) => {
            const isLast = i === points.length - 1;
            const isFirst = i === 0;
            const pct = points.length > 1 ? (i / (points.length - 1)) * 100 : 0;
            const isHovered = hoveredIndex === i;
            return (
              <span
                key={i}
                suppressHydrationWarning
                style={{
                  left: `${pct}%`,
                  transform: isFirst
                    ? "translateX(0%)"
                    : isLast
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
                }}
                className={`absolute top-2 transition-colors whitespace-nowrap ${
                  i % 2 === 0 || isLast ? "block" : "hidden sm:block"
                } ${
                  isLast
                    ? "font-bold text-[#4D6010] dark:text-[#d8ec8d] bg-accent/20 px-2 py-0.5 rounded-md border border-accent/40 shadow-xs"
                    : isHovered
                    ? "text-[#4D6010] dark:text-[#d8ec8d] font-bold"
                    : ""
                }`}
              >
                {pt.time}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
