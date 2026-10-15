"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function ParticleField({ count = 350 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, colors, scales] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sca = new Float32Array(count);

    const color1 = new THREE.Color("#FF4D8D");
    const color2 = new THREE.Color("#D8EC8D");
    const color3 = new THREE.Color("#7B3FF2");
    const color4 = new THREE.Color("#FFFFFF");

    for (let i = 0; i < count; i++) {
      // Spread across 3D sphere volume
      const r = 3.5 + Math.random() * 9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const mixed = Math.random();
      const chosenColor =
        mixed < 0.35 ? color1 : mixed < 0.65 ? color2 : mixed < 0.88 ? color3 : color4;
      col[i * 3] = chosenColor.r;
      col[i * 3 + 1] = chosenColor.g;
      col[i * 3 + 2] = chosenColor.b;

      sca[i] = 0.5 + Math.random() * 1.5;
    }

    return [pos, col, sca];
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const time = state.clock.getElapsedTime();
    pointsRef.current.rotation.y = time * 0.04;
    pointsRef.current.rotation.x = Math.sin(time * 0.02) * 0.05;

    const posAttr = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = posAttr.getY(i);
      y += 0.014; // upward drift
      if (y > 7) y = -7;
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
