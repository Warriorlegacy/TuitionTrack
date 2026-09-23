// Shared submit engine: record → pending teacher review.
// Used by POST /api/assessments/:id/submit and alias POST /api/tests/:id/submit
// (legacy tests table untouched; alias treats :id as assessment id).
//
// Manual-grading rule: NOTHING here decides marks. Responses are recorded
// verbatim, the attempt stays "submitted", and no score is returned. The
// teacher reviews each response and finalizes the grade; only then do
// mastery/mistake/analytics pipelines consume the result.

import type { SupabaseClient } from "@supabase/supabase-js";
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
  // one active attempt per student+assessment (idempotent resubmit → new pending attempt)
  const { data: attempt } = await supabase.from("attempts").insert({
    assessment_id: opts.assessmentId, student_id: opts.studentId, status: "submitted",
  }).select("id").single();
  if (!attempt) return { error: "Could not create attempt" as const };

  let total = 0;
  for (const r of opts.responses) {
    const it = byId.get(r.assessment_item_id) as unknown as {
      question_id: string; marks: number;
      questions: { qtype: string; difficulty: number; syllabus_node_id: string | null;
        question_options: { label: string; is_correct: boolean }[];
        question_solutions: { final_answer: string }[] | null };
    } | undefined;
    if (!it) continue;
    total += Number(it.marks);
    const normalized = String((r.answer as { value?: unknown } | null)?.value ?? r.answer ?? "").trim();
    // ponytail: record only — no is_correct verdict, no marks_awarded.
    // Teacher review decides every mark.
    await supabase.from("attempt_responses").insert({
      attempt_id: attempt.id, assessment_item_id: r.assessment_item_id,
      question_id: it.question_id, student_answer: { value: normalized } as never,
      is_correct: null, marks_awarded: 0,
      time_ms: r.time_ms ?? null, confidence: r.confidence ?? null,
      hints_used: r.hints_used ?? 0,
    });
  }
  await supabase.from("attempts").update({ score: 0, total, status: "submitted", submitted_at: new Date().toISOString() }).eq("id", attempt.id);
  await logEvent(supabase, opts.studentId, "test_submitted", { attempt_id: attempt.id, assessment_id: opts.assessmentId, status: "submitted" });
  return { attemptId: attempt.id as string, status: "submitted" as const, total, attempted: opts.responses.length };
}
