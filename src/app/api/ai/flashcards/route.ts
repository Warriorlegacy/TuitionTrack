import { NextResponse } from "next/server";
import { flashcardSchema } from "@/lib/ai/schemas";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { complete, PROMPT_VERSION } from "@/lib/ai/provider";
import { initialFsrs } from "@/lib/ai/fsrs-lite";
import { getBestKeyForTier } from "@/lib/ai/byok";
import { checkRateLimit, logUsage, logEvent } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

// Content agent: flashcards → spaced_items with FSRS initial state (#19).
export async function POST(request: Request) {
  const parsed = flashcardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request", parsed.error.flatten());
  const input = parsed.data;
  const { error, context } = await requireStudentAccess(input.student_id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const rl = await checkRateLimit(supabase, context.user.id, "/api/ai/flashcards");
  if (!rl.ok) return NextResponse.json({ error: rl.reason }, { status: 429 });

  let cards: { front: string; back: string }[] =
    input.front && input.back ? [{ front: input.front, back: input.back }] : [];
  let stubbed = true;
  if (!cards.length) {
    try {
      const best = await getBestKeyForTier(supabase, context.user.id, "B");
      const r = await complete({
        tier: "B",
        system: `Create ${input.count} flashcards as JSON [{front, back}]. Atomic facts, one idea per card, exam-accurate.`,
        user: `Concept id: ${input.concept_id ?? "general"}. Count ${input.count}.`,
        maxTokens: 900,
        ...(best ? { apiKeyOverride: best.key, providerKind: best.provider.kind, baseUrlOverride: best.provider.baseUrl, modelOverride: best.model } : {}),
      });
      stubbed = r.stubbed;
      const m = r.text.match(/\[[\s\S]*\]/);
      if (m) cards = JSON.parse(m[0]);
      await logUsage(supabase, {
        user_id: context.user.id, student_id: input.student_id, tier: "B", model: r.model,
        endpoint: "/api/ai/flashcards", input_tokens: r.inputTokens, output_tokens: r.outputTokens,
        cost_usd: r.costUsd, latency_ms: r.latencyMs,
      });
    } catch { /* template fallback */ }
  }
  if (!cards.length) {
    cards = Array.from({ length: input.count }, (_, i) => ({
      front: `Recall card ${i + 1} — key fact (${input.concept_id ?? "general"})`,
      back: "Answer: define in your own words, then check notes. (Stub — set OPENAI_API_KEY for generated cards.)",
    }));
  }
  const init = initialFsrs();
  const { data } = await supabase.from("spaced_items").insert(
    cards.slice(0, input.count).map((c) => ({
      student_id: input.student_id, concept_id: input.concept_id ?? null,
      front: c.front, back: c.back,
      stability: init.stability, difficulty: init.difficulty, state: "new" as never,
      due_at: new Date().toISOString(),
    })),
  ).select("id, front, back, due_at");
  await logEvent(supabase, input.student_id, "flashcards_created", { count: data?.length ?? 0 });
  return NextResponse.json({ cards: data ?? [], stubbed, prompt_version: PROMPT_VERSION }, { status: 201 });
}
