// Provider abstraction + cost tiers (blueprint #45, #47, #65).
//
// Multi-provider BYOK: OpenAI, Anthropic, Google, Groq, Together AI, OpenRouter,
// HuggingFace, NVIDIA NIM, DeepSeek, GitHub Models, local Ollama,
// or any OpenAI-compatible endpoint. Free-tier models are prioritized
// when user preference allows. Server-side secrets only; client never sees keys.
//
// Degradation contract (blueprint #83): with no platform key and no BYOK key,
// complete() returns an actionable stub result instead of throwing, so routes
// fall back to deterministic templates instead of 5xx-ing the whole feature.

import { isOpenCodeFreeModel } from "./opencode-catalog";

export const PROMPT_VERSION = "mvp1-2026-09-16b";

// ── Cost mode (server-side billing guard) ──────────────────────────────
// AI_COST_MODE=free_only (default) → paid models NEVER called, period.
// free_preferred → free first; paid only via explicit user opt-out + paid opt-in.
// paid_allowed + ALLOW_PAID_FALLBACK=true → user preference honored.
// Anything else fails safe to free-only.
export type CostMode = "free_only" | "free_preferred" | "paid_allowed";

export function costMode(): CostMode {
  const raw = (process.env.AI_COST_MODE ?? "free_only").trim().toLowerCase();
  return raw === "paid_allowed" || raw === "free_preferred" ? raw : "free_only";
}

export function isPaidUsageAllowed(): boolean {
  const mode = costMode();
  return (
    (mode === "paid_allowed" || mode === "free_preferred") && process.env.ALLOW_PAID_FALLBACK === "true"
  );
}

/** Effective free-only flag: env mode gates the user preference. */
export function resolveFreeOnly(userPref?: boolean | null): boolean {
  if (costMode() === "free_only") return true;
  if (!isPaidUsageAllowed()) return true;
  return userPref ?? true;
}
export type AiTier = "A" | "B" | "C" | "deterministic";

  // ── Provider endpoints ──────────────────────────────────────────────
const ENDPOINTS: Record<string, { base: string; kind: "openai" | "anthropic" | "google" | "custom" }> = {
  openai:      { base: "https://api.openai.com/v1", kind: "openai" },
  anthropic:   { base: "https://api.anthropic.com/v1", kind: "anthropic" },
  google:      { base: "https://generativelanguage.googleapis.com/v1beta", kind: "google" },
  groq:        { base: "https://api.groq.com/openai/v1", kind: "openai" },
  together:    { base: "https://api.together.xyz/v1", kind: "openai" },
  openrouter:  { base: "https://openrouter.ai/api/v1", kind: "openai" },
  huggingface: { base: "https://router.huggingface.co/v1", kind: "openai" },
  nvidia:      { base: "https://integrate.api.nvidia.com/v1", kind: "openai" },
  deepseek:    { base: "https://api.deepseek.com/v1", kind: "openai" },
  github:      { base: "https://models.github.ai/inference", kind: "openai" },
  ollama:      { base: "http://localhost:11434/v1", kind: "openai" },
  opencode:    { base: "https://opencode.ai/inference/openai/v1", kind: "openai" },
  custom:      { base: "", kind: "custom" },
};

// ── Free-tier-friendly defaults (overridden by AI_MODEL_TIER_* env or user prefs) ──
// OpenRouter free slugs verified live against /api/v1/models on 2026-09-23.
// Retired since the last check: inclusionai/ling-3.0-flash-vl:free is DELISTED
// (404 "unavailable for free") — replaced below by ling-3.0-flash-sante:free
// and qwen/qwen3.8-27b:free. A/B default to the fast non-reasoning
// google/gemma-4-26b-a4b-it:free, tier C to google/gemma-4-31b-it:free.
// Google: gemini-2.0-* retired (404 as of 2026-09); 2.5/3.x are current.
// NVIDIA NIM: meta/llama-3.1-8b-instruct reached EOL (410); nemotron is current.
// NOTE: free slugs churn — complete()/streamComplete() auto-rotate past dead
// free models (429 quota AND 404 unavailable-for-free), so one retirement
// never takes a feature down.
const FREE_MODELS: Record<"A" | "B" | "C", Record<string, string>> = {
  A: {
    openai: "gpt-4o-mini", anthropic: "claude-3-haiku-20240307", google: "gemini-3.5-flash-lite",
    groq: "openai/gpt-oss-20b", together: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    openrouter: "google/gemma-4-26b-a4b-it:free", huggingface: "meta-llama/Llama-3.1-8B-Instruct",
    nvidia: "nvidia/nemotron-3.5-lightning-30b-a3b", deepseek: "deepseek-chat",
    ollama: "llama3.1:8b", github: "openai/gpt-4o-mini", custom: "",
  },
  B: {
    openai: "gpt-4o-mini", anthropic: "claude-3-haiku-20240307", google: "gemini-3.5-flash-lite",
    groq: "openai/gpt-oss-20b", together: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    openrouter: "google/gemma-4-26b-a4b-it:free", huggingface: "meta-llama/Llama-3.1-8B-Instruct",
    nvidia: "nvidia/nemotron-3.5-lightning-30b-a3b", deepseek: "deepseek-chat",
    ollama: "llama3.1:8b", github: "openai/gpt-4o-mini", custom: "",
  },
  C: {
    openai: "gpt-4o", anthropic: "claude-3-5-sonnet-20241022", google: "gemini-3.5-flash",
    groq: "openai/gpt-oss-120b", together: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    openrouter: "google/gemma-4-31b-it:free", huggingface: "meta-llama/Llama-3.1-8B-Instruct",
    nvidia: "nvidia/nemotron-3-super-120b-a12b", deepseek: "deepseek-chat",
    ollama: "qwen2.5:14b", github: "openai/gpt-4o", custom: "",
  },
};

