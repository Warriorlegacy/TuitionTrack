import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { PROVIDER_FREE_MODELS, type ProviderKind } from "@/lib/ai/provider";
import { getOpenCodeCatalog } from "@/lib/ai/opencode-catalog";

export const dynamic = "force-dynamic";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
let liveCache: { at: number; models: string[] } | null = null;
const CACHE_MS = 60 * 60 * 1000;

const VALID_PROVIDERS = new Set<string>([
  "openai", "anthropic", "google", "groq", "together", "openrouter",
  "huggingface", "nvidia", "deepseek", "ollama", "ollama_cloud", "github", "opencode", "custom",
]);

async function liveOpenRouterFreeModels(): Promise<{ models: string[]; live: boolean }> {
  if (liveCache && Date.now() - liveCache.at < CACHE_MS) {
    return { models: liveCache.models, live: true };
  }
  const res = await fetch(OPENROUTER_MODELS_URL, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`openrouter models ${res.status}`);
  const data = (await res.json()) as { data?: { id?: string }[] };
  const models = ((data.data ?? []) as { id?: string }[])
    .map((m) => m.id ?? "")
    .filter((id) => id.endsWith(":free"))
    .sort();
  if (!models.length) throw new Error("openrouter returned no free models");
  liveCache = { at: Date.now(), models };
  return { models, live: true };
}

async function liveGroqModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Groq returned ${res.status}`);
  const data = (await res.json()) as { data?: { id?: string }[] };
  const models = ((data.data ?? []) as { id?: string }[])
    .map((m) => m.id ?? "")
    .filter((id) => id && !id.startsWith("whisper-") && !id.includes("embed") && !id.includes("orpheus"))
    .sort();
  return models;
}

async function liveOpenAiModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`OpenAI returned ${res.status}`);
  const data = (await res.json()) as { data?: { id?: string }[] };
  const models = ((data.data ?? []) as { id?: string }[])
    .map((m) => m.id ?? "")
    .filter((id) => id && (id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3") || id.startsWith("chatgpt")))
    .sort();
  return models;
}

async function liveGoogleModels(apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`Google returned ${res.status}`);
  const data = (await res.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
  const models = ((data.models ?? []) as { name?: string; supportedGenerationMethods?: string[] }[])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter((id) => id && !id.includes("embedding") && !id.includes("aqa"))
    .sort();
  return models;
}

async function resolveModels(
  provider: string,
  apiKey?: string
): Promise<{ provider: string; models: string[]; live: boolean; all?: unknown; warning?: string }> {
  const kind = provider as ProviderKind;
  if (kind === "opencode") {
    const catalog = await getOpenCodeCatalog();
    return {
      provider,
      models: catalog.entries.filter((e) => e.pricing === "free").map((e) => e.id),
      all: catalog.entries,
      live: catalog.live,
    };
  }

  if (kind === "openrouter") {
    try {
      const { models } = await liveOpenRouterFreeModels();
      return { provider, models, live: true };
    } catch (e) {
      return {
        provider,
        models: PROVIDER_FREE_MODELS.openrouter,
        live: false,
        warning: (e as Error).message,
      };
    }
  }

  // If a live API key is supplied, attempt live model catalog discovery
  if (apiKey && apiKey.trim() && apiKey.trim() !== "ollama") {
    try {
      if (kind === "groq") {
        const models = await liveGroqModels(apiKey);
        if (models.length) return { provider, models, live: true };
      } else if (kind === "openai") {
        const models = await liveOpenAiModels(apiKey);
        if (models.length) return { provider, models, live: true };
      } else if (kind === "google") {
        const models = await liveGoogleModels(apiKey);
        if (models.length) return { provider, models, live: true };
      }
    } catch (err) {
      // Return curated list on error with warning
      return {
        provider,
        models: PROVIDER_FREE_MODELS[kind] ?? [],
        live: false,
        warning: (err as Error).message,
      };
    }
  }

  return { provider, models: PROVIDER_FREE_MODELS[kind] ?? [], live: false };
}

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }
  const url = new URL(request.url);
  const provider = (url.searchParams.get("provider") ?? "openrouter").toLowerCase();
  const apiKey = url.searchParams.get("apiKey") ?? undefined;

  if (!VALID_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }

  const result = await resolveModels(provider, apiKey);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { provider?: string; apiKey?: string } | null;
  const provider = (body?.provider ?? "openrouter").toLowerCase();
  const apiKey = body?.apiKey;

  if (!VALID_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }

  const result = await resolveModels(provider, apiKey);
  return NextResponse.json(result);
}
