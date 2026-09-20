// Real voice narration for 1-hour lessons — Gemini TTS → PCM → MP3.
//
// Why this exists: the original pipeline spoke the narration with the browser's
// built-in `speechSynthesis`, which is not a product feature — it is whatever
// voice the visitor's OS happens to ship, it cannot be cached, and it does not
// exist in the file render at all. This module produces actual audio files.
//
// Provider: Google Gemini TTS (`gemini-3.1-flash-tts-preview`, verified live on
// the shared GEMINI_API_KEY). Two hard constraints shape the implementation:
//
//   1. Audio output is capped (~32k tokens ≈ 200 words per call). A 5-minute
//      segment is ~1,500 words, so each part is split into sentence-grouped
//      chunks of <= TTS_MAX_CHARS and synthesized sequentially, then the PCM
//      buffers are concatenated.
//   2. The response is raw 16-bit little-endian PCM at 24 kHz mono, NOT a
//      container. Browsers cannot reliably play headerless PCM, so every part
//      is transcoded to MP3 with ffmpeg (already present on this machine).
//
// Idempotent by construction: a part with an existing, non-empty MP3 AND a
// matching entry in the sidecar manifest is skipped. Re-running after an
// interruption only regenerates what is missing.
//
// CLI:
//   npx tsx src/lib/learn/narration.ts --class 9 --limit 3
//   npx tsx src/lib/learn/narration.ts --only c9-maths-01 --force
//   npx tsx src/lib/learn/narration.ts --class 9 --dry
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { ALL_LESSONS } from "./video-catalog";
import { extendedPath, type ExtendedFile } from "./lesson-research";
import type { VideoLesson } from "./video-catalog";
import type { LessonSegment } from "../ai/video";

// ── provider config ────────────────────────────────────────────────────────
// Model order matters and is measured, not guessed. Live probe results:
//   gemini-3.1-flash-tts-preview  → 429 on the shared key after one call
//                                   (preview model, near-zero free ceiling)
//   gemini-2.5-flash-preview-tts  → works, ~10s per ~200 words of audio
// So 2.5 is primary and 3.1 is the fallback for keys that still have headroom.
const TTS_MODELS = (process.env.TTS_MODEL ?? "gemini-2.5-flash-preview-tts,gemini-3.1-flash-tts-preview")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const TTS_VOICE = process.env.TTS_VOICE ?? "Kore";
const TTS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const SAMPLE_RATE = 24000; // Gemini returns 24 kHz mono s16le
const BYTES_PER_SECOND = SAMPLE_RATE * 2; // 16-bit mono

// The API returns roughly 200 words of audio per call. Chunk on sentence
// boundaries well under that ceiling so a chunk never risks truncation.
const TTS_MAX_CHARS = Number(process.env.TTS_MAX_CHARS ?? 480);
const TTS_CALL_TIMEOUT_MS = 90_000;
const TTS_RETRIES = 3;

export type NarrationPart = {
  part: number;
  file: string; // relative to public/, e.g. videos/c9-maths-01/audio/part-01.mp3
  seconds: number;
  bytes: number;
  chunks: number;
};

export type NarrationManifest = {
  slug: string;
  model: string;
  voice: string;
  generatedAt: string;
  parts: NarrationPart[];
  totalSeconds: number;
};

// ── env loader (same zero-dep pattern as scripts/research-extended.ts) ─────
function loadEnv(): void {
  for (const name of [".env.local", ".env"]) {
    const p = join(process.cwd(), name);
    if (!existsSync(p)) continue;
    try {
      for (const line of readFileSync(p, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && process.env[m[1]] === undefined) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      /* ignore unreadable env file */
    }
  }
}
loadEnv();

// ── text chunking ─────────────────────────────────────────────────────────
// Split on sentence boundaries, then greedily pack sentences into chunks of
// at most TTS_MAX_CHARS. A single sentence longer than the ceiling is split on
// the nearest clause/semicolon, and failing that on a word boundary — TTS
// quality degrades gracefully, but a chunk is never dropped.
export function chunkForTts(text: string, maxChars = TTS_MAX_CHARS): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  // Numbers and abbreviations are common in STEM narration; this split keeps
  // decimals ("3.5") and single-letter marks ("Dr.") intact well enough for TTS.
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";

  const push = (): void => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > maxChars) {
      push();
      for (let i = 0; i < s.length; i += maxChars) {
        const slice = s.slice(i, i + maxChars);
        // Prefer to break at a space so we do not cut a word in half.
        const cut = slice.length === maxChars ? slice.lastIndexOf(" ") : -1;
        chunks.push(cut > maxChars * 0.5 ? slice.slice(0, cut).trim() : slice.trim());
      }
      continue;
    }
    if ((current + " " + s).trim().length > maxChars) push();
    current = (current + " " + s).trim();
  }
  push();
  return chunks.filter(Boolean);
}

