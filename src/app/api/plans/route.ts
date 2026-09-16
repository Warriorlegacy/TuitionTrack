import { NextResponse } from "next/server";
import { planTaskUpdateSchema } from "@/lib/ai/schemas";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

// Planner read-path (blueprint #18, #55, #69).
// POST /api/plans/generate wrote study_plans + plan_tasks but nothing ever read
// them back, so the plan was invisible to the student. This route is the reader:
//   GET   /api/plans?student_id=…[&plan_id=…]  → active (or newest) plan + tasks
//   PATCH /api/plans                            → task status pending/done/skipped
// No AI spend here — both paths are deterministic, so no rate limit/budget call.

type TaskRow = {
  id: string;
  plan_id: string;
  date: string;
  concept_id: string | null;
  task_type: string;
  estimated_min: number;
  priority: number;
  status: string;
  source: string | null;
};

type PlanRow = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  target_score: number | null;
  status: string;
  version: number;
  generated_by: string;
  created_at: string;
};

const todayUtc = () => new Date().toISOString().slice(0, 10);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get("student_id");
  if (!studentId) return badRequest("student_id required");

  const { error, context } = await requireStudentAccess(studentId);
  if (error || !context?.user) {
    return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createSupabaseServerClient();

  const { data: planRows, error: planErr } = await supabase
    .from("study_plans")
    .select("id, title, start_date, end_date, target_score, status, version, generated_by, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 });

  const plans = (planRows ?? []) as unknown as PlanRow[];
  if (plans.length === 0) return NextResponse.json({ plan: null, tasks: [], stats: null, today: todayUtc() });

  const requestedId = url.searchParams.get("plan_id");
  const plan =
    plans.find((p) => p.id === requestedId) ??
    plans.find((p) => p.status === "active") ??
    plans[0];

  const { data: taskRows, error: taskErr } = await supabase
    .from("plan_tasks")
    .select("id, plan_id, date, concept_id, task_type, estimated_min, priority, status, source")
    .eq("plan_id", plan.id)
    .eq("student_id", studentId)
    .order("date", { ascending: true })
    .order("priority", { ascending: false });
  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });

  const tasks = (taskRows ?? []) as unknown as TaskRow[];

  // Resolve concept titles with a second query instead of a PostgREST embed so a
  // missing/renamed relationship can't 500 the whole plan view.
  const conceptIds = Array.from(new Set(tasks.map((t) => t.concept_id).filter((v): v is string => !!v)));
  const titleById = new Map<string, string>();
  if (conceptIds.length) {
    const { data: nodes } = await supabase
      .from("syllabus_nodes")
      .select("id, title")
      .in("id", conceptIds);
    for (const n of ((nodes ?? []) as unknown as { id: string; title: string }[])) {
      titleById.set(n.id, n.title);
    }
  }

  const today = todayUtc();
  const shaped = tasks.map((t) => ({
    id: t.id,
    date: t.date,
    concept_id: t.concept_id,
    concept_title: t.concept_id ? titleById.get(t.concept_id) ?? "Concept" : "Untitled task",
    task_type: t.task_type,
    estimated_min: t.estimated_min,
    priority: Number(t.priority),
    status: t.status,
    source: t.source,
  }));

  const plannedMin = shaped.reduce((s, t) => s + (t.estimated_min || 0), 0);
  const done = shaped.filter((t) => t.status === "done");
  const stats = {
    total: shaped.length,
    done: done.length,
    skipped: shaped.filter((t) => t.status === "skipped").length,
    pending: shaped.filter((t) => t.status === "pending").length,
    planned_min: plannedMin,
    completed_min: done.reduce((s, t) => s + (t.estimated_min || 0), 0),
    today_min: shaped
      .filter((t) => t.date === today && t.status === "pending")
      .reduce((s, t) => s + (t.estimated_min || 0), 0),
    today_tasks: shaped.filter((t) => t.date === today).length,
  };

  return NextResponse.json({
    plan: {
      id: plan.id,
      title: plan.title,
      start_date: plan.start_date,
      end_date: plan.end_date,
      target_score: plan.target_score == null ? null : Number(plan.target_score),
      status: plan.status,
      version: plan.version,
      generated_by: plan.generated_by,
    },
    tasks: shaped,
    stats,
    today,
  });
}

export async function PATCH(request: Request) {
  const parsed = planTaskUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request", parsed.error.flatten());
  const input = parsed.data;

  const { error, context } = await requireStudentAccess(input.student_id);
  if (error || !context?.user) {
    return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createSupabaseServerClient();

  // RLS already scopes plan_tasks to accessible students; the explicit
  // student_id filter is defence in depth against a mismatched task_id.
  const { data, error: upErr } = await supabase
    .from("plan_tasks")
    .update({ status: input.status })
    .eq("id", input.task_id)
    .eq("student_id", input.student_id)
    .select("id, date, status, estimated_min")
    .maybeSingle();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  await logEvent(supabase, input.student_id, `plan_task_${input.status}`, {
    task_id: input.task_id,
  });

  return NextResponse.json({ task: data });
}
