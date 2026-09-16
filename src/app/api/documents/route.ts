import { NextResponse } from "next/server";
import { documentSchema } from "@/lib/ai/schemas";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { getAuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, logUsage, logEvent } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

// POST /api/documents — validate + register source (malware/OCR/storage next;
// MVP accepts inline text so the loop is testable without buckets).
export async function POST(request: Request) {
  const parsed = documentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request", parsed.error.flatten());
  const input = parsed.data;
  const gated = input.student_id
    ? await requireStudentAccess(input.student_id)
    : { error: null as null, context: await getAuthContext() };
  const { error, context } = gated;
  if (error || !context?.user)
    return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const userId = context?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit(supabase, userId, "/api/documents");
  if (!rl.ok) return NextResponse.json({ error: rl.reason }, { status: 429 });

  // file validation gate (#10 step 2): type + size on inline content
  if (input.content.length < 50)
    return badRequest("Content too short to ingest (min 50 chars)");
  const { data: doc, error: insErr } = await supabase.from("documents").insert({
    teacher_id: userId, student_id: input.student_id ?? null,
    title: input.title, source_type: input.source_type, status: "uploaded" as never,
    language: input.language, metadata: { chars: input.content.length, inline: true },
  }).select("id, title, status").single();
  if (insErr || !doc?.id) return NextResponse.json({ error: "Could not save document" }, { status: 500 });

  // stash raw text in metadata-adjacent chunks table on /process; keep POST light
  await supabase.from("documents").update({ metadata: { chars: input.content.length, inline: true, raw: input.content.slice(0, 60000) } }).eq("id", doc.id);
  if (input.student_id) await logEvent(supabase, input.student_id, "document_uploaded", { document_id: doc.id });
  await logUsage(supabase, {
    user_id: userId, student_id: input.student_id ?? null, tier: "deterministic",
    model: "deterministic-v1", endpoint: "/api/documents",
    input_tokens: Math.ceil(input.content.length / 4), output_tokens: 0, cost_usd: 0,
  });
  return NextResponse.json({ ...doc, next: `/api/documents/${doc.id}/process` }, { status: 201 });
}