const PAID_MODELS: Record<"A" | "B" | "C", Record<string, string>> = {
  A: {
    openai: "gpt-4o-mini", anthropic: "claude-3-5-haiku-20241022", google: "gemini-3.5-flash-lite",
    groq: "openai/gpt-oss-20b", together: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    openrouter: "openai/gpt-4o-mini", huggingface: "meta-llama/Llama-3.1-8B-Instruct",
    nvidia: "nvidia/nemotron-3.5-lightning-30b-a3b", deepseek: "deepseek-chat",
    ollama: "llama3.1:8b", github: "openai/gpt-4o-mini", custom: "",
  },
  B: {
    openai: "gpt-4o", anthropic: "claude-3-5-sonnet-20241022", google: "gemini-3.5-flash",
    groq: "openai/gpt-oss-20b", together: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    openrouter: "openai/gpt-4o", huggingface: "meta-llama/Llama-3.1-70B-Instruct",
    nvidia: "nvidia/nemotron-3-super-120b-a12b", deepseek: "deepseek-chat",
    ollama: "llama3.1:8b", github: "openai/gpt-4o-mini", custom: "",
  },
  C: {
    openai: "gpt-4o", anthropic: "claude-3-5-sonnet-20241022", google: "gemini-3.5-flash",
    groq: "openai/gpt-oss-20b", together: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    openrouter: "openai/gpt-4o", huggingface: "meta-llama/Llama-3.1-70B-Instruct",
    nvidia: "nvidia/nemotron-3-super-120b-a12b", deepseek: "deepseek-chat",
    ollama: "qwen2.5:14b", github: "openai/gpt-4o", custom: "",
  },
};

const ENV_MODELS: Record<"A" | "B" | "C", string | undefined> = {
  A: process.env.AI_MODEL_TIER_A,
  B: process.env.AI_MODEL_TIER_B,
  C: process.env.AI_MODEL_TIER_C,
};

// ── Provider detection from key prefix ─────────────────────────────
export type ProviderKind = "openai" | "anthropic" | "google" | "groq" | "together" | "openrouter" | "huggingface" | "nvidia" | "deepseek" | "ollama" | "github" | "opencode" | "custom";

/** Human label for the REAL serving provider — used by generation UIs. */
export function providerDisplayName(kind: ProviderKind | string): string {
  switch (kind) {
    case "openai": return "OpenAI";
    case "anthropic": return "Anthropic";
    case "google": return "Google";
    case "groq": return "Groq";
    case "together": return "Together AI";
    case "openrouter": return "OpenRouter";
    case "huggingface": return "Hugging Face";
    case "nvidia": return "NVIDIA NIM";
    case "deepseek": return "DeepSeek";
    case "github": return "GitHub Models";
    case "opencode": return "OpenCode";
    case "ollama": return "Ollama (local)";
    default: return "Custom endpoint";
  }
}

export interface ResolvedProvider {
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  headers: Record<string, string>;
}

export function detectProviderFromKey(apiKey: string): ProviderKind {
  if (apiKey.startsWith("oc_sk_")) return "opencode";
  if (apiKey.startsWith("sk-or-")) return "openrouter";
  if (apiKey.startsWith("gsk_")) return "groq";
  if (apiKey.startsWith("sg-")) return "together";
  if (apiKey.startsWith("hf_")) return "huggingface";
  // Google issues both legacy AIza… keys and new AQ.… API keys (2025+).
  if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.")) return "google";
  // NVIDIA NIM (build.nvidia.com) exposes an OpenAI-compatible /v1 API.
  if (apiKey.startsWith("nvapi-")) return "nvidia";
  if (apiKey.startsWith("ghp_") || apiKey.startsWith("github_pat_")) return "github";
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  // NOTE: DeepSeek keys share the sk- prefix with OpenAI — they stay
  // openai-detected here; explicit provider selection in the UI disambiguates.
  if (apiKey.startsWith("sk-")) return "openai";
  return "custom";
}

// ── Platform-level fallback keys (free-first) ──────────────────────
// BYOK always wins; these keep AI features working when a user has no key.
// Order matters: cheapest/generous free tiers first.
const PLATFORM_KEYS: { kind: ProviderKind; key: string | undefined }[] = [
  { kind: "groq", key: process.env.GROQ_API_KEY },
  { kind: "google", key: process.env.GEMINI_API_KEY },
  { kind: "openrouter", key: process.env.OPENROUTER_API_KEY },
  { kind: "nvidia", key: process.env.NVIDIA_NIM_API_KEY },
  { kind: "huggingface", key: process.env.HUGGINGFACE_API_KEY },
  // OpenCode credential (server-only): credentialed paid models ONLY, and only
  // when paid usage is explicitly allowed. Keyless OpenCode is NOT in the auto
  // chain — its free tier 403s outside the OpenCode client (verified live).
  { kind: "opencode", key: process.env.OPENCODE_KEY },
  { kind: "openai", key: process.env.OPENAI_API_KEY },
  // Paid/local last: cheap DeepSeek, then GitHub Models free tier, then local
  // Ollama. NOTE: GITHUB_MODELS_TOKEN, not GITHUB_TOKEN (Actions reserves that).
  { kind: "deepseek", key: process.env.DEEPSEEK_API_KEY },
  { kind: "github", key: process.env.GITHUB_MODELS_TOKEN },
  { kind: "ollama", key: process.env.OLLAMA_API_KEY },
];

/** First configured platform key (free tiers first). Callers then resolve kind via the entry. */
export function getPlatformKey(): { kind: ProviderKind; key: string } | null {
  return getPlatformKeyChain()[0] ?? null;
}

/** All configured platform keys, free-first — used for automatic fallback on provider errors. */
export function getPlatformKeyChain(): { kind: ProviderKind; key: string }[] {
  const out: { kind: ProviderKind; key: string }[] = [];
  for (const entry of PLATFORM_KEYS) {
    const k = entry.key?.trim();
    if (!k) continue;
    const detected = detectProviderFromKey(k);
    out.push({ kind: detected === "custom" ? entry.kind : detected, key: k });
  }
  // ponytail: local ollama needs no key — a set OLLAMA_BASE_URL alone enables
  // it with a dummy key (avoids a new branch in requestCompletion).
  if (process.env.OLLAMA_BASE_URL?.trim() && !out.some((e) => e.kind === "ollama")) {
    out.push({ kind: "ollama", key: process.env.OLLAMA_API_KEY?.trim() || "ollama" });
  }
  return out;
}

