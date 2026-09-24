import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { complete, detectProviderFromKey, pickModel, clearCooldown, type ProviderKind } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

// POST /api/ai/keys/test — validate a key without saving it
export async function POST(request: Request) {
  const context = await requireAuthContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const apiKey = body?.api_key as string | undefined;
  const provider = body?.provider as string | undefined;
  const baseUrl = body?.base_url as string | undefined;
  const requestedModel = body?.model as string | undefined;

  const isOllamaLike = provider === "ollama" || provider === "ollama_cloud";
  if (!provider || (!apiKey && !isOllamaLike)) {
    return NextResponse.json({ error: "api_key and provider required" }, { status: 400 });
  }

  const key = apiKey || (isOllamaLike ? "ollama" : "");
  const base = baseUrl || (provider === "ollama"
    ? process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1"
    : provider === "ollama_cloud"
      ? process.env.OLLAMA_CLOUD_BASE_URL || "https://api.ollamacloud.com/v1"
      : undefined);

  const kind: ProviderKind = provider === "custom"
    ? "custom"
    : provider === "ollama"
      ? "ollama"
      : provider === "ollama_cloud"
        ? "ollama_cloud"
        : detectProviderFromKey(key);

  const model = requestedModel?.trim() || pickModel("A", kind, true, null, null);

  // Clear any existing cooldown for this model so an explicit test always executes fresh
  clearCooldown(kind, model);

  try {
    const result = await complete({
      tier: "A",
      system: "You are a helpful assistant.",
      user: "Say 'OK' only.",
      apiKeyOverride: key,
      providerKind: kind,
      baseUrlOverride: base,
      modelOverride: model,
      maxTokens: 300,
      allowFallbacks: false, // Explicitly test THIS key and model, no failover
      freeOnly: false, // Testing a key tests the key itself regardless of platform cost mode
    });
    return NextResponse.json({ ok: true, model: result.model, latencyMs: result.latencyMs, text: result.text });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
