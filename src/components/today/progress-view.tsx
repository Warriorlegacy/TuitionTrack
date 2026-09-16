"use client";

// Progress subviews (Blueprint #28–29): mastery heatmap, Mistake Book,
// readiness trend. Wired to the real GETs; analytics via POST events.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  LineChartIcon,
  RotateCcwIcon,
  WrenchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BentoCard, MasteryRing } from "@/components/marketing/ui";
import { cn } from "@/lib/utils";
import { StudentNav } from "./student-nav";
import {
  masteryTone,
  mistakeTitle,
  nodeLevel,
  nodeTitle,
  pct,
  track,
  useApi,
  type MasteryRow,
  type Mistake,
  type Readiness,
} from "./lib";
import type { RecentTest, TodayStudent } from "./today-view";

const STATUSES = ["all", "open", "practicing", "fixed", "relapsed", "mastered"] as const;

function subjectOf(r: MasteryRow) {
  const t = nodeTitle(r, "");
  const head = (t.split(/[:·|/–—-]/)[0] ?? "").trim();
  return head || nodeLevel(r) || "General";
}

function statusTone(s: string) {
  switch (s) {
    case "open":
      return "destructive";
    case "practicing":
      return "secondary";
    case "fixed":
    case "mastered":
      return "default";
    case "relapsed":
      return "outline";
    default:
      return "outline";
  }
}