export function resolveProviderFromKind(kind: ProviderKind, apiKey: string, baseUrl?: string): ResolvedProvider {
  const ep = ENDPOINTS[kind] ?? ENDPOINTS.custom;
  const resolvedBase = baseUrl?.trim().replace(/\/+$/, "") || ep.base;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (kind === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (kind === "google") {
    headers["x-goog-api-key"] = apiKey;
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (kind === "openrouter") {
    headers["X-Title"] = "TuitionTrack AI";
    if (process.env.NEXT_PUBLIC_APP_URL) headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL;
  }

  return { kind, baseUrl: resolvedBase, apiKey, model: "", headers };
}

// ── Model selection ────────────────────────────────────────────────
// Priority: explicit userPref (per-tier BYOK pref) > envOverride (platform
// default) > free/paid pool. "deterministic" tier never calls a model; if it
// somehow reaches here it routes to the tier-B default.
export function pickModel(
  tier: AiTier,
  providerKind: ProviderKind,
  preferFree: boolean,
  envOverride?: string | null,
  userPref?: string | null,
): string {
  // ponytail: free-only mode (preferFree) NEVER calls a paid model — a paid
  // user/env preference is ignored and the free pool is used instead. Paid
  // models run only when the user explicitly opts out of free-only.
  if (envOverride && (!preferFree || isFreeModel(providerKind, envOverride))) return envOverride;
  // ponytail: free-only mode (preferFree) NEVER calls a paid model — a paid
  // user/env preference is ignored and the free pool is used instead. Paid
  // models run only when the user explicitly opts out of free-only.
  if (userPref && preferFree && !isFreeModel(providerKind, userPref)) {
    const t: "A" | "B" | "C" = tier === "deterministic" ? "B" : tier;
    return FREE_MODELS[t][providerKind] ?? FREE_MODELS[t].openai;
  }
  if (userPref) return userPref;
  if (envOverride) return envOverride;
  const t: "A" | "B" | "C" = tier === "deterministic" ? "B" : tier;
  // ponytail: unknown provider/model combos resolve to "" and are SKIPPED by
  // the loops — never guess a slug (a wrong guess bills or 404s).
  const pool = preferFree ? FREE_MODELS[t][providerKind] : PAID_MODELS[t][providerKind];
  return pool ?? "";
}

// ── Cost estimation ────────────────────────────────────────────────
const PRICE_PER_1K: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.00015, out: 0.0006 },
  "gpt-4o": { in: 0.0025, out: 0.01 },
  "openai/gpt-4o-mini": { in: 0.00015, out: 0.0006 },
  "openai/gpt-4o": { in: 0.0025, out: 0.01 },
  "google/gemini-2.0-flash-exp:free": { in: 0, out: 0 },
  "gemini-3.5-flash-lite": { in: 0.000075, out: 0.0003 },
  "gemini-3.5-flash": { in: 0.00015, out: 0.0006 },
  "gemini-2.5-flash-lite": { in: 0.000075, out: 0.0003 },
  "gemini-2.5-flash": { in: 0.00015, out: 0.0006 },
  "gemini-2.5-pro": { in: 0.00125, out: 0.005 },
  "google/gemma-4-26b-a4b-it:free": { in: 0, out: 0 },
  "google/gemma-4-31b-it:free": { in: 0, out: 0 },
  "qwen/qwen3.8-27b:free": { in: 0, out: 0 },
  "inclusionai/ling-3.0-flash-sante:free": { in: 0, out: 0 },
  "nex-agi/nex-n2.5-mini:free": { in: 0, out: 0 },
  "nex-agi/nex-n2.5-pro:free": { in: 0, out: 0 },
  "liquid/lfm-2.5-2.6b:free": { in: 0, out: 0 },
  "z-ai/glm-5.2:free": { in: 0, out: 0 },
  "nvidia/nemotron-3-super-120b-a12b:free": { in: 0, out: 0 },
  "nvidia/nemotron-3.5-lightning:free": { in: 0, out: 0 },
  "nvidia/nemotron-3-ultra-550b-a55b:free": { in: 0, out: 0 },
  "google/gemini-2.0-flash": { in: 0.000075, out: 0.0003 },
  "google/gemini-2.0-pro": { in: 0.0005, out: 0.002 },
  "anthropic/claude-3-haiku-20240307": { in: 0.00025, out: 0.00125 },
  "anthropic/claude-3-5-sonnet-20241022": { in: 0.003, out: 0.015 },
  "groq/llama-3.1-8b-instant": { in: 0, out: 0 },
  "openai/gpt-oss-20b": { in: 0, out: 0 },
  "openai/gpt-oss-120b": { in: 0, out: 0 },
  "nvidia/nemotron-3.5-lightning-30b-a3b": { in: 0, out: 0 },
  "nvidia/nemotron-3-super-120b-a12b": { in: 0, out: 0 },
  "meta-llama/Llama-3.1-8B-Instruct": { in: 0, out: 0 },
  "together_ai": { in: 0.0002, out: 0.0006 },
  "deepseek-chat": { in: 0.00014, out: 0.00028 },
  "llama3.1:8b": { in: 0, out: 0 },
  "qwen2.5:14b": { in: 0, out: 0 },
};
const FALLBACK_PRICE = { in: 0.00015, out: 0.0006 };

export function estimateCostUsd(model: string, inTok: number, outTok: number): number {
  // ponytail: any ":free" slug is $0 by contract — covers future free models
  // without table maintenance.
  if (model.endsWith(":free")) return 0;
  const p = PRICE_PER_1K[model] ?? FALLBACK_PRICE;
  return Number((((inTok / 1000) * p.in + (outTok / 1000) * p.out).toFixed(6)));
}

