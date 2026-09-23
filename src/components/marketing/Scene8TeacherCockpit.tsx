"use client";

// Scene 8 — Teacher cockpit (Blueprint #73 Scene 8).
// 124 students · 11 at risk · 27 improved · 82% avg + one-click 12Q drill.
// 2D dashboard (no R3F: tables read better flat).

import { useState } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { LoadState } from "./ui";

export const SCENE8_WIRING = { scene: 8, readyFor3D: false, contract: "assignDrill(studentIds) → remedial drill API; metrics come from class analytics." } as const;

const AT_RISK = [
  { id: "s1", name: "Diya · Class 10", issue: "Sign errors ×6 · Algebra 41%" },
  { id: "s2", name: "Kabir · Class 11", issue: "Kinematics weak · 3 skips" },
  { id: "s3", name: "Meera · Class 10", issue: "Pacing: Q9+ rushed" },
] as const;

export function Scene8TeacherCockpit({ status = "ready" }: { status?: LoadState }) {
  const [assigned, setAssigned] = useState(false);
  if (status === "loading")
    return (
      <div className="rounded-tt-lg border border-slate-200 bg-white p-6" aria-busy="true" aria-label="Teacher cockpit loading">
        <div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-tt-md" />)}</div>
        <Skeleton className="mt-4 h-40 w-full rounded-tt-md" />
      </div>
    );
  if (status === "error")
    return (
      <div role="alert" className="rounded-tt-lg border border-red-200 bg-red-50 p-8 text-center text-sm text-slate-600">
        Classroom data couldn’t load. Check your connection and try again.
      </div>
    );
  if (status === "empty")
    return (
      <div className="rounded-tt-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No classes yet — invite students to fill this cockpit.
      </div>
    );
  return (
    <div className="rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8" aria-live="polite">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[["124", "students"], ["11", "at risk"], ["27", "improved"], ["82%", "class avg"]].map(([v, l]) => (
          <div key={l} className="rounded-tt-md bg-slate-50 p-4 text-center">
            <dt className="sr-only">{l}</dt>
            <dd className="tt-tnum text-3xl font-semibold text-slate-950">{v}</dd>
            <dd className="tt-mono-label mt-1 text-[10px] text-slate-500">{l}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-6 space-y-2.5" aria-label="Students at risk">
        {AT_RISK.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-tt-md border border-slate-200 px-4 py-3 text-sm">
            <span className="font-medium text-slate-900">{s.name}</span>
            <span className="text-slate-500">{s.issue}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => setAssigned(true)} disabled={assigned} className="tt-focus rounded-tt-sm">
          {assigned ? <><CheckCircle2Icon className="mr-1.5 size-4" aria-hidden /> 12Q drill assigned</> : "Assign 12Q remedial drill"}
        </Button>
        {assigned && <p className="text-sm text-emerald-700">Drill sent to 11 students · teacher review queued.</p>}
      </div>
    </div>
  );
}
