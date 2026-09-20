import { BookOpenIcon, BrainIcon, CalendarCheckIcon, FileCheckIcon, InfoIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getParentContext } from "@/lib/parent/auth";
import {
  getAssignmentTitles,
  getProgressOverview,
  MASTERY_THRESHOLD,
} from "@/lib/parent/progress";

export const dynamic = "force-dynamic";

export const metadata = { title: "Progress · TuitionTrack" };

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 text-sm leading-relaxed text-slate-600">
      {children}
    </p>
  );
}

export default async function ParentProgressPage({
  searchParams,
}: {
  searchParams?: { child?: string };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  const parentCtx = await getParentContext(requested);
  const activeChild = parentCtx.activeChild;

  if (!parentCtx.user || !activeChild) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Progress</h1>
        <p className="mt-2 text-sm text-slate-600">
          No child is linked to your account yet. Accept an invitation from your tuition teacher
          to see progress here.
        </p>
      </div>
    );
  }

  const student = activeChild.student;
  const overview = await getProgressOverview(student.id, student.class);
  const { curriculumCoverage: coverage, conceptMastery: mastery } = overview;

  const titles = await getAssignmentTitles(
    overview.assessments.recent.map((r) => r.assignmentId),
  );

  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Progress</h1>
      <p className="mt-1 text-sm text-slate-600">
        For <strong>{student.name}</strong> · Class {student.class}
      </p>

      {/* The invariant, stated to the reader. */}
      <div className="mt-5 flex items-start gap-2 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
        <p className="leading-relaxed">
          <strong>Coverage and mastery are two different things.</strong> Coverage is how far the
          syllabus has been taught. Mastery is what {student.name} has actually demonstrated. A
          chapter can be fully covered and still not be mastered — these numbers are never added
          together.
        </p>
      </div>

      {/* ── Curriculum covered ─────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <BookOpenIcon className="size-4 text-slate-500" aria-hidden />
          <h2 className="text-sm font-semibold text-slate-900">Curriculum covered</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Chapters your teacher has set work for. This tracks the syllabus, not learning.
        </p>

        {coverage.chaptersCovered === 0 ? (
          <Empty>
            No chapters have been assigned to {student.name} yet. We show nothing here rather
            than estimate a percentage.
          </Empty>
        ) : (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums text-slate-950">
                {coverage.chaptersCovered}
              </span>
              <span className="text-sm text-slate-600">
                chapter{coverage.chaptersCovered === 1 ? "" : "s"} covered
              </span>
              {coverage.percentOfPlan !== null && (
                <span className="text-xs text-slate-500">
                  · {coverage.percentOfPlan}% of the recorded plan
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {coverage.bySubject.map((s) => (
                <Card key={s.subject} className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {s.subject}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {s.chapters.map((c) => (
                      <li
                        key={c.slug}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5"
                      >
                        <span className="text-sm font-medium text-slate-800">{c.label}</span>
                        <span className="ml-1.5 text-xs text-slate-500">
                          {c.assignmentCount} assignment{c.assignmentCount === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>

            {coverage.planChapters === null && (
              <p className="mt-3 text-xs text-slate-500">
                No formal curriculum plan is recorded for this class, so coverage is shown as a
                count rather than a percentage.
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Concept mastery ────────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <BrainIcon className="size-4 text-slate-500" aria-hidden />
          <h2 className="text-sm font-semibold text-slate-900">Concept mastery</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          What {student.name} has demonstrated in practice and assessment — regardless of how far
          the syllabus has moved.
        </p>

        {mastery.conceptsTracked === 0 ? (
          <Empty>
            No practice or assessment outcomes have been recorded for {student.name} yet. Mastery
            is measured from real attempts; we will not display an estimated score instead.
          </Empty>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
              <p className="text-xs text-slate-500">Concepts tracked</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
                {mastery.conceptsTracked}
              </p>
            </Card>
            <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
              <p className="text-xs text-slate-500">Mastered</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
                {mastery.conceptsMastered}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                mastery ≥ {MASTERY_THRESHOLD}
              </p>
            </Card>
            <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
              <p className="text-xs text-slate-500">Average mastery</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
                {mastery.averageMastery === null
                  ? "—"
                  : `${Math.round(mastery.averageMastery * 100)}%`}
              </p>
            </Card>
          </div>
        )}

        {mastery.lastPracticedAt && (
          <p className="mt-2 text-xs text-slate-500">
            Last practiced{" "}
            {new Date(mastery.lastPracticedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
          </p>
        )}
      </section>

      {/* ── Supporting evidence ────────────────────────────────────────────── */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <FileCheckIcon className="size-4 text-slate-500" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Assessments
            </p>
          </div>
          {overview.assessments.submissions === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No graded submissions recorded yet.</p>
          ) : (
            <>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
                {overview.assessments.averagePercentage === null
                  ? "—"
                  : `${Math.round(overview.assessments.averagePercentage)}%`}
              </p>
              <p className="text-xs text-slate-500">
                Average across {overview.assessments.submissions} graded submission
                {overview.assessments.submissions === 1 ? "" : "s"}
              </p>
              <ul className="mt-3 space-y-1.5">
                {overview.assessments.recent.slice(0, 3).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-slate-700">
                      {titles[r.assignmentId] ?? "Assessment"}
                    </span>
                    <span className="tabular-nums text-slate-500">
                      {r.percentage === null ? "—" : `${Math.round(r.percentage)}%`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <CalendarCheckIcon className="size-4 text-slate-500" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Attendance
            </p>
          </div>
          {overview.attendance.daysMarked === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No attendance recorded yet.</p>
          ) : (
            <>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
                {overview.attendance.percentPresent === null
                  ? "—"
                  : `${Math.round(overview.attendance.percentPresent)}%`}
              </p>
              <p className="text-xs text-slate-500">
                {overview.attendance.daysPresent} of {overview.attendance.daysMarked} days present
              </p>
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
