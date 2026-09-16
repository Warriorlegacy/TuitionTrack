import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

const eventSchema = z.object({
  event_type: z.string().regex(/^[a-z_]{1,64}$/),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

// POST /api/students/:id/events — client analytics for the Today/Progress slice
// (syllabus_viewed, mastery_moved, revision_completed). Best-effort, never 500s learning.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid event", parsed.error.flatten());
  const { error, context } = await requireStudentAccess(params.id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await logEvent(createSupabaseServerClient(), params.id, parsed.data.event_type, parsed.data.payload);
  return NextResponse.json({ ok: true });
}