// ── Types ──────────────────────────────────────────────────────────
export type CompleteArgs = {
  tier: AiTier;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  userId?: string;            // reserved: BYOK resolution happens at the route
  providerKind?: ProviderKind; // explicit override
  modelOverride?: string;      // explicit model slug (highest priority)
  apiKeyOverride?: string;     // explicit key (BYOK flow)
  baseUrlOverride?: string;    // explicit endpoint
  signal?: AbortSignal;        // streams: abort when the client disconnects
  allowFallbacks?: boolean;    // false = exactly one attempt, fail fast (default true)
  freeOnly?: boolean;          // false = paid models allowed (default: env-gated, see resolveFreeOnly)
  task?: string;               // task classifier label for logs (e.g. "homework_generation")
  requirements?: { vision?: boolean }; // capability filter for fallback selection
};

export type AttemptTrail = {
  provider: string;
  model: string;
  ok: boolean;
  error?: string;
};

export type CompleteResult = {
  text: string;
  model: string;
  // ponytail: which provider served this result — set on live completions so
  // callers can show the REAL provider/model instead of hardcoding a label.
  provider?: ProviderKind;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  cached: boolean;
  stubbed: boolean;
  latencyMs: number;
  // ponytail: per-attempt routing trail (requested → each fallback tried).
  // Callers persist/display this so the UI shows the ACTUAL serving model.
  attempts?: AttemptTrail[];
};

// Shown to students when no key is configured anywhere. Actionable, not an error dump.
export const STUB_TEXT =
  "(AI not set up yet) Add your own API key in Settings → AI to enable the live tutor. " +
  "Free options that need no credit card: OpenRouter (Gemini free), Google Gemini, or Groq.";

const approxTokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

// ── Core completion (with provider failover) ─────────────────────
// ── Provider failover ──────────────────────────────────────────
// Candidate chain: explicit BYOK override alone (BYOK errors must surface to
// the user so bad keys get fixed), else all configured platform keys
// (free-first). A dead/retired provider never takes a whole feature down.
function resolveChain(args: CompleteArgs): { kind: ProviderKind; key: string }[] {
  if (args.apiKeyOverride) {
    return [{ kind: args.providerKind || detectProviderFromKey(args.apiKeyOverride), key: args.apiKeyOverride }];
  }
  return getPlatformKeyChain();
}

function stubResult(started: number): CompleteResult {
  return {
    text: STUB_TEXT, model: "stub", inputTokens: 0, outputTokens: 0,
    costUsd: 0, cached: false, stubbed: true, latencyMs: Date.now() - started,
  };
}

// Free-model rate limits (429) are the most common failure on free tiers —
// when one model's quota is exhausted, another free model on the same provider
// usually still has headroom. Retired free slugs (404 "unavailable for free" /
// "No endpoints found") are equally common — OpenRouter delists :free variants
// without warning. These fallbacks rotate through the tier's free pool,
// skipping the model that just failed. BYOK + platform both benefit.
// Pool verified live against /api/v1/models on 2026-09-23.
const FREE_MODEL_FALLBACKS: Record<"A" | "B" | "C", string[]> = {
  A: [
    "google/gemma-4-26b-a4b-it:free", "google/gemma-4-31b-it:free",
    "qwen/qwen3.8-27b:free", "nex-agi/nex-n2.5-mini:free",
    "liquid/lfm-2.5-2.6b:free", "z-ai/glm-5.2:free",
  ],
  B: [
    "google/gemma-4-26b-a4b-it:free", "google/gemma-4-31b-it:free",
    "qwen/qwen3.8-27b:free", "nex-agi/nex-n2.5-mini:free",
    "liquid/lfm-2.5-2.6b:free", "z-ai/glm-5.2:free",
  ],
  C: [
    "google/gemma-4-31b-it:free", "qwen/qwen3.8-27b:free",
    "nvidia/nemotron-3-super-120b-a12b:free", "nex-agi/nex-n2.5-pro:free",
  ],
};

/** Is this error a provider 429 (rate limit / quota exhausted)? */
function is429(err: unknown): boolean {
  return /^provider 429 /.test((err as Error)?.message ?? "");
}

/**
 * Is this error an OpenRouter 404 for a dead :free slug ("unavailable for
 * free" / "No endpoints found")? These must rotate, not fail the feature.
 */
function isFreeUnavailable(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  return (
    /^provider 404 \(openrouter\):/.test(msg) &&
    /unavailable for free|no endpoints found/i.test(msg)
  );
}

/** Next free fallback model for this tier after `failedModel`, or null. */
function nextFreeFallback(tier: "A" | "B" | "C", failedModel: string): string | null {
  const pool = FREE_MODEL_FALLBACKS[tier];
  const idx = pool.indexOf(failedModel);
  // Start after the failed model; if it wasn't from the pool, start at 0.
  // Skip cooled-down models and the failed one.
  const start = idx >= 0 ? idx + 1 : 0;
  for (let i = start; i < pool.length; i++) {
    if (pool[i] !== failedModel && !isCooledDown("openrouter", pool[i])) return pool[i];
  }
  // Wrap: earlier pool entries the failure didn't come from are still eligible.
  for (let i = 0; i < start; i++) {
    if (pool[i] !== failedModel && !isCooledDown("openrouter", pool[i])) return pool[i];
  }
  return null;
}

// Google retires Gemini generations on a schedule (2.x → 3.x in 2026) and the
// API 404s with "no longer available … update your code to use models/<next>".
// Map retired slugs to their official successors so one retirement never
// takes a feature down — single hop, then the normal chain takes over.
const GOOGLE_MODEL_SUCCESSORS: Record<string, string> = {
  "gemini-2.5-flash-lite": "gemini-3.5-flash-lite",
  "gemini-2.5-flash": "gemini-3.5-flash-lite",
  "gemini-2.5-pro": "gemini-3.5-flash",
  "gemini-2.0-flash": "gemini-3.1-flash-lite",
  "gemini-2.0-flash-lite": "gemini-3.1-flash-lite",
};

/** Successor for a retired Google model, or null (single hop only). */
function nextGoogleSuccessor(kind: ProviderKind, model: string): string | null {
  if (kind !== "google") return null;
  const next = GOOGLE_MODEL_SUCCESSORS[model];
  return next && next !== model ? next : null;
}

// ── Automatic free-model fallback system ───────────────────────────────
// Central router policy (all AI features flow through complete()/streamComplete):
// FREE ONLY by default + automatic free fallback + no mock data + real
// provider/model transparency. Paid models are NEVER called while free-only
// is active (preferFree) — a paid user/model preference is ignored, not billed.

