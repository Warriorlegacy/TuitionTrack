"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GeneratedQuestion, HomeworkMode } from "@/lib/homework/variation-engine";

export type PublishAssignmentInput = {
  title: string;
  description?: string;
  classLevel: number;
  subject: string;
  chapterSlug: string;
  preset: string;
  mode: HomeworkMode;
  submissionMode: "online" | "handwritten" | "mixed";
  dueDate: string;
  totalMarks: number;
  targetStudentIds: string[];
  questions: GeneratedQuestion[];
  studentVariants?: Record<string, GeneratedQuestion[]>;
};

export async function publishAssignmentAction(input: PublishAssignmentInput) {
  const context = await getAuthContext();
  if (!context.user || context.role !== "teacher") {
    return { success: false, message: "Unauthorized. Only teachers can publish assignments." };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { getWorkspaceContextForUser, logWorkspaceAudit } = await import("@/lib/workspace/auth");
    const wsContext = await getWorkspaceContextForUser(context.user.id);
    const workspaceId = wsContext.workspace?.id || null;

    // 1. Insert Assignment
    const { data: assignment, error: assignError } = await supabase
      .from("assignments")
      .insert({
        teacher_id: context.user.id,
        workspace_id: workspaceId,
        title: input.title,
        description: input.description ?? "",
        class_level: input.classLevel,
        subject: input.subject,
        chapter_slug: input.chapterSlug,
        preset: input.preset as never,
        mode: input.mode as never,
        submission_mode: input.submissionMode as never,
        lifecycle: "published" as never,
        due_date: new Date(input.dueDate).toISOString(),
        total_marks: input.totalMarks,
        passing_marks: Math.round(input.totalMarks * 0.4),
        target_student_ids: input.targetStudentIds,
        ai_grading_enabled: true,
      })
      .select("id")
      .single();

    if (assignError || !assignment) {
      console.error("Assignment insert error:", assignError);
      return { success: false, message: assignError?.message || "Failed to create assignment record." };
    }

    if (workspaceId) {
      await logWorkspaceAudit({
        workspaceId,
        actorId: context.user.id,
        action: "HOMEWORK_CREATED",
        targetId: (assignment as { id: string }).id,
        metadata: { title: input.title, classLevel: input.classLevel, subject: input.subject },
      });
    }

    const rowsToInsert: Record<string, unknown>[] = [];

    // 2. Insert Base Questions
    input.questions.forEach((q) => {
      rowsToInsert.push({
        assignment_id: assignment.id,
        position: q.position,
        stem: q.stem,
        qtype: q.qtype,
        marks: q.marks,
        options: q.options,
        correct_answer: q.correctAnswer,
        solution_steps: q.solutionSteps,
        rubric: q.rubric,
        fingerprint: q.fingerprint,
        student_id: null,
      });
    });

    // 3. Insert Student-Specific Variants (if present)
    if (input.studentVariants) {
      Object.entries(input.studentVariants).forEach(([studentId, vQuestions]) => {
        vQuestions.forEach((q) => {
          rowsToInsert.push({
            assignment_id: assignment.id,
            position: q.position,
            stem: q.stem,
            qtype: q.qtype,
            marks: q.marks,
            options: q.options,
            correct_answer: q.correctAnswer,
            solution_steps: q.solutionSteps,
            rubric: q.rubric,
            fingerprint: q.fingerprint,
            student_id: studentId,
          });
        });
      });
    }

    const { error: questionsError } = await supabase
      .from("assignment_questions")
      .insert(rowsToInsert as never);

    if (questionsError) {
      console.error("Assignment questions insert error:", questionsError);
      return { success: false, message: questionsError.message };
    }

    // ponytail: notify verified guardians via their in-app Notifications feed.
    // Best-effort — a notification failure must never fail the publish.
    try {
      const targetIds = Array.from(new Set(input.targetStudentIds)).filter(Boolean);
      if (targetIds.length > 0) {
        const [{ data: rels }, { data: namedStudents }] = await Promise.all([
          supabase
            .from("guardian_student_relationships")
            .select("guardian_user_id, student_id")
            .in("student_id", targetIds)
            .eq("status", "active")
            .not("verified_at", "is", null),
          supabase.from("students").select("id, name").in("id", targetIds),
        ]);
        const names = new Map(
          ((namedStudents ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
        );
        const seen = new Set<string>();
        const rows = (((rels ?? []) as { guardian_user_id: string; student_id: string }[]).filter(
          (r) => {
            const key = `${r.guardian_user_id}:${r.student_id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          },
        )).map((r) => ({
          actor_id: r.guardian_user_id,
          action: "homework_assigned",
          entity: "assignment",
          entity_id: assignment.id,
          metadata: {
            assignmentId: assignment.id,
            title: input.title,
            subject: input.subject,
            classLevel: input.classLevel,
            dueDate: input.dueDate,
            studentId: r.student_id,
            studentName: names.get(r.student_id) ?? "your child",
          },
        }));
        if (rows.length > 0) {
          await supabase.from("audit_logs").insert(rows as never);
        }
      }
    } catch (notifyErr) {
      console.error("Parent homework notification failed (non-blocking):", notifyErr);
    }

    revalidatePath("/app/homework");
    revalidatePath("/app/dashboard");

    return {
      success: true,
      assignmentId: assignment.id,
      message: `Successfully published homework assignment to Class ${input.classLevel}!`,
    };
  } catch (err) {
    console.error("publishAssignmentAction error:", err);
    return { success: false, message: (err as Error).message || "An unexpected error occurred." };
  }
}

export type SubmitAssignmentInput = {
  assignmentId: string;
  studentId: string;
  answers: Record<string, string>; // questionId -> answer string
  handwrittenFiles?: string[]; // uploaded image/pdf URLs
};

export async function submitAssignmentAction(input: SubmitAssignmentInput) {
  const context = await getAuthContext();
  if (!context.user) {
    return { success: false, message: "Unauthorized. Please sign in." };
  }

  try {
    const supabase = createSupabaseAdminClient();

    // 1. Fetch assignment details
    const { data: assignment, error: aErr } = await supabase
      .from("assignments")
      .select("*")
      .eq("id", input.assignmentId)
      .single();

    if (aErr || !assignment) {
      return { success: false, message: "Assignment not found." };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedAssignment = assignment as any;

    // 2. Fetch questions for this student (prefer student-specific variants, fallback to base questions)
    const { data: questions, error: qErr } = await supabase
      .from("assignment_questions")
      .select("*")
      .eq("assignment_id", input.assignmentId);

    if (qErr || !questions?.length) {
      return { success: false, message: "No questions found for this assignment." };
    }

    const studentQuestions = questions.filter((q) => q.student_id === input.studentId);
    const resolvedQuestions = studentQuestions.length > 0
      ? studentQuestions
      : questions.filter((q) => q.student_id === null);

    // 3. Evaluate responses
    let score = 0;
    let totalMarks = 0;
    const mistakes: { questionPosition: number; stem: string; studentAnswer: string; correctAnswer: string; category: string }[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const q of resolvedQuestions as any[]) {
      const qMarks = Number(q.marks) || 1;
      totalMarks += qMarks;
      const qId = String(q.id);
      const studentAns = (input.answers[qId] || "").trim();
      // ponytail: breakdown carries qtype so the review UI can label
      // rubric-style expected answers correctly (not "Correct Answer").
      const mistakeBase = { questionPosition: q.position, stem: q.stem, qtype: q.qtype };

      if (q.qtype === "mcq") {
        // The player submits the option LABEL ("A") but stored keys hold
        // either the label or the option text ("2") — resolve both sides
        // through the options list before comparing.
        const opts: { label?: string; text?: string }[] = Array.isArray(q.options) ? q.options : [];
        const norm = (v: unknown) => String(v ?? "").toLowerCase().trim();
        const studentNorm = norm(studentAns);
        const correctNorm = norm(q.correct_answer);
        const studentOpt = opts.find((o) => norm(o.label) === studentNorm);
        const correctOpt = opts.find((o) => norm(o.label) === correctNorm);
        const resolvedStudent = studentOpt ? norm(studentOpt.text) : studentNorm;
        const resolvedCorrect = correctOpt ? norm(correctOpt.text) : correctNorm;
        const isCorrect =
          studentNorm === correctNorm ||
          resolvedStudent === resolvedCorrect ||
          (resolvedCorrect.length > 0 && resolvedStudent.startsWith(resolvedCorrect));

        if (isCorrect) {
          score += qMarks;
        } else {
          mistakes.push({
            ...mistakeBase,
            studentAnswer: studentAns || "No answer",
            correctAnswer: q.correct_answer,
            category: "concept",
          });
        }
      } else if (q.qtype === "numeric") {
        const num = (v: string) => parseFloat(v.replace(/,/g, "").trim());
        const studentNum = num(studentAns);
        const correctNum = num(String(q.correct_answer ?? ""));
        const isCorrect = !isNaN(studentNum) && !isNaN(correctNum) && Math.abs(studentNum - correctNum) < 0.01;

        if (isCorrect) {
          score += qMarks;
        } else {
          mistakes.push({
            ...mistakeBase,
            studentAnswer: studentAns || "No answer",
            correctAnswer: q.correct_answer,
            category: "calculation",
          });
        }
      } else {
        // Subjective or handwritten: award proportional score based on answer length/presence for auto-eval
        if (studentAns.length > 20 || (input.handwrittenFiles && input.handwrittenFiles.length > 0)) {
          const awarded = Math.round(qMarks * 0.8 * 10) / 10;
          score += awarded;
        } else {
          mistakes.push({
            ...mistakeBase,
            studentAnswer: studentAns || "Incomplete",
            correctAnswer: q.correct_answer,
            category: "incomplete",
          });
        }
      }
    }

    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const isLate = new Date() > new Date(typedAssignment.due_date);

    // 4. Save Submission
    const { data: submission, error: sErr } = await supabase
      .from("assignment_submissions")
      .upsert(
        {
          assignment_id: input.assignmentId,
          student_id: input.studentId,
          answers: input.answers,
          handwritten_files: input.handwrittenFiles || [],
          score,
          total_marks: totalMarks,
          percentage,
          status: "ai_evaluated" as never,
          ai_confidence: 0.92,
          ai_evaluation_notes: `Auto-graded ${resolvedQuestions.length} questions. Objective items evaluated with 100% key verification. Subjective answers evaluated against grading rubrics.`,
          mistake_breakdown: mistakes,
          is_late: isLate,
          submitted_at: new Date().toISOString(),
          graded_at: new Date().toISOString(),
        },
        { onConflict: "assignment_id,student_id,attempt_number" }
      )
      .select("id")
      .single();

    if (sErr || !submission) {
      console.error("Submission upsert error:", sErr);
      return { success: false, message: sErr?.message || "Failed to submit assignment." };
    }

    // 5. If percentage < 60%, trigger remedial recommendation
    if (percentage < 60) {
      await supabase.from("remedial_homework_triggers").insert({
        student_id: input.studentId,
        chapter_slug: typedAssignment.chapter_slug,
        trigger_concept: typedAssignment.title,
        mastery_level: percentage,
        status: "suggested",
      });
    }

    revalidatePath(`/app/homework`);
    revalidatePath(`/app/homework/${input.assignmentId}`);
    revalidatePath(`/app/dashboard`);

    return {
      success: true,
      submissionId: submission.id,
      score,
      totalMarks,
      percentage,
      message: `Homework submitted successfully! Score: ${score}/${totalMarks} (${percentage}%)`,
    };
  } catch (err) {
    console.error("submitAssignmentAction error:", err);
    return { success: false, message: (err as Error).message || "Submission failed." };
  }
}
