"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import type { AiAssignmentSummary } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SparklesIcon,
  CalendarIcon,
  AwardIcon,
  CheckCircle2Icon,
  ClockIcon,
  ChevronRightIcon,
  UsersIcon,
  Trash2Icon,
  AlertTriangleIcon,
  Loader2Icon,
} from "lucide-react";
import { deleteAssignmentAction } from "@/actions/workspace-actions";

export function AiAssignmentsList({
  assignments,
  canManage,
}: {
  assignments: AiAssignmentSummary[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [deletingAssignment, setDeletingAssignment] = useState<AiAssignmentSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDeleteAssignment = () => {
    if (!deletingAssignment) return;
    startTransition(async () => {
      const result = await deleteAssignmentAction(deletingAssignment.id);
      if (result.success) {
        toast.success(result.message);
        setDeletingAssignment(null);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete assignment.");
      }
    });
  };
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
    // ponytail: 3 cols only at xl — at lg the 320px sidebar leaves cards too
    // narrow and long content forces the grid wider than the viewport.
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {assignments.map((item) => {
        const isPastDue = new Date(item.due_date) < new Date();
        const studentSub = item.student_submission;

        return (
          <Card
            key={item.id}
            className="flex min-w-0 flex-col justify-between border transition hover:border-primary/40 hover:shadow-md"
          >
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="max-w-full truncate text-[11px]">
                      Class {item.class_level} {item.subject}
                    </Badge>
                    <Badge variant="outline" className="max-w-full truncate text-[10px] capitalize">
                      {item.preset}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-base text-foreground line-clamp-2 break-words pt-1">
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
                <div className="flex min-w-0 items-center gap-1.5">
                  <AwardIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">
                    Total: <strong className="text-foreground">{item.total_marks} Marks</strong>
                  </span>
                </div>
                <div className="flex min-w-0 items-center gap-1.5">
                  <ClockIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className={`truncate ${isPastDue ? "text-rose-600 font-medium" : ""}`}>
                    Due: {format(new Date(item.due_date), "MMM d, h:mm a")}
                  </span>
                </div>
              </div>

              {/* Status / Submissions info */}
              <div className="text-xs">
                {canManage ? (
                  <div className="flex flex-wrap items-center justify-between gap-1 text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1">
                      <UsersIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">Mode: <span className="capitalize font-medium text-foreground">{item.mode}</span></span>
                    </span>
                    <span className="shrink-0 font-semibold text-primary">
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

              {/* Action Links */}
              <div className="border-t pt-3 flex items-center gap-2">
                <Link
                  href={canManage ? `/app/homework/${item.id}` : `/student/homework/${item.id}`}
                  className={buttonVariants({ size: "sm", className: "min-w-0 flex-1 gap-1" })}
                >
                  <span className="truncate">
                    {canManage
                      ? "View & Question Bank"
                      : studentSub
                      ? "Review Feedback & Solutions"
                      : "Start Assignment"}
                  </span>
                  <ChevronRightIcon className="h-3.5 w-3.5 ml-auto shrink-0" />
                </Link>

                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingAssignment(item)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive border-slate-200 px-2.5"
                    title="Delete Homework"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deletingAssignment)} onOpenChange={(open) => !open && setDeletingAssignment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangleIcon className="size-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold">
              Delete Homework Assignment?
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-600">
              Are you sure you want to delete{" "}
              <strong className="text-slate-900">&ldquo;{deletingAssignment?.title}&rdquo;</strong>?
              <br />
              <br />
              This will remove the homework assignment from student access. Only authorized teachers can perform this action.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setDeletingAssignment(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAssignment}
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2Icon className="size-4" />}
              {isPending ? "Deleting…" : "Delete Homework"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
