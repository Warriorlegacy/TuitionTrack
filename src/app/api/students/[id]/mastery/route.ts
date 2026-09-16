import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStudentAccess } from "@/lib/ai/guard";

export const dynamic = "force-dynamic";

// GET /api/students/:id/mastery — concept mastery list (powers heatmap next).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { error, context } = await requireStudentAccess(params.id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("concept_mastery")
    .select("mastery, attempt_count, correct_count, streak, last_practiced_at, next_review_at, concept_id, syllabus_nodes:syllabus_nodes!inner(title, level)")
    .eq("student_id", params.id).order("mastery", { ascending: true });
  return NextResponse.json({ student_id: params.id, mastery: data ?? [] });
}
