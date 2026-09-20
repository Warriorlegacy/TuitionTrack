import { BookIcon, CheckIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { getProgressOverview } from "@/lib/parent/progress";

export const dynamic = "force-dynamic";

function CoverageBar({ covered, total }: { covered: number; total: number }) {
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div
          className="h-full rounded-full bg-sky-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-slate-500">
        {covered}/{total}
      </span>
    </div>
  );
}

export default async function ParentSyllabusPage({
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
          title="Syllabus"
          description="Course coverage and curriculum progress."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No child selected</EmptyTitle>
          <EmptyDescription>
            Select a child from the top of the page to view the syllabus.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const student = child.student;
  const overview = await getProgressOverview(student.id, student.class);
  const coverage = overview.curriculumCoverage;

  const hasCoverage = coverage.chaptersCovered > 0;
  const hasPlan = coverage.planChapters !== null && coverage.planChapters > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Syllabus"
        description={`Curriculum coverage for ${student.name} — Class ${student.class}.`}
      />

      {!hasCoverage ? (
        <Empty className="border border-slate-200 bg-white">
          <BookIcon className="mx-auto mb-3 size-8 text-slate-300" />
          <EmptyTitle>No curriculum data recorded yet</EmptyTitle>
          <EmptyDescription>
            Coverage is derived from assignments linked to curriculum chapters.
            When your teacher publishes chapter-tagged assignments, the syllabus
            will appear here automatically — nothing needs to be entered
            separately.
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          {/* Overall summary */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="rounded-2xl border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Chapters covered
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {coverage.chaptersCovered}
              </p>
            </Card>
            {hasPlan && (
              <Card className="rounded-2xl border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  % of plan
                </p>
                <p className="mt-1 text-2xl font-semibold text-sky-600">
                  {coverage.percentOfPlan !== null
                    ? `${Math.round(coverage.percentOfPlan)}%`
                    : "—"}
                </p>
              </Card>
            )}
          </div>

          {hasPlan && (
            <Card className="rounded-2xl border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-900">
                  Overall curriculum progress
                </span>
                <span className="text-slate-500">
                  {coverage.chaptersCovered} of {coverage.planChapters} chapters
                </span>
              </div>
              <CoverageBar
                covered={coverage.chaptersCovered}
                total={coverage.planChapters!}
              />
              <p className="mt-2 text-xs text-slate-500">
                Coverage = ground the teacher has walked through. It says
                nothing about what has been learned — that is shown on the
                Progress page.
              </p>
            </Card>
          )}

          {/* Per-subject breakdown */}
          {coverage.bySubject.length > 0 && (
            <div className="space-y-4">
              {coverage.bySubject.map((subj) => (
                <Card
                  key={subj.subject}
                  className="rounded-2xl border-slate-200 bg-white p-4"
                >
                  <h2 className="mb-3 text-sm font-semibold text-slate-900">
                    {subj.subject}
                  </h2>
                  <div className="space-y-3">
                    {subj.chapters.map((ch) => (
                      <div key={ch.slug} className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-700">
                            {ch.label}
                          </p>
                          <p className="text-xs text-slate-400">
                            {ch.assignmentCount} assignment
                            {ch.assignmentCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                          <CheckIcon className="size-3" aria-hidden />
                          Covered
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <p className="px-1 text-xs leading-relaxed text-slate-500">
        Curriculum coverage shows chapters where your teacher has published
        assignments. It is not the same as concept mastery — a chapter can be
        covered without every concept being mastered. See the{" "}
        <a
          href="/parent/progress"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Progress page
        </a>{" "}
        for mastery data.
      </p>
    </div>
  );
}
