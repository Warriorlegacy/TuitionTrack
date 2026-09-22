import Link from "next/link";
import { requireStudentContext } from "@/lib/student/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BookOpenIcon, ArrowRightIcon } from "lucide-react";
import { listAssignmentsForStudent } from "@/lib/parent/assignments";

export const dynamic = "force-dynamic";

export default async function StudentAssignmentsPage() {
  const context = await requireStudentContext();
  const student = context.student!;

  const assignments = await listAssignmentsForStudent(student.id, student.class);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments & Worksheets"
        description={`Class assignments, worksheets, and study material for Class ${student.class}.`}
      />

      <div className="space-y-3">
        {assignments.length === 0 ? (
          <Card className="border-white/90 bg-white/85 shadow-soft p-8 text-center">
            <BookOpenIcon className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No assignments posted yet</p>
            <p className="mt-1 text-xs text-slate-400">
              When your teacher shares worksheets or assignments, you will see them here.
            </p>
          </Card>
        ) : (
          assignments.map((item) => {
            const isDone = item.displayStatus === "graded" || item.displayStatus === "submitted";

            return (
              <Card key={item.id} className="border-white/90 bg-white/85 shadow-soft transition-all hover:border-slate-300">
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-slate-900">{item.title}</h3>
                        {item.subject && (
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {item.subject}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Posted: {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Badge
                        variant="outline"
                        className={
                          item.displayStatus === "graded"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] uppercase font-semibold"
                            : item.displayStatus === "submitted"
                              ? "border-blue-200 bg-blue-50 text-blue-700 text-[10px] uppercase font-semibold"
                              : item.displayStatus === "overdue"
                                ? "border-rose-200 bg-rose-50 text-rose-700 text-[10px] uppercase font-semibold"
                                : "border-amber-200 bg-amber-50 text-amber-700 text-[10px] uppercase font-semibold"
                        }
                      >
                        {item.displayStatus}
                      </Badge>

                      <Link
                        href={`/student/homework/${item.id}`}
                        className={buttonVariants({
                          variant: isDone ? "outline" : "default",
                          size: "sm",
                          className: isDone
                            ? "h-7 text-xs text-slate-700"
                            : "h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold",
                        })}
                      >
                        <span>{isDone ? "Review" : "Open"}</span>
                        <ArrowRightIcon className="ml-1 size-3" />
                      </Link>
                    </div>
                  </div>

                  {item.submission?.teacherFeedback && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      Teacher Feedback: {item.submission.teacherFeedback}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
