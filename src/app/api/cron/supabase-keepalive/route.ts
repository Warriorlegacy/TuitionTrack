import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }

  const timestamp = new Date().toISOString();

  try {
    const { error } = await supabase
      .from("users")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Supabase keepalive query failed:", error);
      return NextResponse.json(
        { error: "Database query failed", details: error.message },
        { status: 500 }
      );
    }

    console.log(`[supabase-keepalive] ping at ${timestamp}`);
    return NextResponse.json({
      success: true,
      message: "Supabase keepalive ping completed successfully.",
      timestamp,
      active: true,
    });
  } catch (err) {
    console.error("Unhandled error in supabase-keepalive cron:", err);
    return NextResponse.json(
      { error: "Unhandled internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
