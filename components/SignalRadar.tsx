"use client";

import { useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

// War-Room Radar — the dead pipeline as a live intel scope. Every lost deal is a blip;
// the sweep rotates and PINGS the ones that are re-triggerable today. Dim = dormant
// graveyard, bright green = the objection dissolved (you shipped the fix). Click a blip
// → its case file. The whole product thesis as a thing you watch, not a list you read.

export type RadarBlip = {
  id: string;
  account: string;
  angle: number; // 0..1 → position around the scope (stable per account)
  score: number; // 0..1; live blips sit closer to center the hotter they are
  live: boolean; // re-triggerable (has a scored case file) vs dormant
};

type Props = {
  blips: RadarBlip[];
  activeId: string | null;
  onPing: (id: string) => void;
  onSelect: (id: string | null) => void;
  reduced: boolean;
};

const R = 4.0; // scope radius
const HOT = "#34d27b";
const ACTIVE = "#9affc9";
const DIM = "#46618f";
const GRID = "#1f6fa0";
const SWEEP = "#3ee08f";

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const norm = (a: number) => ((a % TAU) + TAU) % TAU;

// did the sweep, advancing prev→cur, pass angle phi this frame?
function crossed(prev: number, cur: number, phi: number): boolean {
  if (cur - prev >= TAU) return true;
  const p = norm(prev);
  const c = norm(cur);
  const t = norm(phi);
  return p <= c ? t > p && t <= c : t > p || t <= c;
}

// stable 0..1 hash from a string (for dormant-blip radius jitter)
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

function RadarGrid() {
  const rings = [1.1, 2.0, 2.9, 3.8];
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[R, 64]} />
        <meshBasicMaterial color="#08182b" transparent opacity={0.55} toneMapped={false} />
      </mesh>
      {rings.map((r) => (
        <mesh key={r} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[r - 0.012, r, 96]} />
          <meshBasicMaterial color={GRID} transparent opacity={0.22} toneMapped={false} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2 * R, 0.02]} />
        <meshBasicMaterial color={GRID} transparent opacity={0.13} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.02, 2 * R]} />
        <meshBasicMaterial color={GRID} transparent opacity={0.13} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Sweep({
  sweepRef,
  reduced,
}: {
  sweepRef: MutableRefObject<number>;
  reduced: boolean;
}) {
  const g = useRef<THREE.Group>(null);
  const a = useRef(0);
  useFrame((_, dt) => {
    if (!reduced) a.current += Math.min(dt, 0.05) * 0.55;
    sweepRef.current = a.current;
    if (g.current) g.current.rotation.y = -a.current;
  });
  return (
    <group ref={g}>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.15, R, 48, 1, -0.5, 0.5]} />
        <meshBasicMaterial
          color={SWEEP}
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[R / 2, 0.012, 0]}>
        <boxGeometry args={[R, 0.015, 0.02]} />
        <meshBasicMaterial color={SWEEP} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial
          color="#000"
          emissive={SWEEP}
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Blip({
  blip,
  isActive,
  sweepRef,
  onPing,
  onSelect,
}: {
  blip: RadarBlip;
  isActive: boolean;
  sweepRef: MutableRefObject<number>;
  onPing: (id: string) => void;
  onSelect: (id: string | null) => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const flare = useRef(0);
  const prev = useRef<number | null>(null);
  const [hovered, setHovered] = useState(false);

  const pos = useMemo(() => {
    const phi = blip.angle * TAU;
    const r = blip.live
      ? lerp(1.15, 3.3, 1 - blip.score)
      : lerp(2.7, 3.95, hash01(blip.id + "r"));
    return new THREE.Vector3(Math.cos(phi) * r, 0, Math.sin(phi) * r);
  }, [blip]);
  const phi = useMemo(() => norm(Math.atan2(pos.z, pos.x)), [pos]);

  const baseSize = blip.live ? (isActive ? 0.18 : 0.12) : 0.055;
  const baseGlow = blip.live ? (isActive ? 2.8 : 1.4) : 0.5;
  const color = isActive ? ACTIVE : blip.live ? HOT : DIM;

  useFrame((state, dt) => {
    const cur = sweepRef.current;
    if (prev.current === null) prev.current = cur;
    if (crossed(prev.current, cur, phi)) {
      flare.current = 1;
      if (blip.live) onPing(blip.id);
    }
    prev.current = cur;
    flare.current = Math.max(0, flare.current - dt * 1.6);
    const f = flare.current;

    if (mat.current) mat.current.emissiveIntensity = baseGlow + f * 3.2;
    if (mesh.current) {
      const s = baseSize * (1 + f * 0.55 + (hovered ? 0.3 : 0));
      mesh.current.scale.setScalar(s);
      mesh.current.position.y = blip.live
        ? 0.12 + Math.sin(state.clock.elapsedTime + phi) * 0.04
        : 0;
    }
    if (ring.current && ringMat.current) {
      const rs = baseSize * (1 + f * 9);
      ring.current.scale.set(rs, rs, rs);
      ringMat.current.opacity = f * 0.6;
    }
  });

  return (
    <group position={pos}>
      <mesh
        ref={mesh}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(blip.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[1, 18, 18]} />
        <meshStandardMaterial
          ref={mat}
          color="#000"
          emissive={color}
          emissiveIntensity={baseGlow}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.9, 1.15, 32]} />
        <meshBasicMaterial
          ref={ringMat}
          color={color}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {blip.live && (hovered || isActive) && (
        <Html center distanceFactor={9} position={[0, 0.5, 0]} className="radar-tag-wrap">
          <span className={`radar-tag${isActive ? " radar-tag--active" : ""}`}>
            {blip.account}
          </span>
        </Html>
      )}
    </group>
  );
}

export default function SignalRadar({ blips, activeId, onPing, onSelect, reduced }: Props) {
  const sweepRef = useRef(0);
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 5.4, 5.6], fov: 42 }}
      gl={{ antialias: true }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#050912"]} />
      <fog attach="fog" args={["#050912", 7, 17]} />
      <ambientLight intensity={0.4} />
      <RadarGrid />
      <Sweep sweepRef={sweepRef} reduced={reduced} />
      {blips.map((b) => (
        <Blip
          key={b.id}
          blip={b}
          isActive={b.id === activeId}
          sweepRef={sweepRef}
          onPing={onPing}
          onSelect={onSelect}
        />
      ))}
      <OrbitControls
        makeDefault
        enableZoom={false}
        enablePan={false}
        autoRotate={!reduced}
        autoRotateSpeed={0.35}
        minPolarAngle={0.55}
        maxPolarAngle={1.15}
      />
      <EffectComposer>
        <Bloom intensity={1.15} luminanceThreshold={0.15} luminanceSmoothing={0.5} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
