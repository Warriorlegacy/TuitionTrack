import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { getServiceConfig } from "@/lib/supabase/env";

/**
 * Privileged Supabase client for cron/background jobs (blueprint #55, #63).
 *
 * Uses the secret key, which BYPASSES Row Level Security — every query must be
 * scoped explicitly by the caller. Server-only: never reachable from the client
 * bundle. Prefer `createSupabaseServerClient()` (RLS-enforced) for anything
 * driven by a logged-in user.
 */
export function createSupabaseAdminClient(): SupabaseClient<Database, "public"> {
  // No `server-only` dependency in this project, so fail loudly if this module
  // ever ends up in a client bundle — the key must never leave the server.
  if (typeof window !== "undefined") {
    throw new Error("createSupabaseAdminClient() must never run in the browser.");
  }

  const { url, serviceKey } = getServiceConfig();

  return createClient<Database, "public">(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
