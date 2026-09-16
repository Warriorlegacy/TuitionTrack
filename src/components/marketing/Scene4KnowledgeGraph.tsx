"use client";

// Scene 4 — "Every mistake has a root" (Blueprint #73 Scene 4).
// Knowledge graph: Exam → Physics → Mechanics → Kinematics → Relative Motion.
// Amber = weak prerequisite; AI backtracks to repair it first.
// Also consumes SCENE2_NODES (Scene 2 wiring contract) via the generic GraphNode shape.

import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { CornerLeftUpIcon } from "lucide-react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { mulberry32, useIsMobile, useSceneActive, useWebGL } from "./scene-kit";
import { MasteryRing, type LoadState } from "./ui";

export type GraphNode = { id: string; label: string; state: "weak" | "recommended" | "active" | "repaired" | "mastered" | string };

export const SCENE4_WIRING = {
  scene: 4,
  readyFor3D: true,
  contract: "nodes[] feeds both rail + 3D graph; `weak` id drives backtrack copy + amber highlight. Accepts SCENE2_NODES.",
} as const;

export const SCENE4_NODES: GraphNode[] = [
  { id: "exam", label: "JEE · Relative Motion", state: "active" },
  { id: "physics", label: "Physics", state: "mastered" },
  { id: "mechanics", label: "Mechanics", state: "repaired" },
  { id: "kinematics", label: "Kinematics · weak", state: "weak" },
  { id: "relative", label: "Relative Motion", state: "recommended" },
];

