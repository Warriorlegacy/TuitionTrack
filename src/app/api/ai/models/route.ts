import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { PROVIDER_FREE_MODELS, type ProviderKind } from "@/lib/ai/provider";
import { getOpenCodeCatalog } from "@/lib/ai/opencode-catalog";

export const dynamic = "force-dynamic";

// GET /api/ai/models?provider=openrouter — free-model catalogue for the
// AI Settings model picker. OpenRouter is fetched LIVE (its :free roster
// churns); every other provider returns the curated free list. No keys, no
// costs, no PII — only public model slugs.
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
let liveCache: { at: number; models: string[] } | null = null;
const CACHE_MS = 60 * 60 * 1000;

const VALID_PROVIDERS = new Set<string>([
  "openai", "anthropic", "google", "groq", "together", "openrouter",
  "huggingface", "nvidia", "deepseek", "ollama", "github", "opencode", "custom",
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

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }
  const provider = (new URL(request.url).searchParams.get("provider") ?? "openrouter").toLowerCase();
  if (!VALID_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }
  const kind = provider as ProviderKind;
  if (kind === "opencode") {
    // Live OpenCode catalog with free/unknown pricing labels. Unknown pricing
    // is NEVER auto-used in free-only mode (see opencode-catalog.ts).
    const catalog = await getOpenCodeCatalog();
    return NextResponse.json({
      provider,
      models: catalog.entries.filter((e) => e.pricing === "free").map((e) => e.id),
      all: catalog.entries,
      live: catalog.live,
    });
  }
  if (kind === "openrouter") {
    try {
      const { models } = await liveOpenRouterFreeModels();
      return NextResponse.json({ provider, models, live: true });
    } catch (e) {
      // Live fetch failed — fall back to the curated list, honestly labelled.
      return NextResponse.json({
        provider, models: PROVIDER_FREE_MODELS.openrouter, live: false,
        warning: (e as Error).message,
      });
    }
  }
  return NextResponse.json({ provider, models: PROVIDER_FREE_MODELS[kind] ?? [], live: false });
}
