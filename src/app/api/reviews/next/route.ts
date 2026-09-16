import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const nextSchema = z.object({ student_id: z.string().uuid(), limit: z.number().int().min(1).max(20).default(10) });

// POST /api/reviews/next — due cards (FSRS-lite by due_at).
export async function POST(request: Request) {
  const parsed = nextSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request", parsed.error.flatten());
  const { error, context } = await requireStudentAccess(parsed.data.student_id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("spaced_items").select("id, front, back, stability, difficulty, state, due_at, concept_id")
    .eq("student_id", parsed.data.student_id).lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true }).limit(parsed.data.limit);
  return NextResponse.json({ due: data ?? [], count: data?.length ?? 0 });
}
