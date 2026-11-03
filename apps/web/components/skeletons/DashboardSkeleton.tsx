"use client";

import React from "react";
import { Skeleton } from "@/components/shared/Skeleton";
import { GlassCard } from "@/components/shared/GlassCard";
import { motion } from "framer-motion";

export function DashboardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-8 pb-12"
    >
      {/* Welcome Banner Skeleton */}
      <GlassCard className="p-6 md:p-8 rounded-3xl border-white/10 bg-[#141414]/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Skeleton className="h-11 w-36 rounded-xl" />
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
      </GlassCard>

      {/* Bento Grid Skeleton: Hero Chart (8 cols) + Live Feed Hub (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Hero Chart Skeleton */}
        <div className="lg:col-span-8">
          <GlassCard className="p-6 rounded-3xl border-white/10 bg-[#141414]/90 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
              <div className="space-y-2">
                <Skeleton className="h-5 w-44 rounded" />
                <Skeleton className="h-3 w-64 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-16 rounded-xl" />
                <Skeleton className="h-8 w-36 rounded-xl" />
              </div>
            </div>

            {/* 4 Summary metric skeletons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-2">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-6 w-24 rounded" />
                  <Skeleton className="h-2.5 w-16 rounded" />
                </div>
              ))}
            </div>

            {/* Chart bar skeletons */}
            <div className="h-52 flex items-end justify-between gap-2 pt-4 border-b border-white/[0.06] pb-3">
              {[40, 65, 30, 80, 50, 95, 70].map((h, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <Skeleton className="w-full max-w-[36px] rounded-t-lg" style={{ height: `${h}%` }} />
                  <Skeleton className="h-2.5 w-8 rounded" />
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Live Feed & Channel Share Skeleton */}
        <div className="lg:col-span-4">
          <GlassCard className="p-6 rounded-3xl border-white/10 bg-[#141414]/90 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>

            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-6 w-6 rounded-lg" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-28 rounded" />
                      <Skeleton className="h-2.5 w-20 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
              <Skeleton className="h-3 w-24 rounded" />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-2 rounded-xl bg-white/[0.02] space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-3 w-8 rounded" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Recent Orders Section Skeleton */}
      <GlassCard className="p-6 md:p-8 rounded-3xl border-white/10 bg-[#141414]/90 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="space-y-1">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-3 w-48 rounded" />
          </div>
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>

        {/* Table Skeleton Rows */}
        <div className="space-y-3 pt-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-44 rounded" />
                  <Skeleton className="h-3 w-64 rounded" />
                </div>
              </div>
              <Skeleton className="h-4 w-16 rounded hidden sm:block" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}
