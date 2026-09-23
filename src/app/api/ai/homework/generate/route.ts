import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBestKeyForTier } from "@/lib/ai/byok";
import { checkRateLimit, logUsage } from "@/lib/ai/usage";
import { providerDisplayName } from "@/lib/ai/provider";
import { generateHomeworkAssignment, type AiKeyOverride, type HomeworkGenerationRequest } from "@/lib/homework/variation-engine";

export const dynamic = "force-dynamic";

// Rate limits for the studio (generation is expensive: 1 + N student calls).
const ENDPOINT = "/api/ai/homework/generate";

export async function POST(req: Request) {
  const started = Date.now();
  try {
    // ponytail: getAuthContext (not requireAuthContext) — require* throws a
    // NEXT_REDIRECT digest that route handlers surface as a 500. API routes
    // must return JSON status codes instead.
    const context = await getAuthContext();
    if (!context.user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }
    if (context.role !== "teacher") {
      return NextResponse.json({ error: "Only teachers can generate homework." }, { status: 403 });
    }

    const body = (await req.json()) as HomeworkGenerationRequest;

    if (!body.chapterSlug) {
      return NextResponse.json({ error: "chapterSlug is required." }, { status: 400 });
    }
    if (!body.classLevel || !body.subject) {
      return NextResponse.json({ error: "classLevel and subject are required." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const rl = await checkRateLimit(supabase, context.user.id, ENDPOINT);
    if (!rl.ok) {
      return NextResponse.json({ error: rl.reason }, { status: 429 });
    }

    // BYOK first (teacher's own key + model prefs), platform chain otherwise.
    // Resolution is server-side only — keys never reach the browser.
    let key: AiKeyOverride | undefined;
    try {
      const best = await getBestKeyForTier(supabase, context.user.id, "B");
      if (best) {
        key = {
          apiKeyOverride: best.key,
          providerKind: best.provider.kind,
          baseUrlOverride: best.provider.baseUrl,
          modelOverride: best.model,
        };
      }
    } catch {
      // Fall through to the platform chain.
    }

    // Anti-repetition: collect fingerprints + stems from this teacher's recent
    // assignments for the same class/subject/chapter.
    const recentStems: string[] = [];
    const excludeFingerprints: string[] = [];
    try {
      const admin = createSupabaseAdminClient();
      const { data: recent } = await admin
        .from("assignments")
        .select("id")
        .eq("teacher_id", context.user.id)
        .eq("class_level", body.classLevel)
        .eq("subject", body.subject)
        .eq("chapter_slug", body.chapterSlug)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      const ids = ((recent ?? []) as { id: string }[]).map((r) => r.id);
      if (ids.length > 0) {
        const { data: qs } = await admin
          .from("assignment_questions")
          .select("stem, fingerprint")
          .in("assignment_id", ids)
          .limit(200);
        for (const q of ((qs ?? []) as { stem: string; fingerprint: string }[])) {
          if (q.stem) recentStems.push(q.stem);
          if (q.fingerprint) excludeFingerprints.push(q.fingerprint);
        }
      }
    } catch {
      // Best-effort — generation still proceeds without avoidance context.
    }

    const assignment = await generateHomeworkAssignment(
      {
        ...body,
        recentStems: [...(body.recentStems ?? []), ...recentStems],
        excludeFingerprints: [...(body.excludeFingerprints ?? []), ...excludeFingerprints],
      },
      context.user.id,
      key
    );

    // Observability: structured log (provider/model/duration/validation — no keys, no PII).
    console.log(JSON.stringify({
      event: "homework_generate",
      provider: assignment.provider,
      model: assignment.model,
      classLevel: assignment.classLevel,
      subject: assignment.subject,
      chapter: body.chapterSlug,
      questionCount: assignment.questions.length,
      variants: assignment.studentVariants ? Object.keys(assignment.studentVariants).length : 0,
      validation: assignment.validation,
      latencyMs: Date.now() - started,
    }));

    // Best-effort cost tracking (same model_usage ledger the tutor uses).
    try {
      await logUsage(supabase, {
        user_id: context.user.id,
        tier: "B",
        model: assignment.model,
        endpoint: ENDPOINT,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        latency_ms: Date.now() - started,
        status: `ok:${assignment.provider}`,
      });
    } catch {
      // Never fail generation on ledger errors.
    }

    return NextResponse.json({
      success: true,
      assignment,
      provider: assignment.provider,
      providerLabel: providerDisplayName(assignment.provider),
      model: assignment.model,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "homework_generate_failed",
      error: (error as Error).message,
      latencyMs: Date.now() - started,
    }));
    return NextResponse.json(
      { error: (error as Error).message || "Failed to generate homework." },
      { status: 500 }
    );
  }
}
