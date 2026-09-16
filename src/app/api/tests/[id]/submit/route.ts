import { NextResponse } from "next/server";
import { submitSchema } from "@/lib/ai/schemas";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitAssessment } from "@/lib/ai/grade-attempt";

export const dynamic = "force-dynamic";

// Alias: POST /api/tests/:id/submit → same engine, :id is the assessment id.
// Legacy flat tests table (marks/total) is preserved and untouched.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const parsed = submitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request", parsed.error.flatten());
  const input = parsed.data;
  const { error, context } = await requireStudentAccess(input.student_id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const res = await submitAssessment(supabase, {
    assessmentId: params.id, studentId: input.student_id, userId: context.user.id, responses: input.responses,
  });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ attempt_id: res.attemptId, score: res.score, total: res.total }, { status: 201 });
}
