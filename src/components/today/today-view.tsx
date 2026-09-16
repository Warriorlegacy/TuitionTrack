"use client";

// Student Today dashboard (Blueprint #8 command centre).
// One screen, one dominant action: hero owns the primary CTA, every other
// panel uses secondary/outline actions. Real GETs only — no invented data.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import {
  AlertTriangleIcon,
  BookOpenCheckIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  PlayIcon,
  RotateCcwIcon,
  SparklesIcon,
  TimerIcon,
  TrendingUpIcon,
  WifiOffIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BentoCard, MasteryRing } from "@/components/marketing/ui";
import { StudentNav } from "./student-nav";
import {
  greeting,
  masteryTone,
  mistakeTitle,
  nodeTitle,
  pct,
  track,
  useApi,
  useOnline,
  type DueCard,
  type MasteryRow,
  type Mistake,
  type Readiness,
} from "./lib";

export type TodayStudent = { id: string; name: string; class?: string };
export type RecentTest = {
  id: string;
  subject: string;
  marks: number;
  total: number;
  date: string;
  percentage: number;
};

const BREAKDOWN: { key: string; label: string }[] = [
  { key: "knowledge", label: "Knowledge" },
  { key: "retention", label: "Retention" },
  { key: "speed", label: "Speed" },
  { key: "accuracy", label: "Accuracy" },
  { key: "strategy", label: "Strategy" },
];

const GRADES = [
  { grade: 1, label: "Again" },
  { grade: 2, label: "Hard" },
  { grade: 3, label: "Good" },
  { grade: 4, label: "Easy" },
];

