"use client";

// Scene 2 — "Stop asking What should I study?" (Blueprint #73 Scene 2).
// Static/animated dashboard mock: weak-topic → recommendation → practice →
// mistake-fixed → mastery-rise. Ships with loading/empty/error states.
// 3D WIRING: replace <Scene2Visual> internals with <KnowledgeGraph nodes={SCENE2_NODES}>
// once Scene 4 lands — step ids below are the stable contract (see SCENE2_WIRING).

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  SparklesIcon,
  TimerIcon,
  TrendingUpIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MasteryRing, type LoadState } from "./ui";

export const SCENE2_WIRING = {
  scene: 2,
  readyFor3D: true,
  contract: "step ids + SCENE2_NODES feed the future KnowledgeGraph; MasteryRing value stays the single progress source.",
} as const;

export const SCENE2_NODES = [
  { id: "weak", label: "Quadratic factoring", state: "weak" },
  { id: "rec", label: "12-min recovery", state: "recommended" },
  { id: "practice", label: "8/10 practice", state: "active" },
  { id: "fixed", label: "Sign-error repair", state: "repaired" },
  { id: "rise", label: "Mastery 83%", state: "mastered" },
] as const;

const STEPS = [
  {
    id: "weak",
    icon: AlertTriangleIcon,
    label: "Weak topic detected",
    detail: "Quadratic factoring · mastery 41% · losing 6 marks per test.",
    mastery: 41,
  },
  {
    id: "rec",
    icon: SparklesIcon,
    label: "Recommendation generated",
    detail: "12-minute recovery drill · 8 questions · targets sign errors first.",
    mastery: 52,
  },
  {
    id: "practice",
    icon: TimerIcon,
    label: "15-minute practice",
    detail: "8/10 correct · 2 sign errors captured to the Mistake Vault.",
    mastery: 61,
  },
  {
    id: "fixed",
    icon: CheckCircle2Icon,
    label: "Mistake fixed",
    detail: "Sign-error repair card complete · prerequisite re-checked.",
    mastery: 74,
  },
  {
    id: "rise",
    icon: TrendingUpIcon,
    label: "Mastery rises",
    detail: "41% → 83% · re-test unlocked · revision scheduled before you forget.",
    mastery: 83,
  },
] as const;

export function Scene2NextStep({ status = "ready", onRetry }: { status?: LoadState; onRetry?: () => void }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(reduce ? STEPS.length - 1 : 0);

  useEffect(() => {
    if (reduce || status !== "ready") return;
    if (active >= STEPS.length - 1) return;
    const t = setTimeout(() => setActive((a) => Math.min(a + 1, STEPS.length - 1)), 2400);
    return () => clearTimeout(t);
  }, [active, reduce, status]);

  if (status === "loading") {
    return (
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]" aria-busy="true" aria-label="Study plan loading">
        <div className="space-y-3">
          {STEPS.map((s) => (
            <Skeleton key={s.id} className="h-16 w-full rounded-tt-md" />
          ))}
        </div>
        <Skeleton className="min-h-[320px] w-full rounded-tt-lg" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div role="alert" className="rounded-tt-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="font-semibold text-slate-950">Study plan couldn’t load</p>
        <p className="mt-1 text-sm text-slate-600">Check your connection and try again.</p>
        {onRetry ? (
          <Button onClick={onRetry} variant="outline" className="mt-4 rounded-tt-sm">
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  if (status === "empty") {
    return (
      <Empty className="rounded-tt-lg border border-slate-200 bg-white">
        <EmptyTitle>No study plan yet</EmptyTitle>
        <EmptyDescription>Run your first diagnostic and the loop will tell you exactly what to study.</EmptyDescription>
      </Empty>
    );
  }

  const current = STEPS[active];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      {/* Step rail — keyboard navigable buttons */}
      <ol className="space-y-3" aria-label="Learning loop steps">
        {STEPS.map((s, i) => {
          const done = i < active;
          const isActive = i === active;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "tt-focus flex w-full items-center gap-4 rounded-tt-md border p-4 text-left transition-colors",
                  isActive
                    ? "border-primary/30 bg-white shadow-soft"
                    : "border-slate-200 bg-white/60 hover:bg-white",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-tt-sm",
                    done || isActive ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400",
                  )}
                  aria-hidden
                >
                  <s.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-950">{s.label}</span>
                  <span className="tt-mono-label mt-0.5 block text-[10px] text-slate-400">
                    Step {i + 1} of {STEPS.length}
                  </span>
                </span>
                {done ? <CheckCircle2Icon className="ml-auto size-4 shrink-0 text-emerald-500" aria-label="Completed" /> : null}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Dashboard mock */}
      <div className="rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="tt-mono-label text-[11px] text-primary">Today’s highest-impact action</p>
            <motion.p
              key={current.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-xl font-semibold text-slate-950"
            >
              {current.detail}
            </motion.p>
          </div>
          <MasteryRing value={current.mastery} label="Topic mastery" />
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={current.mastery} aria-valuemin={0} aria-valuemax={100} aria-label="Topic mastery progress">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${current.mastery}%` }}
            transition={reduce ? { duration: 0 } : { duration: 0.8, ease: "easeOut" }}
          />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="tt-focus rounded-tt-sm"
            disabled={active === 0}
            onClick={() => setActive((a) => Math.max(0, a - 1))}
          >
            <ArrowLeftIcon className="mr-1 size-4" aria-hidden /> Back
          </Button>
          <p className="tt-tnum text-sm text-slate-500">
            {active + 1} / {STEPS.length}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="tt-focus rounded-tt-sm"
            disabled={active === STEPS.length - 1}
            onClick={() => setActive((a) => Math.min(STEPS.length - 1, a + 1))}
          >
            Next <ArrowRightIcon className="ml-1 size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
