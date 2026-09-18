import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runRiskSentinel } from "@/lib/agents/risk-sentinel";

export const dynamic = "force-dynamic";

// Nightly risk-sentinel run (guide A10): computes weighted risk in code and
// flags drifted students as ops tasks. L0 to act — never messages anyone.
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
    const { flagged, tasksCreated } = await runRiskSentinel(supabase);
    return NextResponse.json({ success: true, flagged, tasksCreated });
  } catch (err) {
    console.error("Unhandled error in risk-sentinel cron:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