// ── Gemini TTS call ───────────────────────────────────────────────────────
type TtsResult = { pcm: Buffer; mimeType: string };

class TtsError extends Error {
  transient: boolean;
  // When the server tells us how long to wait (429 with "retry in Ns"), carry
  // it so a batch run can sleep the real quota window instead of guessing.
  retryAfterMs: number;
  constructor(message: string, transient: boolean, retryAfterMs = 0) {
    super(message);
    this.transient = transient;
    this.retryAfterMs = retryAfterMs;
  }
}

async function synthesizeChunk(text: string, apiKey: string, model: string): Promise<TtsResult> {
  const url = `${TTS_ENDPOINT}/${model}:generateContent`;
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_CALL_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new TtsError(`network: ${(e as Error).message}`, true);
  } finally {
    clearTimeout(timer);
  }

  const raw = await res.text();
  if (!res.ok) {
    // 429 is a rate/quota limit. The free-tier TTS bucket refills on a rolling
    // ~1 minute window and the server states the exact wait in the body
    // ("Please retry in 36.07s"). Parse it so a long batch run can pace itself
    // across the window rather than treating the model as permanently dead.
    if (res.status === 429) {
      const m = /retry in ([0-9.]+)s/i.exec(raw);
      const waitMs = m ? Math.ceil(Number(m[1]) * 1000) + 1500 : 0;
      throw new TtsError(`${model} HTTP 429: ${raw.slice(0, 160)}`, true, waitMs);
    }
    // 5xx is a genuine transient fault worth an immediate short retry.
    const transient = res.status >= 500;
    throw new TtsError(`${model} HTTP ${res.status}: ${raw.slice(0, 160)}`, transient);
  }

  let parsed: {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new TtsError("malformed JSON from TTS", true);
  }

  const parts = parsed.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) {
    // A safety block or an empty candidate — not retryable, and a real signal.
    throw new TtsError("no audio in response (possible safety block)", false);
  }
  return { pcm: Buffer.from(inline.data, "base64"), mimeType: inline.mimeType ?? "" };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Walk the model list: retry transient errors on the current model, then fall
// through to the next model on a quota/availability failure.
//
// 429 is special. The batch driver sets TTS_RATE_WAITS>0 to opt into waiting
// out the quota window (the server states the exact delay); without that, a
// single interactive call should fail fast rather than hang for a minute.
async function synthesizeChunkWithRetry(text: string, apiKey: string): Promise<TtsResult> {
  const rateWaits = Number(process.env.TTS_RATE_WAITS ?? 0);
  const failures: string[] = [];
  for (const model of TTS_MODELS) {
    let err: TtsError | null = null;
    for (let attempt = 0; attempt <= (rateWaits > 0 ? rateWaits : 0); attempt++) {
      try {
        return await synthesizeChunk(text, apiKey, model);
      } catch (e) {
        err = e instanceof TtsError ? e : new TtsError(String(e), true);
        // Quota wait: honour the server's stated window, up to the cap.
        if (err.retryAfterMs > 0 && attempt < rateWaits) {
          const wait = Math.min(err.retryAfterMs, Number(process.env.TTS_MAX_WAIT_MS ?? 90000));
          console.warn(`    [tts] ${model} rate-limited — waiting ${(wait / 1000).toFixed(0)}s (attempt ${attempt + 2})`);
          await sleep(wait);
          continue;
        }
        if (!err.transient) break;
        await sleep(1500 * 2 ** attempt);
      }
    }
    failures.push(err?.message ?? "unknown");
    if (TTS_MODELS.length > 1) console.warn(`    [tts] ${model} unavailable, trying next model`);
  }
  throw new Error(`all TTS models failed — ${failures.join(" | ")}`);
}

