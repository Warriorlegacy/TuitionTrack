import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

type Db = SupabaseClient<Database, "public">;

// ponytail: untyped row reads — control-plane tables are Flex in db/types,
// so cast once here instead of threading generics through every query.
type OutboxRow = {
  id: string;
  org_id: string;
  to_identity: string;
  dedupe_key: string | null;
  status: string;
  send_after: string;
  attempts: number;
};

export type DrainResult = { sent: number; suppressed: number; queued: number };

export const DAILY_CAP_PER_RECIPIENT = 3;
// Quiet hours 21:00–07:30 Asia/Kolkata. Queued, never dropped.
const QUIET_START_MIN = 21 * 60;
const QUIET_END_MIN = 7 * 60 + 30;

export function isQuietHours(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const mins = h * 60 + m;
  return mins >= QUIET_START_MIN || mins < QUIET_END_MIN;
}

/**
 * Single outbox drain. Enforces in order: global kill-switch →
 * quiet hours → daily cap → dedupe. No WhatsApp API calls here;
 * sends are recorded as no-op provider "wa.me-link" (provider
 * integration is a later step). Kill-switched / quiet-hour items
 * stay queued; cap hits and dedupe conflicts are suppressed.
 */
export async function checkOutbox(
  supabase: Db,
  opts: { now?: Date; limit?: number } = {},
): Promise<DrainResult> {
  const now = opts.now ?? new Date();
  const result: DrainResult = { sent: 0, suppressed: 0, queued: 0 };

  const { data: queued } = await supabase
    .from("message_outbox")
    .select("id, org_id, to_identity, dedupe_key, status, send_after, attempts")
    .eq("status", "queued")
    .lte("send_after", now.toISOString())
    .order("created_at", { ascending: true })
    .limit(opts.limit ?? 100);
  const rows = ((queued ?? []) as unknown as OutboxRow[]).filter(Boolean);
  if (rows.length === 0) return result;

  // Global kill-switch per org: automation_rules agent='global', enabled=false.
  // Absent row = enabled (guide default true).
  const { data: globals } = await supabase
    .from("automation_rules")
    .select("org_id, enabled")
    .eq("agent", "global");
  const killed = new Set(
    (((globals ?? []) as unknown as { org_id: string; enabled: boolean }[]))
      .filter((r) => r.enabled === false)
      .map((r) => r.org_id),
  );

  const quiet = isQuietHours(now);
  const passable = rows.filter((r) => {
    if (killed.has(r.org_id) || quiet) {
      result.queued += 1;
      return false;
    }
    return true;
  });
  if (passable.length === 0) return result;

  // Today's sent counts per recipient (UTC day; ponytail: IST-day split
  // adds a timezone lib — revisit if cap disputes ever arise).
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const { data: sentToday } = await supabase
    .from("message_outbox")
    .select("to_identity")
    .eq("status", "sent")
    .gte("created_at", dayStart.toISOString())
    .limit(5000);
  const sentCount = new Map<string, number>();
  for (const r of ((sentToday ?? []) as unknown as { to_identity: string }[])) {
    sentCount.set(r.to_identity, (sentCount.get(r.to_identity) ?? 0) + 1);
  }

  // Batch dedupe: any same (org, dedupe_key) already sent → suppress.
  const keys = Array.from(new Set(passable.map((r) => r.dedupe_key).filter((k): k is string => !!k)));
  const alreadySent = new Set<string>();
  if (keys.length > 0) {
    const { data: dupes } = await supabase
      .from("message_outbox")
      .select("org_id, dedupe_key")
      .eq("status", "sent")
      .in("dedupe_key", keys)
      .limit(keys.length);
    for (const d of ((dupes ?? []) as unknown as { org_id: string; dedupe_key: string }[])) {
      alreadySent.add(`${d.org_id}::${d.dedupe_key}`);
    }
  }

  for (const row of passable) {
    if (
      (row.dedupe_key && alreadySent.has(`${row.org_id}::${row.dedupe_key}`)) ||
      (sentCount.get(row.to_identity) ?? 0) >= DAILY_CAP_PER_RECIPIENT
    ) {
      await supabase.from("message_outbox").update({ status: "suppressed" }).eq("id", row.id);
      result.suppressed += 1;
      continue;
    }
    // ponytail: no-op send — the app shares https://wa.me/ links; no provider call.
    await supabase
      .from("message_outbox")
      .update({ status: "sent", provider_id: "wa.me-link", attempts: row.attempts + 1 })
      .eq("id", row.id);
    sentCount.set(row.to_identity, (sentCount.get(row.to_identity) ?? 0) + 1);
    if (row.dedupe_key) alreadySent.add(`${row.org_id}::${row.dedupe_key}`);
    result.sent += 1;
  }
  return result;
}