export function TodayView({
  student,
  students,
  recentTests,
}: {
  student: TodayStudent;
  students: TodayStudent[];
  recentTests: RecentTest[];
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const online = useOnline();
  const revisionRef = useRef<HTMLDivElement>(null);

  const readinessApi = useApi<Readiness>(`/api/students/${student.id}/readiness`);
  const masteryApi = useApi<{ mastery: MasteryRow[] }>(
    `/api/students/${student.id}/mastery`,
    (d) => (d.mastery ?? []).length === 0,
  );
  const mistakesApi = useApi<{ mistakes: Mistake[] }>(
    `/api/students/${student.id}/mistakes?status=open`,
    (d) => (d.mistakes ?? []).length === 0,
  );

  const rows = useMemo(() => masteryApi.data?.mastery ?? [], [masteryApi.data]);
  const weakest = rows[0] ?? null;
  const weakThree = rows.slice(0, 3);
  const openMistakes = useMemo(() => mistakesApi.data?.mistakes ?? [], [mistakesApi.data]);

  // ── Revision session (POST /api/reviews/next|answer, FSRS-lite) ──
  const [due, setDue] = useState<DueCard[] | null>(null);
  const [dueStatus, setDueStatus] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [t0, setT0] = useState(0);
  const [answered, setAnswered] = useState(0);

  const loadDue = async () => {
    setDueStatus("loading");
    try {
      const r = await fetch("/api/reviews/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id, limit: 5 }),
      });
      if (!r.ok) throw new Error(`Request failed (${r.status}).`);
      const j = (await r.json()) as { due?: DueCard[]; count?: number };
      const list = j.due ?? [];
      setDue(list);
      setDueStatus(list.length === 0 ? "empty" : "ready");
    } catch {
      setDueStatus("error");
    }
  };

  const scrollToRevision = () =>
    revisionRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });

  const startRecovery = () => {
    if (dueStatus === "idle" || dueStatus === "error") void loadDue();
    setIdx(0);
    setRevealed(false);
    setT0(Date.now());
    scrollToRevision();
    revisionRef.current?.querySelector<HTMLElement>("button, a")?.focus({ preventScroll: true });
  };

  const grade = async (g: number) => {
    const card = due?.[idx];
    if (!card) return;
    const response_ms = Date.now() - (t0 || Date.now());
    try {
      await fetch("/api/reviews/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id, spaced_item_id: card.id, grade: g, response_ms }),
      });
    } catch {
      /* offline — count locally, card retries tomorrow */
    }
    track(student.id, "revision_completed", { spaced_item_id: card.id, grade });
    if (g >= 3) track(student.id, "mastery_moved", { concept_id: card.concept_id ?? null, direction: "up" });
    setAnswered((a) => a + 1);
    setRevealed(false);
    setT0(Date.now());
    setIdx((i) => i + 1);
  };

  const dueCount = due?.length ?? 0;
  const planMin = 12 + 15 + Math.min(10, Math.max(dueCount, 1) * 2) + 5;
  const heroLoading = readinessApi.status === "loading" || masteryApi.status === "loading";
  const readiness = readinessApi.data;

  return (
    <div className="space-y-5">
      {/* Header: greeting + student switcher */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="tt-mono-label text-[11px] text-primary">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h2 className="tt-display mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">
            {greeting(student.name)}
          </h2>
        </div>
        {students.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Student
            <select
              aria-label="Choose student"
              value={student.id}
              onChange={(e) => {
                const v = e.target.value;
                track(student.id, "syllabus_viewed", { to_student: v });
                router.push(v === students[0]?.id ? "/app/today" : `/app/today?student=${v}`);
              }}
              className="tt-focus rounded-tt-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {!online ? (
        <div role="status" className="flex items-center gap-2 rounded-tt-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <WifiOffIcon className="size-4 shrink-0" aria-hidden />
          You’re offline — showing last synced data. Answers will count locally.
        </div>
      ) : null}

      {/* Hero: the ONE dominant action on this screen */}
      <section aria-labelledby="today-plan" className="rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-xl flex-1">
            <p className="tt-mono-label text-[11px] text-primary">Today · ≈{planMin} min high-impact prep</p>
            <h3 id="today-plan" className="tt-display mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">
              {heroLoading ? (
                <Skeleton className="h-8 w-3/4 rounded-tt-sm" aria-label="Plan loading" />
              ) : weakest ? (
                <>
                  Highest impact: Repair “{nodeTitle(weakest)}”
                </>
              ) : (
                "Run your first diagnostic to get today’s plan"
              )}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              12-min recovery · 15-min practice · {Math.min(10, Math.max(dueCount, 1) * 2)}-min revision · 5-min re-test.
              {weakest ? ` ${nodeTitle(weakest)} sits at ${pct(weakest.mastery)}% — fixing it first moves readiness most.` : ""}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                disabled={!weakest && !heroLoading}
                onClick={startRecovery}
                className="tt-focus rounded-tt-md"
              >
                <PlayIcon className="mr-1 size-4" aria-hidden />
                Start 12-min recovery
              </Button>
              <a
                href="/app/progress"
                onClick={() => track(student.id, "syllabus_viewed", { from: "today_hero" })}
                className="tt-focus inline-flex items-center gap-1 rounded-tt-sm text-sm font-medium text-primary hover:underline"
              >
                See full progress <ChevronRightIcon className="size-4" aria-hidden />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <MasteryRing
              value={readiness ? readiness.readiness : null}
              size={112}
              label="Readiness"
              status={readinessApi.status === "error" ? "error" : readiness ? "ready" : "loading"}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Readiness breakdown */}
        <BentoCard
          icon={<TrendingUpIcon className="size-4" aria-hidden />}
          title="Readiness breakdown"
          desc={readiness?.disclaimer ?? "Estimate only — not a guarantee of exam outcome."}
          status={readinessApi.status}
          error={readinessApi.error}
        >
          {readiness ? (
            <div className="space-y-3 px-4 pb-4" id="readiness">
              {BREAKDOWN.map((b) => {
                const v = Math.max(0, Math.min(100, Number(readiness.breakdown[b.key] ?? 0)));
                return (
                  <div key={b.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{b.label}</span>
                      <span className="tt-tnum text-slate-500">{v}%</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={v}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${b.label} ${v} percent`}
                      className="h-2 overflow-hidden rounded-full bg-slate-100"
                    >
                      <div
                        className={`h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-700`}
                        style={{ width: `${v}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          {readinessApi.status === "error" ? (
            <div className="px-4 pb-4">
              <Button variant="outline" size="sm" onClick={readinessApi.retry} className="tt-focus rounded-tt-sm">
                <RotateCcwIcon className="mr-1 size-3.5" aria-hidden /> Retry
              </Button>
            </div>
          ) : null}
        </BentoCard>

        {/* Weak topics */}
        <BentoCard
          icon={<AlertTriangleIcon className="size-4" aria-hidden />}
          title="Weak topics to fix first"
          desc="Lowest mastery — each hour here returns the most marks."
          status={masteryApi.status}
          error={masteryApi.error}
        >
          <ul className="space-y-3 px-4 pb-4">
            {weakThree.map((r, i) => (
              <li key={r.concept_id ?? i} className="flex items-center gap-3">
                <span className="tt-tnum w-12 shrink-0 text-sm font-semibold text-slate-950">{pct(r.mastery)}%</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{nodeTitle(r)}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${masteryTone(r.mastery)}`} style={{ width: `${pct(r.mastery)}%` }} />
                  </div>
                </div>
                {i === 0 ? <Badge variant="secondary">fix first</Badge> : null}
              </li>
            ))}
          </ul>
          {masteryApi.status === "error" ? (
            <div className="px-4 pb-4">
              <Button variant="outline" size="sm" onClick={masteryApi.retry} className="tt-focus rounded-tt-sm">
                <RotateCcwIcon className="mr-1 size-3.5" aria-hidden /> Retry
              </Button>
            </div>
          ) : null}
        </BentoCard>

        {/* Revision due — the working session lives here */}
        <div id="revision" ref={revisionRef} className="scroll-mt-4">
        <Card className="rounded-tt-md" aria-label="Revision due">
          <div className="space-y-3 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-tt-sm bg-primary/10 text-primary" aria-hidden>
                <TimerIcon className="size-4" />
              </span>
              <div>
                <p className="text-lg font-medium">Revision due</p>
                <p className="text-sm text-slate-500">Spaced cards before you forget them.</p>
              </div>
            </div>
            <div aria-live="polite">
              {dueStatus === "idle" ? (
                <div className="flex flex-wrap items-center gap-3 rounded-tt-sm bg-slate-50 p-4 text-sm text-slate-600">
                  <ClockIcon className="size-4" aria-hidden />
                  Tap “Start 12-min recovery” above to load today’s due cards.
                </div>
              ) : dueStatus === "loading" ? (
                <div className="space-y-2" aria-busy="true" aria-label="Due cards loading">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-20 w-full rounded-tt-sm" />
                </div>
              ) : dueStatus === "error" ? (
                <div role="alert" className="rounded-tt-sm border border-red-200 bg-red-50 p-4 text-sm">
                  <p className="font-medium text-slate-900">Due cards couldn’t load</p>
                  <Button variant="outline" size="sm" onClick={() => void loadDue()} className="tt-focus mt-2 rounded-tt-sm">
                    <RotateCcwIcon className="mr-1 size-3.5" aria-hidden /> Retry
                  </Button>
                </div>
              ) : dueStatus === "empty" ? (
                <div className="flex items-center gap-2 rounded-tt-sm bg-emerald-50 p-4 text-sm text-emerald-900">
                  <CheckCircle2Icon className="size-4" aria-hidden />
                  All caught up — nothing due. New cards appear after practice.
                </div>
              ) : due && idx < due.length ? (
                <div className="rounded-tt-sm border border-slate-200 p-4">
                  <p className="tt-tnum text-xs text-slate-500">
                    Card {idx + 1} of {due.length} · {answered} answered
                  </p>
                  <p className="mt-2 text-base font-medium text-slate-950">{due[idx]?.front ?? "Review card"}</p>
                  {revealed ? (
                    <p className="mt-2 border-t border-dashed border-slate-200 pt-2 text-sm leading-6 text-slate-700">
                      {due[idx]?.back ?? "No answer stored."}
                    </p>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setRevealed(true)} className="tt-focus mt-3 rounded-tt-sm">
                      Show answer
                    </Button>
                  )}
                  {revealed ? (
                    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Grade your recall">
                      {GRADES.map((g) => (
                        <Button key={g.grade} variant="outline" size="sm" onClick={() => void grade(g.grade)} className="tt-focus rounded-tt-sm">
                          {g.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-tt-sm bg-emerald-50 p-4 text-sm text-emerald-900">
                  <CheckCircle2Icon className="size-4" aria-hidden />
                  Session complete — {answered} card{answered === 1 ? "" : "s"} reviewed. Come back tomorrow for the next due set.
                </div>
              )}
            </div>
          </div>
        </Card>
        </div>

        {/* Recent tests (server data) + open mistakes */}
        <BentoCard
          icon={<BookOpenCheckIcon className="size-4" aria-hidden />}
          title="Recent tests & mistakes"
          desc="What happened lately — and what still needs repair."
          status={mistakesApi.status === "loading" ? "loading" : "ready"}
        >
          <div className="space-y-4 px-4 pb-4">
            <div>
              <p className="tt-mono-label mb-2 text-[10px] text-slate-400">Recent tests</p>
              {recentTests.length === 0 ? (
                <p className="text-sm text-slate-500">No tests recorded yet for {student.name}.</p>
              ) : (
                <ul className="space-y-2">
                  {recentTests.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-900">
                        {t.subject} <span className="font-normal text-slate-400">· {t.date}</span>
                      </span>
                      <span className="tt-tnum shrink-0 text-slate-600">
                        {t.marks}/{t.total} ({t.percentage}%)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="tt-mono-label mb-2 text-[10px] text-slate-400">Open mistakes</p>
              {mistakesApi.status === "error" ? (
                <p role="alert" className="text-sm text-slate-500">
                  Mistakes unavailable —{" "}
                  <button type="button" onClick={mistakesApi.retry} className="tt-focus font-medium text-primary hover:underline">
                    retry
                  </button>
                </p>
              ) : openMistakes.length === 0 ? (
                <p className="text-sm text-slate-500">No open mistakes — clean slate.</p>
              ) : (
                <ul className="space-y-2">
                  {openMistakes.slice(0, 3).map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="shrink-0">{m.category ?? "concept"}</Badge>
                      <span className="min-w-0 truncate text-slate-700">{mistakeTitle(m)}</span>
                      {(m.recurrence_count ?? 0) > 1 ? (
                        <span className="tt-tnum shrink-0 text-xs text-slate-400">×{m.recurrence_count}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <a
                href="/app/progress#mistakes"
                className="tt-focus mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <SparklesIcon className="size-3.5" aria-hidden /> Open Mistake Book
              </a>
            </div>
          </div>
        </BentoCard>
      </div>

      <CardContent className="px-0">
        <p className="text-center text-xs text-slate-400">
          Readiness is an estimate from mastery, retention, speed, accuracy and trend — not an exam guarantee.
        </p>
      </CardContent>

      <StudentNav />
    </div>
  );
}
