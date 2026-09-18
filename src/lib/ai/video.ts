// Free video generation chain for 3D animated learning videos.
//
// Free-first order (no credit card on any tier):
//   1. HuggingFace Inference Providers text-to-video (LTX-Video, HunyuanVideo)
//      — free-tier `hf_` token (platform HUGGINGFACE_API_KEY or the user's own
//      BYOK key). Raw MP4 bytes back.
//   2. Pollinations video API (seedance) — keyless free tier (1 req/30s/IP),
//      upgraded by optional POLLINATIONS_API_KEY. Direct MP4 stream.
//   3. Remotion blueprint — always succeeds: the storyboard below renders as
//      a programmatic 3D animation in-app via @remotion/player. Zero cost,
//      zero quota, zero failure modes.
//
// Degradation contract (mirrors provider.ts): provider failures never throw
// to the route as 5xx. Attempt functions throw typed VideoProviderError with
// `transient=true` for retryable states (timeout/429/5xx/loading) and
// `transient=false` for permanent ones (bad key, bad prompt) — the route
// turns transient exhaustion into 202-pending and permanent failure into the
// blueprint. Total provider time is capped by VIDEO_BUDGET_MS so serverless
// functions never blow their timeout.

export type LessonScript = {
  kicker: string;
  title: string;
  subtitle: string;
  badge: string;
  durationLabel: string;
  steps: { tag: string; body: string }[];
  example: string;
  ctaTitle: string;
  ctaBody: string;
  videoPrompt: string;
};

export type VideoBytes = {
  bytes: Uint8Array;
  contentType: string;
  model: string;
};

export class VideoProviderError extends Error {
  transient: boolean;
  constructor(message: string, transient: boolean) {
    super(message);
    this.transient = transient;
  }
}

