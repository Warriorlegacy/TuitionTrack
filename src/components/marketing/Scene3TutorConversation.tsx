"use client";

// Scene 3 — "AI that teaches, not answers" (Blueprint #73 Scene 3).
// Socratic bubbles: hint → nudge → solution, never answer-first.
// 3D: low-poly orbiting hint bubbles (1 draw call). Static chat mock is the SEO source.

import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { LightbulbIcon } from "lucide-react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { mulberry32, useIsMobile, useSceneActive, useWebGL } from "./scene-kit";
import type { LoadState } from "./ui";

export const SCENE3_WIRING = {
  scene: 3,
  readyFor3D: true,
  contract: "hintLevel 0..2 drives both chat mock and bubble highlight; backend swaps MOCK_TURNS for tutor turns.",
} as const;

const MOCK_TURNS = [
  { id: "ask", who: "Aarav · Class 11", text: "A boat moves at 5 m/s across a river flowing at 3 m/s. What's the boat's speed relative to shore?" },
  { id: "hint1", who: "TuitionTrack AI · Hint 1", text: "Good question — which two motions are happening at once? Sketch them as arrows first." },
  { id: "hint2", who: "TuitionTrack AI · Hint 2", text: "They're perpendicular. Which theorem combines perpendicular vectors?" },
  { id: "fix", who: "TuitionTrack AI · Check", text: "Exactly — Pythagoras: √(5² + 3²) ≈ 5.8 m/s. Try the next one with the current at an angle." },
] as const;

// ── 3D bubbles: instanced spheres on two orbit rings, amber = active hint ──
function Bubbles({ count, active }: { count: number; active: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const spin = useRef(0);
  const data = useMemo(() => {
    const rand = mulberry32(11);
    return Array.from({ length: count }, (_, i) => ({
      r: i % 2 === 0 ? 1.5 : 2.1,
      a: rand() * Math.PI * 2,
      y: (rand() - 0.5) * 2.2,
      s: 0.5 + rand() * 0.8,
    }));
  }, [count]);
  const accent = useMemo(() => new THREE.Color("#8fb0ff"), []);
  const amber = useMemo(() => new THREE.Color("#f5a524"), []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    data.forEach((d, i) => {
      m.makeScale(d.s, d.s, d.s);
      m.setPosition(d.r * Math.cos(d.a), d.y, d.r * Math.sin(d.a));
      ref.current.setMatrixAt(i, m);
      ref.current.setColorAt(i, i % 4 === active % 4 ? amber : accent);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [data, active, accent, amber]);
  useFrame((_, delta) => {
    spin.current += Math.min(delta, 0.05) * 0.18;
    ref.current.rotation.y = spin.current;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[0.11, 0]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
    </instancedMesh>
  );
}

function Scene3Visual({ active }: { active: number }) {
  const webgl = useWebGL();
  const mobile = useIsMobile();
  const { ref, running } = useSceneActive();
  if (webgl === null) return <div ref={ref} className="aspect-square w-full animate-pulse rounded-tt-lg bg-white/5" aria-hidden />;
  if (webgl === false)
    return (
      <svg ref={ref} viewBox="0 0 240 200" className="h-auto w-full" role="img" aria-label="Three hint bubbles orbiting a question">
        <ellipse cx="120" cy="100" rx="92" ry="56" fill="none" stroke="#8fb0ff" strokeOpacity="0.35" />
        <ellipse cx="120" cy="100" rx="58" ry="34" fill="none" stroke="#8fb0ff" strokeOpacity="0.25" />
        <circle cx="60" cy="80" r="16" fill="#8fb0ff" opacity="0.7" />
        <circle cx="180" cy="70" r="20" fill="#f5a524" opacity="0.9" />
        <circle cx="130" cy="150" r="14" fill="#8fb0ff" opacity="0.6" />
      </svg>
    );
  return (
    <div ref={ref} className="relative aspect-square w-full" aria-hidden>
      <Canvas
        dpr={mobile ? 1 : [1, 1.5]}
        camera={{ position: [0, 0.4, 6.4], fov: 44 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={running ? "always" : "never"}
        style={{ pointerEvents: "none" }}
      >
        <Suspense fallback={null}>
          <Float speed={1} rotationIntensity={0.2} floatIntensity={0.6}>
            <Bubbles count={mobile ? 8 : 16} active={active} />
            <mesh rotation={[Math.PI / 2.5, 0, 0.3]}>
              <torusGeometry args={[2.1, 0.012, 8, 96]} />
              <meshBasicMaterial color="#8fb0ff" transparent opacity={0.35} toneMapped={false} />
            </mesh>
          </Float>
          <ambientLight intensity={0.8} />
        </Suspense>
      </Canvas>
    </div>
  );
}

const Scene3VisualLazy = dynamic(() => Promise.resolve({ default: Scene3Visual }), { ssr: false });

export function Scene3TutorConversation({ status = "ready" }: { status?: LoadState }) {
  const reduce = useReducedMotion();
  const [level, setLevel] = useState(reduce ? 3 : 1);
  if (status === "loading")
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Tutor conversation loading">
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-tt-md" />)}</div>
        <Skeleton className="min-h-[280px] w-full rounded-tt-lg" />
      </div>
    );
  if (status === "error")
    return (
      <div role="alert" className="rounded-tt-lg border border-red-200 bg-red-50 p-8 text-center text-sm text-slate-600">
        Tutor preview couldn’t load. Check your connection and try again.
      </div>
    );
  if (status === "empty")
    return (
      <div className="rounded-tt-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No conversation yet — ask your first question after the diagnostic.
      </div>
    );
  const visible = MOCK_TURNS.slice(0, level + 1);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Hint level">
          {["Hint 1", "Hint 2", "Solution"].map((l, i) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(i + 1)}
              aria-pressed={level === i + 1}
              className={cn(
                "tt-focus rounded-full border px-4 py-2 text-sm transition-colors",
                level === i + 1 ? "border-primary/40 bg-primary text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <ol className="mt-5 space-y-3" aria-live="polite" aria-label="Socratic tutor conversation">
          {visible.map((t, i) => (
            <motion.li
              key={t.id}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-tt-md border p-4",
                i === 0 ? "border-slate-200 bg-white" : "border-primary/20 bg-primary/[0.06]",
              )}
            >
              <p className="tt-mono-label flex items-center gap-1.5 text-[10px] text-primary">
                <LightbulbIcon className="size-3" aria-hidden /> {t.who}
              </p>
              <p className="mt-2 text-[15px] leading-7 text-slate-800">{t.text}</p>
            </motion.li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-slate-500">Hints before solutions — the AI never answer-dumps on step one.</p>
      </div>
      {reduce ? (
        <svg viewBox="0 0 240 200" className="h-auto w-full" role="img" aria-label="Three hint bubbles orbiting a question">
          <ellipse cx="120" cy="100" rx="92" ry="56" fill="none" stroke="#8fb0ff" strokeOpacity="0.35" />
          <circle cx="60" cy="80" r="16" fill="#8fb0ff" opacity="0.7" />
          <circle cx="180" cy="70" r="20" fill="#f5a524" opacity="0.9" />
        </svg>
      ) : (
        <Scene3VisualLazy active={level} />
      )}
    </div>
  );
}
