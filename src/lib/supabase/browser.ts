import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import { getSupabaseConfig } from "@/lib/supabase/env";

type BrowserClient = ReturnType<typeof createBrowserClient<Database>>;

// HMR-safe singleton (module scope is reset by Fast Refresh in dev).
const globalForSupabase = globalThis as unknown & {
  __tuitionTrackSupabase?: BrowserClient;
};

export function createSupabaseBrowserClient(): BrowserClient {
  if (globalForSupabase.__tuitionTrackSupabase) {
    return globalForSupabase.__tuitionTrackSupabase;
  }

  const { url, anonKey } = getSupabaseConfig();
  // Stay-signed-in contract: persist to cookies, auto-refresh in background,
  // PKCE flow. Singleton so exactly one refresher runs — two clients would
  // race token rotation and log the user out.
  const client = createBrowserClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
    // Explicit long-lived cookie defaults so the session survives app
    // restarts (web + Capacitor WebView) instead of becoming session-only.
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    },
  });
  globalForSupabase.__tuitionTrackSupabase = client;
  return client;
}
