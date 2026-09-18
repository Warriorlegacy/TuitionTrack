import { NextResponse } from "next/server";
import { videoSchema } from "@/lib/ai/schemas";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { complete, stripReasoningTrace } from "@/lib/ai/provider";
import { getBestKeyForTier } from "@/lib/ai/byok";
import { stripInjection, checkSafety } from "@/lib/ai/safety";
import { checkRateLimit, checkAiBudget, logUsage, logEvent } from "@/lib/ai/usage";
import {
  seedForConcept,
  tryHuggingFaceVideo,
  tryPollinationsVideo,
  parseStoryboard,
  deterministicStoryboard,
  VideoProviderError,
  type VideoBytes,
} from "@/lib/ai/video";

export const dynamic = "force-dynamic";

// Serverless time budget for ALL video providers combined — the remainder of
// the function timeout stays reserved for the storyboard + response. When the
// budget burns without a video, the client gets 202 + the storyboard (instant
// Remotion 3D fallback) and polls; the next poll retries the providers.
const VIDEO_BUDGET_MS = 50_000;
const ENDPOINT = "/api/ai/video";

// GET /api/ai/video?student_id=…&concept=…
//   200 video/mp4            — AI-generated clip (immutable, cacheable)
//   200 {status:"blueprint"} — providers unavailable: render script via Remotion
//   202 {status:"pending"}   — still generating: script now, poll for the mp4
// Provider outages never become 5xx: the Remotion blueprint always succeeds.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = videoSchema.safeParse({
    student_id: url.searchParams.get("student_id"),
    concept: url.searchParams.get("concept"),
  });
  if (!parsed.success) return badRequest("Invalid request", parsed.error.flatten());
  const { student_id, concept } = parsed.data;

  const { error, context } = await requireStudentAccess(student_id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const userId = context.user.id;

  // Rate limit + budget. Wrapped: a logging-DB blip must never 500 learning.
  try {
    const rl = await checkRateLimit(supabase, userId, ENDPOINT);
    if (!rl.ok) return NextResponse.json({ error: rl.reason }, { status: 429 });
    const budget = await checkAiBudget(supabase, student_id);
    if (!budget.ok) return NextResponse.json({ error: budget.reason }, { status: 429 });
  } catch { /* proceed — guards are best-effort */ }

  const clean = stripInjection(concept).trim().slice(0, 200);
  const verdict = checkSafety(clean);
  if (!verdict.ok) return NextResponse.json({ error: verdict.reason }, { status: 400 });

  // One cheap LLM call feeds BOTH the AI-video prompt and the Remotion
  // fallback script — the fallback is concept-specific, never canned.
  let script = deterministicStoryboard(clean);
  let storyboardModel = "deterministic-v1";
  try {
    const best = await getBestKeyForTier(supabase, userId, "A").catch(() => null);
    const result = await complete({
      tier: "A",
      system: "You write micro-lesson storyboards. JSON only.",
      user: `Concept for Indian school students: "${clean}". Reply with ONLY the storyboard JSON object (kicker, title, subtitle, badge, steps[3]{tag,body}, example, ctaTitle, ctaBody, videoPrompt).`,
      maxTokens: 700,
      temperature: 0.5,
      ...(best
        ? {
            apiKeyOverride: best.key,
            providerKind: best.provider.kind,
            baseUrlOverride: best.provider.baseUrl,
            modelOverride: best.model,
          }
        : {}),
    });
    if (!result.stubbed && result.text.trim()) {
      script = parseStoryboard(stripReasoningTrace(result.text), clean);
      storyboardModel = result.model;
    }
  } catch { /* deterministic storyboard stands in */ }

  const seed = seedForConcept(clean);
  const prompt = `${script.videoPrompt} 16:9 educational animation, no text watermark, no subtitles burned in`;
  const started = Date.now();
  const deadline = started + VIDEO_BUDGET_MS;

  // Key resolution: user's own free HF quota first (BYOK-first), platform key
  // second. Pollinations needs no key at all.
  let userHfKey: string | null = null;
  try {
    const best = await getBestKeyForTier(supabase, userId, "A").catch(() => null);
    if (best?.provider.kind === "huggingface") userHfKey = best.key;
  } catch { /* platform key / keyless only */ }
  const platformHfKey = process.env.HUGGINGFACE_API_KEY?.trim() || null;
  const hfKeys = [userHfKey, platformHfKey].filter((k): k is string => Boolean(k));

  const finishVideo = async (video: VideoBytes) => {
    await logUsage(supabase, {
      user_id: userId, student_id, tier: "B", model: video.model,
      endpoint: ENDPOINT, input_tokens: 0, output_tokens: 0,
      cost_usd: 0, latency_ms: Date.now() - started, status: "ok",
    });
    await logEvent(supabase, student_id, "ai_video_generated", {
      concept: clean, model: video.model, storyboard_model: storyboardModel,
    });
    const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "lesson";
    return new Response(video.bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": video.contentType,
        "Content-Length": String(video.bytes.length),
        "Content-Disposition": `inline; filename="${slug}.mp4"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Video-Model": video.model,
      },
    });
  };

  let sawTransient = false;
  // HF attempts (free-tier token: user BYOK, then platform).
  for (const hfKey of hfKeys) {
    try {
      return await finishVideo(await tryHuggingFaceVideo(prompt, hfKey, seed, deadline, request.signal));
    } catch (e) {
      if (e instanceof VideoProviderError && !e.transient) break; // bad key/prompt — next provider
      sawTransient = true;
      if (Date.now() >= deadline) break;
    }
  }
  // Pollinations keyless free tier (key from env raises limits when set).
  if (Date.now() < deadline) {
    try {
      return await finishVideo(await tryPollinationsVideo(prompt, seed, deadline, request.signal));
    } catch (e) {
      if (!(e instanceof VideoProviderError) || e.transient) sawTransient = true;
    }
  }

  await logUsage(supabase, {
    user_id: userId, student_id, tier: "B",
    model: sawTransient ? "pending-retry" : "remotion-blueprint",
    endpoint: ENDPOINT, input_tokens: 0, output_tokens: 0,
    cost_usd: 0, latency_ms: Date.now() - started,
    status: sawTransient ? "pending" : "ok",
  });

  // Transient exhaustion (timeouts/queues/rate limits): the clip may still be
  // renderable on retry — client polls the same URL. Permanent failure or no
  // keys at all: blueprint — the Remotion 3D animation plays immediately.
  if (sawTransient) {
    return NextResponse.json(
      { status: "pending", script, retryAfter: 12 },
      { status: 202, headers: { "Retry-After": "12" } },
    );
  }
  return NextResponse.json({ status: "blueprint", script });
}
