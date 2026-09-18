"use client";

// Session guardian — keeps users signed in across restarts (web + Capacitor
// WebView) without ever asking them to log in again.
//
// Why it exists: supabase-js auto-refreshes on a timer, but backgrounded
// tabs/WebViews throttle timers, so a user returning after hours can hold a
// stale access token while the middleware (cookie-local getSession) lets
// them through and a downstream getUser is still mid-refresh. This component:
//  - ensures exactly one auto-refresher runs (singleton browser client),
//  - proactively refreshes via getUser() whenever the app returns to the
//    foreground or regains connectivity, then revalidates server components,
//  - on a genuine SIGNED_OUT inside /app/*, revalidates via the server
//    (router.refresh) instead of trusting possibly-stale client state — the
//    middleware then routes to /login only if the session is truly gone.
//
// Never calls stopAutoRefresh on cleanup: the client is a process-wide
// singleton, and stopping the timer on a remount would silently disable
// background refresh for the whole app.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SessionGuardian() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.startAutoRefresh();

    // getUser() hits the network and rotates a stale token pair; getSession()
    // would not — it only reads local storage and can return an expired token.
    const recheck = () => {
      if (document.visibilityState === "visible") {
        void supabase.auth.getUser().finally(() => router.refresh());
      }
    };
    const recheckOnFocus = () => {
      void supabase.auth.getUser().finally(() => router.refresh());
    };

    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheckOnFocus);
    window.addEventListener("online", recheckOnFocus);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        router.refresh();
      } else if (event === "SIGNED_OUT" && window.location.pathname.startsWith("/app")) {
        router.refresh();
      }
    });

    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheckOnFocus);
      window.removeEventListener("online", recheckOnFocus);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return null;
}
