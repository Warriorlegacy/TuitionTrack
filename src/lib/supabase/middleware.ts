import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/env";

// Paths that must never be gated and must never trigger the signed-in
// redirect. `/auth/*` is included deliberately: the OAuth callback and the
// post-callback hop both set/read cookies, and routing them through the
// "already signed in → go to dashboard" branch would interrupt an in-flight
// exchange. `/auth/complete` in particular is the page that exists to let the
// browser commit those cookies — it must be reachable regardless of session
// state, or the login loop returns.
const PUBLIC_AUTH_PATHS = new Set(["/login", "/signup"]);
const PUBLIC_AUTH_PREFIXES = ["/auth/"];

/**
 * Session middleware — stay-signed-in edition.
 *
 * Past auto-logout incidents and why this looks the way it does:
 *
 * 1. Refresh-token race (the big one). The old version called `getUser()` on
 *    EVERY request. getUser hits Supabase Auth and rotates the refresh token
 *    when the access token is stale. Two concurrent requests in that window
 *    both tried to rotate: the loser got "Invalid Refresh Token: Already
 *    Used", its response cleared the auth cookies, and — depending on which
 *    response landed last — the user was logged out. Routing on getSession()
 *    instead performs zero network calls and zero rotation: the browser
 *    client (single tab, Navigator-Lock protected) owns refreshing.
 *
 * 2. Dropped Set-Cookie on redirects. Rotation responses attached refreshed
 *    cookies to one NextResponse but returned a different one for redirects,
 *    silently dropping them. Every return path still flows through
 *    withCookies(), which replays pending writes onto the response sent.
 *
 * 3. Auth blips. Free-tier cold starts / network hiccups used to read as
 *    "logged out" and bounce users to /login. getSession() only reads
 *    cookies, so a down Auth server can no longer log anyone out; the
 *    downstream getUser() in pages either succeeds or redirects then.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const { url, anonKey } = getSupabaseConfig();

  // Pending cookie writes from auth refresh/sign-out. Applied to whichever
  // response is ultimately returned (next, redirect, or rewrite).
  const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];

  const withCookies = (res: NextResponse): NextResponse => {
    for (const c of pendingCookies) {
      res.cookies.set(c.name, c.value, c.options as Parameters<NextResponse["cookies"]["set"]>[2]);
    }
    return res;
  };

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Accumulate (never overwrite): multiple rotations in one request
        // must all reach the response, or a dropped refresh logs the user out.
        pendingCookies.push(...cookiesToSet);
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Cookie-local read: no network, no rotation, no logout-on-blip.
  // A present session may hold an expired access token — downstream
  // getUser() calls refresh it on demand (single call, no race).
  // Never throw: a middleware crash is a 500 for every route, so on any
  // unexpected failure pass through and let the page decide.
  let session: { user?: unknown } | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    session = data.session;
  } catch {
    return withCookies(response);
  }

  const path = request.nextUrl.pathname;
  const isPortalPath = path.startsWith("/app");
  const isPublicAuthPath =
    PUBLIC_AUTH_PATHS.has(path) || PUBLIC_AUTH_PREFIXES.some((p) => path.startsWith(p));

  if (isPortalPath && !session) {
    // Preserve the destination so an expired session returns the user to where
    // they were, instead of dumping them on the dashboard after re-auth.
    const loginUrl = new URL("/login", request.url);
    const target = path + (request.nextUrl.search ?? "");
    if (target && target !== "/app/dashboard") loginUrl.searchParams.set("next", target);
    return withCookies(NextResponse.redirect(loginUrl));
  }

  if (session && isPublicAuthPath) {
    return withCookies(NextResponse.redirect(new URL("/app/dashboard", request.url)));
  }

  return withCookies(response);
}
