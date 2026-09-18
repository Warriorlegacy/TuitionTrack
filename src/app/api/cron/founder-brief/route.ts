import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildFounderBrief } from "@/lib/agents/founder-brief";

export const dynamic = "force-dynamic";

// Daily 06:30 founder brief (guide A12): five-line markdown for the tutor.
// L4, messages only the tutor — the markdown is returned here and logged to
// agent_runs inside the builder (wiring it to an outbox 'self' message is a
// follow-up once the tutor phone is configured).
export async function GET(request: Request) {
  // Fail closed: without CRON_SECRET this route must not open (copy of
  // the fee-dunning pattern — Bearer secret, Vercel cron header accepted).
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const authorized =
    request.headers.get("Authorization") === `Bearer ${cronSecret}` ||
    request.headers.get("x-vercel-cron") === "1";
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  try {
    const { markdown, counts } = await buildFounderBrief(supabase);
    return NextResponse.json({ success: true, brief: markdown, counts });
  } catch (err) {
    console.error("Unhandled error in founder-brief cron:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
