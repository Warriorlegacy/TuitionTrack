"use client";

// Scene 9 — Parent calm report (Blueprint #73 Scene 9).
// Algebra 71→83% · readiness 78% · plain language, SVG sparkline (no R3F: calm > spectacle).

import { Skeleton } from "@/components/ui/skeleton";
import type { LoadState } from "./ui";

export const SCENE9_WIRING = { scene: 9, readyFor3D: false, contract: "report props (mastery delta, readiness) come from progress summaries; 2D stays." } as const;

const POINTS = [71, 73, 72, 76, 79, 78, 83];
const PATH = POINTS.map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (POINTS.length - 1)) * 280} ${90 - ((p - 65) / 20) * 80}`).join(" ");

export function Scene9ParentReport({ status = "ready" }: { status?: LoadState }) {
  if (status === "loading") return <Skeleton className="mx-auto min-h-[280px] max-w-2xl rounded-tt-lg" aria-busy="true" aria-label="Parent report loading" />;
  if (status === "error")
    return (
      <div role="alert" className="mx-auto max-w-2xl rounded-tt-lg border border-red-200 bg-red-50 p-8 text-center text-sm text-slate-600">
        Report couldn’t load. Check your connection and try again.
      </div>
    );
  if (status === "empty")
    return (
      <div className="mx-auto max-w-2xl rounded-tt-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        First weekly report arrives after 7 days of practice.
      </div>
    );
  return (
    <figure className="mx-auto max-w-2xl rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8" aria-live="polite">
      <p className="tt-mono-label text-[11px] text-primary">Weekly update · Aarav’s Algebra</p>
      <blockquote className="mt-3 text-xl font-medium leading-8 text-slate-900">
        “Algebra moved from 71% to 83%. Exam readiness is 78% — on track for the 14-day goal.”
      </blockquote>
      <svg viewBox="0 0 280 100" className="mt-5 h-auto w-full" role="img" aria-label="Algebra mastery rising from 71 to 83 percent over 7 weeks">
        <path d={PATH} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary" />
        {POINTS.map((p, i) => (
          <circle key={i} cx={(i / (POINTS.length - 1)) * 280} cy={90 - ((p - 65) / 20) * 80} r={i === POINTS.length - 1 ? 5 : 3} className={i === POINTS.length - 1 ? "fill-tt-amber" : "fill-primary"} />
        ))}
      </svg>
      <dl className="tt-tnum mt-4 flex gap-6 text-sm text-slate-600">
        <div><dt className="sr-only">Start</dt><dd><span className="font-semibold text-slate-950">71%</span> start</dd></div>
        <div><dt className="sr-only">Now</dt><dd><span className="font-semibold text-slate-950">83%</span> now</dd></div>
        <div><dt className="sr-only">Readiness</dt><dd><span className="font-semibold text-slate-950">78%</span> readiness</dd></div>
      </dl>
      <figcaption className="mt-3 text-xs text-slate-500">No jargon, no red alerts — what improved, what’s next, how you can help (15 min revision together).</figcaption>
    </figure>
  );
}
