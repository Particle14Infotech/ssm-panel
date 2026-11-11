"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutopilotRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/new-order?tab=autopilot");
  }, [router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
      <h2 className="text-base font-semibold text-white">Redirecting to Autopilot Engine...</h2>
      <p className="text-xs text-neutral-400 mt-1">Autopilot is now conveniently part of New Order (Tab 4).</p>
    </div>
  );
}
