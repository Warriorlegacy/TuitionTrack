"use client";

// Scene 5 — "Your next test changes because of your last test" (Blueprint #73 Scene 5).
// 2D adaptive-test mock (no R3F: dense UI reads better flat — #75 "don't over-3D").
// WIRING: qIndex + answers[] is the future adaptive-engine payload.

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TimerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LoadState } from "./ui";

export const SCENE5_WIRING = { scene: 5, readyFor3D: false, contract: "qIndex/answers/difficulty feed the adaptive test engine; 2D stays (no 3D planned)." } as const;

const QUESTIONS = [
  { q: "If f(x) = x² − 5x + 6, the roots are…", options: ["x = 2, 3", "x = −2, −3", "x = 1, 6", "x = −1, −6"], answer: 0, level: "Medium" },
  { q: "Relative velocity of A w.r.t. B when both move east at 4 and 2 m/s…", options: ["6 m/s east", "2 m/s east", "2 m/s west", "0"], answer: 1, level: "Easy · adapted down after Q6 slip" },
  { q: "Discriminant of 2x² + 3x + 5…", options: ["−31", "49", "9", "−11"], answer: 0, level: "Medium" },
] as const;

export function Scene5ExamSimulator({ status = "ready" }: { status?: LoadState }) {
  const reduce = useReducedMotion();
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  if (status === "loading")
    return <Skeleton className="min-h-[300px] w-full rounded-tt-lg" aria-busy="true" aria-label="Exam simulator loading" />;
  if (status === "error")
    return (
      <div role="alert" className="rounded-tt-lg border border-red-200 bg-red-50 p-8 text-center text-sm text-slate-600">
        Test preview couldn’t load. Check your connection and try again.
      </div>
    );
  if (status === "empty")
    return (
      <div className="rounded-tt-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No test yet — finish the diagnostic to unlock your adaptive mock.
      </div>
    );
  const q = QUESTIONS[qi];
  const correct = picked === q.answer;
  return (
    <div className="mx-auto max-w-3xl rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="tt-mono-label text-[11px] text-primary">Adaptive mock · Q{6 + qi + 1}/12 · {q.level}</p>
        <p className="tt-tnum flex items-center gap-1.5 text-sm text-slate-500"><TimerIcon className="size-4" aria-hidden /> 08:42 left</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={((6 + qi + 1) / 12) * 100} aria-valuemin={0} aria-valuemax={100} aria-label="Test progress">
        <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${((6 + qi + 1) / 12) * 100}%` }} transition={reduce ? { duration: 0 } : { duration: 0.5 }} />
      </div>
      <fieldset className="mt-6">
        <legend className="text-lg font-semibold text-slate-950">{q.q}</legend>
        <div className="mt-4 grid gap-2.5" role="radiogroup" aria-label={`Question ${qi + 1} options`}>
          {q.options.map((o, i) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={picked === i}
              onClick={() => setPicked(i)}
              className={cn(
                "tt-focus rounded-tt-md border p-3.5 text-left text-[15px] transition-colors",
                picked === i ? "border-primary/50 bg-primary/[0.07] font-medium" : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <span className="tt-tnum mr-3 text-xs text-slate-400">{String.fromCharCode(65 + i)}</span>{o}
            </button>
          ))}
        </div>
      </fieldset>
      {picked !== null && (
        <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className={cn("mt-4 text-sm", correct ? "text-emerald-700" : "text-amber-700")}>
          {correct ? "Correct — difficulty steps up next." : "Not quite — captured to the Mistake Vault, next question adapts down."}
        </motion.p>
      )}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" size="sm" className="tt-focus rounded-tt-sm" disabled={qi === 0} onClick={() => { setQi((v) => Math.max(0, v - 1)); setPicked(null); setDone(false); }}>Back</Button>
        <p className="tt-tnum text-sm text-slate-500">{qi + 1} / {QUESTIONS.length} preview</p>
        <Button
          size="sm"
          className="tt-focus rounded-tt-sm"
          disabled={picked === null}
          onClick={() => { if (qi < QUESTIONS.length - 1) { setQi((v) => v + 1); setPicked(null); } else setDone(true); }}
        >
          {done ? "Submitted ✓" : qi === QUESTIONS.length - 1 ? "Submit" : "Next"}
        </Button>
      </div>
    </div>
  );
}
