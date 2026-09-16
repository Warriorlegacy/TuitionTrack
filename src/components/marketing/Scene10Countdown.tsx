"use client";

// Scene 10 — Exam countdown (Blueprint #73 Scene 10).
// 14 DAYS → 9 topics · 4 mocks · 65 revisions. Day-picker decomposition, CSS bars (no R3F).

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LoadState } from "./ui";

export const SCENE10_WIRING = { scene: 10, readyFor3D: false, contract: "daysLeft + plan[] come from the planner; day id drives detail copy." } as const;

const PLAN = [
  { day: 14, focus: "Algebra repair + 1 mock", load: "9 topics · mock 1/4" },
  { day: 7, focus: "Mixed re-test + pacing drill", load: "4 topics left · mock 3/4" },
  { day: 1, focus: "Light revision only, sleep early", load: "0 new topics · 65th revision" },
] as const;

export function Scene10Countdown({ status = "ready" }: { status?: LoadState }) {
  const reduce = useReducedMotion();
  const [day, setDay] = useState(14);
  const current = PLAN.reduce((a, b) => (Math.abs(b.day - day) < Math.abs(a.day - day) ? b : a));
  if (status === "loading")
    return <Skeleton className="min-h-[260px] w-full rounded-tt-lg" aria-busy="true" aria-label="Countdown loading" />;
  if (status === "error")
    return (
      <div role="alert" className="rounded-tt-lg border border-red-200 bg-red-50 p-8 text-center text-sm text-slate-600">
        Study plan couldn’t load. Check your connection and try again.
      </div>
    );
  if (status === "empty")
    return (
      <div className="rounded-tt-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Set your exam date to generate the countdown.
      </div>
    );
  return (
    <div className="rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="tt-tnum text-6xl font-semibold tracking-tight text-slate-950" aria-live="polite" aria-label={`${day} days to exam`}>
          {day}<span className="ml-2 align-middle text-sm font-normal text-slate-500">DAYS TO EXAM</span>
        </p>
        <dl className="tt-tnum flex gap-5 text-sm text-slate-600">
          {[["9", "topics"], ["4", "mocks"], ["65", "revisions"]].map(([v, l]) => (
            <div key={l} className="text-center"><dt className="sr-only">{l}</dt><dd className="text-2xl font-semibold text-slate-950">{v}</dd><dd className="text-xs">{l}</dd></div>
          ))}
        </dl>
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="Pick a day">
        {Array.from({ length: 14 }, (_, i) => 14 - i).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(d)}
            aria-pressed={day === d}
            aria-label={`Day ${d}`}
            className={cn(
              "tt-focus tt-tnum size-9 rounded-tt-sm border text-xs transition-colors",
              day === d ? "border-primary bg-primary font-semibold text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            {d}
          </button>
        ))}
      </div>
      <motion.p key={current.day} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} aria-live="polite" className="mt-5 rounded-tt-md bg-slate-50 p-4 text-[15px] text-slate-800">
        <span className="font-semibold">Day {current.day}: </span>{current.focus} <span className="text-slate-500">· {current.load}</span>
      </motion.p>
    </div>
  );
}
