import React from "react";

interface SoftMeshGradientProps {
  className?: string;
  intensity?: "subtle" | "medium" | "vibrant";
  position?: "top-right" | "top-center" | "center" | "split";
}

/**
 * SoftMeshGradient:
 * Blurred, soft-focus 3D mesh-gradient shape (crown/tulip inspired curves)
 * using the lime-to-olive gradient (#243100 to #DBEF90) with high-diffusion glow and bloom.
 */
export function SoftMeshGradient({
  className = "",
  intensity = "medium",
}: SoftMeshGradientProps) {
  const opacityMap = {
    subtle: "opacity-40",
    medium: "opacity-60",
    vibrant: "opacity-85",
  }[intensity];

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden -z-10 ${opacityMap} ${className}`}
    >
      {/* 3D mesh-gradient shape (crown / tulip contour) with lime #243100 to #DBEF90 bloom */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[950px] h-[700px] max-w-[125vw]">
        {/* Deep olive core base (#243100) */}
        <div className="absolute inset-0 rounded-[45%_55%_60%_40%/50%_45%_55%_50%] bg-[#243100] blur-[150px] opacity-85 transform -rotate-6" />

        {/* Center glowing chartreuse tulip bloom (#DBEF90) */}
        <div className="absolute top-[12%] left-[18%] w-[64%] h-[64%] rounded-[55%_45%_40%_60%/45%_55%_50%_50%] bg-gradient-to-tr from-[#243100] via-[#5b6b1b] to-[#DBEF90] blur-[115px] opacity-75 transform rotate-12" />

        {/* Specular high-bloom apex accent */}
        <div className="absolute top-[20%] left-[32%] w-[35%] h-[35%] rounded-full bg-[#DBEF90] blur-[85px] opacity-55 mix-blend-screen" />
      </div>

      {/* Secondary ambient olive aura */}
      <div className="absolute bottom-[5%] -left-[10%] w-[650px] h-[550px] rounded-full bg-[#243100]/35 blur-[160px]" />
      <div className="absolute top-[40%] -right-[15%] w-[550px] h-[500px] rounded-full bg-[#DBEF90]/10 blur-[150px]" />
    </div>
  );
}
