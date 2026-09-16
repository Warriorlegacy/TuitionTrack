"use client";

// KnowledgeSphere — Scene 1 floating translucent sphere (Blueprint #73 Scene 1, #75).
// InstancedMesh nodes + low-poly shell + drei Sparkles. Lazy/Suspense at call site,
// IntersectionObserver activation, frameloop paused offscreen, CSS/SVG fallback.

import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";

export type ScrollProgressRef = React.MutableRefObject<{ p: number }>;

// Deterministic pseudo-random (stable across renders, no hydration jitter)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useWebGL(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setOk(!!(c.getContext("webgl2") ?? c.getContext("webgl")));
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

// ── Nodes: one InstancedMesh draw call, low-poly icosahedra ──
function Nodes({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const data = useMemo(() => {
    const rand = mulberry32(42);
    const accent = new THREE.Color("#8fb0ff");
    const amber = new THREE.Color("#f5a524");
    return Array.from({ length: count }, (_, i) => {
      // Shell distribution radius 1.2–2.0 (inside the 2.2 sphere)
      const r = 1.2 + rand() * 0.8;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      return {
        pos: new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)),
        scale: 0.5 + rand() * 0.9,
        color: i % 6 === 0 ? amber : accent, // every ~6th node = weak prerequisite (amber)
      };
    });
  }, [count]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    const m = new THREE.Matrix4();
    data.forEach((d, i) => {
      m.makeScale(d.scale, d.scale, d.scale);
      m.setPosition(d.pos);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, d.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [data]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[0.09, 0]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.95} />
    </instancedMesh>
  );
}

// ── Rig: scroll-linked camera + pointer parallax, read from refs (no re-render) ──
function Rig({
  group,
  scrollRef,
  pointerRef,
}: {
  group: React.RefObject<THREE.Group>;
  scrollRef: ScrollProgressRef;
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const { camera } = useThree();
  const spin = useRef(0);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const p = Math.max(0, Math.min(1, scrollRef.current.p));
    spin.current += Math.min(delta, 0.05) * 0.12;
    g.rotation.y = spin.current + p * Math.PI * 1.25; // nodes resolve as you scroll
    const tx = pointerRef.current.y * 0.22;
    const ty = pointerRef.current.x * 0.35;
    g.rotation.x += (tx - g.rotation.x) * 0.045;
    g.rotation.z += (ty * 0.3 - g.rotation.z) * 0.045;
    g.position.y = p * 0.9;
    camera.position.z = 7 - p * 1.3;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ── CSS/SVG fallback: same footprint, zero WebGL (#75 requirement) ──
export function SphereFallback({ label = "Connected exam concepts resolving into a study plan" }: { label?: string }) {
  const dots = useMemo(() => {
    const rand = mulberry32(7);
    return Array.from({ length: 26 }, (_, i) => {
      const a = rand() * Math.PI * 2;
      const r = 34 + rand() * 62;
      return { x: 120 + r * Math.cos(a), y: 120 + r * Math.sin(a), amber: i % 6 === 0, k: i };
    });
  }, []);
  return (
    <svg viewBox="0 0 240 240" className="h-auto w-full" role="img" aria-label={label}>
      <defs>
        <radialGradient id="tt-sphere" cx="38%" cy="32%">
          <stop offset="0%" stopColor="#8fb0ff" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#8fb0ff" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#8fb0ff" stopOpacity="0.03" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="120" r="104" fill="url(#tt-sphere)" />
      <circle cx="120" cy="120" r="104" fill="none" stroke="#8fb0ff" strokeOpacity="0.5" />
      <circle cx="120" cy="120" r="72" fill="none" stroke="#8fb0ff" strokeOpacity="0.28" />
      <circle cx="120" cy="120" r="40" fill="none" stroke="#8fb0ff" strokeOpacity="0.2" />
      <ellipse cx="120" cy="120" rx="112" ry="36" fill="none" stroke="#8fb0ff" strokeOpacity="0.3" transform="rotate(-18 120 120)" />
      {dots.map((d) => (
        <circle key={d.k} cx={d.x} cy={d.y} r={d.amber ? 4 : 2.6} fill={d.amber ? "#f5a524" : "#bcd0ff"} opacity={d.amber ? 0.95 : 0.75} />
      ))}
    </svg>
  );
}

export function KnowledgeSphere({ scrollRef }: { scrollRef: ScrollProgressRef }) {
  const webgl = useWebGL();
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const group = useRef<THREE.Group>(null!);
  const pointerRef = useRef({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [hidden, setHidden] = useState(false);
  const running = inView && !hidden;

  // IntersectionObserver: expensive scene only near viewport (#75)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "240px" });
    io.observe(el);
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const count = mobile ? 36 : 96;

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto aspect-square w-full max-w-[300px] sm:max-w-[420px] lg:max-w-[520px]"
      role="img"
      aria-label="Abstract knowledge sphere: exam concepts, question cards and mastery nodes connecting as you scroll"
      onPointerMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        pointerRef.current = {
          x: ((e.clientX - r.left) / r.width - 0.5) * 2,
          y: ((e.clientY - r.top) / r.height - 0.5) * 2,
        };
      }}
    >
      {webgl === null ? (
        <div className="absolute inset-0 animate-pulse rounded-full bg-white/5" aria-hidden />
      ) : webgl === false || reduce ? (
        <SphereFallback />
      ) : (
        <div className="absolute inset-0" aria-hidden>
          <Canvas
            dpr={mobile ? 1 : [1, 1.75]}
            camera={{ position: [0, 0, 7], fov: 42 }}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            frameloop={running ? "always" : "never"}
            style={{ pointerEvents: "none" }}
          >
            <Suspense fallback={null}>
              <group ref={group}>
                <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.7}>
                  {/* Translucent shell */}
                  <mesh>
                    <sphereGeometry args={[2.2, 32, 32]} />
                    <meshPhysicalMaterial color="#8fb0ff" transparent opacity={0.14} roughness={0.2} metalness={0} depthWrite={false} />
                  </mesh>
                  <Nodes count={count} />
                  {/* Orbit rings */}
                  <mesh rotation={[Math.PI / 2.4, 0, 0.4]}>
                    <torusGeometry args={[2.65, 0.014, 8, 128]} />
                    <meshBasicMaterial color="#8fb0ff" transparent opacity={0.4} toneMapped={false} />
                  </mesh>
                  <mesh rotation={[Math.PI / 1.7, 0.4, -0.3]}>
                    <torusGeometry args={[2.9, 0.01, 8, 128]} />
                    <meshBasicMaterial color="#5eead4" transparent opacity={0.25} toneMapped={false} />
                  </mesh>
                  <Sparkles count={mobile ? 30 : 70} scale={[5, 5, 5]} size={2} speed={0.25} opacity={0.6} color="#bcd0ff" />
                </Float>
              </group>
              <Rig group={group} scrollRef={scrollRef} pointerRef={pointerRef} />
              <ambientLight intensity={0.7} />
              <pointLight position={[6, 4, 6]} intensity={12} color="#bcd0ff" />
            </Suspense>
          </Canvas>
        </div>
      )}
    </div>
  );
}
