import { notFound } from "next/navigation";
import { requireAuthContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { StudentHomeworkPlayer } from "@/components/homework/student-homework-player";
import { TeacherSubmissionsView, type TeacherQuestion, type TeacherSubmission } from "@/components/homework/teacher-submissions-view";

export const dynamic = "force-dynamic";

export default async function HomeworkDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { student?: string };
}) {
  const context = await requireAuthContext();
  const supabase = createSupabaseAdminClient();

  // 1. Fetch assignment
  const { data: assignment, error: aErr } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", params.id)
    .single();

  if (aErr || !assignment) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedAssignment = assignment as any;
  const isTeacher = context.role === "teacher";

  // 2. Fetch questions (base + all student variants)
  const { data: allQuestions, error: qErr } = await supabase
    .from("assignment_questions")
    .select("*")
    .eq("assignment_id", params.id)
    .order("position", { ascending: true });

  if (qErr || !allQuestions?.length) {
    return (
      <main className="container py-8 text-center text-sm text-muted-foreground">
        No questions generated for this assignment yet.
      </main>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedQuestions = allQuestions as any[];

  // ── Teacher branch: secure access to EVERY submission in this assignment ──
  // ROOT-CAUSE FIX: the old page only loaded accessibleStudents[0]'s
  // submission, so teachers with many students saw at most one submission (or
  // none). Teachers now get the full submission roster with filters.
  // Security: strict ownership — assignment.teacher_id must equal the signed-in
  // teacher (mirrors the assignments RLS policy). No security checks removed.
  if (isTeacher) {
    if (!context.user || typedAssignment.teacher_id !== context.user.id) {
      notFound();
    }

    const { data: subs } = await supabase
      .from("assignment_submissions")
      .select("*, student:students(id, name, class)")
      .eq("assignment_id", params.id)
      .order("submitted_at", { ascending: false });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedSubs = (subs ?? []) as any[];
    const submissions: TeacherSubmission[] = typedSubs.map((s) => ({
      id: String(s.id),
      studentId: String(s.student_id),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      studentName: String((s.student as any)?.name ?? "Unknown student"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      studentClass: String((s.student as any)?.class ?? ""),
      status: String(s.status ?? "submitted"),
      score: Number(s.score) || 0,
      totalMarks: Number(s.total_marks) || 0,
      percentage: Number(s.percentage) || 0,
      submittedAt: String(s.submitted_at || ""),
      isLate: Boolean(s.is_late),
      answers: (s.answers as Record<string, string>) || {},
      mistakeBreakdown: (s.mistake_breakdown as TeacherSubmission["mistakeBreakdown"]) || [],
      aiEvaluationNotes: s.ai_evaluation_notes ?? undefined,
      teacherFeedback: s.teacher_feedback ?? undefined,
      handwrittenFiles: (s.handwritten_files as string[]) || [],
    }));

    const questions: TeacherQuestion[] = typedQuestions.map((q) => ({
      id: String(q.id),
      position: Number(q.position),
      stem: String(q.stem),
      qtype: String(q.qtype),
      marks: Number(q.marks) || 1,
      correctAnswer: String(q.correct_answer || ""),
      studentId: q.student_id ? String(q.student_id) : null,
    }));

    // Assigned-but-missing roster: prefer the assignment's target list, fall
    // back to the teacher's accessible students in this class.
    let assignedStudents: { id: string; name: string; class: string }[] = [];
    const targetIds: string[] = Array.isArray(typedAssignment.target_student_ids)
      ? typedAssignment.target_student_ids.map(String)
      : [];
    if (targetIds.length > 0) {
      const { data: targets } = await supabase.from("students").select("id, name, class").in("id", targetIds);
      assignedStudents = ((targets ?? []) as { id: string; name: string; class: string }[]).map((s) => ({
        id: String(s.id),
        name: String(s.name),
        class: String(s.class ?? ""),
      }));
    } else {
      assignedStudents = (context.accessibleStudents ?? [])
        .filter((s) => String(s.class) === String(typedAssignment.class_level))
        .map((s) => ({ id: String(s.id), name: String(s.name), class: String(s.class ?? "") }));
    }

    return (
      <main className="container py-6 px-4">
        <TeacherSubmissionsView
          assignment={{
            id: String(typedAssignment.id),
            title: String(typedAssignment.title),
            classLevel: Number(typedAssignment.class_level),
            subject: String(typedAssignment.subject),
            chapterSlug: String(typedAssignment.chapter_slug),
            dueDate: String(typedAssignment.due_date),
            totalMarks: Number(typedAssignment.total_marks) || 10,
          }}
          questions={questions}
          submissions={submissions}
          assignedStudents={assignedStudents}
          focusStudentId={searchParams?.student}
        />
      </main>
    );
  }

  // ── Student/parent branch: single-student view (unchanged behavior) ──
  const studentId = context.accessibleStudents?.[0]?.id || "preview-student";

  const studentQuestions = typedQuestions.filter((q) => q.student_id === studentId);
  const resolvedQuestions = studentQuestions.length > 0
    ? studentQuestions
    : typedQuestions.filter((q) => q.student_id === null);

  // 4. Fetch existing submission (if any)
  const { data: submission } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("assignment_id", params.id)
    .eq("student_id", studentId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedSubmission = submission as any;

  const formattedQuestions = resolvedQuestions.map((q) => ({
    id: String(q.id),
    position: Number(q.position),
    stem: String(q.stem),
    qtype: String(q.qtype),
    marks: Number(q.marks) || 1,
    options: (q.options as { label: string; text: string; isCorrect?: boolean }[]) || [],
    correctAnswer: typedSubmission ? String(q.correct_answer || "") : undefined,
    solutionSteps: typedSubmission ? (q.solution_steps as string[]) : undefined,
  }));

  const formattedSubmission = typedSubmission
    ? {
        id: String(typedSubmission.id),
        score: Number(typedSubmission.score) || 0,
        totalMarks: Number(typedSubmission.total_marks) || 0,
        percentage: Number(typedSubmission.percentage) || 0,
        submittedAt: String(typedSubmission.submitted_at || ""),
        answers: (typedSubmission.answers as Record<string, string>) || {},
        mistakeBreakdown: (typedSubmission.mistake_breakdown as { questionPosition: number; stem: string; studentAnswer: string; correctAnswer: string; category: string }[]) || [],
        aiEvaluationNotes: typedSubmission.ai_evaluation_notes ?? undefined,
        teacherFeedback: typedSubmission.teacher_feedback ?? undefined,
        handwrittenFiles: (typedSubmission.handwritten_files as string[]) || [],
      }
    : null;

  return (
    <main className="container py-6 px-4">
      <StudentHomeworkPlayer
        assignment={{
          id: String(typedAssignment.id),
          title: String(typedAssignment.title),
          description: String(typedAssignment.description || ""),
          classLevel: Number(typedAssignment.class_level),
          subject: String(typedAssignment.subject),
          chapterSlug: String(typedAssignment.chapter_slug),
          dueDate: String(typedAssignment.due_date),
          totalMarks: Number(typedAssignment.total_marks) || 10,
          submissionMode: String(typedAssignment.submission_mode),
        }}
        questions={formattedQuestions}
        submission={formattedSubmission}
        studentId={studentId}
      />
    </main>
  );
}
