import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, AppRole } from "@/lib/db/types";

function getRedirectOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  const host = request.headers.get("host");
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    return `https://${host}`;
  }
  const origin = request.nextUrl.origin;
  if (process.env.NODE_ENV === "production" && origin.startsWith("http://")) {
    return origin.replace("http://", "https://");
  }
  return origin;
}

export async function GET(request: NextRequest) {
  const origin = getRedirectOrigin(request);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const code = request.nextUrl.searchParams.get("code");
  const errorParam = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");

  if (errorParam || errorDescription) {
    console.error("[auth/callback] OAuth provider error:", errorParam, errorDescription);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(errorDescription || errorParam || "oauth_failed")}`,
        origin
      )
    );
  }

  // Only allow same-origin relative redirects — `new URL(userInput, base)`
  // would follow "//evil.com" off-site (open redirect).
  const rawNext = request.nextUrl.searchParams.get("next") ?? "/app/dashboard";
  const redirectPath =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app/dashboard";
  const targetUrl = new URL(redirectPath, origin);
  const response = NextResponse.redirect(targetUrl);

  if (!code) {
    return response;
  }

  const { url, anonKey } = getSupabaseConfig();
  // Every cookie written during the exchange, replayed onto the redirect response.
  const appliedCookies: { name: string; value: string; options?: object }[] = [];
  const supabase = createServerClient<Database, "public">(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        appliedCookies.push(...cookiesToSet);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)
    );
  }

  // Ensure all cookies set during the session exchange are attached to response
  for (const c of appliedCookies) {
    response.cookies.set(
      c.name,
      c.value,
      c.options as Parameters<NextResponse["cookies"]["set"]>[2]
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    const email = user.email.toLowerCase();

    // Resolve name from Google OAuth (Google OpenID metadata uses full_name and/or name)
    const metaName =
      (user.user_metadata?.full_name as string | undefined)?.trim() ||
      (user.user_metadata?.name as string | undefined)?.trim() ||
      (user.user_metadata?.preferred_username as string | undefined)?.trim() ||
      email.split("@")[0];

    try {
      const admin = createSupabaseAdminClient();

      const { data: existingProfile } = await admin
        .from("users")
        .select("id, name, role")
        .eq("id", user.id)
        .maybeSingle();

      const queryRole = request.nextUrl.searchParams.get("signupRole") as AppRole | null;
      let role: AppRole =
        (existingProfile?.role as AppRole) ||
        (queryRole && (queryRole === "teacher" || queryRole === "parent" || queryRole === "student")
          ? queryRole
          : (null as unknown as AppRole)) ||
        (user.user_metadata?.role as AppRole);

      // Automatic Role Detection if not already assigned
      if (role !== "parent" && role !== "student" && role !== "teacher") {
        const { data: parentMatch } = await admin
          .from("students")
          .select("id")
          .ilike("parent_email", email)
          .limit(1)
          .maybeSingle();

        if (parentMatch) {
          role = "parent";
        } else {
          const { data: studentMatch } = await admin
            .from("students")
            .select("id")
            .ilike("student_email", email)
            .limit(1)
            .maybeSingle();

          if (studentMatch) {
            role = "student";
          } else {
            role = "teacher";
          }
        }
      }

      const finalName = existingProfile?.name?.trim() || metaName;

      await admin.from("users").upsert({
        id: user.id,
        email: email,
        name: finalName,
        role: role as Database["public"]["Enums"]["user_role"],
        updated_at: new Date().toISOString(),
      });
    } catch (dbErr) {
      console.error("[auth/callback] Error syncing profile in DB:", dbErr);
    }
  }

  // Everyone redirects directly to targetUrl (/app/dashboard or requested next page)
  return response;
}
