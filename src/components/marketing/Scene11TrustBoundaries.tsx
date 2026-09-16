"use client";

// Scene 11 — Trust & boundaries (Blueprint #73 Scene 11).
// Role-based access, secure tenancy, grounded AI. Static 2D (no R3F: diagram reads better flat).

import { GraduationCapIcon, ShieldCheckIcon, UsersRoundIcon } from "lucide-react";
import { BentoCard } from "./ui";
import type { LoadState } from "./ui";

export const SCENE11_WIRING = { scene: 11, readyFor3D: false, contract: "Static trust copy; roles mirror portal RBAC — no PII on this route." } as const;

export function Scene11TrustBoundaries({ status = "ready" }: { status?: LoadState }) {
  if (status === "loading")
    return (
      <div className="grid gap-5 sm:grid-cols-3" aria-busy="true" aria-label="Trust information loading">
        {[0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-tt-md bg-slate-200" />)}
      </div>
    );
  if (status === "error")
    return (
      <div role="alert" className="rounded-tt-lg border border-red-200 bg-red-50 p-8 text-center text-sm text-slate-600">
        Trust details couldn’t load. Check your connection and try again.
      </div>
    );
  return (
    <div className="grid gap-5 sm:grid-cols-3" aria-live="polite">
      <BentoCard icon={<GraduationCapIcon className="size-4" aria-hidden />} title="Students see their loop" desc="Own diagnostics, plans, vault and revisions. Nothing from other students, ever." status={status} />
      <BentoCard icon={<UsersRoundIcon className="size-4" aria-hidden />} title="Teachers see their classes" desc="Class analytics and at-risk lists for assigned batches only. Role-checked on every request." status={status} />
      <BentoCard icon={<ShieldCheckIcon className="size-4" aria-hidden />} title="Grounded, cited AI" desc="Hints cite syllabus nodes and class notes. No answer-dumps, no invented marks, no PII in prompts." status={status} />
    </div>
  );
}
