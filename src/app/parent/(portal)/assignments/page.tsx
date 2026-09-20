import { ClipboardListIcon, CheckCircle2Icon, ClockIcon, AlertCircleIcon, ArrowUpCircleIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { listAssignmentsForStudent, type AssignmentDisplayStatus } from "@/lib/parent/assignments";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_CONFIG: Record<
  AssignmentDisplayStatus,
  { label: string; cls: string; icon: React.ReactNode }
> = {
  set: {
    label: "Set",
    cls: "bg-slate-50 text-slate-700 border-slate-200",
    icon: <ClipboardListIcon className="size-3" aria-hidden />,
  },
  submitted: {
    label: "Submitted",
    cls: "bg-sky-50 text-sky-700 border-sky-200",
    icon: <ArrowUpCircleIcon className="size-3" aria-hidden />,
  },
  graded: {
    label: "Graded",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2Icon className="size-3" aria-hidden />,
  },
  returned: {
    label: "Returned",
    cls: "bg-violet-50 text-violet-700 border-violet-200",
    icon: <CheckCircle2Icon className="size-3" aria-hidden />,
  },
  overdue: {
    label: "Overdue",
    cls: "bg-red-50 text-red-700 border-red-200",
    icon: <AlertCircleIcon className="size-3" aria-hidden />,
  },
  missing: {
    label: "Missing",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <ClockIcon className="size-3" aria-hidden />,
  },
};

function StatusChip({ status }: { status: AssignmentDisplayStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

import React from "react";

export default async function ParentAssignmentsPage({
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
          title="Assignments"
          description="Set assignments, submission status and results."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No child selected</EmptyTitle>
          <EmptyDescription>
            Select a child from the top of the page to view their assignments.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const student = child.student;
  const assignments = await listAssignmentsForStudent(student.id, student.class);

  // Status counts for summary
  const counts = {
    graded: assignments.filter(
      (a) => a.displayStatus === "graded" || a.displayStatus === "returned",
    ).length,
    submitted: assignments.filter((a) => a.displayStatus === "submitted").length,
    overdue: assignments.filter((a) => a.displayStatus === "overdue").length,
    set: assignments.filter((a) => a.displayStatus === "set").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        description={`Set assignments, submission status and results — ${student.name}.`}
      />

      {assignments.length === 0 ? (
        <Empty className="border border-slate-200 bg-white">
          <ClipboardListIcon className="mx-auto mb-3 size-8 text-slate-300" />
          <EmptyTitle>No assignments yet</EmptyTitle>
          <EmptyDescription>
            Published assignments for your child will appear here, along with
            their submission status and scores once graded.
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {counts.graded > 0 && (
              <Card className="rounded-2xl border-slate-200 bg-white p-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Graded
                </p>
                <p className="mt-1 text-xl font-semibold text-emerald-600">
                  {counts.graded}
                </p>
              </Card>
            )}
            {counts.submitted > 0 && (
              <Card className="rounded-2xl border-slate-200 bg-white p-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Submitted
                </p>
                <p className="mt-1 text-xl font-semibold text-sky-600">
                  {counts.submitted}
                </p>
              </Card>
            )}
            {counts.overdue > 0 && (
              <Card className="rounded-2xl border-slate-200 bg-white p-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Overdue
                </p>
                <p className="mt-1 text-xl font-semibold text-red-600">
                  {counts.overdue}
                </p>
              </Card>
            )}
            <Card className="rounded-2xl border-slate-200 bg-white p-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-950">
                {assignments.length}
              </p>
            </Card>
          </div>

          {/* Assignment list */}
          <div className="space-y-2">
            {assignments.map((a) => (
              <Card
                key={a.id}
                className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {a.subject && (
                        <span className="font-medium text-slate-700">
                          {a.subject} ·{" "}
                        </span>
                      )}
                      Set {fmtDate(a.createdAt)}
                    </p>
                  </div>
                  <StatusChip status={a.displayStatus} />
                </div>

                {/* Score row — only when graded */}
                {a.submission && a.submission.percentage !== null && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
                        <div
                          className={`h-full rounded-full ${
                            a.submission.percentage >= 85
                              ? "bg-emerald-500"
                              : a.submission.percentage >= 60
                                ? "bg-sky-500"
                                : a.submission.percentage >= 40
                                  ? "bg-amber-400"
                                  : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(100, a.submission.percentage)}%` }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">
                      {Math.round(a.submission.percentage)}%
                      {a.submission.score !== null &&
                        a.submission.totalMarks !== null &&
                        ` (${a.submission.score}/${a.submission.totalMarks})`}
                    </span>
                  </div>
                )}

                {/* Teacher comment */}
                {a.submission?.teacherFeedback && (
                  <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 italic">
                    &ldquo;{a.submission.teacherFeedback}&rdquo;
                  </p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      <p className="px-1 text-xs leading-relaxed text-slate-500">
        Parents can view assignments and results but cannot edit submissions.
        Scores are shown only after the teacher has graded the work.
      </p>
    </div>
  );
}