/** Retry classification for a failed attempt. Exported for tests. */
export type AttemptAction = "retry-same" | "rotate" | "successor" | "failover";

export function classifyAttemptError(err: unknown, kind: ProviderKind, model: string): AttemptAction {
  const msg = (err as Error)?.message ?? "";
  if (!/^provider \d+/.test(msg)) {
    // No provider status = transport-level failure → one same-model retry.
    return /fetch failed|network|timeout|timed out|aborted|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(msg)
      ? "retry-same"
      : "failover";
  }
  if (kind === "openrouter" && (is429(err) || isFreeUnavailable(err))) return "rotate";
  if (kind === "google" && /^provider 404/.test(msg) && GOOGLE_MODEL_SUCCESSORS[model]) return "successor";
  // 401/403 (bad key), 400/422 (bad request), 5xx, empty content: retrying the
  // same model cannot help → move to the next provider/model.
  return "failover";
}

/** Max free-model rotations per provider (attempt budget). Configurable. */
function maxFallbacks(): number {
  const raw = Number(process.env.AI_MAX_FALLBACKS);
  return Number.isFinite(raw) && raw >= 0 ? Math.min(10, Math.floor(raw)) : 5;
}

const backoff = (retry: number) =>
  new Promise((r) => setTimeout(r, Math.min(2000, 400 * 2 ** Math.max(0, retry - 1))));

// ── Provider/model health + cooldown ────────────────────────────────────
// Lightweight in-memory health (per server instance, best-effort): repeated
// failures park a model in cooldown; the router skips it until the cooldown
// lapses, then it becomes eligible again automatically. One transient blip
// never permanently disables anything.
type HealthEntry = { failures: number; cooldownUntil: number };
const MODEL_HEALTH = new Map<string, HealthEntry>();

function cooldownMsFor(err: unknown): number {
  const msg = (err as Error)?.message ?? "";
  if (/^provider 429/.test(msg)) return 60_000;
  if (/^provider 404/.test(msg) && /unavailable for free|no endpoints found/i.test(msg)) return 10 * 60_000;
  if (/^provider 401|^provider 403/.test(msg)) return 5 * 60_000;
  return 30_000;
}

export function recordFailure(kind: ProviderKind, model: string, err: unknown): void {
  const key = `${kind}::${model}`;
  const prev = MODEL_HEALTH.get(key);
  MODEL_HEALTH.set(key, {
    failures: (prev?.failures ?? 0) + 1,
    cooldownUntil: Date.now() + cooldownMsFor(err),
  });
}

export function recordSuccess(kind: ProviderKind, model: string): void {
  MODEL_HEALTH.delete(`${kind}::${model}`);
}

export function isCooledDown(kind: ProviderKind, model: string): boolean {
  const e = MODEL_HEALTH.get(`${kind}::${model}`);
  if (!e) return false;
  if (Date.now() >= e.cooldownUntil) {
    MODEL_HEALTH.delete(`${kind}::${model}`);
    return false;
  }
  return true;
}

// ── Free-only guard ────────────────────────────────────────────────────
// Kinds with no free tier are ALWAYS paid (never called in free-only mode).
const PAID_KINDS = new Set<ProviderKind>(["openai", "anthropic", "deepseek", "together", "custom"]);

/** Is this model free on this provider? Exported for tests + settings API. */
export function isFreeModel(kind: ProviderKind, model: string): boolean {
  // Custom endpoints are unverifiable — never assume free.
  if (kind === "custom") return false;
  // OpenCode: only catalog-verified -free ids (unknown pricing is NOT free).
  if (kind === "opencode") return isOpenCodeFreeModel(model);
  if (!model) return true; // auto → tier free pool
  if (PAID_KINDS.has(kind)) return false;
  if (kind === "openrouter") return model.endsWith(":free");
  return (PROVIDER_FREE_MODELS[kind] ?? []).includes(model);
}

// ── Capability filter ──────────────────────────────────────────────────
// All registry models do text + prompted structured output. Vision is the only
// discriminating capability today (no caller requires it yet — plumbing first).
const VISION_MODELS = new Set(["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite"]);

export function supportsCapabilities(kind: ProviderKind, model: string, requirements?: { vision?: boolean }): boolean {
  if (requirements?.vision && !(kind === "google" && VISION_MODELS.has(model))) return false;
  return true;
}

/**
 * Paid-model skip for free-only mode. Paid-only providers (OpenAI/Anthropic/
 * DeepSeek/Together/custom) have NO free model — in free-only mode the router
 * skips them entirely instead of spending money. Exported for tests.
 */
export function shouldSkipPaidModel(kind: ProviderKind, model: string, freeOnly: boolean): boolean {
  return freeOnly && !isFreeModel(kind, model);
}

