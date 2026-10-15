"use client";

import React from "react";
import dynamic from "next/dynamic";

const DynamicLanding3DCanvas = dynamic(
  () => import("./Landing3DCanvas").then((mod) => mod.Landing3DCanvas),
  { ssr: false }
);

export function HeroScene() {
  return <DynamicLanding3DCanvas />;
}