// ── ffmpeg transcode ──────────────────────────────────────────────────────
function ffmpegAvailable(): boolean {
  try {
    execFileSync(process.env.FFMPEG_PATH ?? "ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function pcmToMp3(pcm: Buffer, outPath: string): void {
  // Headerless s16le @ 24 kHz mono → MP3. 64 kbps mono is transparent for
  // speech and keeps a 60-minute lesson around 28 MB.
  execFileSync(
    process.env.FFMPEG_PATH ?? "ffmpeg",
    [
      "-y",
      "-f", "s16le",
      "-ar", String(SAMPLE_RATE),
      "-ac", "1",
      "-i", "pipe:0",
      "-c:a", "libmp3lame",
      "-b:a", "64k",
      "-f", "mp3",
      outPath,
    ],
    { input: pcm, stdio: ["pipe", "ignore", "pipe"], maxBuffer: 1 << 28 },
  );
}

// ── paths + manifest ──────────────────────────────────────────────────────
export function audioDir(slug: string): string {
  return join(process.cwd(), "public", "videos", slug, "audio");
}

export function narrationManifestPath(slug: string): string {
  return join(process.cwd(), "public", "videos", slug, "narration.json");
}

export function readNarrationManifest(slug: string): NarrationManifest | null {
  try {
    const p = narrationManifestPath(slug);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as NarrationManifest;
  } catch {
    return null;
  }
}

function partFilePath(slug: string, part: number): string {
  return join(audioDir(slug), `part-${String(part).padStart(2, "0")}.mp3`);
}

// A part is considered done only when the MP3 exists, is non-trivial in size,
// and the manifest records a positive duration for it. A zero-byte file from a
// killed process must never be treated as complete.
function partIsUsable(slug: string, part: number, manifest: NarrationManifest | null): boolean {
  if (!manifest) return false;
  const rec = manifest.parts.find((p) => p.part === part);
  if (!rec || !(rec.seconds > 1)) return false;
  const f = partFilePath(slug, part);
  if (!existsSync(f)) return false;
  try {
    return statSync(f).size > 4096;
  } catch {
    return false;
  }
}

// ── per-chapter generation ────────────────────────────────────────────────
export async function narrateLesson(
  lessonItem: VideoLesson,
  opts: { apiKey?: string; force?: boolean; onLog?: (line: string) => void } = {},
): Promise<NarrationManifest> {
  const log = opts.onLog ?? ((l: string) => console.log(l));
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set — cannot synthesize narration");

  const ep = extendedPath(lessonItem.slug);
  if (!existsSync(ep)) throw new Error(`${lessonItem.slug}: no extended research yet`);
  const file = JSON.parse(readFileSync(ep, "utf8")) as ExtendedFile;
  const segments = (file.segments ?? []).filter(
    (s): s is LessonSegment => !!s && typeof s.narration === "string" && s.narration.trim().length > 0,
  );
  if (!segments.length) throw new Error(`${lessonItem.slug}: no narration text to speak`);

  mkdirSync(audioDir(lessonItem.slug), { recursive: true });
  const previous = opts.force ? null : readNarrationManifest(lessonItem.slug);
  const manifest: NarrationManifest = {
    slug: lessonItem.slug,
    model: TTS_MODELS[0],
    voice: TTS_VOICE,
    generatedAt: new Date().toISOString(),
    parts: previous ? previous.parts.filter((p) => partIsUsable(lessonItem.slug, p.part, previous)) : [],
    totalSeconds: 0,
  };

  for (let i = 0; i < segments.length; i++) {
    const partNo = i + 1;
    if (partIsUsable(lessonItem.slug, partNo, previous) && !opts.force) {
      log(`  part ${partNo}/${segments.length}: cached`);
      continue;
    }

    const chunks = chunkForTts(segments[i].narration);
    if (!chunks.length) {
      log(`  part ${partNo}/${segments.length}: SKIP — empty narration`);
      continue;
    }

    const buffers: Buffer[] = [];
    for (let c = 0; c < chunks.length; c++) {
      const result = await synthesizeChunkWithRetry(chunks[c], apiKey);
      buffers.push(result.pcm);
      // Free-tier TTS rate-limits per minute; a short gap avoids burning retries.
      if (c < chunks.length - 1) await sleep(Number(process.env.TTS_GAP_MS ?? 1200));
    }

    const pcm = Buffer.concat(buffers);
    const outPath = partFilePath(lessonItem.slug, partNo);
    try {
      pcmToMp3(pcm, outPath);
    } catch (e) {
      // A partial MP3 must never be mistaken for a finished part.
      try {
        rmSync(outPath, { force: true });
      } catch {
        /* nothing to clean */
      }
      throw new Error(`ffmpeg transcode failed for ${lessonItem.slug} part ${partNo}: ${(e as Error).message.slice(0, 200)}`);
    }

    const seconds = pcm.length / BYTES_PER_SECOND;
    const bytes = statSync(outPath).size;
    const record: NarrationPart = {
      part: partNo,
      file: `videos/${lessonItem.slug}/audio/part-${String(partNo).padStart(2, "0")}.mp3`,
      seconds: Math.round(seconds * 100) / 100,
      bytes,
      chunks: chunks.length,
    };
    manifest.parts = [...manifest.parts.filter((p) => p.part !== partNo), record].sort((a, b) => a.part - b.part);
    log(`  part ${partNo}/${segments.length}: ${seconds.toFixed(1)}s · ${chunks.length} chunks · ${(bytes / 1024).toFixed(0)} KB`);
    // Checkpoint after every part so an interruption loses at most one part.
    writeManifest(lessonItem.slug, manifest);
  }

  manifest.totalSeconds = Math.round(manifest.parts.reduce((n, p) => n + p.seconds, 0) * 100) / 100;
  writeManifest(lessonItem.slug, manifest);
  return manifest;
}

function writeManifest(slug: string, manifest: NarrationManifest): void {
  const m: NarrationManifest = {
    ...manifest,
    totalSeconds: Math.round(manifest.parts.reduce((n, p) => n + p.seconds, 0) * 100) / 100,
  };
  writeFileSync(narrationManifestPath(slug), JSON.stringify(m, null, 2));
}

// ── batch CLI ─────────────────────────────────────────────────────────────
function argVal(name: string): string | null {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return null;
  const a = args[i];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "";
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const only = new Set((argVal("only") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const classFilter = Number(argVal("class") ?? NaN);
  const subjectFilter = (argVal("subject") ?? "").toLowerCase();
  const limit = Number(argVal("limit") ?? NaN);
  const force = args.includes("--force");
  const dry = args.includes("--dry");

  if (!ffmpegAvailable()) {
    console.error("ffmpeg not found on PATH. Install it or set FFMPEG_PATH.");
    process.exit(1);
  }

  let queue = ALL_LESSONS.filter(
    (l) =>
      (!only.size || only.has(l.slug)) &&
      (!Number.isFinite(classFilter) || l.classLevel === classFilter) &&
      (!subjectFilter || l.subject.toLowerCase() === subjectFilter),
  );
  // Default: only chapters that already have researched narration text.
  queue = queue.filter((l) => existsSync(extendedPath(l.slug)));
  if (Number.isFinite(limit)) queue = queue.slice(0, limit);

  if (!queue.length) {
    console.log("nothing to narrate.");
    return;
  }
  console.log(`${queue.length} chapter(s) queued${dry ? " (dry run)" : ""}`);

  let done = 0;
  let failed = 0;
  for (const lessonItem of queue) {
    const prev = readNarrationManifest(lessonItem.slug);
    const ep = extendedPath(lessonItem.slug);
    const file = JSON.parse(readFileSync(ep, "utf8")) as ExtendedFile;
    const want = (file.segments ?? []).filter((s) => s && typeof s.narration === "string" && s.narration.trim()).length;
    const have = prev ? prev.parts.filter((p) => partIsUsable(lessonItem.slug, p.part, prev)).length : 0;

    if (!dry && have >= want && want > 0 && !force) {
      console.log(`${lessonItem.slug}: already complete (${have}/${want} parts)`);
      continue;
    }
    if (dry) {
      console.log(`${lessonItem.slug}: ${have}/${want} parts present`);
      continue;
    }
    try {
      console.log(`${lessonItem.slug}: narrating ${want} parts (${have} cached)`);
      const m = await narrateLesson(lessonItem, { force });
      console.log(`${lessonItem.slug}: DONE — ${m.parts.length} parts, ${(m.totalSeconds / 60).toFixed(1)} min audio`);
      done++;
    } catch (e) {
      failed++;
      console.error(`${lessonItem.slug}: FAIL — ${(e as Error).message.slice(0, 220)}`);
    }
  }
  console.log(`\n${done} narrated, ${failed} failed, ${queue.length - done - failed} skipped.`);
  if (failed) process.exit(1);
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("learn/narration.ts");
if (isDirectRun) {
  main().catch((e) => {
    console.error(`fatal: ${(e as Error).message}`);
    process.exit(1);
  });
}