export function ProgressView({
  student,
  recentTests,
}: {
  student: TodayStudent;
  recentTests: RecentTest[];
}) {
  const masteryApi = useApi<{ mastery: MasteryRow[] }>(
    `/api/students/${student.id}/mastery`,
    (d) => (d.mastery ?? []).length === 0,
  );
  const mistakesApi = useApi<{ mistakes: Mistake[] }>(
    `/api/students/${student.id}/mistakes?status=all`,
    (d) => (d.mistakes ?? []).length === 0,
  );
  const readinessApi = useApi<Readiness>(`/api/students/${student.id}/readiness`);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("all");
  const [practiced, setPracticed] = useState<Set<string>>(new Set());

  const rows = useMemo(() => masteryApi.data?.mastery ?? [], [masteryApi.data]);
  const mistakes = useMemo(() => mistakesApi.data?.mistakes ?? [], [mistakesApi.data]);

  const groups = useMemo(() => {
    const map = new Map<string, MasteryRow[]>();
    for (const r of rows) {
      const k = subjectOf(r);
      const list = map.get(k) ?? [];
      list.push(r);
      map.set(k, list);
    }
    return Array.from(map.entries())
      .map(([subject, list]) => ({
        subject,
        list: list.sort((a, b) => a.mastery - b.mastery),
        avg: Math.round(list.reduce((s, r) => s + pct(r.mastery), 0) / Math.max(1, list.length)),
      }))
      .sort((a, b) => a.avg - b.avg);
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: mistakes.length };
    for (const m of mistakes) c[m.status ?? "open"] = (c[m.status ?? "open"] ?? 0) + 1;
    return c;
  }, [mistakes]);
  const visible = filter === "all" ? mistakes : mistakes.filter((m) => (m.status ?? "open") === filter);

  const trend = useMemo(
    () => [...recentTests].sort((a, b) => +new Date(a.date) - +new Date(b.date)).slice(-8),
    [recentTests],
  );
  const readiness = readinessApi.data?.readiness ?? null;
  const spark = useMemo(() => {
    const pts = trend.map((t) => t.percentage);
    if (readiness != null && pts.length > 0) pts.push(readiness);
    const max = 100;
    const W = 320;
    const H = 96;
    return pts.map((v, i) => {
      const x = pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * (W - 8) + 4;
      const y = H - 8 - (Math.max(0, Math.min(max, v)) / max) * (H - 24);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
  }, [trend, readiness]);

  const toggle = (id: string, title: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        track(student.id, "syllabus_viewed", { concept_id: id, title });
      }
      return next;
    });
  };

  const markPracticed = (m: Mistake) => {
    setPracticed((prev) => new Set(prev).add(m.id));
    track(student.id, "mastery_moved", {
      mistake_id: m.id,
      category: m.category ?? null,
      concept_id: m.concept_id ?? null,
      to_status: "practicing",
    });
  };

  return (
    <div className="space-y-5">
      {/* Sub-nav: three subviews, one screen */}
      <nav aria-label="Progress sections" className="flex flex-wrap gap-2">
        {[
          { href: "#heatmap", label: "Mastery heatmap" },
          { href: "#mistakes", label: "Mistake Book" },
          { href: "#trend", label: "Readiness trend" },
        ].map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="tt-focus rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-primary/40 hover:text-primary"
          >
            {l.label}
          </a>
        ))}
      </nav>

      {/* ── Mastery heatmap ── */}
      <BentoCard
        icon={<LineChartIcon className="size-4" aria-hidden />}
        title="Mastery heatmap"
        desc="Exam → Subject → Unit → Chapter → Topic → Concept. Tap a cell to inspect it."
        status={masteryApi.status}
        error={masteryApi.error}
      >
        <div className="space-y-5 px-4 pb-4" id="heatmap">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500" aria-label="Heatmap legend">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-red-500" aria-hidden /> Below 40%</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-500" aria-hidden /> 40–70%</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" aria-hidden /> Above 70%</span>
          </div>
          {groups.map((g) => (
            <section key={g.subject} aria-label={g.subject}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{g.subject}</h3>
                <span className="tt-tnum text-xs text-slate-500">avg {g.avg}% · {g.list.length} concepts</span>
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {g.list.map((r, i) => {
                  const id = r.concept_id ?? `${g.subject}-${i}`;
                  const open = expanded.has(id);
                  const title = nodeTitle(r);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => toggle(id, title)}
                        className={cn(
                          "tt-focus w-full rounded-tt-sm border p-3 text-left",
                          open ? "border-primary/40 bg-primary/[0.04]" : "border-slate-200 bg-white hover:border-slate-300",
                        )}
                      >
                        <span className="tt-tnum text-base font-semibold text-slate-950">{pct(r.mastery)}%</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-600" title={title}>{title}</span>
                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                          <span className={cn("block h-full rounded-full", masteryTone(r.mastery))} style={{ width: `${pct(r.mastery)}%` }} />
                        </span>
                      </button>
                      {open ? (
                        <div className="mt-1 rounded-tt-sm border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                          <p>Streak {r.streak ?? 0} · Attempts {r.attempt_count ?? 0}</p>
                          <p>
                            {r.last_practiced_at ? `Last practised ${new Date(r.last_practiced_at).toLocaleDateString("en-IN")}` : "Not practised yet"}
                            {r.next_review_at ? ` · Review ${new Date(r.next_review_at).toLocaleDateString("en-IN")}` : ""}
                          </p>
                          <Link
                            href={`/app/today?student=${student.id}`}
                            className="tt-focus mt-1 inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                          >
                            Practice this <ChevronRightIcon className="size-3.5" aria-hidden />
                          </Link>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        {masteryApi.status === "error" ? (
          <div className="px-4 pb-4">
            <Button variant="outline" size="sm" onClick={masteryApi.retry} className="tt-focus rounded-tt-sm">
              <RotateCcwIcon className="mr-1 size-3.5" aria-hidden /> Retry
            </Button>
          </div>
        ) : null}
      </BentoCard>

      {/* ── Mistake Book ── */}
      <BentoCard
        icon={<WrenchIcon className="size-4" aria-hidden />}
        title="Mistake Book"
        desc="Every error with a repair. Fix the pattern, not just the question."
        status={mistakesApi.status}
        error={mistakesApi.error}
      >
        <div className="space-y-4 px-4 pb-4" id="mistakes">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by mistake status">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={filter === s}
                onClick={() => setFilter(s)}
                className={cn(
                  "tt-focus rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize",
                  filter === s
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                )}
              >
                {s} · {counts[s] ?? 0}
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="rounded-tt-sm bg-slate-50 p-4 text-sm text-slate-500">
              Nothing {filter === "all" ? "here" : `marked ${filter}`} yet.
              {filter !== "all" ? " Try another status." : " Mistakes appear after the first test analysis."}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {visible.map((m) => {
                const done = practiced.has(m.id) || m.status === "fixed" || m.status === "mastered";
                return (
                  <li key={m.id} className="rounded-tt-sm border border-slate-200 p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusTone(m.status ?? "open")} className="capitalize">{m.status ?? "open"}</Badge>
                      <Badge variant="outline">{m.category ?? "concept"}</Badge>
                      {(m.recurrence_count ?? 0) > 1 ? (
                        <span className="tt-tnum text-xs text-slate-400">repeated ×{m.recurrence_count}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900">{mistakeTitle(m)}</p>
                    <details className="mt-2 text-sm">
                      <summary className="tt-focus inline cursor-pointer rounded-sm font-medium text-primary hover:underline">
                        Fix exercise (≈6 min)
                      </summary>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 leading-6 text-slate-600">
                        <li>Read the question aloud and underline the given values.</li>
                        <li>Re-attempt from scratch without looking at the solution.</li>
                        <li>Compare — write the one line where you diverged.</li>
                      </ol>
                      {done ? (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-emerald-700">
                          <CheckCircle2Icon className="size-4" aria-hidden /> Practiced — it returns to review before you forget it.
                        </p>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => markPracticed(m)} className="tt-focus mt-2 rounded-tt-sm">
                          Mark practiced
                        </Button>
                      )}
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {mistakesApi.status === "error" ? (
          <div className="px-4 pb-4">
            <Button variant="outline" size="sm" onClick={mistakesApi.retry} className="tt-focus rounded-tt-sm">
              <RotateCcwIcon className="mr-1 size-3.5" aria-hidden /> Retry
            </Button>
          </div>
        ) : null}
      </BentoCard>

      {/* ── Readiness trend ── */}
      <BentoCard
        icon={<AlertTriangleIcon className="size-4" aria-hidden />}
        title="Readiness trend"
        desc={readinessApi.data?.disclaimer ?? "Estimate only — not a guarantee of exam outcome."}
        status={readinessApi.status === "error" && trend.length === 0 ? "error" : "ready"}
        error={readinessApi.error}
      >
        <div className="flex flex-wrap items-center gap-6 px-4 pb-4" id="trend">
          <MasteryRing
            value={readiness}
            label="Readiness now"
            status={readinessApi.status === "error" ? "error" : readiness != null ? "ready" : "loading"}
          />
          <div className="min-w-0 flex-1">
            {trend.length === 0 ? (
              <div className="space-y-2" aria-label="Trend loading">
                {readinessApi.status === "loading" ? (
                  <>
                    <Skeleton className="h-24 w-full rounded-tt-sm" />
                    <Skeleton className="h-4 w-2/3" />
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No test history yet — the trend draws itself after the first two tests.</p>
                )}
              </div>
            ) : (
              <>
                <svg
                  viewBox="0 0 320 96"
                  className="h-24 w-full"
                  role="img"
                  aria-label={`Test scores trend: ${trend.map((t) => `${t.subject} ${t.percentage} percent`).join(", ")}${readiness != null ? `, readiness now ${readiness} percent` : ""}`}
                >
                  <polyline
                    points={spark.join(" ")}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                  />
                  {spark.map((pt, i) => {
                    const [cx, cy] = pt.split(",");
                    const last = i === spark.length - 1 && readiness != null && trend.length > 0;
                    return <circle key={i} cx={cx} cy={cy} r={last ? 4.5 : 3} className={last ? "fill-emerald-500" : "fill-primary"} />;
                  })}
                </svg>
                <ul className="tt-tnum mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {trend.map((t) => (
                    <li key={t.id}>{t.subject} {t.percentage}%</li>
                  ))}
                  {readiness != null ? <li className="font-semibold text-emerald-700">now {readiness}% (est.)</li> : null}
                </ul>
              </>
            )}
          </div>
        </div>
      </BentoCard>

      <StudentNav />
    </div>
  );
}
