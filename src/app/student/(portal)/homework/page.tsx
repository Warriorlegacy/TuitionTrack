import Link from "next/link";
import {
  BookOpenCheckIcon,
  CheckCircle2Icon,
  ClockIcon,
  AlertCircleIcon,
  SparklesIcon,
  ArrowRightIcon,
} from "lucide-react";
import { requireStudentContext } from "@/lib/student/auth";
import { listStudentHomework } from "@/lib/student/homework";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Homework & Tasks · TuitionTrack Student Portal",
  robots: { index: false, follow: false },
};

export default async function StudentHomeworkPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const context = await requireStudentContext();
  const student = context.student!;

  const allHomework = await listStudentHomework(student.id, student.class);

  const pendingItems = allHomework.filter(
    (h) => h.status === "pending" || h.status === "overdue",
  );
  const completedItems = allHomework.filter(
    (h) => h.status === "completed" || h.status === "graded" || h.status === "submitted",
  );

  const currentTab = searchParams?.tab === "completed" ? "completed" : searchParams?.tab === "all" ? "all" : "todo";

  const displayedList =
    currentTab === "completed"
      ? completedItems
      : currentTab === "all"
        ? allHomework
        : pendingItems;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Homework & Tasks"
          description={`Assigned curriculum assignments, quizzes, and homework for Class ${student.class}.`}
        />

        <div className="flex items-center gap-2">
          <Link
            href="/app/tutor"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "gap-1.5 text-xs text-primary border-primary/20 bg-primary/5 hover:bg-primary/10",
            })}
          >
            <SparklesIcon className="size-3.5 text-amber-500" />
            <span>Homework Help (AI Tutor)</span>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-semibold">
        <Link
          href="/student/homework?tab=todo"
          className={`rounded-xl px-3.5 py-1.5 transition-colors ${
            currentTab === "todo"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          To Do ({pendingItems.length})
        </Link>
        <Link
          href="/student/homework?tab=completed"
          className={`rounded-xl px-3.5 py-1.5 transition-colors ${
            currentTab === "completed"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          Completed ({completedItems.length})
        </Link>
        <Link
          href="/student/homework?tab=all"
          className={`rounded-xl px-3.5 py-1.5 transition-colors ${
            currentTab === "all"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          All Assigned ({allHomework.length})
        </Link>
      </div>

      {/* Homework List */}
      <div className="space-y-3.5">
        {displayedList.length === 0 ? (
          <Card className="border-white/90 bg-white/85 p-10 text-center shadow-soft">
            <BookOpenCheckIcon className="mx-auto size-12 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              {currentTab === "todo"
                ? "All caught up on homework!"
                : currentTab === "completed"
                  ? "No completed homework yet"
                  : "No homework assigned yet"}
            </p>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              {currentTab === "todo"
                ? "Great job! You have completed all active homework tasks assigned by your teacher."
                : "When your tuition teacher assigns homework or exercises, they will appear here."}
            </p>
          </Card>
        ) : (
          displayedList.map((hw) => {
            const isAI = hw.source === "assignment";
            const isOverdue = hw.status === "overdue";
            const isGraded = hw.status === "graded";
            const isSubmitted = hw.status === "submitted";
            const isCompleted = hw.status === "completed" || isGraded;

            return (
              <Card
                key={hw.id}
                className="overflow-hidden border-white/90 bg-white/85 shadow-soft transition-all hover:border-slate-300 hover:shadow-md"
              >
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isAI && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
                          <SparklesIcon className="size-3 text-purple-500" />
                          Interactive Assignment
                        </span>
                      )}
                      {hw.subject && (
                        <Badge variant="outline" className="text-[10px] uppercase font-semibold text-slate-600">
                          {hw.subject}
                        </Badge>
                      )}
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {hw.title}
                      </span>
                    </div>

                    {hw.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {hw.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="size-3" />
                        {hw.dueDate
                          ? `Due: ${new Date(hw.dueDate).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}`
                          : "No deadline"}
                      </span>

                      {hw.totalMarks && (
                        <span>· {hw.totalMarks} Total Marks</span>
                      )}

                      {hw.teacherFeedback && (
                        <span className="text-emerald-700 font-medium">
                          · Feedback: &quot;{hw.teacherFeedback}&quot;
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    {/* Status Badge */}
                    <Badge
                      variant="outline"
                      className={
                        isGraded
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 gap-1 text-xs py-1 px-2.5 font-semibold"
                          : isSubmitted
                            ? "border-blue-200 bg-blue-50 text-blue-700 gap-1 text-xs py-1 px-2.5 font-semibold"
                            : isOverdue
                              ? "border-rose-200 bg-rose-50 text-rose-700 gap-1 text-xs py-1 px-2.5 font-semibold"
                              : isCompleted
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 gap-1 text-xs py-1 px-2.5 font-semibold"
                                : "border-amber-200 bg-amber-50 text-amber-700 gap-1 text-xs py-1 px-2.5 font-semibold"
                      }
                    >
                      {isGraded ? (
                        <>
                          <CheckCircle2Icon className="size-3.5" />
                          <span>
                            Graded: {hw.score}/{hw.totalMarks} ({hw.percentage}%)
                          </span>
                        </>
                      ) : isSubmitted ? (
                        <>
                          <ClockIcon className="size-3.5" />
                          <span>Submitted</span>
                        </>
                      ) : isOverdue ? (
                        <>
                          <AlertCircleIcon className="size-3.5" />
                          <span>Overdue</span>
                        </>
                      ) : isCompleted ? (
                        <>
                          <CheckCircle2Icon className="size-3.5" />
                          <span>Completed</span>
                        </>
                      ) : (
                        <>
                          <ClockIcon className="size-3.5" />
                          <span>Pending</span>
                        </>
                      )}
                    </Badge>

                    {/* Action Link for Interactive Homework */}
                    {hw.playerUrl && (
                      <Link
                        href={hw.playerUrl}
                        className={buttonVariants({
                          variant: isCompleted || isSubmitted ? "outline" : "default",
                          size: "sm",
                          className:
                            isCompleted || isSubmitted
                              ? "text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                              : "text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold",
                        })}
                      >
                        <span>
                          {isCompleted || isSubmitted
                            ? "View Solutions"
                            : "Start Homework"}
                        </span>
                        <ArrowRightIcon className="size-3.5" />
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
