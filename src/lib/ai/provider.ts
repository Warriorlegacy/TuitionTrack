// Provider abstraction + cost tiers (blueprint #45, #47, #65).
//
// The blueprint is explicit on two points: the AI layer must not be hard-coded
// around one model vendor, and calls must route by cost tier. This module speaks
// any OpenAI-compatible chat-completions API:
//
//   • OpenAI      — default for an `sk-…` key
//   • OpenRouter  — auto-detected from an `sk-or-…` key, so the three tiers can
//                   mix vendors (OpenAI / Anthropic / Google) without touching
//                   route code
//   • any other   — set AI_BASE_URL to an OpenAI-compatible endpoint
//
// LLM explains; the deterministic layer verifies (blueprint #22).

export const PROMPT_VERSION = "mvp1-2026-09-16";
export type AiTier = "A" | "B" | "C" | "deterministic";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Per-tier defaults, namespaced per provider. AI_MODEL_TIER_* always wins, so a
// deployment can pin e.g. Tier A to a cheap Gemini slug and Tier C to Claude.
const DEFAULT_MODELS: Record<"A" | "B" | "C", { openai: string; openrouter: string }> = {
  A: { openai: "gpt-4o-mini", openrouter: "openai/gpt-4o-mini" }, // classify / OCR / tag
  B: { openai: "gpt-4o-mini", openrouter: "openai/gpt-4o-mini" }, // tutor / question gen
  C: { openai: "gpt-4o", openrouter: "openai/gpt-4o" }, // hard reasoning / teacher copilot
};

const ENV_MODELS: Record<"A" | "B" | "C", string | undefined> = {
  A: process.env.AI_MODEL_TIER_A,
  B: process.env.AI_MODEL_TIER_B,
  C: process.env.AI_MODEL_TIER_C,
};

type Provider = { baseUrl: string; kind: "openai" | "openrouter" | "custom" };

function resolveProvider(apiKey: string): Provider {
  const explicit = process.env.AI_BASE_URL?.trim().replace(/\/+$/, "");
  if (explicit) {
    return {
      baseUrl: explicit,
      kind: explicit.includes("openrouter.ai") ? "openrouter" : "custom",
    };
  }
  // OpenRouter keys are `sk-or-v1-…`; sending one to api.openai.com yields a
  // confusing 401, so detect it instead of requiring an extra env var.
  if (apiKey.startsWith("sk-or-")) return { baseUrl: OPENROUTER_BASE_URL, kind: "openrouter" };
  return { baseUrl: OPENAI_BASE_URL, kind: "openai" };
}

function modelForTierOn(tier: "A" | "B" | "C", provider: Provider): string {
  const override = ENV_MODELS[tier];
  if (override) return override;
  return provider.kind === "openrouter" ? DEFAULT_MODELS[tier].openrouter : DEFAULT_MODELS[tier].openai;
}

/** Resolved model slug for a tier (used for logging and cost attribution). */
export function modelForTier(tier: AiTier): string {
  if (tier === "deterministic") return "deterministic-v1";
  return modelForTierOn(tier, resolveProvider(process.env.OPENAI_API_KEY ?? ""));
}

// Rough USD per 1k tokens. Overridden in practice by real billing in
// model_usage; this exists so the per-student budget guard (#65) has a number.
const PRICE_PER_1K: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.00015, out: 0.0006 },
  "gpt-4o": { in: 0.0025, out: 0.01 },
  "openai/gpt-4o-mini": { in: 0.00015, out: 0.0006 },
  "openai/gpt-4o": { in: 0.0025, out: 0.01 },
  "google/gemini-flash-1.5": { in: 0.000075, out: 0.0003 },
  "anthropic/claude-3.5-sonnet": { in: 0.003, out: 0.015 },
};

// Conservative fallback: unknown models are priced at the cheap tier so spend is
// never *under*-counted against the student's cap.
const FALLBACK_PRICE = { in: 0.00015, out: 0.0006 };

export function estimateCostUsd(model: string, inTok: number, outTok: number): number {
  const p = PRICE_PER_1K[model] ?? FALLBACK_PRICE;
  return Number((((inTok / 1000) * p.in + (outTok / 1000) * p.out).toFixed(6)));
}

export type CompleteArgs = {
  tier: AiTier;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
};

export type CompleteResult = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  cached: boolean;
  stubbed: boolean;
  latencyMs: number;
};

const approxTokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

// Deterministic stub so the slice works with no API key / zero spend.
function stubReply(system: string, user: string): string {
  const socratic = system.includes("Socratic");
  if (socratic) {
    return (
      `Let's work this through step by step.\n\n` +
      `1. What do you already know from the question? Reply with the given values.\n` +
      `2. What is it asking for — a value, a reason, or a method?\n` +
      `3. Try the first step on your own, then say "check my answer".\n\n` +
      `Hint: restate the question in your own words first. ` +
      `(Stub tutor — set OPENAI_API_KEY for full Tier-B tutoring. Prompt ${PROMPT_VERSION}.)\n` +
      `You said: "${user.slice(0, 160)}"`
    );
  }
  return (
    `Stub response (no OPENAI_API_KEY). Prompt ${PROMPT_VERSION}.\n` + `Echo: ${user.slice(0, 300)}`
  );
}

export async function complete(args: CompleteArgs): Promise<CompleteResult> {
  const started = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || args.tier === "deterministic") {
    const provider = resolveProvider(apiKey ?? "");
    const model = args.tier === "deterministic" ? "deterministic-v1" : modelForTierOn(args.tier, provider);
    const text = stubReply(args.system, args.user);
    const inTok = approxTokens(args.system + args.user);
    const outTok = approxTokens(text);
    return {
      text,
      model: "stub-" + model,
      inputTokens: inTok,
      outputTokens: outTok,
      costUsd: 0,
      cached: false,
      stubbed: true,
      latencyMs: Date.now() - started,
    };
  }

  const provider = resolveProvider(apiKey);
  const model = modelForTierOn(args.tier, provider);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider.kind === "openrouter") {
    // OpenRouter attribution headers (optional, but they surface the app in
    // their dashboard and keep requests identifiable in rate-limit reviews).
    headers["X-Title"] = "TuitionTrack AI";
    if (process.env.NEXT_PUBLIC_APP_URL) headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL;
  }

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      max_tokens: args.maxTokens ?? 600,
      temperature: args.temperature ?? (args.tier === "A" ? 0.1 : 0.6),
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 401) {
      throw new Error(
        `provider 401 (${provider.kind} @ ${provider.baseUrl}) — the API key was rejected. ` +
          (provider.kind === "openai"
            ? "OPENAI_API_KEY looks like an OpenAI key; if it is an OpenRouter key (sk-or-…) " +
              "set AI_BASE_URL=https://openrouter.ai/api/v1."
            : "Check the key and AI_BASE_URL, and that the model slug is valid for this provider.") +
          ` Response: ${body}`,
      );
    }
    throw new Error(`provider ${res.status} (${provider.kind}): ${body}`);
  }

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  const inTok: number = data.usage?.prompt_tokens ?? approxTokens(args.system + args.user);
  const outTok: number = data.usage?.completion_tokens ?? approxTokens(text);

  return {
    text,
    model,
    inputTokens: inTok,
    outputTokens: outTok,
    costUsd: estimateCostUsd(model, inTok, outTok),
    cached: false,
    stubbed: false,
    latencyMs: Date.now() - started,
  };
}
