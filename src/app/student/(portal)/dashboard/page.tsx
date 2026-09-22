import Link from "next/link";
import {
  BookOpenCheckIcon,
  FilePenLineIcon,
  PlayIcon,
  SparklesIcon,
  ArrowRightIcon,
  FlameIcon,
} from "lucide-react";
import { requireStudentContext } from "@/lib/student/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listStudentHomework } from "@/lib/student/homework";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StudentCodeLinkingCard } from "@/components/student/student-code-linking-card";
import { StudentFeaturesLaunchpad } from "@/components/student/student-features-launchpad";
import { getUserUniqueCodeAction, getStudentLinkedParentsAction } from "@/actions/workspace-actions";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const [context, studentCodeResult, linkedParentsResult] = await Promise.all([
    requireStudentContext(),
    getUserUniqueCodeAction(),
    getStudentLinkedParentsAction(),
  ]);
  const student = context.student!;

  const supabase = createSupabaseServerClient();

  // 1. Fetch assigned homework (AI assignments + quick logs)
  const homeworkList = await listStudentHomework(student.id, student.class);

  // 2. Fetch recent tests
  const { data: testList } = await supabase
    .from("tests")
    .select("id, subject, marks, total, date")
    .eq("student_id", student.id)
    .order("date", { ascending: false })
    .limit(4);

  // 3. Announcements
  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, message, created_at")
    .order("created_at", { ascending: false })
    .limit(3);

  const pendingHomework = homeworkList.filter(
    (h) => h.status === "pending" || h.status === "overdue",
  );
  const completedHomework = homeworkList.filter(
    (h) => h.status === "completed" || h.status === "graded" || h.status === "submitted",
  );

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white shadow-soft">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-emerald-100 backdrop-blur-sm">
              <FlameIcon className="size-3.5 text-amber-300" />
              Class {student.class} Academic Journey
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Welcome back, {student.name}!
            </h1>
            <p className="max-w-xl text-xs text-emerald-100/90 leading-relaxed">
              Track your daily tuition homework, revise chapters with 3D animated lessons, and share your unique code with parents or teachers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/student/lessons"
              className={buttonVariants({
                className: "bg-white text-emerald-800 hover:bg-emerald-50 font-semibold text-xs shadow-xs",
              })}
            >
              <PlayIcon className="mr-1.5 size-3.5 fill-current" />
              3D Lessons
            </Link>
            <Link
              href="/student/homework"
              className={buttonVariants({
                variant: "outline",
                className: "border-white/30 bg-white/10 text-white hover:bg-white/20 text-xs backdrop-blur-sm",
              })}
            >
              <BookOpenCheckIcon className="mr-1.5 size-3.5 text-amber-300" />
              My Homework ({pendingHomework.length})
            </Link>
          </div>
        </div>
      </div>

      {/* Student Unique Code & Parent Linking Card */}
      <StudentCodeLinkingCard
        studentCode={studentCodeResult.code || student.link_code || ""}
        studentName={student.name}
        linkedParents={linkedParentsResult.parents}
      />

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Pending Homework</CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {pendingHomework.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            {pendingHomework.length === 0 ? "All caught up!" : "Needs completion"}
          </CardContent>
        </Card>

        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Completed Homework</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">
              {completedHomework.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Tasks verified & done</CardContent>
        </Card>

        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Tests Recorded</CardDescription>
            <CardTitle className="text-2xl font-bold text-sky-600">
              {(testList ?? []).length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Subject assessments</CardContent>
        </Card>

        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">3D Curriculum</CardDescription>
            <CardTitle className="text-2xl font-bold text-purple-600">Class {student.class}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            CBSE / State board syllabus
          </CardContent>
        </Card>
      </div>

      {/* Complete Student Learning Hub (1-Click Access to All Features) */}
      <StudentFeaturesLaunchpad
        pendingHomeworkCount={pendingHomework.length}
        testCount={(testList ?? []).length}
      />

      {/* Two Column Layout: Homework + Tests */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Homework Section */}
        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <BookOpenCheckIcon className="size-4" />
              </div>
              <CardTitle className="text-base font-semibold">Homework & Tasks</CardTitle>
            </div>
            <Link
              href="/student/homework"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "h-7 text-xs text-primary",
              })}
            >
              View All
              <ArrowRightIcon className="ml-1 size-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {!homeworkList || homeworkList.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                No homework assigned right now. Enjoy your free time!
              </p>
            ) : (
              homeworkList.slice(0, 5).map((hw) => {
                const isCompleted = hw.status === "completed" || hw.status === "graded";
                const isSubmitted = hw.status === "submitted";
                const isOverdue = hw.status === "overdue";

                return (
                  <div
                    key={hw.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate">
                        {hw.source === "assignment" && (
                          <SparklesIcon className="size-3 text-purple-600 shrink-0" />
                        )}
                        <p className="font-semibold text-slate-900 truncate">{hw.title}</p>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {hw.dueDate
                          ? `Due ${new Date(hw.dueDate).toLocaleDateString()}`
                          : "No deadline"}
                        {hw.totalMarks ? ` · ${hw.totalMarks} marks` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={
                          isCompleted
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]"
                            : isSubmitted
                              ? "border-blue-200 bg-blue-50 text-blue-700 text-[10px]"
                              : isOverdue
                                ? "border-rose-200 bg-rose-50 text-rose-700 text-[10px]"
                                : "border-amber-200 bg-amber-50 text-amber-700 text-[10px]"
                        }
                      >
                        {isCompleted
                          ? hw.percentage !== null && hw.percentage !== undefined
                            ? `${hw.percentage}%`
                            : "Done"
                          : isSubmitted
                            ? "Submitted"
                            : isOverdue
                              ? "Overdue"
                              : "Pending"}
                      </Badge>

                      {hw.playerUrl && (
                        <Link
                          href={hw.playerUrl}
                          className={buttonVariants({
                            variant: isCompleted || isSubmitted ? "ghost" : "default",
                            size: "sm",
                            className: isCompleted || isSubmitted
                              ? "h-6 px-2 text-[10px] text-slate-600"
                              : "h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium",
                          })}
                        >
                          {isCompleted || isSubmitted ? "View" : "Start"}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Tests & Assessments Section */}
        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <FilePenLineIcon className="size-4" />
              </div>
              <CardTitle className="text-base font-semibold">Tests & Quizzes</CardTitle>
            </div>
            <Link
              href="/student/tests"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "h-7 text-xs text-primary",
              })}
            >
              View Tests
              <ArrowRightIcon className="ml-1 size-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {!testList || testList.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                No upcoming tests scheduled at the moment.
              </p>
            ) : (
              testList.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-900">{t.subject} Test</p>
                    <p className="text-[11px] text-slate-500">
                      Score: {t.marks} / {t.total}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {t.date ? new Date(t.date).toLocaleDateString() : "Scheduled"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      {announcements && announcements.length > 0 && (
        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-900">
              Class Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{a.title}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">{a.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
