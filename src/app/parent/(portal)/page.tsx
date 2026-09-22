import Link from "next/link";
import { ArrowRightIcon, ShieldCheckIcon, CheckCircle2Icon, AlertCircleIcon, ClockIcon, BookOpenIcon, BrainIcon, CalendarCheckIcon, FileCheckIcon, SparklesIcon, AwardIcon, TargetIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { getUserUniqueCodeAction } from "@/actions/workspace-actions";
import { ChildLinkingHub } from "@/components/parent/child-linking-hub";
import { ParentFeaturesLaunchpad } from "@/components/parent/parent-features-launchpad";
import { getProgressOverview } from "@/lib/parent/progress";
import { getTodayHomework, getHomeworkCompletionRate } from "@/lib/parent/homework";
import { getAttendanceSummary } from "@/lib/parent/attendance";
import { listFeesForStudent } from "@/lib/parent/payments";
import { listTestResultsForStudent } from "@/lib/parent/tests";
import { getDailyDigest, getTodayTimeline, getParentInsights } from "@/lib/parent/insights";
import { AskAiSection } from "@/components/parent/ask-ai-modal";

export const dynamic = "force-dynamic";

function fmt(pct: number | null): string {
  if (pct === null) return "—";
  return `${Math.round(pct)}%`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function StatusChip({
  label,
  variant = "neutral",
}: {
  label: string;
  variant?: "green" | "amber" | "red" | "neutral" | "blue";
}) {
  const cls = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-sky-50 text-sky-700 border-sky-200",
    neutral: "bg-slate-50 text-slate-700 border-slate-200",
  }[variant];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

function ProgressBar({ value, max = 100, color = "slate" }: { value: number; max?: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const colorCls =
    color === "emerald"
      ? "bg-emerald-500"
      : color === "sky"
        ? "bg-sky-500"
        : color === "violet"
          ? "bg-violet-500"
          : color === "amber"
            ? "bg-amber-500"
            : "bg-slate-400";

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
      <div className={`h-full rounded-full ${colorCls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function ParentHomePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  const [context, parentCodeResult] = await Promise.all([
    requireParentContext(requested),
    getUserUniqueCodeAction(),
  ]);

  if (context.children.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Parent Portal"
          description="Welcome! Connect with your child's classroom and track their tuition journey."
        />
        <ChildLinkingHub
          parentCode={parentCodeResult.code || ""}
          parentName={context.profile?.name}
        />
        <PrivacyNote />
      </div>
    );
  }

  const child = context.activeChild!;
  const student = child.student;

  // Greet with time-of-day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Load all data in parallel — gracefully resilient
  const [overview, todayHw, weekRate, attendanceSummary, fees, recentTests, digestRes, timelineRes, insightsRes] =
    await Promise.allSettled([
      getProgressOverview(student.id, student.class),
      getTodayHomework(student.id),
      getHomeworkCompletionRate(student.id, "week"),
      getAttendanceSummary(student.id),
      listFeesForStudent(student.id),
      listTestResultsForStudent(student.id, 5),
      getDailyDigest(student.id, student.class),
      getTodayTimeline(student.id),
      getParentInsights(student.id, student.class),
    ]);

  const prog = overview.status === "fulfilled" ? overview.value : null;
  const hwToday = todayHw.status === "fulfilled" ? todayHw.value : [];
  const hwRate = weekRate.status === "fulfilled" ? weekRate.value : null;
  const att = attendanceSummary.status === "fulfilled" ? attendanceSummary.value : null;
  const feeList = fees.status === "fulfilled" ? fees.value : [];
  const tests = recentTests.status === "fulfilled" ? recentTests.value : [];
  const digest = digestRes.status === "fulfilled" ? digestRes.value : null;
  const timeline = timelineRes.status === "fulfilled" ? timelineRes.value : [];
  const insights = insightsRes.status === "fulfilled" ? insightsRes.value : null;

  // Attention items (Section 83)
  const attentionItems: { icon: "warn" | "ok" | "info"; label: string; href?: string }[] = [];
  const pendingFees = feeList.filter((f) => f.status !== "paid");
  const overdueFees = feeList.filter((f) => f.status === "overdue");

  if (overdueFees.length > 0) {
    attentionItems.push({ icon: "warn", label: `${overdueFees.length} fee${overdueFees.length > 1 ? "s" : ""} overdue`, href: "/parent/fees" });
  } else if (pendingFees.length > 0) {
    attentionItems.push({ icon: "info", label: `${pendingFees.length} fee${pendingFees.length > 1 ? "s" : ""} pending`, href: "/parent/fees" });
  } else if (feeList.length > 0) {
    attentionItems.push({ icon: "ok", label: "Fees up to date" });
  }

  const overdueHw = hwToday.filter((h) => h.isOverdue);
  const dueHw = hwToday.filter((h) => h.isDueToday && h.status === "pending");
  if (overdueHw.length > 0) {
    attentionItems.push({ icon: "warn", label: `${overdueHw.length} homework overdue`, href: "/parent/homework" });
  } else if (dueHw.length > 0) {
    attentionItems.push({ icon: "info", label: `${dueHw.length} homework due today`, href: "/parent/homework" });
  }

  if (att?.todayStatus === false) {
    attentionItems.push({ icon: "warn", label: "Absent today", href: "/parent/attendance" });
  } else if (att?.todayStatus === true) {
    attentionItems.push({ icon: "ok", label: "Present today" });
  }

  const parentName = context.profile?.name ?? context.user?.email?.split("@")[0] ?? "Parent";

  return (
    <div className="space-y-6">
      {/* ── Greeting ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-950">
            {greeting}, {parentName.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Academic command center for{" "}
            <span className="font-semibold text-slate-900">{student.name}</span> · Class{" "}
            {student.class}
          </p>
        </div>
        <Link
          href="/parent/ask"
          className="inline-flex items-center gap-1.5 self-start rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <SparklesIcon className="size-3.5" />
          Ask About My Child
        </Link>
      </div>

      {/* ── Direct Child Linking Hub ────────────────────────────────── */}
      <ChildLinkingHub
        parentCode={parentCodeResult.code || ""}
        parentName={parentName}
        compact={true}
      />

      {/* ── Today's Quick Status Strip ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Attendance today */}
        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Today
          </p>
          {att?.todayStatus === null ? (
            <p className="mt-2 text-sm text-slate-500">Not recorded</p>
          ) : (
            <StatusChip
              label={att!.todayStatus ? "Present" : "Absent"}
              variant={att!.todayStatus ? "green" : "red"}
            />
          )}
          <p className="mt-1 text-xs text-slate-400">Attendance</p>
        </Card>

        {/* Homework today */}
        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Homework
          </p>
          {hwToday.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">None due</p>
          ) : (
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
              {hwToday.filter((h) => h.status === "completed").length}
              <span className="text-sm font-normal text-slate-400">/{hwToday.length}</span>
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">Done today</p>
        </Card>

        {/* This week homework rate */}
        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            This week
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
            {hwRate?.total === 0 ? "—" : fmt(hwRate?.rate ?? null)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Homework rate</p>
        </Card>

        {/* Latest test */}
        <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Last test
          </p>
          {tests.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No results yet</p>
          ) : (
            <>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
                {fmt(tests[0].percentage)}
              </p>
              <p className="mt-1 truncate text-xs text-slate-400">{tests[0].subject ?? tests[0].title}</p>
            </>
          )}
        </Card>
      </div>

      {/* ── All Portal Features Launchpad (1-Click Access for Parents) ─────── */}
      <ParentFeaturesLaunchpad
        overdueHwCount={overdueHw.length}
        pendingFeesCount={pendingFees.length}
      />

      {/* ── SECTION 7: AI DAILY PARENT DIGEST ──────────────────────────────── */}
      {digest && (
        <Card className="rounded-2xl border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/20 p-5 shadow-soft">
          <div className="flex items-center justify-between border-b border-indigo-100/60 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <SparklesIcon className="size-3.5" />
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                  AI Daily Parent Digest
                </h2>
                <p className="text-[11px] text-slate-500">{digest.date}</p>
              </div>
            </div>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-100">
              Verified Facts
            </span>
          </div>

          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
                Attendance & Work
              </span>
              <p className="mt-0.5 font-medium text-slate-900">
                {digest.attendanceStatus} · {digest.homeworkCompleted}/{digest.homeworkTotal} HW Done
              </p>
            </div>
            <div>
              <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
                Assignments & Tests
              </span>
              <p className="mt-0.5 font-medium text-slate-900">
                {digest.assignmentsSubmitted} submitted · {digest.testsToday.length > 0 ? digest.testsToday.join(", ") : "No test today"}
              </p>
            </div>
            <div>
              <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
                Accuracy Level
              </span>
              <p className="mt-0.5 font-medium text-slate-900">
                {digest.recentAccuracy !== null
                  ? `${digest.recentAccuracy}% avg across assessments`
                  : "No assessments recorded yet"}
              </p>
            </div>
          </div>

          {digest.suggestedAction && (
            <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-white p-3 border border-indigo-100 text-xs">
              <TargetIcon className="size-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-slate-900">Suggested Action for Today: </span>
                <span className="text-slate-600">{digest.suggestedAction}</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── SECTION 29: WHAT SHOULD WE DO THIS WEEK? ───────────────────────── */}
      {insights && insights.actionPlan.length > 0 && (
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TargetIcon className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-slate-900">
                What Should We Do This Week?
              </h2>
            </div>
            <span className="text-xs text-slate-500">Action Plan</span>
          </div>
          <div className="mt-3 space-y-2.5">
            {insights.actionPlan.map((item) => (
              <div
                key={item.step}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                    {item.step}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{item.title}</span>
                      {item.badge && (
                        <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[9px] font-medium text-slate-700">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-slate-500">{item.description}</p>
                  </div>
                </div>
                {item.href && (
                  <Link
                    href={item.href}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Open
                  </Link>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── SECTION 8: TODAY'S TIMELINE ────────────────────────────────────── */}
      {timeline.length > 0 && (
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClockIcon className="size-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Today&apos;s Timeline</h2>
            </div>
            <span className="text-xs text-slate-400">Recorded activity</span>
          </div>

          <div className="mt-4 relative border-l-2 border-slate-100 ml-3 pl-4 space-y-4">
            {timeline.map((ev) => (
              <div key={ev.id} className="relative group">
                <span className="absolute -left-[23px] top-1 size-2.5 rounded-full bg-primary ring-4 ring-white" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 font-mono">
                    {ev.time ?? "Today"}
                  </span>
                  {ev.badge && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {ev.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-900 mt-0.5">{ev.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{ev.description}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── SECTION 83: NEEDS ATTENTION ───────────────────────────────────── */}
      {attentionItems.length > 0 && (
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
          <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
          <ul className="mt-3 space-y-2">
            {attentionItems.map((item, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm">
                {item.icon === "warn" && (
                  <AlertCircleIcon className="size-4 shrink-0 text-amber-500" aria-hidden />
                )}
                {item.icon === "ok" && (
                  <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" aria-hidden />
                )}
                {item.icon === "info" && (
                  <ClockIcon className="size-4 shrink-0 text-sky-500" aria-hidden />
                )}
                {item.href ? (
                  <Link href={item.href} className="text-slate-700 hover:text-slate-950 hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-slate-700">{item.label}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── SECTION 27, 84: POSITIVE PROGRESS & ACHIEVEMENTS ──────────────── */}
      {insights && insights.achievements.length > 0 && (
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 text-emerald-600">
            <AwardIcon className="size-4" />
            <h2 className="text-sm font-semibold text-slate-900">Recent Achievements</h2>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {insights.achievements.map((ach) => (
              <div
                key={ach.id}
                className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-xs"
              >
                <p className="font-semibold text-emerald-950">{ach.title}</p>
                <p className="mt-0.5 text-[11px] text-emerald-700">{ach.evidence.join(" · ")}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── SECTION 11: ACADEMIC SNAPSHOT ─────────────────────────────────── */}
      {prog && (
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
          <h2 className="text-sm font-semibold text-slate-900">Academic snapshot</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Coverage and mastery are different things — both shown separately.
          </p>

          <div className="mt-4 space-y-3">
            {/* Curriculum covered */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <BookOpenIcon className="size-3.5" aria-hidden />
                  Curriculum covered
                </span>
                <span className="font-semibold text-slate-900">
                  {prog.curriculumCoverage.percentOfPlan !== null
                    ? `${prog.curriculumCoverage.percentOfPlan}%`
                    : `${prog.curriculumCoverage.chaptersCovered} chapters`}
                </span>
              </div>
              <ProgressBar
                value={prog.curriculumCoverage.percentOfPlan ?? prog.curriculumCoverage.chaptersCovered}
                max={prog.curriculumCoverage.percentOfPlan !== null ? 100 : Math.max(prog.curriculumCoverage.chaptersCovered, 1) * 1.4}
                color="sky"
              />
            </div>

            {/* Concept mastery */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <BrainIcon className="size-3.5" aria-hidden />
                  Concept mastery
                </span>
                <span className="font-semibold text-slate-900">
                  {fmt(prog.conceptMastery.averageMastery !== null ? prog.conceptMastery.averageMastery * 100 : null)}
                </span>
              </div>
              <ProgressBar
                value={prog.conceptMastery.averageMastery !== null ? prog.conceptMastery.averageMastery * 100 : 0}
                max={100}
                color="violet"
              />
            </div>

            {/* Assessment avg */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <FileCheckIcon className="size-3.5" aria-hidden />
                  Assessment average
                </span>
                <span className="font-semibold text-slate-900">
                  {fmt(prog.assessments.averagePercentage)}
                </span>
              </div>
              <ProgressBar
                value={prog.assessments.averagePercentage ?? 0}
                max={100}
                color="emerald"
              />
            </div>

            {/* Attendance */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <CalendarCheckIcon className="size-3.5" aria-hidden />
                  Attendance
                </span>
                <span className="font-semibold text-slate-900">
                  {fmt(att?.percentPresent ?? prog.attendance.percentPresent)}
                </span>
              </div>
              <ProgressBar
                value={att?.percentPresent ?? prog.attendance.percentPresent ?? 0}
                max={100}
                color="emerald"
              />
            </div>
          </div>

          <Link
            href="/parent/progress"
            className="mt-4 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            Full progress breakdown <ArrowRightIcon className="size-3" />
          </Link>
        </Card>
      )}

      {/* ── Interactive Ask AI Section on Home ────────────────────────────── */}
      <AskAiSection
        childId={student.id}
        studentName={student.name}
      />

      {/* ── Today's Homework & Recent Tests ───────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Today's Homework */}
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Today&apos;s homework</h2>
            <Link href="/parent/homework" className="text-xs text-slate-500 hover:text-slate-900">
              All →
            </Link>
          </div>
          {hwToday.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">No homework due today.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {hwToday.map((hw) => (
                <li
                  key={hw.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                >
                  {hw.status === "completed" ? (
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                  ) : hw.isOverdue ? (
                    <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                  ) : (
                    <ClockIcon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-800">{hw.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {hw.status === "completed"
                        ? "Completed"
                        : hw.isOverdue
                          ? "Overdue"
                          : "Due today"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent Tests */}
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent test results</h2>
            <Link href="/parent/tests" className="text-xs text-slate-500 hover:text-slate-900">
              See all →
            </Link>
          </div>
          {tests.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">No graded tests yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {tests.slice(0, 3).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-800">{t.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {t.subject ?? "Assessment"} · {t.gradedAt ? fmtDate(t.gradedAt) : ""}
                    </p>
                  </div>
                  <span className="ml-4 shrink-0 text-xs font-semibold tabular-nums text-slate-950">
                    {fmt(t.percentage)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <PrivacyNote />
    </div>
  );
}

function PrivacyNote() {
  return (
    <Card className="flex items-start gap-3 rounded-2xl border-slate-200 bg-slate-50 p-4">
      <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
      <p className="text-xs leading-relaxed text-slate-600">
        You can only ever see{" "}
        <strong className="font-semibold text-slate-800">your own children&apos;s</strong>{" "}
        records. Every request is authorised on the server against your verified link, and every
        access to your child&apos;s data is logged. If you believe you can see another
        child&apos;s information, please report it immediately from Support.
      </p>
    </Card>
  );
}