// ── Free-model catalogue (model picker + non-OpenRouter providers) ─────────
// Curated free/cheap slugs per provider for the AI Settings model picker.
// OpenRouter is served LIVE from /api/v1/models (see /api/ai/models) since
// its :free roster churns; this table is the fallback for every provider.
export const PROVIDER_FREE_MODELS: Record<ProviderKind, string[]> = {
  openrouter: [...FREE_MODEL_FALLBACKS.B, ...FREE_MODEL_FALLBACKS.C.filter((m) => !FREE_MODEL_FALLBACKS.B.includes(m))],
  google: ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite"],
  groq: ["openai/gpt-oss-20b", "openai/gpt-oss-120b"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-3-5-haiku-20241022", "claude-3-haiku-20240307", "claude-3-5-sonnet-20241022"],
  huggingface: ["meta-llama/Llama-3.1-8B-Instruct"],
  together: ["meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"],
  nvidia: ["nvidia/nemotron-3.5-lightning-30b-a3b", "nvidia/nemotron-3-super-120b-a12b"],
  deepseek: ["deepseek-chat"],
  github: ["openai/gpt-4o-mini", "openai/gpt-4o"],
  ollama: ["llama3.1:8b", "qwen2.5:14b"],
  // OpenCode: served LIVE from the inference catalog (see /api/ai/models) —
  // keyless external free calls 403, so no static free list is trusted here.
  opencode: [],
  custom: [],
};

function resolveAttemptProvider(
  args: CompleteArgs,
  entry: { kind: ProviderKind; key: string },
  tier: "A" | "B" | "C",
): ResolvedProvider {
  const provider = resolveProviderFromKind(entry.kind, entry.key,
    args.baseUrlOverride || process.env.AI_BASE_URL ||
    (entry.kind === "ollama" ? process.env.OLLAMA_BASE_URL : undefined) || undefined);
  // Explicit per-call override wins (BYOK user pref flows through here);
  // otherwise fall back to platform env defaults, then the free pool.
  provider.model = args.modelOverride || pickModel(tier, provider.kind, true, ENV_MODELS[tier], null);
  return provider;
}

// Reasoning models sometimes emit their chain-of-thought inside `content`,
// either as <think>…</think> blocks or a bare thinking preamble. Strip it so
// students never see the model's internal monologue.
export function stripReasoningTrace(text: string): string {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Unclosed <think> (hit max_tokens mid-thought): treat everything from the
  // opening tag on as trace.
  t = t.replace(/<think>[\s\S]*/i, "");
  return t.trim();
}

async function requestCompletion(
  provider: ResolvedProvider,
  tier: "A" | "B" | "C",
  args: CompleteArgs,
  stream: boolean,
): Promise<Response> {
  const maxTokens = args.maxTokens ?? 600;
  const temperature = args.temperature ?? (tier === "A" ? 0.1 : 0.6);
  const streamBody = stream ? { stream: true } : {};
  if (provider.kind === "anthropic") {
    return fetch(`${provider.baseUrl}/messages`, {
      method: "POST", headers: provider.headers, signal: args.signal,
      body: JSON.stringify({
        model: provider.model, max_tokens: maxTokens, temperature,
        ...streamBody, system: args.system, messages: [{ role: "user", content: args.user }],
      }),
    });
  }
  if (provider.kind === "google") {
    const action = stream ? `streamGenerateContent?alt=sse&` : `generateContent?`;
    const url = `${provider.baseUrl}/models/${provider.model}:${action}key=${encodeURIComponent(provider.apiKey)}`;
    return fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: args.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: args.user }] }],
        systemInstruction: { parts: [{ text: args.system }] },
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
    });
  }
  // OpenAI-compatible (openai, groq, together, openrouter, huggingface, nvidia, deepseek, github, ollama, custom)
  return fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST", headers: provider.headers, signal: args.signal,
    body: JSON.stringify({
      model: provider.model, max_tokens: maxTokens, temperature, ...streamBody,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });
}

export async function complete(args: CompleteArgs): Promise<CompleteResult> {
  const started = Date.now();
  const tier: "A" | "B" | "C" = args.tier === "deterministic" ? "B" : args.tier;
  const allowFallbacks = args.allowFallbacks !== false;
  const freeOnly = args.freeOnly ?? resolveFreeOnly(true);
  const chain = allowFallbacks ? resolveChain(args) : resolveChain(args).slice(0, 1);
  if (!chain.length) return stubResult(started);

  let lastErr: unknown;
  const trail: AttemptTrail[] = [];
  const fail = (provider: ResolvedProvider, e: unknown) => {
    lastErr = e;
    recordFailure(provider.kind, provider.model, e);
    trail.push({
      provider: provider.kind, model: provider.model, ok: false,
      error: ((e as Error)?.message ?? "unknown").slice(0, 120),
    });
  };
  for (const entry of chain) {
    let provider = resolveAttemptProvider(args, entry, tier);
    if (!provider.model) {
      fail(provider, new Error(`no model resolved for provider ${provider.kind} — skipped, never guessed`));
      continue;
    }
    // Free-only mode: NEVER call a paid model — skip the provider entirely.
    if (shouldSkipPaidModel(provider.kind, provider.model, freeOnly)) {
      fail(provider, new Error(`paid model ${provider.model} blocked by free-only mode`));
      continue; // next provider in the chain
    }
    // Capability filter: never select a model that cannot do the task.
    if (!supportsCapabilities(provider.kind, provider.model, args.requirements)) {
      fail(provider, new Error(`model ${provider.model} lacks required capabilities`));
      continue; // next provider in the chain
    }
    // Cooldown: skip recently-failed models while alternatives exist.
    if (isCooledDown(provider.kind, provider.model) && (chain.length > 1 || allowFallbacks)) {
      fail(provider, new Error(`model ${provider.model} in cooldown after recent failures`));
      continue;
    }
    // Inner loop: same-model retry for transient blips, free-model rotation
    // on quota/retired slugs, retired-Google successor hop — then next provider.
    let netRetries = 0;
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await requestCompletion(provider, tier, args, false);
        if (!res.ok) {
          const body = (await res.text()).slice(0, 300);
          throw new Error(`provider ${res.status} (${provider.kind}): ${body}`);
        }
        let text = "";
        let inTok = approxTokens(args.system + args.user);
        let outTok = 0;
        if (provider.kind === "google") {
          const data = await res.json();
          text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          outTok = approxTokens(text);
        } else if (provider.kind === "anthropic") {
          const data = await res.json();
          text = data.content?.[0]?.text ?? "";
          inTok = data.usage?.input_tokens ?? inTok;
          outTok = data.usage?.output_tokens ?? approxTokens(text);
        } else {
          const data = await res.json();
          text = asStr(asObj(asObj(data.choices?.[0]).message).content);
          // Reasoning models (nemotron, groq gpt-oss, ...) put the thinking
          // trace in `reasoning` and the answer in `content`. When the token
          // budget runs out mid-trace, `content` comes back empty — the model
          // never got to the answer.
          const finish = data.choices?.[0]?.finish_reason;
          text = stripReasoningTrace(text);
          if (!text.trim()) {
            // An empty answer is a FAILURE, not a success. Returning it here
            // would stop the chain and surface as a confusing downstream error
            // (e.g. "model returned no plan") instead of trying the next
            // provider. `length` means the budget ran out on the trace.
            const why = finish === "length"
              ? `hit the ${args.maxTokens ?? 600}-token cap while reasoning (raise maxTokens)`
              : "returned empty content";
            throw new Error(`provider ${provider.kind} ${provider.model} ${why}`);
          }
          inTok = data.usage?.prompt_tokens ?? inTok;
          outTok = data.usage?.completion_tokens ?? approxTokens(text);
        }
        // Applies to every provider: a 200 with no usable text is a failure.
        // Google returns no `finish_reason` here, so this is the safety net for
        // providers whose branch above did not already check.
        if (!text.trim()) {
          throw new Error(`provider ${provider.kind} ${provider.model} returned empty content`);
        }
        recordSuccess(provider.kind, provider.model);
        trail.push({ provider: provider.kind, model: provider.model, ok: true });
        return {
          text, model: provider.model, provider: provider.kind,
          inputTokens: inTok, outputTokens: outTok,
          costUsd: estimateCostUsd(provider.model, inTok, outTok),
          cached: false, stubbed: false, latencyMs: Date.now() - started,
          attempts: trail,
        };
      } catch (e) {
        fail(provider, e);
        if (!allowFallbacks) break; // fail fast — caller disabled fallbacks
        const action = classifyAttemptError(e, provider.kind, provider.model);
        if (action === "retry-same" && netRetries < 1) {
          netRetries++;
          await backoff(netRetries);
          continue; // one transient retry on the same model
        }
        if (action === "rotate") {
          const nextModel = attempt < maxFallbacks() ? nextFreeFallback(tier, provider.model) : null;
          if (!nextModel) break; // next provider in the chain
          provider = { ...provider, model: nextModel };
          continue;
        }
        if (action === "successor") {
          const next = nextGoogleSuccessor(provider.kind, provider.model);
          if (!next) break;
          provider = { ...provider, model: next };
          continue;
        }
        break; // failover → next provider in the chain
      }
    }
  }
  throw new Error(`All AI providers failed (task=${args.task ?? "generic"}) — last error: ${(lastErr as Error)?.message ?? "unknown"}`);
}

