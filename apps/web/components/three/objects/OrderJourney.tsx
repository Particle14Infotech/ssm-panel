"use client";

import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Brand, BRAND } from "../brand";
import { SocialChip, type PlatformId } from "./SocialLogos";
import { stageStore } from "../stage";

export const STEPS = [
  "Add funds",
  "Choose service",
  "Place order",
  "Provider delivers",
  "Complete",
] as const;

export const STEP_DESCRIPTIONS = [
  "Top up your wallet. Any bonus credit is shown before you pay.",
  "Pick a platform and service. Price per 1,000 and min/max quantity are shown up front.",
  "Enter your link and quantity. The total is shown before you confirm.",
  "The order goes to the provider through their API. Status updates on its own.",
  "Completed and partial orders appear in your history. Any undelivered quantity goes back to your wallet.",
] as const;

const PICK: PlatformId[] = [
  "instagram",
  "youtube",
  "telegram",
  "tiktok",
  "facebook",
  "x",
];

export function OrderJourney({
  customT,
  scale = 1,
}: {
  customT?: number;
  scale?: number;
}) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-4.8, -0.8, 0),
        new THREE.Vector3(-2.4, 0.9, 0.3),
        new THREE.Vector3(0, -0.7, 0),
        new THREE.Vector3(2.4, 0.9, 0.3),
        new THREE.Vector3(4.8, -0.5, 0),
      ]),
    []
  );

  const tube = useMemo(
    () => new THREE.TubeGeometry(curve, 120, 0.022, 8),
    [curve]
  );
  const nodePos = useMemo(
    () => [0, 0.25, 0.5, 0.75, 1].map((t) => curve.getPoint(t)),
    [curve]
  );

  const token = useRef<THREE.Group>(null!);
  const nodes = useRef<(THREE.Group | null)[]>([]);
  const picker = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }, dt) => {
    const t = typeof customT === "number" ? customT : stageStore.pipelineT;
    if (token.current) {
      token.current.position.copy(curve.getPoint(Math.max(0, Math.min(1, t))));
    }

    const active = Math.min(4, Math.max(0, Math.floor(t * 5 - 0.001 + 0.2)));

    nodes.current.forEach((n, i) => {
      if (!n) return;
      const s = i === active ? 1.2 : 1;
      n.scale.setScalar(THREE.MathUtils.damp(n.scale.x, s, 8, dt));
      n.traverse((o) => {
        const m = (o as THREE.Mesh).material as
          | THREE.MeshPhysicalMaterial
          | THREE.MeshBasicMaterial
          | undefined;
        if (m && "opacity" in m) {
          m.transparent = true;
          m.opacity = i > active ? 0.4 : 1;
        }
      });
    });

    // step 2: carousel cycles through platforms, the highlighted one pulses
    const cur = Math.floor(clock.elapsedTime * 1.2) % 3;
    picker.current.forEach((p, i) => {
      if (!p) return;
      p.scale.setScalar(
        THREE.MathUtils.damp(p.scale.x, i === cur ? 0.65 : 0.45, 8, dt)
      );
    });
  });

  return (
    <group scale={scale} name="order-journey">
      {/* Journey Tube Track */}
      <mesh geometry={tube}>
        <meshBasicMaterial color={BRAND.pink} transparent opacity={0.55} />
      </mesh>

      {/* 1 Add funds: coin */}
      <group
        ref={(r) => {
          nodes.current[0] = r;
        }}
        position={nodePos[0]}
        name="step-node-wallet"
      >
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.12, 48]} />
          <Brand color={BRAND.pink} glow={0.3} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.5, 0.04, 16, 48]} />
          <Brand color={BRAND.lime} glow={0.4} />
        </mesh>
      </group>

      {/* 2 Choose service: three platform chips */}
      <group
        ref={(r) => {
          nodes.current[1] = r;
        }}
        position={nodePos[1]}
        name="step-node-choose"
      >
        {PICK.slice(0, 3).map((id, i) => (
          <group
            key={id}
            ref={(r) => {
              picker.current[i] = r;
            }}
            position={[(i - 1) * 0.95, 0, 0]}
            scale={0.5}
          >
            <SocialChip id={id} tintIndex={i} />
          </group>
        ))}
      </group>

      {/* 3 Place order: package */}
      <group
        ref={(r) => {
          nodes.current[2] = r;
        }}
        position={nodePos[2]}
        name="step-node-package"
      >
        <RoundedBox args={[0.9, 0.65, 0.9]} radius={0.05}>
          <Brand color={BRAND.lime} glow={0.3} />
        </RoundedBox>
        <mesh>
          <boxGeometry args={[0.12, 0.66, 0.92]} />
          <Brand color="#ffffff" glow={0.05} />
        </mesh>
      </group>

      {/* 4 Provider delivers: server stack */}
      <group
        ref={(r) => {
          nodes.current[3] = r;
        }}
        position={nodePos[3]}
        name="step-node-provider"
      >
        {[-0.26, 0, 0.26].map((y, i) => (
          <RoundedBox
            key={i}
            args={[1, 0.2, 0.65]}
            radius={0.04}
            position={[0, y, 0]}
          >
            <Brand color={BRAND.purple} glow={0.25} />
          </RoundedBox>
        ))}
      </group>

      {/* 5 Complete: sphere + check */}
      <group
        ref={(r) => {
          nodes.current[4] = r;
        }}
        position={nodePos[4]}
        name="step-node-complete"
      >
        <mesh>
          <sphereGeometry args={[0.55, 48, 48]} />
          <Brand color={BRAND.pink} glow={0.35} />
        </mesh>
        <mesh>
          <tubeGeometry
            args={[
              new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.22, 0, 0.55),
                new THREE.Vector3(-0.07, -0.18, 0.57),
                new THREE.Vector3(0.26, 0.22, 0.55),
              ]),
              24,
              0.055,
              12,
            ]}
          />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* the order token travelling the path */}
      <group ref={token} name="journey-token">
        <mesh>
          <sphereGeometry args={[0.15, 24, 24]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <pointLight color={BRAND.lime} intensity={2.5} distance={3} />
      </group>
    </group>
  );
}
