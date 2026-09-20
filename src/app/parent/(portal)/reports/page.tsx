import { PrinterIcon, CheckCircle2Icon, AlertCircleIcon, TrendingUpIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { requireParentContext } from "@/lib/parent/auth";
import { getWeeklyReport, getMonthlyReport, getFormalReportCard } from "@/lib/parent/reports";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reports · TuitionTrack" };

export default async function ParentReportsPage({
  searchParams,
}: {
  searchParams?: { child?: string; tab?: string };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  const context = await requireParentContext(requested);
  const child = context.activeChild;

  if (!child) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Academic Reports"
          description="Evidence-based weekly and monthly summaries and official report cards."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No child selected</EmptyTitle>
          <EmptyDescription>
            Select a child from the switcher to view their generated academic reports.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const student = child.student;
  const activeTab = searchParams?.tab ?? "weekly"; // "weekly" | "monthly" | "card"

  const [weekly, monthly, reportCard] = await Promise.all([
    getWeeklyReport(student.id, student.name, student.class),
    getMonthlyReport(student.id, student.name, student.class),
    getFormalReportCard(student.id, student.name, student.class),
  ]);

  const childParam = requested ? `&child=${requested}` : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Academic Reports"
          description={`Evidence-based performance reports and official report cards for ${student.name}.`}
        />
        {/* Print / Save button for Report Card */}
        {activeTab === "card" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {}}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 print:hidden"
            >
              <PrinterIcon className="size-3.5" />
              Print / Save PDF
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 print:hidden">
        <Link
          href={`/parent/reports?tab=weekly${childParam}`}
          className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === "weekly"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Weekly Summary
        </Link>
        <Link
          href={`/parent/reports?tab=monthly${childParam}`}
          className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === "monthly"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Monthly Report
        </Link>
        <Link
          href={`/parent/reports?tab=card${childParam}`}
          className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === "card"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Formal Report Card
        </Link>
      </div>

      {/* ── TAB 1: WEEKLY SUMMARY ────────────────────────────────────────── */}
      {activeTab === "weekly" && (
        <div className="space-y-5">
          {/* Metadata Cutoff Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Generated: {weekly.generatedAt}</span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium">
              Data through: {weekly.dataCutoff}
            </span>
          </div>

          {/* Week at a Glance Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="rounded-2xl border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Attendance
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {weekly.attendancePercent !== null ? `${Math.round(weekly.attendancePercent)}%` : "—"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {weekly.attendancePresentDays} of {weekly.attendanceTotalDays} sessions
              </p>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Homework
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {weekly.homeworkRate !== null ? `${Math.round(weekly.homeworkRate)}%` : "—"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {weekly.homeworkCompleted}/{weekly.homeworkTotal} completed
              </p>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Tests Graded
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {weekly.testAveragePercent !== null ? `${weekly.testAveragePercent}%` : "—"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {weekly.testsTaken} test{weekly.testsTaken === 1 ? "" : "s"} evaluated
              </p>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Concept Mastery
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {weekly.conceptMasteryPercent !== null ? `${weekly.conceptMasteryPercent}%` : "—"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Demonstrated mastery</p>
            </Card>
          </div>

          {/* Improved vs Needs Practice */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2Icon className="size-4" />
                <h3 className="text-xs font-semibold uppercase tracking-wider">
                  Strengths & Improvement
                </h3>
              </div>
              {weekly.improvedConcepts.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  Continued consistent effort across ongoing topics.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {weekly.improvedConcepts.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <span className="mt-0.5 size-1.5 rounded-full bg-emerald-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircleIcon className="size-4" />
                <h3 className="text-xs font-semibold uppercase tracking-wider">
                  Needs Practice / Revision
                </h3>
              </div>
              {weekly.needsPractice.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  No critical gaps flagged in recent assessments.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {weekly.needsPractice.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <span className="mt-0.5 size-1.5 rounded-full bg-amber-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Teacher feedback & Recommended actions */}
          <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Recommended Actions for this Week
              </h3>
              <ul className="mt-2 space-y-1.5">
                {weekly.recommendedActions.map((action, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-700">
                    <span className="flex size-4 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                      {i + 1}
                    </span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>

            {weekly.teacherFeedback.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Teacher Notes
                </h3>
                <div className="mt-2 space-y-1.5">
                  {weekly.teacherFeedback.map((note, i) => (
                    <p key={i} className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 italic">
                      &ldquo;{note}&rdquo;
                    </p>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB 2: MONTHLY REPORT ────────────────────────────────────────── */}
      {activeTab === "monthly" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-900">
              {monthly.monthName} {monthly.year} Academic Summary
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium">
              Data through: {monthly.dataCutoff}
            </span>
          </div>

          {/* Subject Breakdown Table */}
          <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Subject-Wise Monthly Performance
            </h3>
            {monthly.subjects.length === 0 ? (
              <p className="text-xs text-slate-500">
                Subject evaluations will appear here once monthly assessments are logged.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="pb-2 font-semibold uppercase">Subject</th>
                      <th className="pb-2 font-semibold uppercase">Test Average</th>
                      <th className="pb-2 font-semibold uppercase">Homework Done</th>
                      <th className="pb-2 font-semibold uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthly.subjects.map((s) => (
                      <tr key={s.subject}>
                        <td className="py-2.5 font-medium text-slate-900">{s.subject}</td>
                        <td className="py-2.5 text-slate-700">
                          {s.testAverage !== null ? `${s.testAverage}%` : "—"}
                        </td>
                        <td className="py-2.5 text-slate-700">
                          {s.homeworkCompleted}/{s.homeworkTotal}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              s.status === "Excelling"
                                ? "bg-emerald-50 text-emerald-700"
                                : s.status === "Needs Attention"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Improvement trends & Teacher comments */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Improvement Trends
              </h3>
              <ul className="mt-3 space-y-1.5">
                {monthly.improvementTrends.length > 0 ? (
                  monthly.improvementTrends.map((trend, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <TrendingUpIcon className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      {trend}
                    </li>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">Steady academic progress observed.</p>
                )}
              </ul>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Focus Areas for Next Month
              </h3>
              <ul className="mt-3 space-y-1.5">
                {monthly.unresolvedWeakAreas.length > 0 ? (
                  monthly.unresolvedWeakAreas.map((area, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <AlertCircleIcon className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
                      {area}
                    </li>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">All evaluated topics meet target mastery.</p>
                )}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB 3: FORMAL REPORT CARD ────────────────────────────────────── */}
      {activeTab === "card" && (
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-300 bg-white p-6 sm:p-8 shadow-md print:shadow-none print:border-none">
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-4 text-center">
              <h2 className="text-xl font-bold tracking-tight text-slate-950 uppercase">
                TuitionTrack Academic Progress Report
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {reportCard.academicYear} · {reportCard.term} · Official Parent Portal Copy
              </p>
            </div>

            {/* Student Info Bar */}
            <div className="mt-4 grid grid-cols-2 gap-4 border-b border-slate-200 pb-4 text-xs sm:grid-cols-4">
              <div>
                <span className="text-slate-400 font-medium">Student:</span>
                <p className="font-bold text-slate-900">{reportCard.studentName}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Class:</span>
                <p className="font-bold text-slate-900">Class {reportCard.className}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Report ID:</span>
                <p className="font-mono text-slate-700">{reportCard.reportId}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Issue Date:</span>
                <p className="text-slate-700">{reportCard.generatedAt}</p>
              </div>
            </div>

            {/* Academic Subject Grades Table */}
            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2">
                Curriculum Assessment Summary
              </h4>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-y border-slate-300 bg-slate-50 font-bold text-slate-700">
                    <th className="py-2 px-3">Subject</th>
                    <th className="py-2 px-3 text-center">Score %</th>
                    <th className="py-2 px-3 text-center">Grade</th>
                    <th className="py-2 px-3">Teacher Assessment Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reportCard.subjectGrades.map((g) => (
                    <tr key={g.subject}>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{g.subject}</td>
                      <td className="py-2.5 px-3 text-center tabular-nums text-slate-800">
                        {g.percentage !== null ? `${g.percentage}%` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                        {g.grade}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{g.remarks}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-slate-50 font-bold">
                    <td className="py-2.5 px-3 text-slate-900">Overall Term Evaluation</td>
                    <td className="py-2.5 px-3 text-center tabular-nums text-slate-950 text-sm">
                      {reportCard.overallAveragePercent !== null
                        ? `${reportCard.overallAveragePercent}%`
                        : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-950 text-sm">
                      {reportCard.overallGrade}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 text-xs">
                      Attendance: {reportCard.attendanceRecord.present}/
                      {reportCard.attendanceRecord.totalMarked} sessions (
                      {reportCard.attendanceRecord.percentage !== null
                        ? `${Math.round(reportCard.attendanceRecord.percentage)}%`
                        : "—"}
                      )
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Strengths & Development */}
            <div className="mt-6 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 text-xs">
              <div>
                <h5 className="font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                  Demonstrated Strengths
                </h5>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  {reportCard.areasOfStrength.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                  Target Areas for Growth
                </h5>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  {reportCard.areasForDevelopment.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Teacher Remarks Box */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
              <span className="font-bold text-slate-900 uppercase tracking-wider">
                Overall Mentor Remarks:
              </span>
              <p className="mt-1 leading-relaxed text-slate-700 italic">
                &ldquo;{reportCard.teacherRemarks}&rdquo;
              </p>
            </div>

            {/* Verification Sign-off */}
            <div className="mt-8 pt-6 border-t border-dashed border-slate-300 flex justify-between items-end text-[10px] text-slate-400">
              <div>
                <p>Data Verification Cutoff: {reportCard.dataCutoff}</p>
                <p>TuitionTrack Digital Academic Signature</p>
              </div>
              <div className="text-right">
                <div className="h-8 border-b border-slate-400 w-32 mb-1" />
                <p>Tuition Mentor Authorization</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
