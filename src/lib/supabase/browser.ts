import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import { getSupabaseConfig } from "@/lib/supabase/env";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createSupabaseBrowserClient() {
  if (client) return client;

  const { url, anonKey } = getSupabaseConfig();
  client = createBrowserClient<Database>(url, anonKey);
  return client;
}
