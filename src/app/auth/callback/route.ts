import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, AppRole } from "@/lib/db/types";

function getRedirectOrigin(request: NextRequest): string {
  // `x-forwarded-host` is attacker-controllable on Vercel, and a wrong host here
  // writes the session cookie against the wrong domain — the user is then
  // "logged in" to a host the app never reads again, which presents as a silent
  // logout. So the canonical origin is preferred, in this order:
  //
  //   1. the actual request host, when running locally — otherwise a dev server
  //      would bounce sign-ins to the production domain and the session cookie
  //      would be written for the wrong host;
  //   2. NEXT_PUBLIC_APP_URL — the canonical deployed origin;
  //   3. the platform-provided production host;
  //   4. the request origin as a last resort.
  const host = request.headers.get("host") ?? "";
  const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  if (isLocalHost) {
    const proto = request.nextUrl.protocol.replace(":", "") || "http";
    return `${proto}://${host}`;
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prodHost) return `https://${prodHost}`;

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

  // ── The cookie race, and why this redirects to /auth/complete instead ──
  //
  // A redirect carrying `Set-Cookie` is committed by the browser only after it
  // receives the response. The follow-up request for the destination arrives at
  // middleware before those cookies are applied, so middleware sees no session
  // and 307s the freshly-logged-in user back to /login. The race is timing
  // dependent, which is why Google sign-in worked sometimes and not others.
  //
  // Routing through a client-side hop fixes it structurally: the browser fully
  // commits the cookies while rendering /auth/complete, then navigates with
  // `location.replace`, so the destination request is a real document request
  // that carries the session.
  const completeUrl = new URL("/auth/complete", origin);
  completeUrl.searchParams.set("next", redirectPath);
  const response = NextResponse.redirect(completeUrl);

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

  // The response already points at /auth/complete (see the cookie-race note
  // above). /auth/complete loads in the browser, the session cookies are
  // committed, and it then navigates client-side to the real destination.
  return response;
}
