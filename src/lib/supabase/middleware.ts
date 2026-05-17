import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/env";

const PUBLIC_AUTH_PATHS = new Set(["/login", "/signup"]);

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const { url, anonKey } = getSupabaseConfig();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPortalPath = path.startsWith("/app");
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.has(path);

  if (isPortalPath && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isPublicAuthPath) {
    return NextResponse.redirect(new URL("/app/dashboard", request.url));
  }

  return response;
}
