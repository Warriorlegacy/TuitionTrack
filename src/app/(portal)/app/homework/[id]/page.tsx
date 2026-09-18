import { notFound } from "next/navigation";
import { requireAuthContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { StudentHomeworkPlayer } from "@/components/homework/student-homework-player";

export const dynamic = "force-dynamic";

export default async function HomeworkDetailPage({
  params,
}: {
  params: { id: string };
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

  // 2. Identify target student
  const studentId = context.accessibleStudents?.[0]?.id || "preview-student";
  const isTeacher = context.role === "teacher";

  // 3. Fetch questions
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
    correctAnswer: isTeacher || typedSubmission ? String(q.correct_answer || "") : undefined,
    solutionSteps: isTeacher || typedSubmission ? (q.solution_steps as string[]) : undefined,
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
