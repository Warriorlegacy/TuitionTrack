import { AwardIcon, CheckCircle2Icon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { listTestResultsForStudent } from "@/lib/parent/tests";
import { listHomeworkForStudent } from "@/lib/parent/homework";
import { listAssignmentsForStudent } from "@/lib/parent/assignments";

export const dynamic = "force-dynamic";

export const metadata = { title: "Student Portfolio · TuitionTrack" };

export default async function ParentPortfolioPage({
  searchParams,
}: {
  searchParams?: { child?: string };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  const context = await requireParentContext(requested);
  const child = context.activeChild;

  if (!child) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Student Portfolio"
          description="Curated showcase of verified learning achievements and approved project submissions."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No child selected</EmptyTitle>
          <EmptyDescription>
            Select a child from the switcher to view their academic portfolio.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const student = child.student;

  const [tests, allHw] = await Promise.all([
    listTestResultsForStudent(student.id, 20).catch(() => []),
    listHomeworkForStudent(student.id, "all").catch(() => []),
    listAssignmentsForStudent(student.id, "all").catch(() => []),
  ]);

  const topTests = tests.filter((t) => t.percentage !== null && t.percentage >= 80);
  const completedHw = allHw.filter((h) => h.status === "completed");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Portfolio"
        description={`Verified academic work, approved project achievements, and excellence milestones for ${student.name}.`}
      />

      {/* Summary Highlight */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Top Assessments (80%+)
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{topTests.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">Evaluated with distinction</p>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Completed Submissions
          </p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{completedHw.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">Verified by mentor</p>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Academic Status
          </p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">Active</p>
          <p className="mt-0.5 text-xs text-slate-500">Class {student.class} Track</p>
        </Card>
      </div>

      {/* Distinction Assessments Showcase */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AwardIcon className="size-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-900">Distinction Assessments</h2>
        </div>

        {topTests.length === 0 ? (
          <Empty className="border border-slate-200 bg-white">
            <EmptyTitle>No distinction assessments yet</EmptyTitle>
            <EmptyDescription>
              Tests where {student.name} scores 80% or higher will be showcased here.
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {topTests.map((test) => (
              <Card
                key={test.id}
                className="rounded-2xl border-amber-100 bg-gradient-to-br from-amber-50/30 via-white to-white p-5 shadow-soft"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                      {test.subject ?? "Assessment"}
                    </span>
                    <h3 className="mt-2 text-sm font-bold text-slate-950">{test.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Evaluated on{" "}
                      {test.gradedAt
                        ? new Date(test.gradedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Recently"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-emerald-600">
                      {Math.round(test.percentage!)}%
                    </span>
                    {test.score !== null && test.totalMarks !== null && (
                      <p className="text-[11px] text-slate-400">
                        {test.score}/{test.totalMarks} marks
                      </p>
                    )}
                  </div>
                </div>

                {test.teacherFeedback && (
                  <p className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 italic">
                    &ldquo;{test.teacherFeedback}&rdquo;
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Completed Homework & Project Evidence */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2Icon className="size-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-900">Verified Completed Assignments</h2>
        </div>

        {completedHw.length === 0 ? (
          <Empty className="border border-slate-200 bg-white">
            <EmptyTitle>No verified submissions yet</EmptyTitle>
            <EmptyDescription>
              Completed work checked and approved by the teacher will appear here.
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="space-y-2">
            {completedHw.slice(0, 10).map((hw) => (
              <Card
                key={hw.id}
                className="flex items-center justify-between rounded-2xl border-slate-200 bg-white p-4 shadow-soft"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{hw.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {hw.subject && <span className="font-medium">{hw.subject} · </span>}
                    Submitted & verified by mentor
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200 shrink-0">
                  Completed
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
