import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Daily keep-alive ping. Fails closed: without CRON_SECRET the spoofable
// x-vercel-cron header must not open the route (same policy as the other
// /api/cron/* routes).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase credentials are not configured in environment variables" },
      { status: 500 },
    );
  }

  try {
    // Lightweight read against `users` keeps the free-tier project from
    // auto-pausing due to inactivity.
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.from("users").select("id").limit(1);

    if (error) {
      console.error("Keep-alive database query failed:", error);
      return NextResponse.json(
        { error: "Database query failed", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Supabase keep-alive check completed successfully.",
      timestamp: new Date().toISOString(),
      active: true,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Unhandled error in keep-alive cron job:", err);
    return NextResponse.json(
      { error: "Unhandled internal server error", details: errorMessage },
      { status: 500 },
    );
  }
}
