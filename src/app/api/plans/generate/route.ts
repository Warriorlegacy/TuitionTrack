import { NextResponse } from "next/server";
import { planGenerateSchema } from "@/lib/ai/schemas";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rankPlan, replan, type PlanCandidate } from "@/lib/ai/planner";
import { checkRateLimit, checkAiBudget, logUsage, logAudit, logEvent } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

// POST /api/plans/generate — deterministic planner write-path (blueprint #18).
// rankPlan weights 0.35/0.25/0.2/0.1/0.1 live in src/lib/ai/planner; this route
// gathers signals (mastery, mistakes, due reviews), ranks under a minute
// budget, preserves high-value pending tasks from the prior active plan
// (replan), and writes study_plans + plan_tasks. Tier: deterministic ($0).
export async function POST(request: Request) {
  const parsed = planGenerateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request", parsed.error.flatten());
  const input = parsed.data;

  const { error, context } = await requireStudentAccess(input.student_id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const userId = context.user.id;

  const rl = await checkRateLimit(supabase, userId, "/api/plans/generate");
  if (!rl.ok) return NextResponse.json({ error: rl.reason }, { status: 429 });
  const budget = await checkAiBudget(supabase, input.student_id);
  if (!budget.ok) return NextResponse.json({ error: budget.reason }, { status: 429 });

  const now = new Date();
  const start = input.start_date ?? now.toISOString().slice(0, 10);
  const startMs = new Date(start + "T00:00:00Z").getTime();
  if (Number.isNaN(startMs)) return badRequest("Invalid start_date");

  // signals (tenant-scoped by RLS + guard)
  const [{ data: mastery }, { data: mistakes }, { data: due }] = await Promise.all([
    supabase.from("concept_mastery")
      .select("mastery, next_review_at, concept_id, syllabus_nodes:syllabus_nodes!inner(title)")
      .eq("student_id", input.student_id).order("mastery", { ascending: true }).limit(50),
    supabase.from("mistakes")
      .select("concept_id, recurrence_count").eq("student_id", input.student_id).eq("status", "open"),
    supabase.from("spaced_items").select("concept_id")
      .eq("student_id", input.student_id)
      .lte("due_at", new Date(now.getTime() + 7 * 86_400_000).toISOString()).limit(200),
  ]);
  const mRows = (mastery ?? []) as unknown as {
    mastery: number; next_review_at: string | null; concept_id: string;
    syllabus_nodes: { title: string };
  }[];
  const recur = new Map<string, number>();
  for (const m of ((mistakes ?? []) as unknown as { concept_id: string | null; recurrence_count: number }[])) {
    if (m.concept_id) recur.set(m.concept_id, Math.max(recur.get(m.concept_id) ?? 0, m.recurrence_count ?? 1));
  }
  const dueSet = new Set(
    ((due ?? []) as unknown as { concept_id: string | null }[]).map((d) => d.concept_id).filter(Boolean),
  );

  const cands: PlanCandidate[] = mRows
    .filter((m) => m.concept_id)
    .map((m) => {
      const masteryN = Number(m.mastery ?? 0.3);
      const next = m.next_review_at ? new Date(m.next_review_at).getTime() : null;
      return {
        conceptId: m.concept_id,
        title: m.syllabus_nodes.title,
        weakness: Number((1 - masteryN).toFixed(3)),
        urgency: next == null ? 0.5 : next < now.getTime() ? 1 : next - now.getTime() < 3 * 86_400_000 ? 0.7 : 0.3,
        prereqImpact: 0.5, // ponytail: flat until concept graph edges exist
        retentionRisk: dueSet.has(m.concept_id) ? 1 : 0.4,
        scoreImpact: Math.min(1, (recur.get(m.concept_id) ?? 0) / 3),
        estimatedMin: 20,
      };
    });
  // mistake-only concepts with no mastery row yet
  const missing: { cid: string; n: number }[] = [];
  recur.forEach((n, cid) => {
    if (!cands.some((c) => c.conceptId === cid)) missing.push({ cid, n });
  });
  for (const { cid, n } of missing) {
    if (!cands.some((c) => c.conceptId === cid)) {
      cands.push({
        conceptId: cid, title: "Targeted repair", weakness: 0.8, urgency: 0.7,
        prereqImpact: 0.5, retentionRisk: dueSet.has(cid) ? 1 : 0.5,
        scoreImpact: Math.min(1, n / 3), estimatedMin: 20,
      });
    }
  }
  if (!cands.length) return badRequest("No learning signals yet — attempt a quiz first");

  const ranked = rankPlan(cands, input.budget_min);

  // replan: preserve high-value pending tasks from prior active plans
  const { data: priorPlans } = await supabase.from("study_plans")
    .select("id, version").eq("student_id", input.student_id).eq("status", "active").order("version", { ascending: false });
  const prior = (priorPlans ?? []) as unknown as { id: string; version: number }[];
  let kept = 0, dropped = 0;
  if (prior.length) {
    const priorIds = prior.map((p) => p.id);
    const { data: pending } = await supabase.from("plan_tasks")
      .select("id, priority, date, status").in("plan_id", priorIds).eq("status", "pending");
    const pend = (pending ?? []) as unknown as { id: string; priority: number; date: string }[];
    const today = now.toISOString().slice(0, 10);
    const missed = new Set(pend.filter((t) => t.date < today).map((t) => t.date)).size;
    const { keep, drop } = replan(
      pend.map((t) => ({ ...t, status: "pending" as const })), missed,
    );
    kept = keep.length;
    dropped = drop.length;
    const movedIds = [...keep, ...drop].map((t) => t.id);
    if (movedIds.length) {
      await supabase.from("plan_tasks").update({ status: "rescheduled" as never })
        .in("id", movedIds);
    }
    await supabase.from("study_plans").update({ status: "completed" as never }).in("id", priorIds);
  }
  const version = (prior[0]?.version ?? 0) + 1;

  const endDate = new Date(startMs + (input.days - 1) * 86_400_000).toISOString().slice(0, 10);
  const teacherId = context.role === "teacher"
    ? userId
    : context.accessibleStudents.find((s) => s.id === input.student_id)?.teacher_id ?? userId;
  const { data: plan, error: planErr } = await supabase.from("study_plans").insert({
    student_id: input.student_id, teacher_id: teacherId, title: input.title,
    start_date: start, end_date: endDate, target_score: input.target_score ?? null,
    status: "active" as never, version, generated_by: "deterministic",
  }).select("id, version, start_date, end_date").single();
  if (planErr || !(plan as { id?: string } | null)?.id) {
    return NextResponse.json({ error: "Could not create plan" }, { status: 500 });
  }
  const planId = (plan as { id: string }).id;

  const rows = ranked.map((c, i) => ({
    plan_id: planId,
    student_id: input.student_id,
    date: new Date(startMs + (i % input.days) * 86_400_000).toISOString().slice(0, 10),
    concept_id: c.conceptId,
    task_type: c.retentionRisk >= 0.9 ? "review" : c.scoreImpact > 0 ? "drill" : "practice",
    estimated_min: c.estimatedMin,
    priority: c.priority,
    status: "pending" as never,
    source: "planner-v1",
  }));
  const { data: tasks, error: taskErr } = await supabase.from("plan_tasks")
    .insert(rows).select("id, date, concept_id, task_type, estimated_min, priority, status");
  if (taskErr) return NextResponse.json({ error: "Plan created but tasks failed", plan_id: planId }, { status: 500 });

  await logUsage(supabase, {
    user_id: userId, student_id: input.student_id, tier: "deterministic",
    model: "planner-v1", endpoint: "/api/plans/generate",
    input_tokens: cands.length, output_tokens: rows.length, cost_usd: 0,
  });
  await logAudit(supabase, {
    actor_id: userId, action: "plan.generated", entity: "study_plans",
    entity_id: planId, metadata: { version, tasks: rows.length, kept, dropped },
  });
  await logEvent(supabase, input.student_id, "plan_generated", { plan_id: planId, version });

  return NextResponse.json(
    { plan, tasks: tasks ?? [], kept_prior_tasks: kept, rescheduled_prior_tasks: dropped },
    { status: 201 },
  );
}
