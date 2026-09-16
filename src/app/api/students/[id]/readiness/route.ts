import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStudentAccess } from "@/lib/ai/guard";
import { readinessBreakdown } from "@/lib/ai/mastery";

export const dynamic = "force-dynamic";

// GET /api/students/:id/readiness — exam readiness estimate (#16, labelled estimate).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { error, context } = await requireStudentAccess(params.id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const [{ data: mastery }, { data: attempts }, { count: dueCount }] = await Promise.all([
    supabase.from("concept_mastery").select("mastery").eq("student_id", params.id),
    supabase.from("attempts").select("score, total, submitted_at").eq("student_id", params.id)
      .eq("status", "graded").order("submitted_at", { ascending: false }).limit(5),
    supabase.from("spaced_items").select("id", { count: "exact", head: true })
      .eq("student_id", params.id).lte("due_at", new Date().toISOString()),
  ]);
  const m = ((mastery ?? []) as { mastery: number }[]).map((x) => Number(x.mastery));
  const avgMastery = m.length ? m.reduce((a, b) => a + b, 0) / m.length : 0.3;
  const acc = ((attempts ?? []) as { score: number; total: number }[])
    .map((a) => (Number(a.total) ? Number(a.score) / Number(a.total) : 0));
  const avgAccuracy = acc.length ? acc.reduce((a, b) => a + b, 0) / acc.length : 0.5;
  const trend = acc.length >= 2 ? Math.max(-1, Math.min(1, acc[0] - acc[acc.length - 1])) : 0;
  const retention = Math.max(0, 1 - (dueCount ?? 0) / 20);
  const r = readinessBreakdown({ avgMastery, retention, avgAccuracy, avgSpeedRatio: 1, trend });
  return NextResponse.json({
    student_id: params.id, readiness: r.total, breakdown: r.parts,
    disclaimer: "Estimate only — not a guarantee of exam outcome.",
  });
}
