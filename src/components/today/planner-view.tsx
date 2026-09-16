"use client";

// Student Planner view (Blueprint #18, #69). Reads the plan the deterministic
// planner already writes, so nothing here invents data: GET /api/plans is the
// only source, PATCH marks tasks done/skipped. One dominant action per screen —
// today's plan owns the primary CTA, everything else is secondary.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SkipForwardIcon,
  SparklesIcon,
  WifiOffIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { track, useApi, useOnline } from "./lib";
import type { TodayStudent } from "./today-view";

type PlanTask = {
  id: string;
  date: string;
  concept_id: string | null;
  concept_title: string;
  task_type: string;
  estimated_min: number;
  priority: number;
  status: string;
  source: string | null;
};

type PlansResponse = {
  plan: null | {
    id: string;
    title: string;
    start_date: string;
    end_date: string | null;
    target_score: number | null;
    status: string;
    version: number;
    generated_by: string;
  };
  tasks: PlanTask[];
  stats: null | {
    total: number;
    done: number;
    skipped: number;
    pending: number;
    planned_min: number;
    completed_min: number;
    today_min: number;
    today_tasks: number;
  };
  today: string;
};

const TYPE_LABEL: Record<string, string> = {
  practice: "Practice",
  drill: "Drill",
  review: "Revision",
};

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  const d = new Date(`${date}T00:00:00Z`);
  const t = new Date(`${today}T00:00:00Z`);
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return d.toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

function TaskRow({
  task,
  busy,
  onSet,
}: {
  task: PlanTask;
  busy: boolean;
  onSet: (task: PlanTask, status: "done" | "skipped" | "pending") => void;
}) {
  const settled = task.status === "done" || task.status === "skipped";
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-tt-md border p-3.5",
        task.status === "done" ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-tt-sm",
          task.status === "done" ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary",
        )}
        aria-hidden
      >
        <SparklesIcon className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-semibold text-slate-950", settled && "line-through decoration-slate-400")}>
          {task.concept_title}
        </span>
        <span className="tt-mono-label mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
          <span>{TYPE_LABEL[task.task_type] ?? task.task_type}</span>
          <span aria-hidden>·</span>
          <span className="tt-tnum inline-flex items-center gap-1">
            <ClockIcon className="size-3" aria-hidden /> {task.estimated_min} min
          </span>
          <span aria-hidden>·</span>
          <span>priority {task.priority.toFixed(2)}</span>
        </span>
      </span>

      <span className="flex items-center gap-2">
        {task.status === "pending" ? (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onSet(task, "done")}
              className="tt-focus rounded-tt-sm"
            >
              <CheckCircle2Icon className="mr-1 size-3.5" aria-hidden /> Done
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onSet(task, "skipped")}
              className="tt-focus rounded-tt-sm"
            >
              <SkipForwardIcon className="mr-1 size-3.5" aria-hidden /> Skip
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onSet(task, "pending")}
            className="tt-focus rounded-tt-sm text-slate-500"
          >
            <RotateCcwIcon className="mr-1 size-3.5" aria-hidden /> Undo
          </Button>
        )}
      </span>
    </li>
  );
}

