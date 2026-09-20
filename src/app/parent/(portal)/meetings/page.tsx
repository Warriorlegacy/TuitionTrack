import { CalendarIcon, VideoIcon, ClockIcon, CheckCircle2Icon, UsersIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Parent-Teacher Meetings · TuitionTrack" };

export default async function ParentMeetingsPage({
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
          title="Parent-Teacher Meetings"
          description="Schedule and track academic conferences with your tuition mentor."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No child selected</EmptyTitle>
          <EmptyDescription>
            Select a child from the switcher to view or schedule PTM meetings.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const student = child.student;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Parent-Teacher Meetings"
          description={`Coordinate conferences and track agreed academic action plans for ${student.name}.`}
        />
      </div>

      {/* Upcoming PTM Card */}
      <Card className="rounded-2xl border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/40 p-6 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <VideoIcon className="size-5" />
            </div>
            <div>
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                Scheduled Meeting
              </span>
              <h3 className="mt-1 text-base font-semibold text-slate-950">
                Mid-Term Academic Review with Mentor
              </h3>
              <p className="mt-0.5 text-xs text-slate-600 flex items-center gap-1.5">
                <CalendarIcon className="size-3.5 text-slate-400" />
                Friday, 26 September 2026 · 05:00 PM – 05:30 PM (IST)
              </p>
            </div>
          </div>
          <div className="flex sm:flex-col items-end gap-2">
            <a
              href="https://meet.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <VideoIcon className="size-3.5" />
              Join Google Meet
            </a>
            <span className="text-[11px] text-slate-500">Duration: 30 minutes</span>
          </div>
        </div>

        {/* Meeting Discussion Points */}
        <div className="mt-5 rounded-xl border border-indigo-100 bg-white/80 p-4">
          <p className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
            Discussion Agenda:
          </p>
          <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-slate-600">
            <li>Review recent assessment scores in Mathematics and Science</li>
            <li>Reinforce step-by-step problem solving in linear word problems</li>
            <li>Formulate parent-child practice schedule for upcoming exams</li>
          </ul>
        </div>
      </Card>

      {/* Agreed Action Items from Recent Meetings */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Agreed Action Plan from Previous Conferences
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
              <UsersIcon className="size-4" />
              Teacher Action
            </div>
            <p className="mt-2 text-xs text-slate-700 leading-relaxed">
              Provide extra diagnostic practice worksheet on algebraic equations and review with {student.name} during Friday doubt clearance.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <CheckCircle2Icon className="size-3" />
              Worksheet Provided
            </span>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-wider">
              <UsersIcon className="size-4" />
              Parent Action
            </div>
            <p className="mt-2 text-xs text-slate-700 leading-relaxed">
              Ensure dedicated 25-minute evening study block without phone interruptions, checking off homework completion daily.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-sky-600 font-medium">
              <ClockIcon className="size-3" />
              In Progress
            </span>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs uppercase tracking-wider">
              <UsersIcon className="size-4" />
              Student Action
            </div>
            <p className="mt-2 text-xs text-slate-700 leading-relaxed">
              Attempt all homework questions independently before asking for hints, writing out complete intermediate steps.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-sky-600 font-medium">
              <ClockIcon className="size-3" />
              In Progress
            </span>
          </Card>
        </div>
      </section>

      {/* Book / Request a Slot */}
      <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
        <h3 className="text-sm font-semibold text-slate-900">Request New Conference Slot</h3>
        <p className="mt-1 text-xs text-slate-500">
          Tuition mentor availability for 1-on-1 consultations:
        </p>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {[
            { date: "Tue, 29 Sep", time: "05:30 PM", status: "Available" },
            { date: "Thu, 01 Oct", time: "06:00 PM", status: "Available" },
            { date: "Sat, 03 Oct", time: "11:30 AM", status: "Available" },
          ].map((slot, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs"
            >
              <div>
                <p className="font-semibold text-slate-900">{slot.date}</p>
                <p className="text-slate-500">{slot.time}</p>
              </div>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-slate-800"
              >
                Request
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
