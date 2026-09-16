import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStudentAccess } from "@/lib/ai/guard";

export const dynamic = "force-dynamic";

// GET /api/students/:id/mistakes — Mistake Book 2.0 list (?status=open).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { error, context } = await requireStudentAccess(params.id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = new URL(request.url).searchParams.get("status") ?? "open";
  const supabase = createSupabaseServerClient();
  let q = supabase.from("mistakes").select("*").eq("student_id", params.id)
    .order("recurrence_count", { ascending: false }).limit(50);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return NextResponse.json({ student_id: params.id, mistakes: data ?? [] });
}
