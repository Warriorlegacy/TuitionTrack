const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Supabase's current API-key model issues `sb_secret_…` keys, which replace the
// legacy service_role JWT. Prefer the new key when both are present: a stale
// legacy value exported in the shell previously shadowed .env.local and made
// every privileged call 401 with "Invalid API key".
const supabaseServiceKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseConfig() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local.",
    );
  }

  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  };
}

export function isServiceConfigured() {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

/**
 * Server-only privileged key. Never import this into a client component —
 * it bypasses Row Level Security for every tenant.
 */
export function getServiceConfig() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY. " +
        "Add one to .env.local — server-side cron and admin jobs need it.",
    );
  }

  return { url: supabaseUrl, serviceKey: supabaseServiceKey };
}
