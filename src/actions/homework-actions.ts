"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GeneratedQuestion, HomeworkMode } from "@/lib/homework/variation-engine";
import {
  notifyHomeworkAssigned,
  notifyHomeworkSubmitted,
  notifyHomeworkGraded,
} from "@/lib/notifications";

/**
 * Normalize an Indian family contact number to WhatsApp's digit-only
 * international format (e.g. "6202442690" -> "916202442690").
 * Returns null when there is nothing sendable.
 */
function normalizeIndianPhone(raw?: string | null): string | null {
  const digits = (raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits;
  return null;
}

/**
 * Send one Meta Cloud API template message. Returns true on accept.
 * Business-initiated chats must use an approved utility template, so the
 * template name/lang come from env (WHATSAPP_TEMPLATE_NAME, default
 * "homework_alert"). Never throws — callers treat false as skip.
 */
async function sendWhatsAppTemplate(
  token: string,
  phoneNumberId: string,
  to: string,
  bodyParams: string[],
): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME ?? "homework_alert",
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "en" },
          components: [
            { type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) },
          ],
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error("WhatsApp template send rejected:", await res.text().catch(() => res.status));
      return false;
    }
    return true;
  } catch (err) {
    console.error("WhatsApp template send failed (non-blocking):", err);
    return false;
  }
}

export type PublishAssignmentInput = {
  title: string;
  description?: string;
  classLevel: number;
  subject: string;
  chapterSlug: string;
  preset: string;
  mode: HomeworkMode;
  questionFormat?: "mixed" | "mcq";
  submissionMode: "online" | "handwritten" | "mixed";
  dueDate: string;
  totalMarks: number;
  targetStudentIds: string[];
  questions: GeneratedQuestion[];
  studentVariants?: Record<string, GeneratedQuestion[]>;
  /** Actual serving model metadata (transparency: what REALLY generated it). */
  aiProvider?: string;
  aiModel?: string;
  aiFallbackUsed?: boolean;
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
        ai_grading_enabled: false,
        question_format: (input.questionFormat ?? "mixed") as never,
        config: {
          question_format: input.questionFormat ?? "mixed",
          ai_provider: input.aiProvider ?? null,
          ai_model: input.aiModel ?? null,
          ai_fallback_used: input.aiFallbackUsed ?? false,
          ai_generated_at: new Date().toISOString(),
        } as never,
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

    // ponytail: ping targeted students + verified guardians via their
    // in-app Notifications feeds. Best-effort — never fails the publish.
    await notifyHomeworkAssigned(supabase, {
      assignmentId: (assignment as { id: string }).id,
      title: input.title,
      subject: input.subject,
      classLevel: input.classLevel,
      dueDate: input.dueDate,
      studentIds: input.targetStudentIds,
    });

    // ponytail: auto-WhatsApp to guardians' family numbers via Meta Cloud API.
    // Needs WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID; without them this is a
    // silent no-op (in-app notification above still covers parents).
    // Business-initiated messages require an approved utility template, so we
    // send WHATSAPP_TEMPLATE_NAME (default "homework_alert") — never free text.
    let waSent = 0;
    let waSkipped = 0;
    let waEnabled = false;
    try {
      const waToken = process.env.WHATSAPP_TOKEN;
      const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      waEnabled = Boolean(waToken && waPhoneId);
      const targetIds = Array.from(new Set(input.targetStudentIds)).filter(Boolean);
      if (waToken && waPhoneId && targetIds.length > 0) {
        const { data: contactStudents } = await supabase
          .from("students")
          .select("id, name, parent_phone")
          .in("id", targetIds);
        const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
        const link = origin ? `${origin}/student/homework/${assignment.id}` : "";
        const due = new Date(input.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        const seenPhones = new Set<string>();
        const jobs: { to: string; params: string[] }[] = [];
        ((contactStudents ?? []) as { id: string; name: string; parent_phone?: string | null }[]).forEach((s) => {
          const to = normalizeIndianPhone(s.parent_phone);
          if (!to || seenPhones.has(to)) {
            waSkipped++;
          } else {
            seenPhones.add(to);
            jobs.push({
              to,
              params: [s.name || "Student", input.title, `${input.subject} · Class ${input.classLevel}`, `Due ${due}`, link || "Open the TuitionTrack student portal"],
            });
          }
        });
        for (const job of jobs) {
          if (await sendWhatsAppTemplate(waToken, waPhoneId, job.to, job.params)) waSent++;
          else waSkipped++;
        }
      }
    } catch (waErr) {
      console.error("Auto-WhatsApp on publish failed (non-blocking):", waErr);
    }

    revalidatePath("/app/homework");
    revalidatePath("/app/dashboard");

    const waNote =
      waSent > 0
        ? ` WhatsApp sent to ${waSent} parent${waSent === 1 ? "" : "s"}.`
        : waEnabled && waSkipped > 0
          ? ` WhatsApp skipped for ${waSkipped} (no valid parent number).`
          : "";

    return {
      success: true,
      assignmentId: assignment.id,
      message: `Successfully published homework assignment to Class ${input.classLevel}!${waNote}`,
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

/**
 * Is this a Mathematics assessment? Handwritten notebook upload is mandatory
 * for Maths (all classes 5-12) — other subjects follow their configured format.
 */
function isMathsSubject(subject: unknown): boolean {
  const s = String(subject ?? "").toLowerCase();
  return s === "maths" || s === "math" || s === "mathematics";
}

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

    // 3. Completion gate: every required question must be answered.
    // Answer key is revealed only after this gate passes + submission saves.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unanswered = (resolvedQuestions as any[]).filter((q) => {
      const ans = (input.answers[String(q.id)] || "").trim();
      return ans.length === 0;
    });
    if (unanswered.length > 0) {
      return {
        success: false,
        message: `Please answer all ${resolvedQuestions.length} questions before submitting (${unanswered.length} remaining).`,
      };
    }

    // 4. Mathematics gate: handwritten notebook upload is mandatory for Maths
    // (all classes). Other subjects follow their configured submission format.
    const files = input.handwrittenFiles || [];
    if (isMathsSubject(typedAssignment.subject) && files.length === 0) {
      return {
        success: false,
        message: "Mathematics homework requires a handwritten notebook upload (photo/PDF of your written work). Please attach at least one page.",
      };
    }

    // 5. Total marks come from the question paper — NEVER an auto score.
    // Official grade stays empty until the teacher reviews every question.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalMarks = (resolvedQuestions as any[]).reduce((t, q) => t + (Number(q.marks) || 1), 0);
    const isLate = new Date() > new Date(typedAssignment.due_date);

    // 6. Save submission as SUBMITTED / PENDING teacher review.
    // No AI evaluation, no auto score, no mistake breakdown, no graded_at.
    const { data: submission, error: sErr } = await supabase
      .from("assignment_submissions")
      .upsert(
        {
          assignment_id: input.assignmentId,
          student_id: input.studentId,
          answers: input.answers,
          handwritten_files: files,
          score: 0,
          total_marks: totalMarks,
          percentage: 0,
          status: "submitted" as never,
          grading_status: "pending",
          grading_method: "teacher_manual",
          teacher_marks: {},
          question_feedback: {},
          reviewed_questions: [],
          ai_confidence: null,
          ai_evaluation_notes: null,
          mistake_breakdown: [],
          is_late: isLate,
          submitted_at: new Date().toISOString(),
          graded_at: null,
          finalized_at: null,
        },
        { onConflict: "assignment_id,student_id,attempt_number" }
      )
      .select("id")
      .single();

    if (sErr || !submission) {
      console.error("Submission upsert error:", sErr);
      return { success: false, message: sErr?.message || "Failed to submit assignment." };
    }

    // 7. Targeted notifications for this REAL event — no scores included.
    // Teacher gets "awaiting review", student/parent get confirmations only.
    await notifyHomeworkSubmitted(supabase, {
      assignmentId: input.assignmentId,
      teacherId: String(typedAssignment.teacher_id ?? ""),
      title: String(typedAssignment.title ?? "Homework"),
      subject: String(typedAssignment.subject ?? ""),
      studentId: input.studentId,
      isLate,
    });

    revalidatePath(`/app/homework`);
    revalidatePath(`/app/homework/${input.assignmentId}`);
    revalidatePath(`/app/dashboard`);

    return {
      success: true,
      submissionId: submission.id,
      message: `Homework submitted successfully! Answer key is now available. Grade: Pending Teacher Review.`,
    };
  } catch (err) {
    console.error("submitAssignmentAction error:", err);
    return { success: false, message: (err as Error).message || "Submission failed." };
  }
}

