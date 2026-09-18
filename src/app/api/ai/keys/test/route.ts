import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { complete, detectProviderFromKey, pickModel } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

// POST /api/ai/keys/test — validate a key without saving it
export async function POST(request: Request) {
  const context = await requireAuthContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const apiKey = body?.api_key as string | undefined;
  const provider = body?.provider as string | undefined;
  const baseUrl = body?.base_url as string | undefined;

  if (!provider || (!apiKey && provider !== "ollama")) {
    return NextResponse.json({ error: "api_key and provider required" }, { status: 400 });
  }

  // ponytail: local ollama needs no key — dummy key + local base override.
  const key = apiKey || "ollama";
  const base = baseUrl || (provider === "ollama"
    ? process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1"
    : undefined);
  const kind = provider === "custom" ? "custom"
    : provider === "ollama" ? "ollama" : detectProviderFromKey(key);
  // Provider-correct free default (the old hardcoded gpt-4o-mini broke Groq/
  // Together/HuggingFace tests with model_not_found).
  const model = pickModel("A", kind, true, null, null);

  try {
    const result = await complete({
      tier: "A", system: "You are a helpful assistant.", user: "Say 'OK' only.",
      apiKeyOverride: key, providerKind: kind, baseUrlOverride: base, modelOverride: model,
      // Free models can be reasoning models that spend tokens on a thinking
      // trace before answering — a tiny budget returns the trace, not the answer.
      maxTokens: 300,
    });
    return NextResponse.json({ ok: true, model: result.model, latencyMs: result.latencyMs, text: result.text });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
