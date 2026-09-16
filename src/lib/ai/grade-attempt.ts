// Shared submit engine: deterministic grade → mastery → mistakes → events.
// Used by POST /api/assessments/:id/submit and alias POST /api/tests/:id/submit
// (legacy tests table untouched; alias treats :id as assessment id).

import type { SupabaseClient } from "@supabase/supabase-js";
import { gradeResponse } from "@/lib/ai/scoring";
import { updateMastery } from "@/lib/ai/mastery";
import { classifyMistake } from "@/lib/ai/mistakes";
import { logEvent } from "@/lib/ai/usage";

export async function submitAssessment(
  supabase: SupabaseClient,
  opts: {
    assessmentId: string; studentId: string; userId: string;
    responses: { assessment_item_id: string; answer: unknown; time_ms?: number; confidence?: number; hints_used?: number }[];
  },
) {
  const { data: items } = await supabase.from("assessment_items")
    .select("id, question_id, marks, position, questions:questions!inner(id, qtype, difficulty, syllabus_node_id, question_options(label, text, is_correct), question_solutions(final_answer))")
    .eq("assessment_id", opts.assessmentId).order("position");
  if (!items?.length) return { error: "Assessment has no items" as const };

  const byId = new Map(items.map((i: unknown) => [(i as { id: string }).id, i as never]));
  // one active attempt per student+assessment (idempotent resubmit → new graded attempt)
  const { data: attempt } = await supabase.from("attempts").insert({
    assessment_id: opts.assessmentId, student_id: opts.studentId, status: "submitted",
  }).select("id").single();
  if (!attempt) return { error: "Could not create attempt" as const };

  let score = 0, total = 0, correct = 0, guessed = 0;
  for (const r of opts.responses) {
    const it = byId.get(r.assessment_item_id) as unknown as {
      question_id: string; marks: number;
      questions: { qtype: string; difficulty: number; syllabus_node_id: string | null;
        question_options: { label: string; is_correct: boolean }[];
        question_solutions: { final_answer: string }[] | null };
    } | undefined;
    if (!it) continue;
    const q = it.questions;
    const g = gradeResponse({
      qtype: q.qtype,
      correctLabel: q.question_options.find((o) => o.is_correct)?.label ?? null,
      finalAnswer: q.question_solutions?.[0]?.final_answer ?? null,
      studentAnswer: r.answer, marks: Number(it.marks),
    });
    total += Number(it.marks); score += g.marksAwarded;
    if (g.isCorrect) correct++;
    if ((r.time_ms ?? 99999) < 8000 && !g.isCorrect) guessed++;
    await supabase.from("attempt_responses").insert({
      attempt_id: attempt.id, assessment_item_id: r.assessment_item_id,
      question_id: it.question_id, student_answer: { value: g.normalized } as never,
      is_correct: g.isCorrect, marks_awarded: g.marksAwarded,
      time_ms: r.time_ms ?? null, confidence: r.confidence ?? null,
      hints_used: r.hints_used ?? 0,
    });
    // mastery update (best-effort per concept)
    if (q.syllabus_node_id) {
      const { data: m } = await supabase.from("concept_mastery")
        .select("mastery, attempt_count, correct_count, streak")
        .eq("student_id", opts.studentId).eq("concept_id", q.syllabus_node_id).maybeSingle();
      const next = updateMastery(
        { mastery: Number(m?.mastery ?? 0.3), attemptCount: m?.attempt_count ?? 0, correctCount: m?.correct_count ?? 0, streak: m?.streak ?? 0 },
        { correct: g.isCorrect, difficulty: q.difficulty ?? 3, confidence: r.confidence, hintsUsed: r.hints_used, timeMs: r.time_ms, timeExpectedMs: 60_000 },
      );
      await supabase.from("concept_mastery").upsert({
        student_id: opts.studentId, concept_id: q.syllabus_node_id,
        mastery: next.mastery, attempt_count: next.attemptCount,
        correct_count: next.correctCount, streak: next.streak,
        last_practiced_at: new Date().toISOString(),
      });
    }
    if (!g.isCorrect && q.syllabus_node_id) {
      const cls = classifyMistake({
        studentAnswer: g.normalized,
        correctAnswer: q.question_solutions?.[0]?.final_answer ?? q.question_options.find((o) => o.is_correct)?.label ?? "",
        qtype: q.qtype, timeMs: r.time_ms, confidence: r.confidence, hintsUsed: r.hints_used,
      });
      // recurrence bump on same question+category
      const { data: existing } = await supabase.from("mistakes").select("id, recurrence_count")
        .eq("student_id", opts.studentId).eq("question_id", it.question_id)
        .eq("category", cls.category).eq("status", "open").maybeSingle();
      if (existing) {
        await supabase.from("mistakes").update({
          recurrence_count: (existing.recurrence_count ?? 1) + 1,
          status: (existing.recurrence_count ?? 1) + 1 >= 3 ? "relapsed" : "open",
        }).eq("id", existing.id);
      } else {
        await supabase.from("mistakes").insert({
          student_id: opts.studentId, question_id: it.question_id, concept_id: q.syllabus_node_id,
          category: cls.category, severity: cls.severity, root_cause: cls.rootCause,
          student_answer: { value: g.normalized } as never,
          correct_answer: q.question_solutions?.[0]?.final_answer ?? null,
          explanation: null, status: "open",
        });
      }
    }
  }
  await supabase.from("attempts").update({ score, total, status: "graded", submitted_at: new Date().toISOString() }).eq("id", attempt.id);
  await logEvent(supabase, opts.studentId, "test_submitted", { attempt_id: attempt.id, assessment_id: opts.assessmentId, score, total });
  return { attemptId: attempt.id as string, score, total, correct, attempted: opts.responses.length, guessed };
}
