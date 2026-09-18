"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { AiAssignmentSummary } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  SparklesIcon,
  CalendarIcon,
  AwardIcon,
  CheckCircle2Icon,
  ClockIcon,
  ChevronRightIcon,
  UsersIcon,
} from "lucide-react";

export function AiAssignmentsList({
  assignments,
  canManage,
}: {
  assignments: AiAssignmentSummary[];
  canManage: boolean;
}) {
  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center bg-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
          <SparklesIcon className="h-6 w-6" />
        </div>
        <h3 className="font-semibold text-foreground">No AI Homework Assigned Yet</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          {canManage
            ? "Create your first AI-generated assignment with personalized, unique question variants for each student in the Homework Studio."
            : "No active homework assignments have been assigned by your teacher yet. Check back soon!"}
        </p>
        {canManage && (
          <Link
            href="/app/homework/studio"
            className={buttonVariants({ size: "sm", className: "mt-4 gap-1.5 shadow-sm" })}
          >
            <SparklesIcon className="h-4 w-4" />
            Open AI Homework Studio
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {assignments.map((item) => {
        const isPastDue = new Date(item.due_date) < new Date();
        const studentSub = item.student_submission;

        return (
          <Card
            key={item.id}
            className="flex flex-col justify-between border transition hover:border-primary/40 hover:shadow-md"
          >
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[11px]">
                      Class {item.class_level} {item.subject}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {item.preset}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-base text-foreground line-clamp-1 pt-1">
                    {item.title}
                  </h4>
                </div>

                {item.ai_grading_enabled && (
                  <Badge variant="outline" className="border-primary/30 text-primary text-[10px] shrink-0 gap-1">
                    <SparklesIcon className="h-3 w-3" />
                    AI Graded
                  </Badge>
                )}
              </div>

              {/* Assignment Meta */}
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-y py-2.5">
                <div className="flex items-center gap-1.5">
                  <AwardIcon className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Total: <strong className="text-foreground">{item.total_marks} Marks</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="h-3.5 w-3.5 text-primary" />
                  <span className={isPastDue ? "text-rose-600 font-medium" : ""}>
                    Due: {format(new Date(item.due_date), "MMM d, h:mm a")}
                  </span>
                </div>
              </div>

              {/* Status / Submissions info */}
              <div className="text-xs">
                {canManage ? (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <UsersIcon className="h-3.5 w-3.5 text-primary" />
                      Mode: <span className="capitalize font-medium text-foreground">{item.mode}</span>
                    </span>
                    <span className="font-semibold text-primary">
                      {item.submissions_count ?? 0} Submissions
                    </span>
                  </div>
                ) : (
                  <div>
                    {studentSub ? (
                      <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">
                        <span className="flex items-center gap-1 font-medium">
                          <CheckCircle2Icon className="h-4 w-4" />
                          {studentSub.status === "graded" ? "Graded" : "Submitted"}
                        </span>
                        <span className="font-bold">
                          {studentSub.score} / {studentSub.total_marks} ({Math.round(studentSub.percentage)}%)
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          Pending Attempt
                        </span>
                        <span className={isPastDue ? "font-semibold text-rose-600" : "font-semibold text-amber-600"}>
                          {isPastDue ? "Past Due" : "Action Required"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Link */}
              <div className="border-t pt-3 flex items-center justify-between">
                <Link
                  href={`/app/homework/${item.id}`}
                  className={buttonVariants({ size: "sm", className: "w-full gap-1" })}
                >
                  {canManage
                    ? "Preview & Question Bank"
                    : studentSub
                    ? "Review Feedback & Solutions"
                    : "Start Assignment"}
                  <ChevronRightIcon className="h-3.5 w-3.5 ml-auto" />
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
