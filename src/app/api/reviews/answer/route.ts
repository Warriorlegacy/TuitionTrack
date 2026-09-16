import { NextResponse } from "next/server";
import { reviewAnswerSchema } from "@/lib/ai/schemas";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scheduleReview } from "@/lib/ai/fsrs-lite";
import { logEvent } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

// POST /api/reviews/answer — grade 1..4 → reschedule + log (answer-before-reveal enforced client-side).
export async function POST(request: Request) {
  const parsed = reviewAnswerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request", parsed.error.flatten());
  const input = parsed.data;
  const { error, context } = await requireStudentAccess(input.student_id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data: item } = await supabase.from("spaced_items").select("*")
    .eq("id", input.spaced_item_id).eq("student_id", input.student_id).maybeSingle();
  if (!item) return NextResponse.json({ error: "Card not found" }, { status: 404 });
  const it = item as { stability: number; difficulty: number; state: string; lapse_count: number };
  const r = scheduleReview(
    { stability: Number(it.stability), difficulty: Number(it.difficulty), state: it.state, lapseCount: it.lapse_count },
    input.grade as 1 | 2 | 3 | 4,
  );
  await supabase.from("spaced_items").update({
    stability: r.stability, difficulty: r.difficulty, due_at: r.dueAt.toISOString(),
    state: r.state as never, lapse_count: it.lapse_count + (input.grade === 1 ? 1 : 0),
    last_reviewed_at: new Date().toISOString(),
  }).eq("id", input.spaced_item_id);
  await supabase.from("review_events").insert({
    spaced_item_id: input.spaced_item_id, student_id: input.student_id,
    grade: input.grade, response_ms: input.response_ms ?? null, scheduled_days: r.scheduledDays,
  });
  await logEvent(supabase, input.student_id, "card_reviewed", { spaced_item_id: input.spaced_item_id, grade: input.grade });
  return NextResponse.json({ due_at: r.dueAt.toISOString(), scheduled_days: r.scheduledDays, state: r.state });
}