// ── Streaming (SSE) ────────────────────────────────────────────────
// Streaming mirror of complete(): same key/model resolution, same stub
// degradation. Deltas are pushed to onDelta as they arrive; the resolved
// CompleteResult carries the full text + usage for persistence/logging.

// Strict unknown-accessors: provider SSE payloads are untrusted JSON.
const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
const asNum = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

// One SSE `data:` payload → optional text delta + optional usage numbers.
function extractProviderSse(
  kind: ProviderKind,
  payload: string,
): { text: string | null; inTok?: number; outTok?: number } {
  let j: unknown;
  try { j = JSON.parse(payload); } catch { return { text: null }; }
  const root = asObj(j);

  if (kind === "google") {
    const cand = asObj(asArr(root.candidates)[0]);
    const text = asArr(asObj(cand.content).parts).map((p) => asStr(asObj(p).text)).join("");
    const u = asObj(root.usageMetadata);
    return { text: text || null, inTok: asNum(u.promptTokenCount), outTok: asNum(u.candidatesTokenCount) };
  }
  if (kind === "anthropic") {
    if (root.type === "content_block_delta") return { text: asStr(asObj(root.delta).text) || null };
    if (root.type === "message_start") return { text: null, inTok: asNum(asObj(asObj(root.message).usage).input_tokens) };
    if (root.type === "message_delta") return { text: null, outTok: asNum(asObj(root.usage).output_tokens) };
    return { text: null };
  }
  // OpenAI-compatible (openai, groq, together, openrouter, huggingface, nvidia, deepseek, github, ollama, custom)
  const choice = asObj(asArr(root.choices)[0]);
  const text = asStr(asObj(choice.delta).content) || asStr(asObj(choice.message).content) || asStr(choice.text);
  const u = asObj(root.usage);
  return { text: text || null, inTok: asNum(u.prompt_tokens), outTok: asNum(u.completion_tokens) };
}

// Estimates-only result (no provider-reported usage available).
export function estimateUsageResult(opts: {
  model: string; system: string; user: string; text: string; startedAt: number;
}): CompleteResult {
  const inTok = approxTokens(opts.system + opts.user);
  const outTok = Math.max(1, approxTokens(opts.text));
  return {
    text: opts.text, model: opts.model, inputTokens: inTok, outputTokens: outTok,
    costUsd: estimateCostUsd(opts.model, inTok, outTok),
    cached: false, stubbed: false, latencyMs: Date.now() - opts.startedAt,
  };
}

