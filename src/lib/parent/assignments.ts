import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Parent-facing assignment queries.
 *
 * An "assignment" in TuitionTrack is a published record in `assignments` with
 * targeting (`target_student_ids`). A parent sees the assignment once it is
 * published and may see the submission status + score once graded.
 *
 * Parents CANNOT edit or see draft submissions. They see the final result only
 * after the teacher has graded it (§19).
 */

export type AssignmentForParent = {
  id: string;
  title: string;
  subject: string | null;
  chapterSlug: string | null;
  lifecycle: string;
  createdAt: string;
  dueAt: string | null;
  /** Null when no submission exists yet */
  submission: AssignmentSubmission | null;
  /** Derived status for display */
  displayStatus: AssignmentDisplayStatus;
};

export type AssignmentSubmission = {
  id: string;
  status: string;
  score: number | null;
  totalMarks: number | null;
  percentage: number | null;
  submittedAt: string | null;
  gradedAt: string | null;
  teacherFeedback: string | null;
};

export type AssignmentDisplayStatus =
  | "set"
  | "submitted"
  | "graded"
  | "overdue"
  | "returned"
  | "missing";

const PUBLISHED_LIFECYCLES = [
  "published",
  "started",
  "in_progress",
  "submitted",
  "ai_evaluated",
  "teacher_reviewed",
  "graded",
  "returned",
];

function deriveDisplayStatus(
  lifecycle: string,
  submission: AssignmentSubmission | null,
  dueAt: string | null,
): AssignmentDisplayStatus {
  if (!submission) {
    const now = new Date().toISOString();
    if (dueAt && dueAt < now) return "overdue";
    return "set";
  }
  const s = submission.status;
  if (s === "returned") return "returned";
  if (s === "graded" || s === "teacher_reviewed") return "graded";
  if (s === "ai_evaluated") return "graded";
  if (s === "submitted" || s === "in_progress" || s === "started") return "submitted";
  return "set";
}

function targetsStudent(target: unknown, studentId: string): boolean {
  if (target === null || target === undefined) return true;
  if (Array.isArray(target)) {
    if (target.length === 0) return true;
    return target.some((v) => String(v) === studentId);
  }
  return false;
}

/**
 * List all published assignments visible to this student, joined with their
 * submission if one exists. Newest first.
 */
export async function listAssignmentsForStudent(
  studentId: string,
  classLevel?: string | number | null,
): Promise<AssignmentForParent[]> {
  const supabase = createSupabaseServerClient();

  let q = supabase
    .from("assignments")
    .select(
      `id, title, subject, chapter_slug, lifecycle, created_at, target_student_ids, class_level,
       assignment_submissions!left(id, status, score, total_marks, percentage, submitted_at, graded_at, teacher_feedback)`,
    )
    .in("lifecycle", PUBLISHED_LIFECYCLES)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  // Narrow to this class level where available to avoid irrelevant rows
  if (classLevel) {
    q = q.eq("class_level", Number(classLevel));
  }

  const { data, error } = await q;
  if (error) return [];

  type SubmissionRaw = {
    id: string;
    status: string;
    score: number | null;
    total_marks: number | null;
    percentage: number | null;
    submitted_at: string | null;
    graded_at: string | null;
    teacher_feedback: string | null;
  };

  type Raw = {
    id: string;
    title: string;
    subject: string | null;
    chapter_slug: string | null;
    lifecycle: string;
    created_at: string;
    target_student_ids: unknown;
    class_level: number | null;
    assignment_submissions: SubmissionRaw[] | null;
  };

  const rows = (data as unknown as Raw[]) ?? [];

  return rows
    .filter((row) => targetsStudent(row.target_student_ids, studentId))
    .map((row) => {
      // Take first submission (there should be at most one per student per assignment)
      const subRaw = (row.assignment_submissions ?? [])[0] ?? null;

      const submission: AssignmentSubmission | null = subRaw
        ? {
            id: subRaw.id,
            status: subRaw.status,
            score: subRaw.score,
            totalMarks: subRaw.total_marks,
            percentage: subRaw.percentage !== null ? Number(subRaw.percentage) : null,
            submittedAt: subRaw.submitted_at,
            gradedAt: subRaw.graded_at,
            teacherFeedback: subRaw.teacher_feedback,
          }
        : null;

      return {
        id: row.id,
        title: row.title,
        subject: row.subject,
        chapterSlug: row.chapter_slug,
        lifecycle: row.lifecycle,
        createdAt: row.created_at,
        dueAt: null, // `assignments` table has no explicit due_date yet
        submission,
        displayStatus: deriveDisplayStatus(row.lifecycle, submission, null),
      } satisfies AssignmentForParent;
    });
}
