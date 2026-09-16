import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { threeActions, type AttemptLayers } from "@/lib/ai/planner";
import { scoreToPercent } from "@/lib/ai/scoring";

export const dynamic = "force-dynamic";

// GET /api/attempts/:id/analysis — score + accuracy + time + concept + behavior → 3 actions (#13).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const context = await getAuthContext();
  if (!context.configured || !context.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data: attempt } = await supabase.from("attempts")
    .select("id, student_id, score, total, status, assessments!inner(title, subject)")
    .eq("id", params.id).maybeSingle();
  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  const studentId = (attempt as { student_id: string }).student_id;
  const allowed = context.accessibleStudents.some((s) => s.id === studentId) ||
    (context.role === "teacher" && context.teacherIds.length > 0);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: responses } = await supabase.from("attempt_responses")
    .select("is_correct, time_ms, confidence, hints_used, question_id, questions:questions!inner(qtype, syllabus_node_id, question_solutions(final_answer))")
    .eq("attempt_id", params.id);
  const rows = (responses ?? []) as unknown as {
    is_correct: boolean | null; time_ms: number | null; confidence: number | null;
    question_id: string; questions: { syllabus_node_id: string | null };
  }[];
  const correct = rows.filter((r) => r.is_correct).length;
  const incorrect = rows.filter((r) => r.is_correct === false).length;
  const times = rows.map((r) => r.time_ms).filter((t): t is number => t != null);
  const avgTimeMs = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const tooFastIncorrect = rows.filter((r) => !r.is_correct && (r.time_ms ?? 99999) < 8000).length;
  const guessed = rows.filter((r) => (r.confidence ?? 3) <= 2 && !r.is_correct).length;
  const overtimeCount = rows.filter((r) => (r.time_ms ?? 0) > 180_000).length;

  // concept layer from mastery deltas
  const { data: mastery } = await supabase.from("concept_mastery")
    .select("mastery, concept_id, syllabus_nodes:syllabus_nodes!inner(title)")
    .eq("student_id", studentId).order("mastery", { ascending: true }).limit(3);
  const weakestConcepts = ((mastery ?? []) as unknown as { mastery: number; concept_id: string; syllabus_nodes: { title: string } }[])
    .map((m) => ({ conceptId: m.concept_id, title: m.syllabus_nodes.title, accuracy: Math.round(Number(m.mastery) * 100) }));
  const { data: mistakes } = await supabase.from("mistakes").select("category")
    .eq("student_id", studentId).order("created_at", { ascending: false }).limit(20);
  const freq = new Map<string, number>();
  for (const m of ((mistakes ?? []) as { category: string }[])) freq.set(m.category, (freq.get(m.category) ?? 0) + 1);
  const topMistakeCategory = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const score = Number((attempt as { score: number }).score);
  const total = Number((attempt as { total: number }).total);
  const layers: AttemptLayers = {
    score, total, percent: scoreToPercent(score, total),
    correct, incorrect, unattempted: 0, guessed, careless: tooFastIncorrect,
    avgTimeMs, overtimeCount, tooFastIncorrect, weakestConcepts, topMistakeCategory,
  };
  // First screen = score + 3 actions; deeper layers below (#82).
  return NextResponse.json({ attempt_id: params.id, ...layers, next_actions: threeActions(layers) });
}