export async function streamComplete(
  args: CompleteArgs,
  onDelta: (text: string) => void,
): Promise<CompleteResult> {
  const started = Date.now();
  const tier: "A" | "B" | "C" = args.tier === "deterministic" ? "B" : args.tier;
  const allowFallbacks = args.allowFallbacks !== false;
  const freeOnly = args.freeOnly ?? resolveFreeOnly(true);

  const chain = allowFallbacks ? resolveChain(args) : resolveChain(args).slice(0, 1);
  if (!chain.length) {
    onDelta(STUB_TEXT);
    return stubResult(started);
  }

  // NOTE: only connection/response-establishment failures failover. Once a
  // stream starts delivering deltas, a mid-stream break propagates — the
  // caller has already rendered partial text, so retrying would duplicate it.
  let lastErr: unknown;
  const trail: AttemptTrail[] = [];
  const fail = (provider: ResolvedProvider, e: unknown) => {
    lastErr = e;
    recordFailure(provider.kind, provider.model, e);
    trail.push({
      provider: provider.kind, model: provider.model, ok: false,
      error: ((e as Error)?.message ?? "unknown").slice(0, 120),
    });
  };
  for (const entry of chain) {
    let provider = resolveAttemptProvider(args, entry, tier);
    if (!provider.model) {
      fail(provider, new Error(`no model resolved for provider ${provider.kind} — skipped, never guessed`));
      continue;
    }
    if (shouldSkipPaidModel(provider.kind, provider.model, freeOnly)) {
      fail(provider, new Error(`paid model ${provider.model} blocked by free-only mode`));
      continue;
    }
    if (!supportsCapabilities(provider.kind, provider.model, args.requirements)) {
      fail(provider, new Error(`model ${provider.model} lacks required capabilities`));
      continue;
    }
    if (isCooledDown(provider.kind, provider.model) && (chain.length > 1 || allowFallbacks)) {
      fail(provider, new Error(`model ${provider.model} in cooldown after recent failures`));
      continue;
    }
    // 429/retired-slug rotation (before any deltas flow): same policy as complete().
    let netRetries = 0;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await requestCompletion(provider, tier, args, true);
      } catch (e) {
        fail(provider, e);
        if (!allowFallbacks) break;
        if (classifyAttemptError(e, provider.kind, provider.model) === "retry-same" && netRetries < 1) {
          netRetries++;
          await backoff(netRetries);
          continue;
        }
        break; // connection error → next provider
      }
      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        const err = new Error(`provider ${res.status} (${provider.kind}): ${bodyText.slice(0, 300)}`);
        fail(provider, err);
        if (!allowFallbacks) break;
        const action = classifyAttemptError(err, provider.kind, provider.model);
        if (action === "rotate") {
          const nextModel = attempt < maxFallbacks() ? nextFreeFallback(tier, provider.model) : null;
          if (!nextModel) break; // next provider in the chain
          provider = { ...provider, model: nextModel };
          continue; // retry same provider with the next free model
        }
        if (action === "successor") {
          const next = nextGoogleSuccessor(provider.kind, provider.model);
          if (!next) break;
          provider = { ...provider, model: next };
          continue;
        }
        break; // next provider in the chain
      }
      const body = res.body;
      if (!body) {
        fail(provider, new Error("Provider returned an empty stream body"));
        break; // give up on this provider, try the next in the chain
      }

    const reader = body.getReader();
    const dec = new TextDecoder();
    let full = "";
    let inTok = approxTokens(args.system + args.user);
    let outTok = 0;
    let buf = "";

    // Returns true when the provider signalled end-of-stream.
    const handlePayload = (payload: string): boolean => {
      if (payload === "[DONE]") return true;
      const { text, inTok: i, outTok: o } = extractProviderSse(provider.kind, payload);
      if (i !== undefined) inTok = i;
      if (o !== undefined) outTok = o;
      if (text) { full += text; onDelta(text); }
      return false;
    };
    const finish = (): CompleteResult => {
      const finalOut = outTok || Math.max(1, approxTokens(full));
      recordSuccess(provider.kind, provider.model);
      trail.push({ provider: provider.kind, model: provider.model, ok: true });
      return {
        text: full, model: provider.model, provider: provider.kind,
        inputTokens: inTok, outputTokens: finalOut,
        costUsd: estimateCostUsd(provider.model, inTok, finalOut),
        cached: false, stubbed: false, latencyMs: Date.now() - started,
        attempts: trail,
      };
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line.startsWith("data:") && handlePayload(line.slice(5).trim())) {
            await reader.cancel().catch(() => {});
            return finish();
          }
        }
      }
      const tail = buf.trim();
      if (tail.startsWith("data:")) handlePayload(tail.slice(5).trim());
      return finish();
    } finally {
      try { await reader.cancel(); } catch { /* already closed */ }
    }
    } // — inner 429-rotation loop (every success path returns)
  }
  throw new Error(`All AI providers failed (task=${args.task ?? "generic"}) — last error: ${(lastErr as Error)?.message ?? "unknown"}`);
}

// ── Embeddings (RAG #50) ─────────────────────────────────────────
// OpenAI-compatible /embeddings (openai, together, openrouter, hf, custom) or
// Google text-embedding. BYOK: the user's chat key usually embeds too; if not,
// callers fall back to the platform key, then keyword-only retrieval.
export const DEFAULT_EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
export const EMBEDDING_DIM = 1536; // text-embedding-3-small / text-embedding-ada-002

export type EmbedResult = {
  vectors: number[][];
  model: string;
  stubbed: boolean;
};

export async function embedTexts(
  texts: string[],
  opts: { apiKeyOverride?: string; providerKind?: ProviderKind; modelOverride?: string; baseUrlOverride?: string } = {},
): Promise<EmbedResult> {
  // Platform fallback: only OpenAI-compatible embedding surfaces (Google's
  // embedding models are 768-dim and would fail the 1536-dim RPC guard).
  const platform = getPlatformKeyChain().find(
    (e) => e.kind === "openai" || e.kind === "together" || e.kind === "huggingface" || e.kind === "custom",
  );
  const apiKey = opts.apiKeyOverride || platform?.key || "";
  if (!apiKey || texts.length === 0) return { vectors: [], model: "stub", stubbed: true };

  const kind: ProviderKind = opts.providerKind || detectProviderFromKey(apiKey);
  const model = opts.modelOverride || DEFAULT_EMBEDDING_MODEL;

  if (kind === "google") {
    // Google embeds one text per request on the v1beta surface.
    const base = (opts.baseUrlOverride || process.env.AI_BASE_URL || ENDPOINTS.google.base).replace(/\/+$/, "");
    const out: number[][] = [];
    for (const t of texts) {
      const res = await fetch(`${base}/models/${model}:embedContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text: t }] } }),
      });
      if (!res.ok) throw new Error(`embeddings ${res.status} (google): ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const v = asArr(asObj(data.embedding).values).map(Number);
      if (!v.length) throw new Error("google embeddings: empty vector");
      out.push(v);
    }
    return { vectors: out, model, stubbed: false };
  }

  const baseUrl = (opts.baseUrlOverride || process.env.AI_BASE_URL || ENDPOINTS[kind]?.base || "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error(`No embedding endpoint for provider ${kind}`);
  const provider = resolveProviderFromKind(kind, apiKey, baseUrl);
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: provider.headers,
    body: JSON.stringify({ model, input: texts.map((t) => t.slice(0, 8000)) }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status} (${kind}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out = asArr((data as { data?: unknown }).data)
    .map((d) => asArr(asObj(d).embedding).map(Number))
    .filter((v) => v.length > 0);
  if (out.length !== texts.length) throw new Error(`embeddings: got ${out.length} vectors for ${texts.length} inputs`);
  return { vectors: out, model, stubbed: false };
}
