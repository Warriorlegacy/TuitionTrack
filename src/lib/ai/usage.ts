import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiTier } from "@/lib/ai/provider";
import { PROMPT_VERSION } from "@/lib/ai/provider";

// Rate limit + per-user budget + model_usage logging (blueprint #65, #92).
// Reuses reports/generate pattern: count recent rows, never fail open on spend.

export const RATE_LIMITS: Record<string, { perMin: number; perDay: number }> = {
  "/api/ai/tutor": { perMin: 10, perDay: 100 },
  "/api/ai/quiz": { perMin: 6, perDay: 30 },
  "/api/ai/homework/generate": { perMin: 3, perDay: 30 },
  "/api/ai/flashcards": { perMin: 6, perDay: 30 },
  "/api/ai/video": { perMin: 2, perDay: 10 }, // video renders are slow + quota-hungry
  "/api/documents": { perMin: 6, perDay: 30 },
  "/api/plans/generate": { perMin: 6, perDay: 30 },
  default: { perMin: 10, perDay: 100 },
};

// Cost guard (blueprint #65): global kill switch + per-student monthly cap.
// Env defaults; per-student overrides live in public.ai_budgets.
export const AI_KILL_SWITCH = process.env.AI_KILL_SWITCH === "1";
export const PER_STUDENT_MONTHLY_CAP_USD = Number(
  process.env.AI_PER_STUDENT_CAP_USD ?? 5,
);

export async function checkAiBudget(
  supabase: SupabaseClient,
  student_id: string,
): Promise<{ ok: boolean; reason?: string; spend?: number; cap?: number }> {
  if (AI_KILL_SWITCH) return { ok: false, reason: "AI is temporarily disabled." };
  const { data: b } = await supabase.from("ai_budgets")
    .select("monthly_cap_usd, kill_switch").eq("student_id", student_id).maybeSingle();
  const row = b as unknown as { monthly_cap_usd?: number; kill_switch?: boolean } | null;
  if (row?.kill_switch) return { ok: false, reason: "AI is paused for this student." };
  const cap = Number(row?.monthly_cap_usd ?? PER_STUDENT_MONTHLY_CAP_USD);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await supabase.from("model_usage")
    .select("cost_usd").eq("student_id", student_id).gte("created_at", monthAgo).limit(5000);
  const spend = ((data ?? []) as unknown as { cost_usd: number | string | null }[])
    .reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  if (spend >= cap)
    return { ok: false, reason: "Monthly AI budget reached for this student.", spend, cap };
  return { ok: true, spend, cap };
}

export async function logAudit(
  supabase: SupabaseClient,
  row: { actor_id: string; action: string; entity: string; entity_id?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  // best-effort like logUsage; RLS requires actor_id = auth.uid()
  try {
    await supabase.from("audit_logs").insert({
      actor_id: row.actor_id, action: row.action, entity: row.entity,
      entity_id: row.entity_id ?? null, metadata: row.metadata ?? {},
    });
  } catch { /* surfaced via observability, not user error */ }
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
): Promise<{ ok: boolean; reason?: string }> {
  const lim = RATE_LIMITS[endpoint] ?? RATE_LIMITS.default;
  const minAgo = new Date(Date.now() - 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { count: c1 } = await supabase.from("model_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("endpoint", endpoint).gte("created_at", minAgo);
  if ((c1 ?? 0) >= lim.perMin) return { ok: false, reason: "Too many requests — wait a minute." };
  const { count: c2 } = await supabase.from("model_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("endpoint", endpoint).gte("created_at", dayAgo);
  if ((c2 ?? 0) >= lim.perDay) return { ok: false, reason: "Daily AI budget reached for this feature." };
  return { ok: true };
}

export async function logUsage(
  supabase: SupabaseClient,
  row: {
    user_id: string; student_id?: string | null; tier: AiTier; model: string;
    endpoint: string; input_tokens: number; output_tokens: number;
    cost_usd: number; latency_ms?: number; cached?: boolean; status?: string;
  },
): Promise<void> {
  // best-effort: cost tracking must never break learning
  try {
    await supabase.from("model_usage").insert({
      ...row, prompt_version: PROMPT_VERSION,
      student_id: row.student_id ?? null,
      latency_ms: row.latency_ms ?? null,
      cached: row.cached ?? false, status: row.status ?? "ok",
    });
  } catch { /* ponytail: swallow; surfaced via observability, not user error */ }
}

export async function logEvent(
  supabase: SupabaseClient,
  student_id: string,
  event_type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from("learning_events").insert({ student_id, event_type, payload });
  } catch { /* same */ }
}
