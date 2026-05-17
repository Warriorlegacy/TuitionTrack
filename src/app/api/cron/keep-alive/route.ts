import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Force dynamic rendering to prevent Next.js from caching this API route
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  
  // Secure the cron endpoint by validating the Vercel CRON_SECRET if it's configured
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase credentials are not configured in environment variables" },
      { status: 500 }
    );
  }

  try {
    // Connect to the Supabase database using the client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Query the users table with a limit of 1 to trigger database activity.
    // This simple, lightweight request keeps the Supabase project active and prevents auto-pausing.
    const { error } = await supabase
      .from("users")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Keep-alive database query failed:", error);
      return NextResponse.json(
        { error: "Database query failed", details: error.message },
        { status: 500 }
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
      { status: 500 }
    );
  }
}
