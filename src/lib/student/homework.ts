import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StudentHomeworkStatus =
  | "pending"
  | "submitted"
  | "graded"
  | "completed"
  | "overdue";

export type StudentHomeworkItem = {
  id: string;
  source: "assignment" | "quick_log";
  title: string;
  subject: string;
  chapterSlug?: string | null;
  description?: string | null;
  dueDate: string | null;
  totalMarks?: number | null;
  status: StudentHomeworkStatus;
  score?: number | null;
  percentage?: number | null;
  teacherFeedback?: string | null;
  playerUrl?: string | null;
  createdAt: string;
};

function parseNumericClass(classValue?: string | number | null): number | null {
  if (classValue === null || classValue === undefined) return null;
  const match = String(classValue).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function targetsStudent(target: unknown, studentId: string): boolean {
  if (target === null || target === undefined) return true;
  if (Array.isArray(target)) {
    if (target.length === 0) return true;
    return target.some((v) => String(v) === studentId);
  }
  return false;
}

function isPastDue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

/**
 * Lists all homework items assigned to a student:
 * 1. Rich AI Homework Assignments (`public.assignments`)
 * 2. Quick Homework Tracker Logs (`public.homework`)
 *
 * Ordered by due date (urgent/overdue first), with pending tasks prioritized.
 */
export async function listStudentHomework(
  studentId: string,
  classValue?: string | number | null,
): Promise<StudentHomeworkItem[]> {
  const supabase = createSupabaseServerClient();
  const numericClass = parseNumericClass(classValue);

  // 1. Fetch Assignments
  let assignQuery = supabase
    .from("assignments")
    .select(
      `id, title, description, class_level, subject, chapter_slug,
       due_date, total_marks, target_student_ids, lifecycle, created_at,
       assignment_submissions!left(
         id, student_id, status, score, total_marks, percentage,
         submitted_at, graded_at, teacher_feedback
       )`,
    )
    .is("deleted_at", null)
    .in("lifecycle", [
      "published",
      "started",
      "in_progress",
      "submitted",
      "ai_evaluated",
      "teacher_reviewed",
      "graded",
      "returned",
    ])
    .order("created_at", { ascending: false })
    .limit(100);

  if (numericClass !== null) {
    assignQuery = assignQuery.eq("class_level", numericClass);
  }

  // 2. Fetch Quick Homework Logs
  const hwQuery = supabase
    .from("homework")
    .select("id, title, description, due_date, status, created_at")
    .is("deleted_at", null)
    .eq("student_id", studentId)
    .order("due_date", { ascending: false })
    .limit(100);

  const [assignRes, hwRes] = await Promise.all([assignQuery, hwQuery]);

  const items: StudentHomeworkItem[] = [];

  // Process Assignments
  if (assignRes.data) {
    type SubRaw = {
      id: string;
      student_id: string;
      status: string;
      score: number | null;
      total_marks: number | null;
      percentage: number | null;
      submitted_at: string | null;
      graded_at: string | null;
      teacher_feedback: string | null;
    };

    type AssignmentRaw = {
      id: string;
      title: string;
      description: string | null;
      class_level: number;
      subject: string;
      chapter_slug: string | null;
      due_date: string | null;
      total_marks: number | null;
      target_student_ids: unknown;
      lifecycle: string;
      created_at: string;
      assignment_submissions: SubRaw[] | null;
    };

    const assignmentRows = (assignRes.data as unknown as AssignmentRaw[]) ?? [];

    for (const a of assignmentRows) {
      if (!targetsStudent(a.target_student_ids, studentId)) {
        continue;
      }

      const subs = a.assignment_submissions ?? [];
      const sub = subs.find((s) => s.student_id === studentId) ?? subs[0] ?? null;

      let status: StudentHomeworkStatus = "pending";
      if (sub) {
        // ponytail: only teacher-finalized grades count as graded.
        // Legacy "ai_evaluated" rows are pending teacher review, not results.
        if (
          sub.status === "graded" ||
          sub.status === "teacher_reviewed" ||
          sub.status === "returned"
        ) {
          status = "graded";
        } else if (sub.status === "submitted" || sub.status === "in_progress" || sub.status === "ai_evaluated") {
          status = "submitted";
        }
      } else if (isPastDue(a.due_date)) {
        status = "overdue";
      }

      items.push({
        id: a.id,
        source: "assignment",
        title: a.title,
        subject: a.subject || "Academic",
        chapterSlug: a.chapter_slug,
        description: a.description,
        dueDate: a.due_date,
        totalMarks: a.total_marks ? Number(a.total_marks) : null,
        status,
        score: sub?.score !== null && sub?.score !== undefined ? Number(sub.score) : null,
        percentage: sub?.percentage !== null && sub?.percentage !== undefined ? Number(sub.percentage) : null,
        teacherFeedback: sub?.teacher_feedback,
        playerUrl: `/student/homework/${a.id}`,
        createdAt: a.created_at,
      });
    }
  }

  // Process Quick Homework Logs
  if (hwRes.data) {
    for (const hw of hwRes.data) {
      const isDone = hw.status === "completed";
      const status: StudentHomeworkStatus = isDone
        ? "completed"
        : isPastDue(hw.due_date)
          ? "overdue"
          : "pending";

      items.push({
        id: hw.id,
        source: "quick_log",
        title: hw.title,
        subject: "General",
        description: hw.description,
        dueDate: hw.due_date,
        status,
        playerUrl: null,
        createdAt: hw.created_at,
      });
    }
  }

  // Sort: pending & overdue first, then by due_date ascending
  items.sort((a, b) => {
    const aIsActive = a.status === "pending" || a.status === "overdue";
    const bIsActive = b.status === "pending" || b.status === "overdue";
    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;

    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return aDue - bDue;
  });

  return items;
}

export type StudentAssignmentPlayerDetails = {
  assignment: {
    id: string;
    title: string;
    description: string;
    classLevel: number;
    subject: string;
    chapterSlug: string;
    dueDate: string;
    totalMarks: number;
    submissionMode: string;
  };
  questions: {
    id: string;
    position: number;
    stem: string;
    qtype: string;
    marks: number;
    options: { label: string; text: string; isCorrect?: boolean }[];
    correctAnswer?: string;
    solutionSteps?: string[];
  }[];
  submission: {
    id: string;
    status: string;
    gradingStatus: string;
    isGraded: boolean;
    score: number;
    totalMarks: number;
    percentage: number;
    submittedAt: string;
    answers: Record<string, string>;
    mistakeBreakdown?: {
      questionPosition: number;
      stem: string;
      studentAnswer: string;
      correctAnswer: string;
      category: string;
      qtype?: string;
    }[];
    aiEvaluationNotes?: string;
    teacherFeedback?: string;
    handwrittenFiles?: string[];
  } | null;
};

export async function getStudentAssignmentPlayerDetails(
  assignmentId: string,
  studentId: string,
): Promise<StudentAssignmentPlayerDetails | null> {
  const supabase = createSupabaseServerClient();

  const { data: assignment, error: aErr } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .is("deleted_at", null)
    .single();

  if (aErr || !assignment) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedAssignment = assignment as any;

  // Fetch questions for this assignment
  const { data: allQuestions, error: qErr } = await supabase
    .from("assignment_questions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("position", { ascending: true });

  if (qErr || !allQuestions?.length) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedQuestions = allQuestions as any[];
  const studentSpecific = typedQuestions.filter((q) => q.student_id === studentId);
  const resolvedQuestions =
    studentSpecific.length > 0
      ? studentSpecific
      : typedQuestions.filter((q) => q.student_id === null);

  // Fetch student submission
  const { data: submission } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedSubmission = submission as any;

  const isGraded = Boolean(
    typedSubmission &&
      (typedSubmission.status === "graded" ||
        typedSubmission.status === "teacher_reviewed" ||
        typedSubmission.status === "returned"),
  );
  // Answer key is available after ANY successful submission (it is study
  // material, not a grade). Scores stay hidden until teacher finalize.
  const hasSubmitted = Boolean(typedSubmission);

  const formattedQuestions = resolvedQuestions.map((q) => ({
    id: String(q.id),
    position: Number(q.position),
    stem: String(q.stem),
    qtype: String(q.qtype),
    marks: Number(q.marks) || 1,
    options: (q.options as { label: string; text: string; isCorrect?: boolean }[]) || [],
    correctAnswer: hasSubmitted ? String(q.correct_answer || "") : undefined,
    solutionSteps: hasSubmitted ? (q.solution_steps as string[]) : undefined,
  }));

  const formattedSubmission = typedSubmission
    ? {
        id: String(typedSubmission.id),
        status: String(typedSubmission.status ?? "submitted"),
        gradingStatus: String(typedSubmission.grading_status ?? "pending"),
        isGraded,
        score: Number(typedSubmission.score) || 0,
        totalMarks: Number(typedSubmission.total_marks) || 0,
        percentage: Number(typedSubmission.percentage) || 0,
        submittedAt: String(typedSubmission.submitted_at || ""),
        answers: (typedSubmission.answers as Record<string, string>) || {},
        mistakeBreakdown:
          (typedSubmission.mistake_breakdown as {
            questionPosition: number;
            stem: string;
            studentAnswer: string;
            correctAnswer: string;
            category: string;
          }[]) || [],
        aiEvaluationNotes: typedSubmission.ai_evaluation_notes ?? undefined,
        teacherFeedback: typedSubmission.teacher_feedback ?? undefined,
        handwrittenFiles: (typedSubmission.handwritten_files as string[]) || [],
      }
    : null;

  return {
    assignment: {
      id: String(typedAssignment.id),
      title: String(typedAssignment.title),
      description: String(typedAssignment.description || ""),
      classLevel: Number(typedAssignment.class_level),
      subject: String(typedAssignment.subject),
      chapterSlug: String(typedAssignment.chapter_slug),
      dueDate: String(typedAssignment.due_date),
      totalMarks: Number(typedAssignment.total_marks) || 10,
      submissionMode: String(typedAssignment.submission_mode),
    },
    questions: formattedQuestions,
    submission: formattedSubmission,
  };
}