// ── 3D chain: 5 nodes diagonal + amber weak + backtrack arc ──
function Graph3D({ nodes, mobile }: { nodes: GraphNode[]; mobile: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const group = useRef<THREE.Group>(null!);
  const pos = useMemo(() => {
    const rand = mulberry32(4);
    return nodes.map((_, i) => new THREE.Vector3((i - (nodes.length - 1) / 2) * 1.15, Math.sin(i * 1.1) * 0.5, (rand() - 0.5) * 0.8));
  }, [nodes]);
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([...pos, pos[3], pos[2]]);
    return g;
  }, [pos]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const amber = new THREE.Color("#f5a524");
    const blue = new THREE.Color("#8fb0ff");
    const teal = new THREE.Color("#5eead4");
    pos.forEach((p, i) => {
      const s = nodes[i].state === "weak" ? 1.6 : 1;
      m.makeScale(s, s, s);
      m.setPosition(p);
      mesh.current.setMatrixAt(i, m);
      mesh.current.setColorAt(i, nodes[i].state === "weak" ? amber : i === nodes.length - 1 ? teal : blue);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [pos, nodes]);
  useFrame((state, delta) => {
    group.current.rotation.y += Math.min(delta, 0.05) * 0.15;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.12;
  });
  return (
    <group ref={group}>
      <Float speed={1} rotationIntensity={0.15} floatIntensity={0.5}>
        <instancedMesh ref={mesh} args={[undefined, undefined, pos.length]} frustumCulled={false}>
          <icosahedronGeometry args={[mobile ? 0.16 : 0.19, 0]} />
          <meshBasicMaterial toneMapped={false} transparent opacity={0.95} />
        </instancedMesh>
        {/* chain edges */}
        <lineSegments geometry={line}>
          <lineBasicMaterial color="#8fb0ff" transparent opacity={0.55} />
        </lineSegments>
      </Float>
    </group>
  );
}

function Scene4Visual({ nodes }: { nodes: GraphNode[] }) {
  const webgl = useWebGL();
  const mobile = useIsMobile();
  const { ref, running } = useSceneActive();
  const labels = nodes.map((n) => n.label).join(" → ");
  if (webgl === null) return <div ref={ref} className="aspect-[4/3] w-full animate-pulse rounded-tt-lg bg-white/5" aria-hidden />;
  if (webgl === false)
    return (
      <svg ref={ref} viewBox="0 0 320 140" className="h-auto w-full" role="img" aria-label={`Knowledge chain: ${labels}`}>
        {nodes.map((n, i) => (
          <g key={n.id}>
            {i > 0 && <line x1={30 + (i - 1) * 65} y1="70" x2={30 + i * 65} y2="70" stroke="#8fb0ff" strokeOpacity="0.5" strokeWidth="2" />}
            <circle cx={30 + i * 65} cy="70" r={n.state === "weak" ? 14 : 10} fill={n.state === "weak" ? "#f5a524" : "#8fb0ff"} opacity="0.9" />
          </g>
        ))}
        <path d="M 225 84 Q 160 120 95 84" fill="none" stroke="#f5a524" strokeWidth="2" strokeDasharray="5 4" />
      </svg>
    );
  return (
    <div ref={ref} className="relative aspect-[4/3] w-full" role="img" aria-label={`Knowledge chain: ${labels}. Kinematics is weak, AI backtracks to Mechanics.`}>
      <div aria-hidden className="absolute inset-0">
        <Canvas
          dpr={mobile ? 1 : [1, 1.5]}
          camera={{ position: [0, 0.6, 7], fov: 44 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          frameloop={running ? "always" : "never"}
          style={{ pointerEvents: "none" }}
        >
          <Suspense fallback={null}>
            <Graph3D nodes={nodes} mobile={mobile} />
            <ambientLight intensity={0.9} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}

const Scene4VisualLazy = dynamic(() => Promise.resolve({ default: Scene4Visual }), { ssr: false });

export function Scene4KnowledgeGraph({ status = "ready", nodes = SCENE4_NODES }: { status?: LoadState; nodes?: GraphNode[] }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(3);
  const current = nodes[Math.min(active, nodes.length - 1)];
  const weakIdx = nodes.findIndex((n) => n.state === "weak");
  if (status === "loading")
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Knowledge graph loading">
        <div className="space-y-3">{nodes.map((n) => <Skeleton key={n.id} className="h-14 w-full rounded-tt-md" />)}</div>
        <Skeleton className="min-h-[280px] w-full rounded-tt-lg" />
      </div>
    );
  if (status === "error")
    return (
      <div role="alert" className="rounded-tt-lg border border-red-200 bg-red-50 p-8 text-center text-sm text-slate-600">
        Knowledge graph couldn’t load. Check your connection and try again.
      </div>
    );
  if (status === "empty" || nodes.length === 0)
    return (
      <div className="rounded-tt-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No graph yet — your diagnostic maps the prerequisites first.
      </div>
    );
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <ol className="space-y-2.5" aria-label="Prerequisite chain">
        {nodes.map((n, i) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-current={i === active ? "step" : undefined}
              className={cn(
                "tt-focus flex w-full items-center gap-3 rounded-tt-md border p-3.5 text-left text-sm transition-colors",
                n.state === "weak" ? "border-tt-amber/50 bg-tt-amber/[0.08]" : "border-slate-200 bg-white/70 hover:bg-white",
                i === active && "shadow-soft",
              )}
            >
              <span className={cn("tt-tnum text-xs", n.state === "weak" ? "text-tt-amber" : "text-primary")}>{String(i + 1).padStart(2, "0")}</span>
              <span className="font-medium text-slate-900">{n.label}</span>
              {n.state === "weak" && <span className="ml-auto rounded-full bg-tt-amber/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700">weak link</span>}
            </button>
          </li>
        ))}
      </ol>
      <div className="rounded-tt-lg border border-slate-200 bg-white p-6 sm:p-7" aria-live="polite">
        {reduce ? (
          <svg viewBox="0 0 320 140" className="h-auto w-full" role="img" aria-label="Knowledge chain fallback">
            {nodes.map((n, i) => (
              <circle key={n.id} cx={30 + i * 65} cy="70" r={n.state === "weak" ? 14 : 10} fill={n.state === "weak" ? "#f5a524" : "#8fb0ff"} />
            ))}
          </svg>
        ) : (
          <Scene4VisualLazy nodes={nodes} />
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <MasteryRing value={current.state === "weak" ? 38 : current.state === "recommended" ? 55 : 82} label={current.label} />
          <p className="flex max-w-xs items-start gap-2 text-sm leading-6 text-slate-600">
            <CornerLeftUpIcon className="mt-1 size-4 shrink-0 text-amber-600" aria-hidden />
            {weakIdx >= 0 ? `AI backtrack: ${nodes[weakIdx].label} is the root cause — repairing it before re-attempting ${nodes[nodes.length - 1].label}.` : "No weak link — proceeding forward."}
          </p>
        </div>
        <motion.p key={current.id} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="tt-mono-label mt-4 text-[11px] text-slate-400">
          Selected {active + 1}/{nodes.length} · {current.label}
        </motion.p>
      </div>
    </div>
  );
}
