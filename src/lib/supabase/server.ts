import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/env";

export function createSupabaseServerClient(): SupabaseClient<Database, "public"> {
  const cookieStore = cookies();
  const { url, anonKey } = getSupabaseConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component (cookie writes are only allowed in
          // Server Actions / Route Handlers). Safe to ignore: the middleware
          // refreshes sessions before RSCs render, so this is a no-op fallback.
        }
      },
    },
  });
}
