// BYOK helpers: load user AI keys/prefs, select best key for a tier.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiTier, ProviderKind, ResolvedProvider } from "./provider";
import { DEFAULT_EMBEDDING_MODEL, detectProviderFromKey, resolveFreeOnly, resolveProviderFromKind, pickModel, getPlatformKeyChain } from "./provider";
import { decryptKey } from "./crypto";

export type UserAiKeyRow = {
  id: string;
  user_id: string;
  provider: string;
  label: string;
  encrypted_key: string;
  key_fingerprint: string;
  status: string;
  last_used_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UserAiPrefsRow = {
  user_id: string;
  default_provider: string;
  default_model: string;
  tier_a_model: string | null;
  tier_b_model: string | null;
  tier_c_model: string | null;
  allow_free_fallbacks: boolean;
  prefer_free_tiers: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function getUserKeys(supabase: SupabaseClient, userId: string): Promise<UserAiKeyRow[]> {
  const { data } = await supabase
    .from("user_ai_keys")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  return ((data ?? []) as unknown as UserAiKeyRow[]);
}

export async function getUserPrefs(supabase: SupabaseClient, userId: string): Promise<UserAiPrefsRow | null> {
  const { data } = await supabase
    .from("user_ai_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as unknown as UserAiPrefsRow | null);
}

export async function getBestKeyForTier(
  supabase: SupabaseClient,
  userId: string,
  tier: AiTier,
): Promise<{ key: string; provider: ResolvedProvider; model: string; allowFallbacks: boolean; freeOnly: boolean } | null> {
  const [keys, prefs] = await Promise.all([getUserKeys(supabase, userId), getUserPrefs(supabase, userId)]);
  if (!keys.length) return null;

  const prefsProvider = prefs?.default_provider;
  const tierModelMap: Record<"A" | "B" | "C", string | null> = {
    A: prefs?.tier_a_model ?? null,
    B: prefs?.tier_b_model ?? null,
    C: prefs?.tier_c_model ?? null,
  };

  // Prefer user's default provider for all tiers unless tier-specific override exists
  const preferred = keys.find((k) => k.provider === prefsProvider) ?? keys[0];
  const plainKey = await decryptKey(preferred.encrypted_key);
  const kind = detectProviderFromKey(plainKey);
  const provider = resolveProviderFromKind(kind, plainKey);
  // Per-tier user pref wins; else user's default model; else tier pool.
  const model = pickModel(
    tier, kind, prefs?.prefer_free_tiers ?? true,
    tierModelMap[tier === "deterministic" ? "B" : tier],
    tier === "deterministic" ? null : prefs?.default_model || null,
  );

  // Touch last_used_at (fire-and-forget) so key usage is visible in the UI.
  // Key resolution ≈ usage; per-key failures surface via last_error elsewhere.
  void Promise.resolve(
    supabase
      .from("user_ai_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", preferred.id),
  )
    .then(({ error }) => {
      if (error) console.warn("[byok] last_used_at update failed:", error.message);
    })
    .catch(() => {});

  return {
    key: plainKey,
    provider,
    model,
    allowFallbacks: prefs?.allow_free_fallbacks ?? true,
    // ponytail: env cost mode gates the settings toggle — free_only (default)
    // forces freeOnly even if the user unchecked it. Paid runs need
    // AI_COST_MODE=paid_allowed + ALLOW_PAID_FALLBACK=true.
    freeOnly: resolveFreeOnly(prefs?.prefer_free_tiers ?? true),
  };
}

/**
 * Resolve a key for embeddings (RAG #50): the user's preferred key first,
 * then the platform OPENAI_API_KEY fallback. Callers must handle `null`
 * (keyword-only retrieval) — embeddings are an upgrade, never a hard dep.
 */
export async function getEmbeddingKey(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ key: string; kind: ProviderKind; model: string } | null> {
  const model = process.env.EMBEDDING_MODEL ?? null;
  try {
    const best = await getBestKeyForTier(supabase, userId, "B");
    if (best) return { key: best.key, kind: best.provider.kind, model: model ?? DEFAULT_EMBEDDING_MODEL };
  } catch { /* decrypt/DB failure — fall through to platform key */ }
  // Platform chain, OpenAI-compatible embedding surfaces only (1536-dim guard).
  const platform = getPlatformKeyChain().find(
    (e) => e.kind === "openai" || e.kind === "together" || e.kind === "huggingface" || e.kind === "custom",
  );
  if (platform) {
    return { key: platform.key, kind: platform.kind, model: model ?? DEFAULT_EMBEDDING_MODEL };
  }
  return null;
}
