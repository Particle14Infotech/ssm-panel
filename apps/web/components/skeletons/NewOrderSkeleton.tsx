"use client";

import React from "react";
import { Skeleton } from "@/components/shared/Skeleton";
import { GlassCard } from "@/components/shared/GlassCard";
import { motion } from "framer-motion";

export function NewOrderSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-[1180px] mx-auto pb-24 md:pb-12 text-slate-200"
    >
      {/* Page Header */}
      <div className="mb-6">
        <Skeleton className="h-8 w-44 rounded-lg mb-2" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 p-1 bg-white/[0.04] border border-white/10 rounded-2xl w-fit mb-8">
        <Skeleton className="h-9 w-32 rounded-xl" />
        <Skeleton className="h-9 w-40 rounded-xl" />
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form Column */}
        <div className="lg:col-span-8 space-y-7">
          {/* 1. Platform Selector */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>
            <div className="flex flex-wrap gap-2.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-11 w-32 rounded-xl" />
              ))}
            </div>
          </div>

          {/* 2. Category Selector */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>
            <Skeleton className="h-13 w-full rounded-2xl" />
          </div>

          {/* 3. Service Selector */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>
            {/* Service Box */}
            <GlassCard className="p-4 rounded-2xl border-white/10 bg-[#141414]/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-32 rounded" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                </div>
                <Skeleton className="h-6 w-20 rounded-lg shrink-0 ml-4" />
              </div>
              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/[0.06]">
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
              </div>
            </GlassCard>
          </div>

          {/* 4. Target Link & Quantity Details */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>
            <GlassCard className="p-5 rounded-2xl border-white/10 bg-[#141414]/90 space-y-5">
              <div className="space-y-2">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Right Order Summary Column */}
        <div className="lg:col-span-4 sticky top-6">
          <GlassCard className="p-6 rounded-3xl border-white/10 bg-[#141414]/95 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <Skeleton className="h-3.5 w-32 rounded" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            <div className="space-y-3 py-1">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-4 w-full rounded" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-4 w-40 rounded" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-3 w-12 rounded" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            </div>

            {/* Total Charge Box */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-9 w-32 rounded-lg" />
              <div className="flex justify-between pt-2 border-t border-white/[0.06]">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            </div>

            {/* Submit Button */}
            <Skeleton className="h-12 w-full rounded-2xl" />
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
}
