// Batch-narrates catalog chapters through a locally-running
// MoneyPrinterTurbo instance (tools/moneyprinterturbo, see
// docs/MONEYPRINTER_SETUP.md) and integrates the mp4s into the app.
//
// For each lesson: LessonScript → narration paragraphs (custom video_script,
// so NO LLM key is burned) → POST /api/v1/videos (16:9, Edge TTS = free,
// Pexels stock or local ffmpeg backgrounds) → poll → download to
// public/videos/<slug>/narrated.mp4 + manifest.json entry. The Videos page
// and the HyperFrames file render pick narrated clips up from the manifest.
//
// Usage:
//   npx tsx scripts/moneyprinter-batch.ts --slugs c10-maths-04
//   npx tsx scripts/moneyprinter-batch.ts --class 10 --subject Maths --limit 3
//   npx tsx scripts/moneyprinter-batch.ts --all --limit 5   (pilot carefully:
//   each clip takes minutes + Pexels quota)

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_LESSONS, resolveScript } from "../src/lib/learn/video-catalog";

const MPT = process.env.MPT_API ?? "http://127.0.0.1:8080";
const API_KEY = process.env.MPT_API_KEY ?? "";
const VOICE = process.env.MPT_VOICE ?? "en-IN-NeerjaNeural-Female";
const SOURCE = process.env.MPT_SOURCE ?? "pexels"; // or "local" (see docs)
const POLL_MS = 15_000;
const TIMEOUT_MS = 20 * 60_000;

const args = process.argv.slice(2);
const opt = (name: string): string | null => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? null) : null;
};

function narrationFor(slug: string): { subject: string; script: string; terms: string } {
  const lessonItem = ALL_LESSONS.find((l) => l.slug === slug);
  if (!lessonItem) throw new Error(`unknown slug ${slug}`);
  const s = resolveScript(lessonItem);
  const paras = [
    `${s.title} ${s.subtitle}`,
    ...s.steps.map((st) => `${st.tag}. ${st.body}`),
    s.example,
    `${s.ctaTitle} ${s.ctaBody}`,
  ];
  const terms = [lessonItem.concept, lessonItem.subject, `class ${lessonItem.classLevel} India school`].join(",");
  return { subject: lessonItem.concept, script: paras.join("\n\n"), terms };
}

async function mpt(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${MPT}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`MPT ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function narrate(slug: string): Promise<void> {
  const { subject, script, terms } = narrationFor(slug);
  console.log(`[${slug}] submitting "${subject}"`);
  const created = (await mpt("/api/v1/videos", {
    method: "POST",
    body: JSON.stringify({
      video_subject: subject,
      video_script: script,
      video_terms: terms,
      video_aspect: "16:9",
      voice_name: VOICE,
      video_source: SOURCE,
      video_clip_duration: 5,
      subtitle_enabled: true,
      bgm_type: "random",
      bgm_volume: 0.15,
      paragraph_number: 1,
    }),
  })) as { data?: { task_id?: string }; task_id?: string };
  const taskId = created.data?.task_id ?? created.task_id;
  if (!taskId) throw new Error(`[${slug}] no task_id in response`);

  const started = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (Date.now() - started > TIMEOUT_MS) throw new Error(`[${slug}] timed out after 20min`);
    const st = (await mpt(`/api/v1/tasks/${taskId}`)) as {
      data?: { status?: string; result?: { videos?: string[] }; error?: string };
    };
    const status = st.data?.status ?? "";
    console.log(`[${slug}] ${status}`);
    if (status === "succeed" || status === "success" || status === "completed") {
      const remote = st.data?.result?.videos?.[0];
      if (!remote) throw new Error(`[${slug}] task done but no video path`);
      const dl = await fetch(`${MPT}/api/v1/download/${remote}`, {
        headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
      });
      if (!dl.ok) throw new Error(`[${slug}] download failed: ${dl.status}`);
      const dir = join(process.cwd(), "public", "videos", slug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "narrated.mp4"), Buffer.from(await dl.arrayBuffer()));
      const manifestPath = join(process.cwd(), "public", "videos", "manifest.json");
      const manifest = existsSync(manifestPath)
        ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>)
        : {};
      manifest[slug] = { narrated: true, voice: VOICE, source: SOURCE, at: new Date().toISOString() };
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`[${slug}] saved narrated.mp4`);
      return;
    }
    if (status === "failed" || status === "error") {
      throw new Error(`[${slug}] failed: ${(st.data?.error ?? "unknown").toString().slice(0, 200)}`);
    }
  }
}

async function main(): Promise<void> {
  let slugs = (opt("--slugs") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!slugs.length) {
    const cls = opt("--class");
    const subject = opt("--subject");
    const limit = Number(opt("--limit") ?? "3");
    let pool = ALL_LESSONS;
    if (cls) pool = pool.filter((l) => l.classLevel === Number(cls));
    if (subject) pool = pool.filter((l) => l.subject.toLowerCase() === subject.toLowerCase());
    if (opt("--all") === null && !cls && !subject) {
      throw new Error("pass --slugs, --class/--subject, or --all (with --limit)");
    }
    slugs = pool.slice(0, limit).map((l) => l.slug);
  }
  console.log(`narrating ${slugs.length} lesson(s) via ${MPT}`);
  for (const slug of slugs) {
    try {
      await narrate(slug);
    } catch (e) {
      console.error((e as Error).message);
    }
  }
}

void main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
