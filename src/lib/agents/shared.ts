import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

export type Db = SupabaseClient<Database, "public">;

export type OrgLookup = { org_id: string | null; teacher_id: string };

// Legacy students carry no org_id — fall back to the teacher's org.
// (Same pattern as fee-dunning-agent; shared so new agents reuse it.)
export async function resolveOrgId(supabase: Db, s: OrgLookup): Promise<string | null> {
  if (s.org_id) return s.org_id;
  const { data } = await supabase
    .from("orgs")
    .select("id")
    .eq("created_by", s.teacher_id)
    .limit(1)
    .maybeSingle();
  return ((data as unknown as { id: string } | null)?.id ?? null);
}

// Memoized resolver — one orgs lookup per teacher per run, not per student.
export function orgResolver(supabase: Db) {
  const cache = new Map<string, string | null>();
  return async (s: OrgLookup): Promise<string | null> => {
    if (s.org_id) return s.org_id;
    if (cache.has(s.teacher_id)) return cache.get(s.teacher_id) ?? null;
    const orgId = await resolveOrgId(supabase, s);
    cache.set(s.teacher_id, orgId);
    return orgId;
  };
}

// Absent rule row = enabled (guide default true).
export function disabledOrgIds(
  rows: { org_id: string; agent: string; enabled: boolean }[],
  agents: string[],
): Set<string> {
  return new Set(
    rows.filter((r) => agents.includes(r.agent) && r.enabled === false).map((r) => r.org_id),
  );
}

export function chunk<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function todayISO(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
