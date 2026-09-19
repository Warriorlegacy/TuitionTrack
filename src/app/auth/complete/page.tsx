"use client";

// OAuth completion hop — fixes the Google sign-in redirect loop.
//
// The callback route sets the session cookies and redirects here. Because a
// redirect's `Set-Cookie` is only committed once the browser receives the
// response, sending the user straight to /app/dashboard raced the cookie write:
// middleware ran the destination request with no session and bounced the
// freshly-authenticated user back to /login. Intermittent by nature, which is
// what made Google sign-in feel flaky.
//
// This page exists to be *rendered* — establishing the document where cookies
// are committed — and only then performs a client-side navigation. The
// destination request is therefore a normal document request that carries the
// session. It also gives the OAuth round-trip a visible progress surface, so
// the user sees "signing you in" instead of a blank screen or a stall.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// Two rAFs then a macrotask: enough for the browser to commit the Set-Cookie
// headers that arrived with the redirect, without an arbitrary sleep.
function afterCookieCommit(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 60)));
  });
}

export default function AuthCompletePage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const rawNext = params.get("next") ?? "/app/dashboard";
      // Same open-redirect guard as the callback route.
      const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app/dashboard";

      await afterCookieCommit();
      if (cancelled) return;

      // Confirm the browser can actually read the session before navigating.
      // If it cannot, the honest outcome is an error message — not a bounce to
      // /login that looks like the user typed the wrong password.
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          // One more grace period: some browsers apply cookies a beat later.
          await new Promise((r) => setTimeout(r, 400));
          const retry = await supabase.auth.getSession();
          if (!retry.data.session) {
            if (!cancelled) {
              setMessage("We could not finish signing you in.");
              setFailed(true);
              setTimeout(() => router.replace("/login?error=session_not_established"), 1400);
            }
            return;
          }
        }
      } catch {
        // A client-side read failure must not block a session the server may
        // still accept — proceed to the destination and let it decide.
      }

      if (cancelled) return;
      setMessage("Almost there…");
      // replace(), not push(): the hop should not appear in the back stack.
      router.replace(next);
      router.refresh();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {failed ? null : (
          <Loader2Icon aria-hidden="true" className="size-8 animate-spin text-slate-400" />
        )}
        <p aria-live="polite" className="text-sm font-medium text-slate-700">
          {message}
        </p>
        <p className="text-xs text-slate-500">
          {failed
            ? "If this keeps happening, try signing in with your email and password instead."
            : "Setting up your secure session."}
        </p>
      </div>
    </main>
  );
}
