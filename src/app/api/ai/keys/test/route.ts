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

  if (!apiKey || !provider) {
    return NextResponse.json({ error: "api_key and provider required" }, { status: 400 });
  }

  const kind = (provider as string) === "custom" ? "custom" : detectProviderFromKey(apiKey);
  // Provider-correct free default (the old hardcoded gpt-4o-mini broke Groq/
  // Together/HuggingFace tests with model_not_found).
  const model = pickModel("A", kind, true, null, null);

  try {
    const result = await complete({
      tier: "A", system: "You are a helpful assistant.", user: "Say 'OK' only.",
      apiKeyOverride: apiKey, providerKind: kind, baseUrlOverride: baseUrl, modelOverride: model,
      maxTokens: 10,
    });
    return NextResponse.json({ ok: true, model: result.model, latencyMs: result.latencyMs, text: result.text });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
