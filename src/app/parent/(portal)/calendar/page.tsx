import { CalendarIcon, BookOpenIcon, ClipboardListIcon, IndianRupeeIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { listHomeworkForStudent } from "@/lib/parent/homework";
import { listAssignmentsForStudent } from "@/lib/parent/assignments";
import { listFeesForStudent } from "@/lib/parent/payments";

export const dynamic = "force-dynamic";

type CalendarEvent = {
  id: string;
  date: string; // ISO
  type: "homework" | "assignment" | "fee";
  label: string;
  secondary?: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function EventCard({ event, isToday }: { event: CalendarEvent; isToday: boolean }) {
  const icon =
    event.type === "homework" ? (
      <BookOpenIcon className="size-4 text-amber-500" aria-hidden />
    ) : event.type === "assignment" ? (
      <ClipboardListIcon className="size-4 text-sky-500" aria-hidden />
    ) : (
      <IndianRupeeIcon className="size-4 text-emerald-600" aria-hidden />
    );

  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-100">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{event.label}</p>
        {event.secondary && (
          <p className="text-xs text-slate-500">{event.secondary}</p>
        )}
      </div>
      {isToday && (
        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
          Today
        </span>
      )}
    </div>
  );
}

export default async function ParentCalendarPage({
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
          title="Calendar"
          description="Upcoming homework, tests, and fee deadlines."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No child selected</EmptyTitle>
          <EmptyDescription>
            Select a child from the top of the page to view upcoming events.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const student = child.student;
  const today = new Date().toISOString().slice(0, 10);

  // Load data in parallel
  const [homework, assignments, fees] = await Promise.all([
    listHomeworkForStudent(student.id, "month"),
    listAssignmentsForStudent(student.id, student.class),
    listFeesForStudent(student.id),
  ]);

  // Build event list
  const events: CalendarEvent[] = [];

  // Homework due dates (next 30 days + today)
  for (const hw of homework) {
    if (hw.due_date >= today) {
      events.push({
        id: `hw-${hw.id}`,
        date: hw.due_date,
        type: "homework",
        label: hw.title,
        secondary: `Homework${hw.subject ? ` · ${hw.subject}` : ""}`,
      });
    }
  }

  // Assignment created dates (those set recently and pending)
  for (const a of assignments) {
    if (
      a.displayStatus === "set" ||
      a.displayStatus === "submitted" ||
      a.displayStatus === "overdue"
    ) {
      // Only include if created within last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const createdAt = a.createdAt.slice(0, 10);
      if (createdAt >= thirtyDaysAgo.toISOString().slice(0, 10)) {
        events.push({
          id: `asgn-${a.id}`,
          date: createdAt,
          type: "assignment",
          label: a.title,
          secondary: `Assignment${a.subject ? ` · ${a.subject}` : ""} · ${a.displayStatus}`,
        });
      }
    }
  }

  // Fee due dates
  for (const fee of fees) {
    if (fee.status !== "paid" && fee.due_date && fee.due_date >= today) {
      events.push({
        id: `fee-${fee.id}`,
        date: fee.due_date,
        type: "fee",
        label: `Fee due — ₹${Number(fee.amount).toLocaleString("en-IN")}`,
        secondary: fee.status === "overdue" ? "Overdue" : "Pending payment",
      });
    }
  }

  // Sort chronologically
  events.sort((a, b) => a.date.localeCompare(b.date));

  // Group by date
  const grouped = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (!grouped.has(e.date)) grouped.set(e.date, []);
    grouped.get(e.date)!.push(e);
  }

  const dates = Array.from(grouped.keys()).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description={`Upcoming events for ${student.name}.`}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-400" />
          Homework
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-500" />
          Assignment
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" />
          Fee due
        </span>
      </div>

      {dates.length === 0 ? (
        <Empty className="border border-slate-200 bg-white">
          <CalendarIcon className="mx-auto mb-3 size-8 text-slate-300" />
          <EmptyTitle>No upcoming events</EmptyTitle>
          <EmptyDescription>
            Homework due dates, assignment deadlines, and fee dates will appear
            here once your teacher records them.
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => {
            const dayEvents = grouped.get(date)!;
            const isToday = date === today;
            const isPast = date < today;
            return (
              <div key={date}>
                <p
                  className={`mb-2 text-xs font-semibold uppercase tracking-wider ${
                    isToday
                      ? "text-primary"
                      : isPast
                        ? "text-slate-300"
                        : "text-slate-500"
                  }`}
                >
                  {fmtDate(date)}
                  {isToday && " · Today"}
                </p>
                <Card className="divide-y divide-slate-100 rounded-2xl border-slate-200 bg-white">
                  {dayEvents.map((ev) => (
                    <div key={ev.id} className="p-4">
                      <EventCard event={ev} isToday={isToday} />
                    </div>
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
