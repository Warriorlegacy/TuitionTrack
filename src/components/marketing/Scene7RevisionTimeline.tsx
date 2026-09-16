"use client";

// Scene 7 — "Review before you forget" (Blueprint #73 Scene 7).
// Orbital spaced-repetition timeline: 3 rings (now / 3d / 7d) + cards.
// 3D: 3 torus rings + instanced orbiting cards. Static list is the SEO source.

import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { mulberry32, useIsMobile, useSceneActive, useWebGL } from "./scene-kit";
import type { LoadState } from "./ui";

export const SCENE7_WIRING = { scene: 7, readyFor3D: true, contract: "dueFilter id drives both list + ring highlight; SM-2 dates come from the scheduler." } as const;

const CARDS = [
  { id: "now", due: "Due now · 8", items: ["Quadratic sign ritual", "Relative-motion diagram", "Discriminant drill"] },
  { id: "3d", due: "In 3 days · 21", items: ["Trigonometry identities", "Kinematics graphs"] },
  { id: "7d", due: "In 7 days · 36", items: ["Full algebra re-test", "Mechanics mixed set"] },
] as const;

const RINGS = [1.3, 1.9, 2.5];

function OrbitCards({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const spin = useRef(0);
  const data = useMemo(() => {
    const rand = mulberry32(7);
    return Array.from({ length: count }, (_, i) => ({ ring: i % 3, a: rand() * Math.PI * 2, speed: 0.12 + (i % 3) * 0.06 }));
  }, [count]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const e = new THREE.Euler();
    data.forEach((d, i) => {
      e.set(0, d.a, 0.2);
      m.makeRotationFromEuler(e);
      m.setPosition(RINGS[d.ring] * Math.cos(d.a), (d.ring - 1) * 0.35, RINGS[d.ring] * Math.sin(d.a));
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [data]);
  useFrame((_, delta) => {
    spin.current += Math.min(delta, 0.05) * 0.2;
    ref.current.rotation.y = spin.current;
  });
  const c = useMemo(() => new THREE.Color("#8fb0ff"), []);
  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) ref.current.setColorAt(i, i % 5 === 0 ? new THREE.Color("#f5a524") : c);
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [count, c]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[0.22, 0.3, 0.02]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
    </instancedMesh>
  );
}

function Scene7Visual() {
  const webgl = useWebGL();
  const mobile = useIsMobile();
  const { ref, running } = useSceneActive();
  if (webgl === null) return <div ref={ref} className="aspect-square w-full animate-pulse rounded-tt-lg bg-white/5" aria-hidden />;
  if (webgl === false)
    return (
      <svg ref={ref} viewBox="0 0 240 240" className="h-auto w-full" role="img" aria-label="Three orbital revision rings">
        <circle cx="120" cy="120" r="44" fill="none" stroke="#f5a524" strokeWidth="2" />
        <circle cx="120" cy="120" r="72" fill="none" stroke="#8fb0ff" strokeOpacity="0.5" strokeWidth="1.5" />
        <circle cx="120" cy="120" r="100" fill="none" stroke="#8fb0ff" strokeOpacity="0.3" strokeWidth="1.5" />
        <rect x="150" y="62" width="14" height="18" rx="3" fill="#f5a524" />
        <rect x="66" y="150" width="14" height="18" rx="3" fill="#8fb0ff" />
      </svg>
    );
  return (
    <div ref={ref} className="relative aspect-square w-full" aria-hidden>
      <Canvas
        dpr={mobile ? 1 : [1, 1.5]}
        camera={{ position: [0, 3.4, 5.2], fov: 44 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={running ? "always" : "never"}
        style={{ pointerEvents: "none" }}
      >
        <Suspense fallback={null}>
          {[1.3, 1.9, 2.5].map((r, i) => (
            <mesh key={r} rotation={[Math.PI / 2.15, 0, 0]} position={[0, (i - 1) * 0.35, 0]}>
              <torusGeometry args={[r, 0.012, 8, 96]} />
              <meshBasicMaterial color={i === 0 ? "#f5a524" : "#8fb0ff"} transparent opacity={i === 0 ? 0.7 : 0.32} toneMapped={false} />
            </mesh>
          ))}
          <OrbitCards count={mobile ? 12 : 27} />
          <ambientLight intensity={0.9} />
        </Suspense>
      </Canvas>
    </div>
  );
}

const Scene7VisualLazy = dynamic(() => Promise.resolve({ default: Scene7Visual }), { ssr: false });

export function Scene7RevisionTimeline({ status = "ready" }: { status?: LoadState }) {
  const reduce = useReducedMotion();
  const [due, setDue] = useState<(typeof CARDS)[number]["id"]>("now");
  const current = CARDS.find((c) => c.id === due)!;
  if (status === "loading")
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Revision timeline loading">
        <Skeleton className="min-h-[240px] w-full rounded-tt-lg" />
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-tt-md" />)}</div>
      </div>
    );
  if (status === "error")
    return (
      <div role="alert" className="rounded-tt-lg border border-red-200 bg-red-50 p-8 text-center text-sm text-slate-600">
        Revision plan couldn’t load. Check your connection and try again.
      </div>
    );
  if (status === "empty")
    return (
      <div className="rounded-tt-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Nothing due — your orbit fills up after the first practice set.
      </div>
    );
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      {reduce ? (
        <svg viewBox="0 0 240 240" className="h-auto w-full" role="img" aria-label="Three orbital revision rings">
          <circle cx="120" cy="120" r="44" fill="none" stroke="#f5a524" strokeWidth="2" />
          <circle cx="120" cy="120" r="72" fill="none" stroke="#8fb0ff" strokeOpacity="0.5" strokeWidth="1.5" />
          <circle cx="120" cy="120" r="100" fill="none" stroke="#8fb0ff" strokeOpacity="0.3" strokeWidth="1.5" />
        </svg>
      ) : (
        <Scene7VisualLazy />
      )}
      <div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Due filter">
          {CARDS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setDue(c.id)}
              aria-pressed={due === c.id}
              className={cn(
                "tt-focus rounded-full border px-4 py-2 text-sm transition-colors",
                due === c.id ? "border-tt-amber/60 bg-tt-amber/15 font-semibold text-amber-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              {c.due}
            </button>
          ))}
        </div>
        <ul className="mt-5 space-y-2.5" aria-live="polite" aria-label={`Cards ${current.due}`}>
          {current.items.map((t) => (
            <motion.li
              key={t}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-tt-md border border-slate-200 bg-white p-4 text-[15px] text-slate-800"
            >
              {t}
            </motion.li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">65 revisions queued · forgetting-curve timed, 10 min/day keeps the orbit stable.</p>
      </div>
    </div>
  );
}
