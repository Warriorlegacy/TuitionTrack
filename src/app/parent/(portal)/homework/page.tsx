import Link from "next/link";
import { CheckCircle2Icon, ClockIcon, AlertCircleIcon, BookOpenIcon, CalendarIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { listHomeworkForStudent, getHomeworkCompletionRate, type HomeworkEntry, type HomeworkPeriod } from "@/lib/parent/homework";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function StatusChip({ entry }: { entry: HomeworkEntry }) {
  if (entry.isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        <AlertCircleIcon className="size-3" aria-hidden />
        Overdue
      </span>
    );
  }
  if (entry.status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2Icon className="size-3" aria-hidden />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
      <ClockIcon className="size-3" aria-hidden />
      Pending
    </span>
  );
}

// `period` was previously a required prop but is redundant: `href` carries the
// period and `active` already compares it. Removed rather than underscore-
// prefixed, which would only silence the lint rule without removing dead API.
function PeriodTab({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-slate-950 text-white"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
}

export default async function ParentHomeworkPage({
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
          title="Homework"
          description="What was set, what is due, and what has been completed."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No child selected</EmptyTitle>
          <EmptyDescription>
            Select a child from the top of the page to view their homework.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const rawPeriod = typeof searchParams?.period === "string" ? searchParams.period : "week";
  const period: HomeworkPeriod = ["today", "week", "month", "all"].includes(rawPeriod)
    ? (rawPeriod as HomeworkPeriod)
    : "week";

  const student = child.student;
  const childParam = requested ? `&child=${requested}` : "";

  const [entries, rate] = await Promise.all([
    listHomeworkForStudent(student.id, period),
    getHomeworkCompletionRate(student.id, period === "today" ? "week" : period),
  ]);

  const periodLabel = {
    today: "today",
    week: "this week",
    month: "this month",
    all: "all time",
  }[period];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Homework"
        description={`What was set, what is due, and what has been completed — ${student.name}.`}
      />

      {/* Period tabs */}
      <div className="flex flex-wrap gap-2">
        <PeriodTab
          label="Today"
          active={period === "today"}
          href={`/parent/homework?period=today${childParam}`}
        />
        <PeriodTab
          label="This week"
          active={period === "week"}
          href={`/parent/homework?period=week${childParam}`}
        />
        <PeriodTab
          label="This month"
          active={period === "month"}
          href={`/parent/homework?period=month${childParam}`}
        />
        <PeriodTab
          label="All"
          active={period === "all"}
          href={`/parent/homework?period=all${childParam}`}
        />
      </div>

      {/* Completion summary */}
      {rate.total > 0 && (
        <Card className="rounded-2xl border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Completion rate · {periodLabel}
          </p>
          <div className="mt-2 flex items-end gap-3">
            <p className="text-2xl font-semibold tracking-tight text-slate-950">
              {rate.rate !== null ? `${Math.round(rate.rate)}%` : "—"}
            </p>
            <p className="mb-0.5 text-sm text-slate-500">
              {rate.completed} of {rate.total} completed
              {rate.overdue > 0 && (
                <span className="ml-2 font-semibold text-red-600">
                  · {rate.overdue} overdue
                </span>
              )}
            </p>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width: `${rate.rate !== null ? Math.round(rate.rate) : 0}%`,
              }}
            />
          </div>
        </Card>
      )}

      {/* Homework list */}
      {entries.length === 0 ? (
        <Empty className="border border-slate-200 bg-white">
          <BookOpenIcon className="mx-auto mb-3 size-8 text-slate-300" />
          <EmptyTitle>No homework {periodLabel}</EmptyTitle>
          <EmptyDescription>
            {period === "today"
              ? "No homework is due today. Check 'This week' to see upcoming items."
              : "No homework has been recorded for this period yet."}
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card
              key={entry.id}
              className="flex items-start gap-4 rounded-2xl border-slate-200 bg-white p-4 shadow-soft"
            >
              {/* Status indicator dot */}
              <span
                className={`mt-1 size-2 shrink-0 rounded-full ${
                  entry.isOverdue
                    ? "bg-red-500"
                    : entry.status === "completed"
                      ? "bg-emerald-500"
                      : "bg-amber-400"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {entry.title}
                    </p>
                    {entry.description && (
                      <p className="mt-0.5 text-sm text-slate-600 line-clamp-2">
                        {entry.description}
                      </p>
                    )}
                  </div>
                  <StatusChip entry={entry} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  {entry.subject && (
                    <span className="font-medium text-slate-700">
                      {entry.subject}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="size-3" aria-hidden />
                    Due {fmtDate(entry.due_date)}
                  </span>
                  {entry.status === "completed" && entry.updated_at && (
                    <span className="text-emerald-600">
                      Done {fmtDate(entry.updated_at)}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Privacy note */}
      <p className="px-1 text-xs leading-relaxed text-slate-500">
        Homework records are set by your child&apos;s tuition teacher. If you
        see a discrepancy, contact your teacher directly.
      </p>
    </div>
  );
}
