import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { getAttendanceForMonth } from "@/lib/parent/attendance";

export const dynamic = "force-dynamic";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function CalendarCell({
  day,
  present,
}: {
  day: number | null;
  present: boolean | null; // null = no record
}) {
  if (day === null) {
    return <div className="aspect-square" />;
  }

  const base = "flex aspect-square items-center justify-center rounded-full text-sm font-medium transition-colors";
  if (present === true) {
    return (
      <div className={`${base} bg-emerald-100 text-emerald-800`} title="Present">
        {day}
      </div>
    );
  }
  if (present === false) {
    return (
      <div className={`${base} bg-red-100 text-red-800`} title="Absent">
        {day}
      </div>
    );
  }
  return (
    <div className={`${base} text-slate-400`} title="Not recorded">
      {day}
    </div>
  );
}

export default async function ParentAttendancePage({
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
          title="Attendance"
          description="Attendance history and patterns."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No child selected</EmptyTitle>
          <EmptyDescription>
            Select a child from the top of the page to view their attendance.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const student = child.student;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Parse requested month/year from query params
  const rawYear = typeof searchParams?.year === "string" ? parseInt(searchParams.year) : NaN;
  const rawMonth = typeof searchParams?.month === "string" ? parseInt(searchParams.month) : NaN;

  const year = !isNaN(rawYear) && rawYear > 2000 && rawYear < 2100 ? rawYear : today.getFullYear();
  const month = !isNaN(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : today.getMonth() + 1;

  const attendance = await getAttendanceForMonth(student.id, year, month);
  const childParam = requested ? `&child=${requested}` : "";

  // Prev / next month navigation
  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const prevHref = `/parent/attendance?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}${childParam}`;
  const nextHref = `/parent/attendance?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}${childParam}`;

  // Calendar grid: days of month, padded by weekday of 1st
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description={`Day-by-day attendance for ${student.name}.`}
      />

      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <Link
          href={prevHref}
          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="size-4" aria-hidden />
          Prev
        </Link>
        <h2 className="text-sm font-semibold text-slate-900">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <Link
          href={nextHref}
          className={`flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 ${
            isCurrentMonth ? "pointer-events-none opacity-40" : ""
          }`}
          aria-label="Next month"
        >
          Next
          <ChevronRightIcon className="size-4" aria-hidden />
        </Link>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl border-slate-200 bg-white p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Present
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {attendance.daysPresent}
          </p>
        </Card>
        <Card className="rounded-2xl border-slate-200 bg-white p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Absent
          </p>
          <p className="mt-1 text-2xl font-semibold text-red-600">
            {attendance.daysAbsent}
          </p>
        </Card>
        <Card className="rounded-2xl border-slate-200 bg-white p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Rate
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">
            {attendance.percentPresent !== null
              ? `${Math.round(attendance.percentPresent)}%`
              : "—"}
          </p>
        </Card>
      </div>

      {/* Calendar */}
      <Card className="rounded-2xl border-slate-200 bg-white p-4">
        {/* Day headers */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {DAYS_OF_WEEK.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`pad-${i}`} className="aspect-square" />;
            }
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const present = attendance.byDate.has(dateStr)
              ? attendance.byDate.get(dateStr)!
              : null;
            const isToday = dateStr === todayStr;
            return (
              <div key={day} className={isToday ? "ring-2 ring-primary ring-offset-1 rounded-full" : ""}>
                <CalendarCell day={day} present={present} />
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-emerald-100 ring-1 ring-emerald-300" />
            Present
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-red-100 ring-1 ring-red-300" />
            Absent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-slate-100 ring-1 ring-slate-200" />
            Not recorded
          </span>
        </div>
      </Card>

      {attendance.daysMarked === 0 && (
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No attendance recorded this month</EmptyTitle>
          <EmptyDescription>
            Your teacher has not marked attendance for {MONTH_NAMES[month - 1]}{" "}
            yet. Check a previous month or ask your teacher.
          </EmptyDescription>
        </Empty>
      )}

      {/* Honest denominator note */}
      {attendance.daysMarked > 0 && (
        <p className="px-1 text-xs leading-relaxed text-slate-500">
          Attendance rate is calculated as{" "}
          <span className="font-medium">
            {attendance.daysPresent} present ÷ {attendance.daysMarked} marked
          </span>
          , not as a fraction of all calendar days. Days where attendance was
          not recorded are shown in grey and are not counted.
        </p>
      )}
    </div>
  );
}
