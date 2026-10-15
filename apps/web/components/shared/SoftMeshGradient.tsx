import React from "react";

interface SoftMeshGradientProps {
  className?: string;
  intensity?: "subtle" | "medium" | "vibrant";
  position?: "top-right" | "top-center" | "center" | "split";
}

/**
 * SoftMeshGradient:
 * Dark + Blue diffuse ambient aura (#1D4ED8 to #2563EB) for subtle depth behind glassmorphic panels.
 */
export function SoftMeshGradient({
  className = "",
  intensity = "subtle",
}: SoftMeshGradientProps) {
  const opacityMap = {
    subtle: "opacity-25",
    medium: "opacity-40",
    vibrant: "opacity-60",
  }[intensity];

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden -z-10 ${opacityMap} ${className}`}
    >
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[950px] h-[700px] max-w-[125vw]">
        {/* Deep blue core base (#1D4ED8) */}
        <div className="absolute inset-0 rounded-full bg-blue-900/30 blur-[150px] transform -rotate-6" />

        {/* Center blue bloom (#2563EB) */}
        <div className="absolute top-[12%] left-[18%] w-[64%] h-[64%] rounded-full bg-gradient-to-tr from-blue-900/40 via-blue-700/20 to-blue-500/10 blur-[120px] transform rotate-12" />

        {/* Specular apex accent */}
        <div className="absolute top-[20%] left-[32%] w-[35%] h-[35%] rounded-full bg-blue-500/10 blur-[90px]" />
      </div>

      {/* Secondary subtle ambient blue aura */}
      <div className="absolute bottom-[5%] -left-[10%] w-[650px] h-[550px] rounded-full bg-blue-950/20 blur-[160px]" />
      <div className="absolute top-[40%] -right-[15%] w-[550px] h-[500px] rounded-full bg-blue-600/5 blur-[150px]" />
    </div>
  );
}