// ── Teacher manual review ─────────────────────────────────────────────────
// Teacher marks are the ONLY source of truth for the official grade.
// Finalize stays disabled until every question is reviewed.

export type SaveQuestionReviewInput = {
  submissionId: string;
  questionId: string;
  marksAwarded: number;
  feedback?: string;
};

export async function saveQuestionReviewAction(input: SaveQuestionReviewInput) {
  const context = await getAuthContext();
  if (!context.user || context.role !== "teacher") {
    return { success: false, message: "Unauthorized. Only teachers can review submissions." };
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data: sub, error: sErr } = await supabase
      .from("assignment_submissions")
      .select("id, assignment_id, teacher_marks, question_feedback, reviewed_questions, status")
      .eq("id", input.submissionId)
      .single();
    if (sErr || !sub) return { success: false, message: "Submission not found." };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typed = sub as any;

    // Ownership: teacher must own the assignment (mirrors RLS).
    const { data: asg } = await supabase
      .from("assignments")
      .select("id, teacher_id")
      .eq("id", typed.assignment_id)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!asg || (asg as any).teacher_id !== context.user.id) {
      return { success: false, message: "Unauthorized. This submission belongs to another workspace." };
    }

    // Clamp marks to [0, max] using the question paper.
    const { data: q } = await supabase
      .from("assignment_questions")
      .select("id, marks")
      .eq("id", input.questionId)
      .single();
    const maxMarks = Number((q as { marks?: unknown } | null)?.marks) || 0;
    const awarded = Math.min(Math.max(0, Number(input.marksAwarded) || 0), maxMarks);

    const teacherMarks = { ...((typed.teacher_marks as Record<string, number>) ?? {}) };
    const feedback = { ...((typed.question_feedback as Record<string, string>) ?? {}) };
    const reviewed = new Set<string>(Array.isArray(typed.reviewed_questions) ? typed.reviewed_questions.map(String) : []);
    teacherMarks[input.questionId] = awarded;
    if (input.feedback !== undefined) feedback[input.questionId] = input.feedback;
    reviewed.add(input.questionId);

    const { error: uErr } = await supabase
      .from("assignment_submissions")
      .update({
        teacher_marks: teacherMarks,
        question_feedback: feedback,
        reviewed_questions: Array.from(reviewed),
        grading_status: "in_review",
        teacher_overridden: true,
      })
      .eq("id", input.submissionId);
    if (uErr) return { success: false, message: uErr.message };

    revalidatePath(`/app/homework/${typed.assignment_id}`);
    return { success: true, message: "Review saved." };
  } catch (err) {
    return { success: false, message: (err as Error).message || "Failed to save review." };
  }
}

