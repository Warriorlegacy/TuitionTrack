import { NextResponse } from "next/server";
import { submitSchema } from "@/lib/ai/schemas";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitAssessment } from "@/lib/ai/grade-attempt";

export const dynamic = "force-dynamic";

async function handle(request: Request, assessmentId: string) {
  const parsed = submitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request", parsed.error.flatten());
  const input = parsed.data;
  const { error, context } = await requireStudentAccess(input.student_id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data: a } = await supabase.from("assessments").select("id, status").eq("id", assessmentId).maybeSingle();
  if (!a) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  const res = await submitAssessment(supabase, {
    assessmentId, studentId: input.student_id, userId: context.user.id, responses: input.responses,
  });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json(
    { attempt_id: res.attemptId, status: "submitted", total: res.total, message: "Submitted — awaiting teacher review." },
    { status: 201 },
  );
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return handle(request, params.id);
}
