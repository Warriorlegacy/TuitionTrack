"use client";

// Scene 6 — Mistake Vault (Blueprint #73 Scene 6).
// Careless / Concept / Formula / Time / Misread → each with a repair.
// 2D tabs (no R3F: taxonomy UI reads better flat). Keyboard tabs + aria-live repair card.

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LoadState } from "./ui";

export const SCENE6_WIRING = { scene: 6, readyFor3D: false, contract: "vaultTab id + repairId feed the Vault API; 2D stays." } as const;

export const SCENE6_NODES = [
  { id: "careless", label: "Careless", count: 12, example: "Sign error: −3 × −4 = −12", repair: "Sign-check ritual: circle every sign before solving." },
  { id: "concept", label: "Concept", count: 8, example: "Relative velocity direction flipped", repair: "2-min re-teach card: frame-of-reference diagram." },
  { id: "formula", label: "Formula", count: 6, example: "Used v² = u² + 2as for non-uniform a", repair: "Formula-clip card: when it applies + one counter-example." },
  { id: "time", label: "Time", count: 5, example: "Q9 ate 6 min, Q10–12 rushed", repair: "Pacing drill: 90-sec flag-and-move rule." },
  { id: "misread", label: "Misread", count: 4, example: "Missed 'not' in assertion-reason", repair: "Underline-the-ask habit: rewrite the ask in 5 words." },
] as const;

export function Scene6MistakeVault({ status = "ready" }: { status?: LoadState }) {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<(typeof SCENE6_NODES)[number]["id"]>("careless");
  const current = SCENE6_NODES.find((n) => n.id === tab)!;
  if (status === "loading")
    return (
      <div className="grid gap-3 sm:grid-cols-5" aria-busy="true" aria-label="Mistake vault loading">
        {SCENE6_NODES.map((n) => <Skeleton key={n.id} className="h-24 w-full rounded-tt-md" />)}
      </div>
    );
  if (status === "error")
    return (
      <div role="alert" className="rounded-tt-lg border border-red-200 bg-red-50 p-8 text-center text-sm text-slate-600">
        Mistake Vault couldn’t load. Check your connection and try again.
      </div>
    );
  if (status === "empty")
    return (
      <div className="rounded-tt-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Vault’s empty — a good sign. Mistakes land here with repairs after each test.
      </div>
    );
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-5" role="tablist" aria-label="Mistake categories">
        {SCENE6_NODES.map((n) => (
          <button
            key={n.id}
            type="button"
            role="tab"
            aria-selected={tab === n.id}
            onClick={() => setTab(n.id)}
            className={cn(
              "tt-focus rounded-tt-md border p-4 text-left transition-colors",
              tab === n.id ? "border-primary/40 bg-white shadow-soft" : "border-slate-200 bg-white/60 hover:bg-white",
            )}
          >
            <span className="tt-tnum block text-2xl font-semibold text-slate-950">{n.count}</span>
            <span className="mt-1 block text-sm font-medium text-slate-700">{n.label}</span>
          </button>
        ))}
      </div>
      <motion.div
        key={current.id}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        role="tabpanel"
        aria-live="polite"
        aria-label={`${current.label} repair`}
        className="mt-4 rounded-tt-lg border border-slate-200 bg-white p-6 sm:p-7"
      >
        <p className="tt-mono-label text-[11px] text-primary">Latest {current.label.toLowerCase()} slip → repair</p>
        <p className="mt-2 font-medium text-slate-950">“{current.example}”</p>
        <p className="mt-2 text-[15px] leading-7 text-slate-600"><span className="font-semibold text-emerald-700">Repair: </span>{current.repair}</p>
      </motion.div>
    </div>
  );
}
