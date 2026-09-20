import { TrendingUpIcon, TrendingDownIcon, MinusIcon, AwardIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { listTestResultsForStudent, getSubjectPerformance, getTestTrend } from "@/lib/parent/tests";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function GradeChip({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-400">—</span>;

  const rounded = Math.round(pct);
  let cls = "bg-slate-50 text-slate-700 border-slate-200";
  if (rounded >= 85) cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
  else if (rounded >= 60) cls = "bg-sky-50 text-sky-700 border-sky-200";
  else if (rounded >= 40) cls = "bg-amber-50 text-amber-700 border-amber-200";
  else cls = "bg-red-50 text-red-700 border-red-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {rounded}%
    </span>
  );
}

function ScoreBar({ pct }: { pct: number }) {
  const w = Math.min(100, Math.max(0, pct));
  const color =
    w >= 85
      ? "bg-emerald-500"
      : w >= 60
        ? "bg-sky-500"
        : w >= 40
          ? "bg-amber-400"
          : "bg-red-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function TrendIndicator({ trend }: { trend: number[] }) {
  if (trend.length < 2) return null;
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const diff = last - prev;

  if (Math.abs(diff) < 3) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-slate-400">
        <MinusIcon className="size-3" aria-hidden />
        Steady
      </span>
    );
  }
  if (diff > 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-600">
        <TrendingUpIcon className="size-3" aria-hidden />
        +{Math.round(diff)}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-xs font-medium text-red-600">
      <TrendingDownIcon className="size-3" aria-hidden />
      {Math.round(diff)}%
    </span>
  );
}

export default async function ParentTestsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const requested =
    typeof searchParams?.child === "string" ? searchParams.child : undefined;
  const context = await requireParentContext(requested);

  const child = context.activeChild;
  if (!child) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Tests & Results"
          description="Test and exam results, with trends rather than single numbers."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No child selected</EmptyTitle>
          <EmptyDescription>
            Select a child from the top of the page to view test results.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const student = child.student;

  const [results, subjectPerf, trend] = await Promise.all([
    listTestResultsForStudent(student.id, 50),
    getSubjectPerformance(student.id),
    getTestTrend(student.id, 20),
  ]);

  const trendValues = trend.map((t) => t.percentage);
  const avgPct =
    results.length > 0
      ? Math.round(
          results.reduce((s, r) => s + (r.percentage ?? 0), 0) / results.length,
        )
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tests & Results"
        description={`Assessment results for ${student.name}.`}
      />

      {results.length === 0 ? (
        <Empty className="border border-slate-200 bg-white">
          <AwardIcon className="mx-auto mb-3 size-8 text-slate-300" />
          <EmptyTitle>No results yet</EmptyTitle>
          <EmptyDescription>
            Graded test results will appear here once your teacher has reviewed
            and returned them. Results are shown only after the teacher has
            completed grading — not when submitted.
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          {/* Overall summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="rounded-2xl border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Tests graded
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {results.length}
              </p>
            </Card>
            <Card className="rounded-2xl border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Average score
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {avgPct !== null ? `${avgPct}%` : "—"}
              </p>
            </Card>
            <Card className="rounded-2xl border-slate-200 bg-white p-4 col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Trend
              </p>
              <div className="mt-1">
                <TrendIndicator trend={trendValues} />
                {trendValues.length < 2 && (
                  <p className="text-sm text-slate-500">Need 2+ results</p>
                )}
              </div>
            </Card>
          </div>

          {/* Subject breakdown */}
          {subjectPerf.length > 0 && (
            <Card className="rounded-2xl border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">
                Subject performance
              </h2>
              <div className="space-y-3">
                {subjectPerf.map((s) => (
                  <div key={s.subject}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-900">
                        {s.subject}
                      </span>
                      <span className="text-slate-500">
                        {s.averagePercentage}% avg · {s.count} test
                        {s.count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ScoreBar pct={s.averagePercentage} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Individual results */}
          <div className="space-y-2">
            {results.map((result) => (
              <Card
                key={result.id}
                className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {result.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {result.subject && (
                        <span className="font-medium text-slate-700">
                          {result.subject} ·{" "}
                        </span>
                      )}
                      {fmtDate(result.gradedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <GradeChip pct={result.percentage} />
                    {result.score !== null && result.totalMarks !== null && (
                      <p className="text-xs text-slate-400 tabular-nums">
                        {result.score}/{result.totalMarks}
                      </p>
                    )}
                  </div>
                </div>
                {result.teacherFeedback && (
                  <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 italic">
                    &ldquo;{result.teacherFeedback}&rdquo;
                  </p>
                )}
                {result.percentage !== null && (
                  <div className="mt-3">
                    <ScoreBar pct={result.percentage} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      <p className="px-1 text-xs leading-relaxed text-slate-500">
        Results are shown after your teacher has reviewed and returned them.
        Scores reflect what was graded — not class-wide ranks or estimates.
      </p>
    </div>
  );
}