export async function finalizeSubmissionGradeAction(submissionId: string) {
  const context = await getAuthContext();
  if (!context.user || context.role !== "teacher") {
    return { success: false, message: "Unauthorized. Only teachers can finalize grades." };
  }
  try {
    const supabase = createSupabaseAdminClient();
    const { data: sub, error: sErr } = await supabase
      .from("assignment_submissions")
      .select("id, assignment_id, student_id, teacher_marks, reviewed_questions, status")
      .eq("id", submissionId)
      .single();
    if (sErr || !sub) return { success: false, message: "Submission not found." };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typed = sub as any;

    const { data: asg } = await supabase
      .from("assignments")
      .select("id, teacher_id, title, subject, chapter_slug")
      .eq("id", typed.assignment_id)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedAsg = asg as any;
    if (!typedAsg || typedAsg.teacher_id !== context.user.id) {
      return { success: false, message: "Unauthorized. This submission belongs to another workspace." };
    }

    // Every question on the student's paper must be reviewed first.
    const { data: qs } = await supabase
      .from("assignment_questions")
      .select("id, marks, student_id")
      .eq("assignment_id", typed.assignment_id);
    const all = ((qs ?? []) as { id: string; marks: unknown; student_id: string | null }[]);
    const studentQs = all.filter((x) => x.student_id === typed.student_id);
    const paper = studentQs.length > 0 ? studentQs : all.filter((x) => x.student_id === null);
    const reviewed = new Set<string>(
      Array.isArray(typed.reviewed_questions) ? typed.reviewed_questions.map(String) : [],
    );
    const pending = paper.filter((x) => !reviewed.has(String(x.id)));
    if (pending.length > 0) {
      return {
        success: false,
        message: `${pending.length} question(s) still require review. (${reviewed.size}/${paper.length} reviewed)`,
      };
    }

    // Final score = SUM of teacher-entered marks. Nothing else.
    const marks = (typed.teacher_marks as Record<string, number>) ?? {};
    let score = 0;
    let total = 0;
    for (const x of paper) {
      const max = Number(x.marks) || 0;
      total += max;
      score += Math.min(Math.max(0, Number(marks[String(x.id)]) || 0), max);
    }
    score = Math.round(score * 10) / 10;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

    const { error: uErr } = await supabase
      .from("assignment_submissions")
      .update({
        score,
        total_marks: total,
        percentage,
        status: "graded",
        grading_status: "completed",
        grading_method: "teacher_manual",
        graded_at: new Date().toISOString(),
        finalized_at: new Date().toISOString(),
      })
      .eq("id", submissionId);
    if (uErr) return { success: false, message: uErr.message };

    // Remedial signal now uses the teacher-finalized grade (never an AI score).
    if (percentage < 60) {
      await supabase.from("remedial_homework_triggers").insert({
        student_id: typed.student_id,
        chapter_slug: String(typedAsg.chapter_slug ?? ""),
        trigger_concept: String(typedAsg.title ?? "Homework"),
        mastery_level: percentage,
        status: "suggested",
      });
    }

    await notifyHomeworkGraded(supabase, {
      assignmentId: String(typed.assignment_id),
      teacherId: String(typedAsg.teacher_id ?? ""),
      title: String(typedAsg.title ?? "Homework"),
      subject: String(typedAsg.subject ?? ""),
      studentId: String(typed.student_id),
      score,
      totalMarks: total,
      percentage,
    });

    revalidatePath(`/app/homework/${typed.assignment_id}`);
    revalidatePath(`/app/dashboard`);
    return { success: true, message: `Grade finalized: ${score}/${total} (${percentage}%). Result published.` };
  } catch (err) {
    return { success: false, message: (err as Error).message || "Failed to finalize grade." };
  }
}