export function PlannerView({ student, students }: { student: TodayStudent; students: TodayStudent[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const online = useOnline();

  const plansApi = useApi<PlansResponse>(`/api/plans?student_id=${student.id}`, (d) => !d.plan);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const data = plansApi.data;
  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const today = data?.today ?? "";
  const stats = data?.stats ?? null;

  const todayTasks = useMemo(() => tasks.filter((t) => t.date === today), [tasks, today]);
  const upcoming = useMemo(() => {
    const byDate = new Map<string, PlanTask[]>();
    for (const t of tasks) {
      if (t.date <= today) continue;
      const list = byDate.get(t.date) ?? [];
      list.push(t);
      byDate.set(t.date, list);
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks, today]);

  const setStatus = async (task: PlanTask, status: "done" | "skipped" | "pending") => {
    setBusyId(task.id);
    setNotice(null);
    try {
      const r = await fetch("/api/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id, task_id: task.id, status }),
      });
      if (!r.ok) throw new Error(`Request failed (${r.status}).`);
      track(student.id, status === "done" ? "plan_task_completed" : "plan_task_skipped", {
        task_id: task.id,
        concept_id: task.concept_id,
      });
      plansApi.retry();
    } catch {
      setNotice("Couldn't save that just now — we'll sync when you're back online.");
    } finally {
      setBusyId(null);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setNotice(null);
    try {
      const r = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id, budget_min: 120, days: 7, title: "Study plan" }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `Request failed (${r.status}).`);
      }
      track(student.id, "plan_generated", { source: "planner_ui" });
      plansApi.retry();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't build a plan yet.");
    } finally {
      setGenerating(false);
    }
  };

  const plannedPct =
    stats && stats.planned_min > 0 ? Math.round((stats.completed_min / stats.planned_min) * 100) : 0;

  // ── loading ──────────────────────────────────────────────────────────
  if (plansApi.status === "loading") {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Planner loading">
        <Skeleton className="h-36 w-full rounded-tt-lg" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-tt-lg" />
          <Skeleton className="h-40 w-full rounded-tt-lg" />
        </div>
      </div>
    );
  }

  // ── error ────────────────────────────────────────────────────────────
  if (plansApi.status === "error") {
    return (
      <div role="alert" className="rounded-tt-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="font-semibold text-slate-950">Your plan couldn’t load</p>
        <p className="mt-1 text-sm text-slate-600">{plansApi.error}</p>
        <Button variant="outline" onClick={plansApi.retry} className="tt-focus mt-4 rounded-tt-sm">
          <RotateCcwIcon className="mr-1 size-3.5" aria-hidden /> Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header: plan identity + student switcher */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="tt-mono-label text-[11px] text-primary">Deterministic planner · no AI spend</p>
          <h2 className="tt-display mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">
            {data?.plan?.title ?? "Study plan"}
          </h2>
          {data?.plan ? (
            <p className="mt-1 text-xs text-slate-500">
              {data.plan.start_date}
              {data.plan.end_date ? ` → ${data.plan.end_date}` : ""} · v{data.plan.version}
              {data.plan.target_score != null ? ` · target ${data.plan.target_score}%` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {students.length > 1 ? (
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Student
              <select
                aria-label="Choose student"
                value={student.id}
                onChange={(e) => {
                  const v = e.target.value;
                  router.push(v === students[0]?.id ? "/app/planner" : `/app/planner?student=${v}`);
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
          {data?.plan ? (
            <Button
              variant="outline"
              disabled={generating}
              onClick={generate}
              className="tt-focus rounded-tt-sm"
            >
              <RefreshCwIcon
                className={cn("mr-1 size-4", generating && !reduce && "motion-safe:animate-spin")}
                aria-hidden
              />
              {generating ? "Rebuilding…" : "Rebuild plan"}
            </Button>
          ) : null}
        </div>
      </div>

      {!online ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-tt-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <WifiOffIcon className="size-4 shrink-0" aria-hidden />
          You’re offline — showing the last synced plan.
        </div>
      ) : null}

      {notice ? (
        <div role="status" className="rounded-tt-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {notice}
        </div>
      ) : null}

      {/* ── empty: no plan yet — primary CTA ── */}
      {plansApi.status === "empty" || !data?.plan ? (
        <Empty className="rounded-tt-lg border border-slate-200 bg-white">
          <EmptyTitle>No plan yet</EmptyTitle>
          <EmptyDescription>
            The planner ranks your weakest concepts, open mistakes and due revisions, then fits them into a
            120-minute weekly budget. Attempt a quiz first so there are signals to plan from.
          </EmptyDescription>
          <Button disabled={generating} onClick={generate} size="lg" className="tt-focus mt-4 rounded-tt-md">
            <CalendarClockIcon className="mr-1 size-4" aria-hidden />
            {generating ? "Building your plan…" : "Build my plan"}
          </Button>
        </Empty>
      ) : (
        <>
          {/* ── Hero: today's plan — the one dominant action ── */}
          <section
            aria-labelledby="planner-today"
            className="rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="tt-mono-label text-[11px] text-primary">
                  Today · {stats?.today_tasks ?? 0} task{(stats?.today_tasks ?? 0) === 1 ? "" : "s"}
                </p>
                <h3 id="planner-today" className="tt-display mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">
                  {stats && stats.today_min > 0
                    ? `≈${stats.today_min} min left in today’s plan`
                    : (stats?.today_tasks ?? 0) > 0
                      ? "Today’s plan is done — nice work"
                      : "Nothing scheduled today"}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Work top-down: the planner already ordered these by expected mark gain, so finishing the first
                  task moves readiness further than any later one.
                </p>
              </div>
              <div className="text-right">
                <p className="tt-mono-label text-[11px] text-slate-400">Plan progress</p>
                <p className="tt-tnum mt-1 text-3xl font-semibold text-slate-950">{plannedPct}%</p>
                <p className="tt-tnum mt-1 text-xs text-slate-500">
                  {stats?.completed_min ?? 0} of {stats?.planned_min ?? 0} min
                </p>
              </div>
            </div>

            <div
              role="progressbar"
              aria-valuenow={plannedPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Plan minutes completed"
              className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-700"
                style={{ width: `${plannedPct}%` }}
              />
            </div>

            {todayTasks.length > 0 ? (
              <ul className="mt-6 space-y-3" aria-label="Today’s plan tasks">
                {todayTasks.map((t) => (
                  <TaskRow key={t.id} task={t} busy={busyId === t.id} onSet={setStatus} />
                ))}
              </ul>
            ) : (
              <p className="mt-6 rounded-tt-md bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No tasks dated today. Check the upcoming days below, or rebuild the plan.
              </p>
            )}
          </section>

          {/* ── Upcoming days ── */}
          <section aria-labelledby="planner-upcoming" className="rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4 text-primary" aria-hidden />
              <h3 id="planner-upcoming" className="text-base font-semibold text-slate-950">
                Upcoming days
              </h3>
            </div>
            {upcoming.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Nothing scheduled ahead. Rebuild the plan to spread the remaining workload.
              </p>
            ) : (
              <div className="mt-5 space-y-5">
                {upcoming.map(([date, list]) => (
                  <div key={date}>
                    <div className="flex items-center justify-between">
                      <p className="tt-mono-label text-[11px] text-slate-500">{dayLabel(date, today)}</p>
                      <p className="tt-tnum text-[11px] text-slate-400">
                        {list.reduce((s, t) => s + t.estimated_min, 0)} min
                      </p>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {list.map((t) => (
                        <li
                          key={t.id}
                          className="flex flex-wrap items-center gap-2 rounded-tt-md border border-slate-200 bg-slate-50/60 px-3.5 py-2.5"
                        >
                          <Badge variant="secondary" className="tt-mono-label rounded-tt-sm text-[10px]">
                            {TYPE_LABEL[t.task_type] ?? t.task_type}
                          </Badge>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{t.concept_title}</span>
                          <span className="tt-tnum text-xs text-slate-500">{t.estimated_min} min</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === t.id}
                            onClick={() => setStatus(t, "done")}
                            className="tt-focus rounded-tt-sm"
                          >
                            <CheckCircle2Icon className="mr-1 size-3.5" aria-hidden /> Done
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Summary strip ── */}
          <section
            aria-label="Plan summary"
            className="grid gap-4 rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft sm:grid-cols-3"
          >
            {[
              { label: "Done", value: stats?.done ?? 0, tone: "text-emerald-600" },
              { label: "Still pending", value: stats?.pending ?? 0, tone: "text-primary" },
              { label: "Skipped", value: stats?.skipped ?? 0, tone: "text-slate-400" },
            ].map((s) => (
              <div key={s.label}>
                <p className="tt-mono-label text-[11px] text-slate-400">{s.label}</p>
                <p className={cn("tt-tnum mt-1 text-3xl font-semibold", s.tone)}>{s.value}</p>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
