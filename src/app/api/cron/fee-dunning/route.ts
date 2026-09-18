import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runFeeDunning } from "@/lib/agents/fee-dunning-agent";

export const dynamic = "force-dynamic";

// Daily fee-dunning draft run (control plane, L3): drafts approvals for
// steps 1–2, escalates step 3 to an ops task. Never sends directly.
export async function GET(request: Request) {
  // Fail closed: without CRON_SECRET this route must not open (copy of
  // the monday-sync pattern — Bearer secret, Vercel cron header accepted).
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
    const { drafted, escalated } = await runFeeDunning(supabase);
    return NextResponse.json({ success: true, drafted, escalated });
  } catch (err) {
    console.error("Unhandled error in fee-dunning cron:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
