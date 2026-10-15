"use client";

import React from "react";
import { CrownAura, CrownMesh } from "./CrownAura";

export interface AuraShapeProps {
  presence?: number;
  mousePos?: { current: [number, number] };
  scale?: number;
  position?: [number, number, number];
  calm?: boolean;
}

/**
 * AuraShape alias backed by the new CrownAura 3D glass crown
 */
export function AuraShape({
  presence = 1,
  mousePos,
  scale = 1.9,
  position = [0, 0, 0],
  calm = false,
}: AuraShapeProps) {
  return (
    <group position={position} scale={scale}>
      <CrownAura
        presence={presence}
        mousePos={mousePos}
        calm={calm}
        size="hero"
      />
    </group>
  );
}

// Retain GradientOrb alias for backward compatibility
export const GradientOrb = AuraShape;