// Deterministic seed per concept: same concept → same video → CDN/browser
// caches actually hit instead of regenerating every view.
export function seedForConcept(concept: string): number {
  let h = 2166136261;
  for (let i = 0; i < concept.length; i++) {
    h ^= concept.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1_000_000;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Provider 1: HuggingFace Inference Providers (text-to-video) ──────
// POST https://router.huggingface.co/hf-inference/models/{id}
// { inputs, parameters } → raw video bytes. 503 while the model loads,
// with { estimated_time } to wait out.
const HF_MODELS = [
  process.env.AI_VIDEO_MODEL?.trim(),
  "Lightricks/LTX-Video-0.9.8-13B-distilled",
  "tencent/HunyuanVideo",
].filter((m): m is string => Boolean(m));

export async function tryHuggingFaceVideo(
  prompt: string,
  hfKey: string,
  seed: number,
  deadline: number,
  signal?: AbortSignal,
): Promise<VideoBytes> {
  let lastErr = "";
  for (const model of HF_MODELS) {
    let attempt = 0;
    for (;;) {
      if (Date.now() >= deadline) throw new VideoProviderError(lastErr || "HF budget exhausted", true);
      if (signal?.aborted) throw new VideoProviderError("request aborted", true);
      attempt++;
      let res: Response;
      try {
        res = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfKey}`,
            "Content-Type": "application/json",
            Accept: "video/mp4",
          },
          body: JSON.stringify({ inputs: prompt, parameters: { seed } }),
          signal: signal ?? null,
        });
      } catch (e) {
        // Aborts surface here too — transient either way.
        throw new VideoProviderError(`HF network: ${(e as Error).message}`.slice(0, 160), true);
      }
      if (res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.startsWith("video/")) {
          lastErr = `HF ${model}: non-video response (${ct.slice(0, 40)})`;
          break; // wrong task type for this model — try next model
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.length < 1024) {
          lastErr = `HF ${model}: empty video`;
          break;
        }
        return { bytes: buf, contentType: ct.split(";")[0], model: `hf:${model}` };
      }
      if (res.status === 401 || res.status === 403) {
        throw new VideoProviderError("HF key rejected (401/403)", false);
      }
      if (res.status === 400 || res.status === 404 || res.status === 422) {
        lastErr = `HF ${model}: ${res.status} ${(await res.text()).slice(0, 120)}`;
        break; // model slug unsupported — try next model
      }
      if (res.status === 429) {
        lastErr = `HF ${model}: quota exhausted (429)`;
        break; // quota is per-model — try next model
      }
      if (res.status === 503 && attempt <= 4) {
        // Model cold-loading: wait the estimate (or 20s) and retry same model.
        const body = await res.text().catch(() => "");
        let waitMs = 20_000;
        try {
          const est = (JSON.parse(body) as { estimated_time?: unknown }).estimated_time;
          if (typeof est === "number" && est > 0) waitMs = Math.min(est * 1000 + 2000, 45_000);
        } catch { /* plain-text 503 — default wait */ }
        await sleep(Math.min(waitMs, Math.max(deadline - Date.now() - 1000, 0)));
        continue;
      }
      lastErr = `HF ${model}: ${res.status} ${(await res.text()).slice(0, 120)}`;
      break;
    }
  }
  const permanent = /401|403/.test(lastErr);
  throw new VideoProviderError(lastErr || "HF: all models failed", !permanent);
}

// ── Provider 2: Pollinations video (keyless free tier + optional key) ─
// GET https://gen.pollinations.ai/video/{prompt}?model=seedance&duration=5
// → direct MP4. Unauthenticated: 1 req/30s/IP. private=true keeps student
// concepts out of the public feed and enables immutable caching.
export async function tryPollinationsVideo(
  prompt: string,
  seed: number,
  deadline: number,
  signal?: AbortSignal,
): Promise<VideoBytes> {
  const params = new URLSearchParams({
    model: process.env.AI_VIDEO_POLLINATIONS_MODEL?.trim() || "seedance",
    duration: "5",
    aspectRatio: "16:9",
    seed: String(seed),
    private: "true",
  });
  const key = process.env.POLLINATIONS_API_KEY?.trim();
  if (key) params.set("key", key);
  const url = `https://gen.pollinations.ai/video/${encodeURIComponent(prompt)}?${params}`;

  const msLeft = () => Math.max(deadline - Date.now(), 0);
  if (msLeft() < 5000) throw new VideoProviderError("pollinations: no time budget left", true);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), msLeft());
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(url, {
      headers: { Accept: "video/mp4" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 400) {
        return Promise.reject(
          new VideoProviderError(`pollinations: ${res.status} ${body.slice(0, 120)}`, false),
        );
      }
      throw new VideoProviderError(
        `pollinations: ${res.status} ${body.slice(0, 120)}`,
        res.status === 429 || res.status >= 500 || res.status === 504,
      );
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("video/")) {
      throw new VideoProviderError(`pollinations: non-video response (${ct.slice(0, 40)})`, true);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 1024) throw new VideoProviderError("pollinations: empty video", true);
    return { bytes: buf, contentType: ct.split(";")[0], model: "pollinations:seedance" };
  } catch (e) {
    if (e instanceof VideoProviderError) throw e;
    const aborted = (e as Error)?.name === "AbortError";
    throw new VideoProviderError(
      `pollinations: ${aborted ? "generation exceeded time budget" : (e as Error).message}`.slice(0, 160),
      true,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

// ── Storyboard: one cheap LLM call feeds BOTH the video prompt and the ──
// ── Remotion 3D fallback, so the fallback is concept-specific, not canned.
// (System prompt lives at the call-site in the video route, next to the
// tier/BYOK wiring it depends on.)
export function deterministicStoryboard(concept: string): LessonScript {
  const c = concept.trim().slice(0, 80) || "Today's concept";
  return {
    kicker: "TUITIONTRACK · MOTION LESSON",
    title: `${c}, visualized.`,
    subtitle: `The core idea behind ${c} — in under a minute.`,
    badge: "Concept explainer",
    durationLabel: "▶ 18 seconds",
    steps: [
      { tag: "STEP 1 · SEE IT", body: `What ${c} means, in plain words` },
      { tag: "STEP 2 · RULE IT", body: "The one rule that always works" },
      { tag: "STEP 3 · USE IT", body: "Apply it to one exam-style question" },
    ],
    example: `Worked example: apply each step to ${c}.`,
    ctaTitle: `Fix ${c} today.`,
    ctaBody: "Start your highest-impact session — Tutor guides, Planner schedules.",
    videoPrompt: `A vibrant 3D animated explainer scene teaching "${c}": floating geometric shapes and glowing formula text assembling step by step over a deep indigo gradient, smooth camera drift, educational motion graphics style`,
  };
}

export function parseStoryboard(text: string, concept: string): LessonScript {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return deterministicStoryboard(concept);
    const j = JSON.parse(text.slice(start, end + 1)) as Partial<LessonScript>;
    const str = (v: unknown, fb: string) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 220) : fb);
    const fb = deterministicStoryboard(concept);
    const steps = Array.isArray(j.steps)
      ? j.steps.slice(0, 4).map((s, i) => ({
          tag: str((s as { tag?: unknown })?.tag, fb.steps[Math.min(i, 2)].tag),
          body: str((s as { body?: unknown })?.body, fb.steps[Math.min(i, 2)].body),
        }))
      : fb.steps;
    return {
      kicker: str(j.kicker, fb.kicker),
      title: str(j.title, fb.title),
      subtitle: str(j.subtitle, fb.subtitle),
      badge: str(j.badge, fb.badge),
      durationLabel: "▶ 18 seconds",
      steps: steps.length ? steps : fb.steps,
      example: str(j.example, fb.example),
      ctaTitle: str(j.ctaTitle, fb.ctaTitle),
      ctaBody: str(j.ctaBody, fb.ctaBody),
      videoPrompt: str(j.videoPrompt, fb.videoPrompt),
    };
  } catch {
    return deterministicStoryboard(concept);
  }
}
