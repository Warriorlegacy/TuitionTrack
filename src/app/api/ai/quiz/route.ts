import { NextResponse } from "next/server";
import { quizSchema } from "@/lib/ai/schemas";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { complete, PROMPT_VERSION } from "@/lib/ai/provider";
import { getBestKeyForTier } from "@/lib/ai/byok";
import { qualityGate } from "@/lib/ai/quality";
import { checkRateLimit, logUsage, logEvent } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

// Assessment agent: generation only; deterministic qualityGate verifies (#22).
export async function POST(request: Request) {
  const parsed = quizSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request", parsed.error.flatten());
  const input = parsed.data;
  const { error, context } = await requireStudentAccess(input.student_id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const rl = await checkRateLimit(supabase, context.user.id, "/api/ai/quiz");
  if (!rl.ok) return NextResponse.json({ error: rl.reason }, { status: 429 });

  const { data: concept } = input.concept_id
    ? await supabase.from("syllabus_nodes").select("id, title, level").eq("id", input.concept_id).maybeSingle()
    : { data: null };
  const { data: existing } = await supabase.from("questions").select("stem").limit(50);
  const existingStems = ((existing ?? []) as { stem: string }[]).map((q) => q.stem);

  let drafts: { stem: string; options: string[]; answer: string; explanation: string }[] = [];
  let stubbed = true;
  try {
    const best = await getBestKeyForTier(supabase, context.user.id, "B");
    const r = await complete({
      tier: "B",
      task: "quiz_generation",
      system: `Generate ${input.count} ${input.qtype} questions at difficulty ${input.difficulty}/5. Return JSON array [{stem, options[4], answer, explanation}]. Syllabus-accurate, unambiguous.`,
      user: `Concept: ${concept?.title ?? "general practice"}. Count ${input.count}.`,
      maxTokens: 1200,
      ...(best ? { apiKeyOverride: best.key, providerKind: best.provider.kind, baseUrlOverride: best.provider.baseUrl, modelOverride: best.model, allowFallbacks: best.allowFallbacks, freeOnly: best.freeOnly } : {}),
    });
    stubbed = r.stubbed;
    const m = r.text.match(/\[[\s\S]*\]/);
    if (m) drafts = JSON.parse(m[0]);
    await logUsage(supabase, {
      user_id: context.user.id, student_id: input.student_id, tier: "B", model: r.model,
      endpoint: "/api/ai/quiz", input_tokens: r.inputTokens, output_tokens: r.outputTokens,
      cost_usd: r.costUsd, latency_ms: r.latencyMs,
    });
  } catch { /* fall through to template */ }
  if (!drafts.length) {
    // deterministic template keeps slice usable with zero spend
    const topic = concept?.title ?? "general practice";
    drafts = Array.from({ length: input.count }, (_, i) => ({
      stem: `Q${i + 1}: Which statement about ${topic} is correct? (difficulty ${input.difficulty}/5)`,
      options: ["Option A (correct concept)", "Common misconception 1", "Common misconception 2", "Out-of-syllabus distractor"],
      answer: "A",
      explanation: `Review the definition of ${topic}, then eliminate distractors.`,
    }));
  }

  const out = [];
  for (const d of drafts.slice(0, input.count)) {
    const verdict = qualityGate({
      stem: d.stem, options: d.options,
      finalAnswer: input.qtype === "numeric" ? d.answer : undefined,
      existingStems, difficulty: input.difficulty, qtype: input.qtype,
    });
    const { data: q } = await supabase.from("questions").insert({
      teacher_id: context.user.id, syllabus_node_id: input.concept_id ?? null,
      stem: d.stem, qtype: input.qtype, difficulty: input.difficulty,
      generated_by: "ai", model: stubbed ? "stub-tier-B" : "tier-B",
      prompt_version: PROMPT_VERSION, quality_score: verdict.qualityScore,
      risk_level: verdict.risk, status: verdict.needsReview ? "draft" : "published",
    }).select("id").single();
    if (!q) continue;
    const labels = ["A", "B", "C", "D", "E"];
    await supabase.from("question_options").insert(
      d.options.map((text, i) => ({
        question_id: q.id, label: labels[i] ?? String(i + 1), text,
        is_correct: labels[i] === d.answer || (i === 0 && !labels.includes(d.answer)),
      })),
    );
    await supabase.from("question_solutions").insert({
      question_id: q.id, steps: [{ t: d.explanation }], final_answer: d.answer, verified_by: "none",
    });
    existingStems.push(d.stem);
    out.push({ id: q.id, stem: d.stem, options: d.options, quality_score: verdict.qualityScore, risk: verdict.risk, needs_review: verdict.needsReview, flags: verdict.flags });
  }
  await logEvent(supabase, input.student_id, "quiz_generated", { count: out.length, concept_id: input.concept_id ?? null });
  return NextResponse.json({ questions: out, stubbed, prompt_version: PROMPT_VERSION }, { status: 201 });
}
