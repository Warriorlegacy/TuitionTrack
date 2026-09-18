import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/env";
import type { Database } from "@/lib/db/types";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  // Only allow same-origin relative redirects — `new URL(userInput, base)`
  // would follow "//evil.com" off-site (open redirect).
  const rawNext = request.nextUrl.searchParams.get("next") ?? "/app/dashboard";
  const redirectPath =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app/dashboard";
  let response = NextResponse.redirect(new URL(redirectPath, request.url));

  if (!code) {
    return response;
  }

  const { url, anonKey } = getSupabaseConfig();
  // Every cookie written during the exchange, replayed onto whichever
  // redirect is ultimately returned (reassigning the response object below
  // would otherwise silently drop the fresh session → instant "logout").
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
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    const email = user.email.toLowerCase();
    let role = user.user_metadata?.role;

    // Automatic Role Detection if not explicitly set to parent/student
    if (role !== "parent" && role !== "student") {
      const { data: parentMatch } = await supabase
        .from("students")
        .select("id")
        .ilike("parent_email", email)
        .limit(1)
        .maybeSingle();

      if (parentMatch) {
        role = "parent";
      } else {
        const { data: studentMatch } = await supabase
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

    const { data: existingProfile } = await supabase
      .from("users")
      .select("id, name")
      .eq("id", user.id)
      .maybeSingle();

    await supabase.from("users").upsert({
      id: user.id,
      email: email,
      name: existingProfile?.name ?? user.user_metadata?.name ?? null,
      role: role as Database["public"]["Enums"]["user_role"],
    });

    if (!existingProfile?.name && role === "teacher") {
      const onboarding = NextResponse.redirect(new URL("/auth/onboarding", request.url));
      for (const c of appliedCookies) {
        onboarding.cookies.set(
          c.name,
          c.value,
          c.options as Parameters<NextResponse["cookies"]["set"]>[2],
        );
      }
      response = onboarding;
    }
  }

  return response;
}
