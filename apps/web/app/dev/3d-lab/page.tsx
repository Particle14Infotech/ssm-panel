"use client";

import React, { useState, Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  SocialChip,
  LOGOS,
  PlatformRing,
  PlatformId,
} from "@/components/three/objects/SocialLogos";
import { OrderJourney } from "@/components/three/objects/OrderJourney";
import { Brand, BRAND } from "@/components/three/brand";

type LabTarget =
  | "instagram"
  | "youtube"
  | "telegram"
  | "tiktok"
  | "facebook"
  | "x"
  | "wallet"
  | "package"
  | "provider"
  | "complete"
  | "journey";

function RotatingObject({
  target,
  journeyT,
  autoRotate = false,
}: {
  target: LabTarget;
  journeyT: number;
  autoRotate?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (groupRef.current && autoRotate && target !== "journey") {
      groupRef.current.rotation.y += dt * 0.4;
    }
  });

  return (
    <group ref={groupRef} rotation={autoRotate ? [0, 0, 0] : [0.12, 0.22, 0]}>
      {target === "instagram" && <SocialChip id="instagram" tintIndex={0} scale={1.8} />}
      {target === "youtube" && <SocialChip id="youtube" tintIndex={1} scale={1.8} />}
      {target === "telegram" && <SocialChip id="telegram" tintIndex={2} scale={1.8} />}
      {target === "tiktok" && <SocialChip id="tiktok" tintIndex={0} scale={1.8} />}
      {target === "facebook" && <SocialChip id="facebook" tintIndex={1} scale={1.8} />}
      {target === "x" && <SocialChip id="x" tintIndex={2} scale={1.8} />}

      {target === "wallet" && (
        <group scale={2.2} rotation={[0.4, 0.4, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 0.12, 48]} />
            <Brand color={BRAND.pink} glow={0.3} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.5, 0.04, 16, 48]} />
            <Brand color={BRAND.lime} glow={0.4} />
          </mesh>
        </group>
      )}

      {target === "package" && (
        <group scale={2.0} rotation={[0.2, 0.4, 0]}>
          <RoundedBox args={[0.9, 0.65, 0.9]} radius={0.05}>
            <Brand color={BRAND.lime} glow={0.3} />
          </RoundedBox>
          <mesh>
            <boxGeometry args={[0.12, 0.66, 0.92]} />
            <Brand color="#ffffff" glow={0.05} />
          </mesh>
        </group>
      )}

      {target === "provider" && (
        <group scale={2.0} rotation={[0.2, 0.4, 0]}>
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
      )}

      {target === "complete" && (
        <group scale={2.0} rotation={[0.1, 0.2, 0]}>
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
      )}

      {target === "journey" && (
        <group position={[0, 0, 0]}>
          <OrderJourney customT={journeyT} scale={0.45} />
        </group>
      )}
    </group>
  );
}

export default function Dev3DLabPage() {
  const [target, setTarget] = useState<LabTarget>("instagram");
  const [journeyT, setJourneyT] = useState(0.3);

  const targets: LabTarget[] = [
    "instagram",
    "youtube",
    "telegram",
    "tiktok",
    "facebook",
    "x",
    "wallet",
    "package",
    "provider",
    "complete",
    "journey",
  ];

  return (
    <div className="min-h-screen bg-[#07080B] text-white p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl flex items-center justify-between mb-6 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D8D] via-[#D8EC8D] to-[#7B3FF2]">
            3D Object & Logo Lab
          </h1>
          <p className="text-sm text-zinc-400">
            Real platform logos and order journey verification
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="lab-select" className="text-sm font-medium text-zinc-300">
            Select 3D Asset:
          </label>
          <select
            id="lab-select"
            value={target}
            onChange={(e) => setTarget(e.target.value as LabTarget)}
            className="bg-zinc-900 border border-white/20 text-white rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#D8EC8D]"
          >
            {targets.map((t) => (
              <option key={t} value={t}>
                {t.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pill selection buttons */}
      <div className="w-full max-w-4xl flex flex-wrap gap-2 mb-4 justify-center">
        {targets.map((t) => (
          <button
            key={t}
            type="button"
            data-testid={`lab-btn-${t}`}
            onClick={() => setTarget(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
              target === t
                ? "bg-gradient-to-r from-[#D8EC8D] to-[#BEF264] text-[#121b00] shadow-lg shadow-[#D8EC8D]/30 scale-105"
                : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-white/10"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {target === "journey" && (
        <div className="w-full max-w-xl flex items-center gap-4 mb-4 bg-zinc-900/80 p-3 rounded-xl border border-white/10">
          <span className="text-xs font-mono text-zinc-400">Journey Progress:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={journeyT}
            onChange={(e) => setJourneyT(parseFloat(e.target.value))}
            className="flex-1 accent-[#D8EC8D]"
          />
          <span className="text-xs font-mono font-bold text-[#D8EC8D] w-12 text-right">
            {(journeyT * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* 800x800 Canvas Container */}
      <div
        id="lab-canvas-container"
        className="w-[800px] h-[800px] bg-zinc-950/80 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden flex items-center justify-center"
      >
        <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-mono text-zinc-300">
          Preview: <span data-testid="lab-target-badge" className="text-[#D8EC8D] font-semibold">{target}</span>
        </div>

        <Canvas
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
          camera={{ position: [0, 0, target === "journey" ? 7 : 4.5], fov: 45 }}
          className="w-full h-full"
        >
          <ambientLight intensity={1.0} />
          <directionalLight position={[10, 10, 5]} intensity={1.8} color="#FFFFFF" />
          <pointLight position={[-8, -5, -4]} intensity={2.5} color="#FF4D8D" />
          <pointLight position={[8, -8, 6]} intensity={2.2} color="#D8EC8D" />
          <pointLight position={[0, 10, -5]} intensity={2.0} color="#7B3FF2" />

          <Suspense fallback={null}>
            <Environment resolution={256}>
              <group rotation={[-Math.PI / 3, 0, 1]}>
                <Lightformer
                  form="rect"
                  intensity={4}
                  color="#FF4D8D"
                  scale={[10, 5, 1]}
                  position={[-5, 5, -5]}
                  target={[0, 0, 0]}
                />
                <Lightformer
                  form="rect"
                  intensity={3.5}
                  color="#D8EC8D"
                  scale={[10, 5, 1]}
                  position={[5, -5, 5]}
                  target={[0, 0, 0]}
                />
                <Lightformer
                  form="ring"
                  intensity={3}
                  color="#7B3FF2"
                  scale={8}
                  position={[0, 8, -2]}
                  target={[0, 0, 0]}
                />
              </group>
            </Environment>

            <RotatingObject target={target} journeyT={journeyT} />
            <OrbitControls enableZoom={true} enablePan={false} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
