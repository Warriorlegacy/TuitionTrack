"use client";

// Scene 12 — Final CTA constellation (Blueprint #73 Scene 12).
// Starfield points + connecting lines behind the CTA. Canvas is decor-only (aria-hidden),
// CTA copy stays in DOM for SEO/a11y. Reduced-motion + no-WebGL → static gradient.

import { Suspense, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Canvas, useFrame } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { GlassPanel, MagneticButton } from "./ui";
import { mulberry32, useIsMobile, useSceneActive, useWebGL } from "./scene-kit";

export const SCENE12_WIRING = { scene: 12, readyFor3D: true, contract: "Decor-only canvas; CTA hrefs are the contract (/signup, /pricing)." } as const;

function Stars({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null!);
  const { positions, lineGeom } = useMemo(() => {
    const rand = mulberry32(12);
    const positions = new Float32Array(count * 3);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      const r = 2.5 + rand() * 3.5;
      const t = rand() * Math.PI * 2;
      const p = rand() * Math.PI - Math.PI / 2;
      const v = new THREE.Vector3(r * Math.cos(p) * Math.cos(t), r * Math.sin(p) * 0.6, -1 - rand() * 2);
      positions.set([v.x, v.y, v.z], i * 3);
      pts.push(v);
    }
    // connect near neighbours (cap segments for perf)
    const pairs: THREE.Vector3[] = [];
    for (let i = 0; i < pts.length && pairs.length < 120; i += 3) {
      let best = -1;
      let bd = Infinity;
      for (let j = i + 1; j < Math.min(i + 8, pts.length); j++) {
        const d = pts[i].distanceToSquared(pts[j]);
        if (d < bd) { bd = d; best = j; }
      }
      if (best > 0) pairs.push(pts[i], pts[best]);
    }
    return { positions, lineGeom: new THREE.BufferGeometry().setFromPoints(pairs) };
  }, [count]);
  useFrame((state, delta) => {
    ref.current.rotation.y += Math.min(delta, 0.05) * 0.03;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.08;
  });
  return (
    <group>
      <points ref={ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#bcd0ff" size={0.045} transparent opacity={0.9} sizeAttenuation depthWrite={false} />
      </points>
      <lineSegments geometry={lineGeom}>
        <lineBasicMaterial color="#8fb0ff" transparent opacity={0.28} />
      </lineSegments>
    </group>
  );
}

function Scene12Visual() {
  const webgl = useWebGL();
  const mobile = useIsMobile();
  const { ref, running } = useSceneActive();
  if (webgl === null) return <div ref={ref} className="absolute inset-0 bg-white/[0.03]" aria-hidden />;
  if (webgl === false) return <div ref={ref} className="absolute inset-0" aria-hidden />;
  return (
    <div ref={ref} className="absolute inset-0" aria-hidden>
      <Canvas
        dpr={mobile ? 1 : [1, 1.5]}
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        frameloop={running ? "always" : "never"}
        style={{ pointerEvents: "none" }}
      >
        <Suspense fallback={null}>
          <Stars count={mobile ? 90 : 220} />
        </Suspense>
      </Canvas>
    </div>
  );
}

const Scene12VisualLazy = dynamic(() => Promise.resolve({ default: Scene12Visual }), { ssr: false });

export function Scene12FinalCTA() {
  const reduce = useReducedMotion();
  return (
    <div className="bg-tt-hero relative overflow-hidden px-4 py-24 sm:px-6">
      {!reduce && <Scene12VisualLazy />}
      <GlassPanel className="relative mx-auto max-w-4xl p-10 text-center sm:p-14" data-reveal>
        <p className="tt-mono-label text-[11px] text-tt-accent">Scene 12 · Begin the loop</p>
        <h2 id="cta-title" className="tt-display mx-auto mt-4 max-w-2xl text-3xl font-semibold text-white sm:text-5xl">
          Build confidence one mastered concept at a time.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">
          Diagnose → Learn → Practice → Retrieve → Test → Analyze → Repair → Re-test → Master → Maintain.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <MagneticButton href="/signup">Start TuitionTrack AI</MagneticButton>
          <MagneticButton href="/pricing" variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white">
            Book a tutor demo
          </MagneticButton>
        </div>
      </GlassPanel>
    </div>
  );
}
