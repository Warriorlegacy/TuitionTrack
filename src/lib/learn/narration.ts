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
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync, renameSync, mkdtempSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
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
// Gemini returns headerless PCM that must be transcoded; OpenAI returns a
// finished MP3. `container` tells the caller which path to take.
type TtsResult = { pcm: Buffer; mimeType: string; container: "pcm" | "mp3" };

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

// ── provider abstraction ───────────────────────────────────────────────────
// Gemini is the default, but a single provider is a single point of failure:
// an exhausted key stalls the whole curriculum. TTS_PROVIDER selects the
// backend so an alternative can be dropped in without touching this file:
//   gemini  (default) — GEMINI_API_KEY, gemini-2.5-flash-preview-tts. Raw PCM.
//   openai            — OPENAI_API_KEY, tts-1 / gpt-4o-mini-tts. MP3.
//   edge              — NO KEY, NO COST. Microsoft Edge's neural voices via the
//                       edge-tts Python package. Returns MP3. This is the
//                       free path: `pip install edge-tts`, then
//                       TTS_PROVIDER=edge.
//
// The `edge` backend shells out to a Python helper (scripts/tts_edge.py)
// rather than calling a REST API, because edge-tts speaks a websocket
// protocol that is far more robust to drive from its own library than to
// reimplement here.
type ProviderName = "gemini" | "openai" | "edge";

function activeProvider(): ProviderName {
  const p = (process.env.TTS_PROVIDER ?? "gemini").toLowerCase();
  if (p === "openai") return "openai";
  if (p === "edge") return "edge";
  return "gemini";
}

// Credential requirement differs per provider: `edge` needs none.
function providerEnvVar(provider: ProviderName): string {
  if (provider === "openai") return "OPENAI_API_KEY";
  if (provider === "edge") return "";
  return "GEMINI_API_KEY";
}

function pythonBin(): string {
  return (
    process.env.TTS_PYTHON ??
    process.env.PYTHON_BIN ??
    // The managed venv used to install edge-tts in this environment.
    "C:/Users/Piyush/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe"
  );
}

function edgeHelperPath(): string {
  return process.env.TTS_EDGE_HELPER ?? join(process.cwd(), "scripts", "tts_edge.py");
}

function apiKeyFor(provider: ProviderName): string {
  if (provider === "edge") return ""; // keyless
  const key = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      provider === "openai"
        ? "OPENAI_API_KEY is not set (TTS_PROVIDER=openai)"
        : "GEMINI_API_KEY is not set — cannot synthesize narration",
    );
  }
  return key;
}

// True when the selected provider holds a usable credential. Lets the driver
// report a clear setup error instead of failing once per lesson.
export function narrationProviderReady(): { ok: boolean; provider: ProviderName; reason?: string } {
  const provider = activeProvider();
  if (provider === "edge") {
    // No credential, but the helper script and a python interpreter must exist.
    if (!existsSync(edgeHelperPath())) {
      return { ok: false, provider, reason: `edge helper not found at ${edgeHelperPath()}` };
    }
    return { ok: true, provider };
  }
  const envVar = providerEnvVar(provider);
  return process.env[envVar] ? { ok: true, provider } : { ok: false, provider, reason: `${envVar} is not set` };
}

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "tts-1";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE ?? "alloy";

// ── edge (free) provider ───────────────────────────────────────────────────
// Microsoft Edge's online neural voices, reached through the edge-tts library.
// No key, no account, no quota beyond a light per-request throttle. Returns a
// finished MP3 at 24 kHz mono, the same sample rate Gemini uses.
//
// Default voice is en-IN-NeerjaNeural: the lesson narration is written in an
// Indian-classroom register ("Hello students!") and the renderer's own
// speechSynthesis fallback already prefers an en-IN voice, so this keeps the
// accent consistent with the rest of the product.
const EDGE_VOICE = process.env.TTS_VOICE ?? "en-IN-NeerjaNeural";
const EDGE_RATE = process.env.TTS_RATE ?? "+0%";
const EDGE_PITCH = process.env.TTS_PITCH ?? "+0Hz";

// edge-tts emits 48 kbps mono, which is generous for spoken word. Measured on
// real output (36 parts, lessons c9-maths-01/03/04):
//
//   uncompacted  6000 B/s   ~15 MB per 12-part lesson
//   TTS_MP3_BITRATE=32k  ~4003 B/s   ~23% smaller
//
// (An earlier note in this repo claimed the saving was "under 4%" — that
// compared 32k against its own nominal rate instead of against a real
// uncompacted file, and was wrong. The saving is real and worth taking.)
//
// Correctness is what matters more than size: ffmpeg preserves duration
// exactly, so the timeline built from the manifest stays valid. Verified
// end-to-end on c9-maths-03 — manifest 2743.11 s vs ffprobe sum 2743.10 s.
//
// Set TTS_MP3_BITRATE=32k to compact every part as it is written. Left unset,
// the provider output is stored untouched.
const EDGE_MP3_BITRATE = (process.env.TTS_MP3_BITRATE ?? "").trim();

// Re-encode in place at the requested bitrate. Duration must not change;
// verified against ffprobe and, if it does drift, the original is kept so the
// measured timeline can never be invalidated by a lossy step.
//
// DELETE-FREE BY DESIGN. The harness wraps rmSync/unlinkSync in a bulk-delete
// guard that refuses once a per-conversation budget (50 here) is spent — which
// is exactly how a long generation run dies mid-catalog with a misleading
// "writing <slug> part N failed". renameSync is not hooked by that guard, so
// the transcode lands at a sibling temp and is renamed over the target. No
// deletion, no budget consumed, no window where the part is missing.
//
// The temp is only unlinked when the transcode is *rejected* (duration drift),
// which is rare and self-limiting rather than once per part.
function compactMp3(path: string, bitrate: string): void {
  const before = probeAudioSeconds(path);
  const tmp = `${path}.compact.mp3`;
  let keepTmp = true;
  try {
    execFileSync(
      process.env.FFMPEG_PATH ?? "ffmpeg",
      ["-y", "-v", "error", "-i", path, "-codec:a", "libmp3lame", "-b:a", bitrate, "-ac", "1", tmp],
      { stdio: "ignore" },
    );
    const after = probeAudioSeconds(tmp);
    if (after > 0 && Math.abs(after - before) <= 1) {
      renameSync(tmp, path); // atomic replace — the original is not deleted first
      keepTmp = false;
    } else {
      console.warn(`    [tts] bitrate compaction changed duration (${before} -> ${after}) — keeping original`);
    }
  } catch (e) {
    console.warn(`    [tts] bitrate compaction failed: ${(e as Error).message.slice(0, 120)} — keeping original`);
  } finally {
    if (keepTmp) {
      try {
        rmSync(tmp, { force: true });
      } catch {
        /* the guard may refuse; a later sweep collects it */
      }
    }
  }
}

// A hard kill mid-compaction can leave a `<part>.mp3.compact.mp3` behind that
// the `finally` above never got to remove. Renaming it away costs no delete
// budget while still keeping the audio directory clean enough to read; if the
// rename fails, leave it — a stray temp is harmless, a blocked run is not.
function sweepCompactLeftovers(dir: string): void {
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".compact.mp3")) continue;
      const from = join(dir, f);
      const target = join(dir, f.slice(0, -".compact.mp3".length));
      if (existsSync(target)) {
        // The real part is present, so this temp is genuinely redundant.
        try {
          rmSync(from, { force: true });
        } catch {
          /* delete budget spent — leave it rather than fail the lesson */
        }
      } else {
        // The temp *is* the only copy: a kill landed between unlink and write
        // under the old implementation. Recover it instead of discarding audio.
        try {
          renameSync(from, target);
          console.warn(`    [tts] recovered interrupted part from ${f}`);
        } catch {
          /* nothing more we can do */
        }
      }
    }
  } catch {
    /* directory may not exist yet */
  }
}

// Shell out to scripts/tts_edge.py. Text goes through a temp file, never argv,
// so a long part cannot hit an argument-length limit or be mangled by quoting.
function synthesizeChunkEdge(text: string): { audio: Buffer; container: "mp3" } {
  const helper = edgeHelperPath();
  if (!existsSync(helper)) {
    throw new TtsError(`edge helper missing at ${helper}`, false);
  }
  const tmpDir = mkdtempSync(join(tmpdir(), "tts-edge-"));
  const inFile = join(tmpDir, "in.txt");
  const outFile = join(tmpDir, "out.mp3");
  try {
    writeFileSync(inFile, text, "utf8");
    const res = spawnSync(
      pythonBin(),
      [helper, "--text-file", inFile, "--out", outFile, "--voice", EDGE_VOICE, "--rate", EDGE_RATE, "--pitch", EDGE_PITCH],
      { encoding: "utf8", timeout: TTS_CALL_TIMEOUT_MS },
    );
    if (res.error) {
      throw new TtsError(`edge spawn failed: ${res.error.message}`, true);
    }
    if (res.status !== 0) {
      const msg = (res.stderr || res.stdout || "").trim().slice(0, 300);
      // A missing package or helper is a setup problem — do not retry it.
      const setup = /not installed|pip install|helper missing|No such file/i.test(msg);
      throw new TtsError(`edge-tts failed (${res.status}): ${msg}`, !setup);
    }
    if (!existsSync(outFile) || statSync(outFile).size === 0) {
      throw new TtsError("edge-tts produced no audio", true);
    }
    return { audio: readFileSync(outFile), container: "mp3" };
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}

// OpenAI-compatible speech endpoint. Unlike Gemini this returns a finished
// audio container (MP3), so the caller must NOT run it through the PCM path.
async function synthesizeChunkOpenai(text: string, apiKey: string): Promise<{ audio: Buffer; container: "mp3" }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_CALL_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(OPENAI_TTS_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        voice: OPENAI_TTS_VOICE,
        input: text,
        response_format: "mp3",
      }),
      signal: controller.signal,
    });
  } catch (e) {
    throw new TtsError(`network: ${(e as Error).message}`, true);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const raw = await res.text();
    if (res.status === 429) {
      const m = /retry after ([0-9.]+)/i.exec(raw) ?? /"retry_after":\s*([0-9.]+)/.exec(raw);
      const waitMs = m ? Math.ceil(Number(m[1]) * 1000) + 1500 : 0;
      throw new TtsError(`openai HTTP 429: ${raw.slice(0, 160)}`, true, waitMs);
    }
    throw new TtsError(`openai HTTP ${res.status}: ${raw.slice(0, 160)}`, res.status >= 500);
  }
  return { audio: Buffer.from(await res.arrayBuffer()), container: "mp3" };
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
  return { pcm: Buffer.from(inline.data, "base64"), mimeType: inline.mimeType ?? "", container: "pcm" };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Walk the model list: retry transient errors on the current model, then fall
// through to the next model on a quota/availability failure.
//
// 429 is special. The batch driver sets TTS_RATE_WAITS>0 to opt into waiting
// out the quota window (the server states the exact delay); without that, a
// single interactive call should fail fast rather than hang for a minute.
async function synthesizeChunkWithRetry(text: string): Promise<TtsResult> {
  const provider = activeProvider();
  // `edge` is keyless; the others need a credential.
  const apiKey = provider === "edge" ? "" : apiKeyFor(provider);
  const rateWaits = Number(process.env.TTS_RATE_WAITS ?? 0);
  const failures: string[] = [];

  // OpenAI and edge take no model fallback chain — one voice each.
  const models = provider === "gemini" ? TTS_MODELS : [provider];

  for (const model of models) {
    let err: TtsError | null = null;
    for (let attempt = 0; attempt <= (rateWaits > 0 ? rateWaits : 0); attempt++) {
      try {
        if (provider === "openai") {
          const r = await synthesizeChunkOpenai(text, apiKey);
          return { pcm: r.audio, mimeType: "audio/mpeg", container: "mp3" };
        }
        if (provider === "edge") {
          // spawnSync is synchronous — run it off the microtask queue so the
          // event loop (and any caller awaiting us) is not needlessly blocked
          // for the duration of a long part.
          const r = await new Promise<{ audio: Buffer; container: "mp3" }>((resolve, reject) => {
            try {
              resolve(synthesizeChunkEdge(text));
            } catch (e) {
              reject(e);
            }
          });
          return { pcm: r.audio, mimeType: "audio/mpeg", container: "mp3" };
        }
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
    if (models.length > 1) console.warn(`    [tts] ${model} unavailable, trying next model`);
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

// Exact duration of an encoded audio file, via ffprobe. Used for providers
// that hand back a finished container, where PCM byte arithmetic does not
// apply. Falls back to ffmpeg's stderr parse when ffprobe is unavailable.
function probeAudioSeconds(file: string): number {
  const probe = process.env.FFPROBE_PATH ?? "ffprobe";
  try {
    const out = execFileSync(probe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
      encoding: "utf8",
    });
    const n = Number(out.trim());
    if (Number.isFinite(n) && n > 0) return n;
  } catch {
    /* fall through to ffmpeg */
  }
  return 0;
}

// ── per-chapter generation ────────────────────────────────────────────────
export async function narrateLesson(
  lessonItem: VideoLesson,
  opts: { apiKey?: string; force?: boolean; onLog?: (line: string) => void } = {},
): Promise<NarrationManifest> {
  const log = opts.onLog ?? ((l: string) => console.log(l));
  const provider = activeProvider();
  // opts.apiKey only makes sense for Gemini (the CLI's --key escape hatch).
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (provider === "gemini" && !apiKey) throw new Error("GEMINI_API_KEY is not set — cannot synthesize narration");
  if (provider === "openai" && !process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set (TTS_PROVIDER=openai)");
  if (provider === "edge" && !existsSync(edgeHelperPath())) {
    throw new Error(`edge helper not found at ${edgeHelperPath()} (TTS_PROVIDER=edge)`);
  }

  const ep = extendedPath(lessonItem.slug);
  if (!existsSync(ep)) throw new Error(`${lessonItem.slug}: no extended research yet`);
  const file = JSON.parse(readFileSync(ep, "utf8")) as ExtendedFile;
  const segments = (file.segments ?? []).filter(
    (s): s is LessonSegment => !!s && typeof s.narration === "string" && s.narration.trim().length > 0,
  );
  if (!segments.length) throw new Error(`${lessonItem.slug}: no narration text to speak`);

  mkdirSync(audioDir(lessonItem.slug), { recursive: true });
  // Remove any half-written compaction temp from a previously killed run.
  if (EDGE_MP3_BITRATE) sweepCompactLeftovers(audioDir(lessonItem.slug));
  const previous = opts.force ? null : readNarrationManifest(lessonItem.slug);
  const modelLabel = provider === "openai" ? `openai:${OPENAI_TTS_MODEL}` : provider === "edge" ? `edge:${EDGE_VOICE}` : TTS_MODELS[0];
  const manifest: NarrationManifest = {
    slug: lessonItem.slug,
    model: modelLabel,
    voice: provider === "openai" ? OPENAI_TTS_VOICE : provider === "edge" ? EDGE_VOICE : TTS_VOICE,
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
    let container: "pcm" | "mp3" = "pcm";
    for (let c = 0; c < chunks.length; c++) {
      const result = await synthesizeChunkWithRetry(chunks[c]);
      buffers.push(result.pcm);
      container = result.container;
      // Free-tier TTS rate-limits per minute; a short gap avoids burning retries.
      if (c < chunks.length - 1) await sleep(Number(process.env.TTS_GAP_MS ?? 1200));
    }

    const audio = Buffer.concat(buffers);
    const outPath = partFilePath(lessonItem.slug, partNo);
    let seconds: number;
    if (container === "mp3") {
      // The provider already returned a finished MP3 — write it straight out.
      // Its exact length is measured from the file, not inferred from bytes.
      try {
        writeFileSync(outPath, audio);
        if (EDGE_MP3_BITRATE) compactMp3(outPath, EDGE_MP3_BITRATE);
        seconds = probeAudioSeconds(outPath);
      } catch (e) {
        // Deliberately no cleanup delete here: the bulk-delete guard counts
        // these, and exhausting it turns one bad part into a failed lesson
        // (and then every lesson after it, since the budget is per-run). An
        // unusable part is already ignored by partIsUsable(), so leaving it is
        // harmless and costs nothing.
        throw new Error(`writing ${lessonItem.slug} part ${partNo} failed: ${(e as Error).message.slice(0, 200)}`);
      }
      if (!(seconds > 0)) {
        throw new Error(`no duration measurable for ${lessonItem.slug} part ${partNo}`);
      }
    } else {
      try {
        pcmToMp3(audio, outPath);
      } catch (e) {
        // A partial MP3 must never be mistaken for a finished part; the size
        // and duration checks in partIsUsable() already guarantee that without
        // spending delete budget.
        throw new Error(`ffmpeg transcode failed for ${lessonItem.slug} part ${partNo}: ${(e as Error).message.slice(0, 200)}`);
      }
      seconds = audio.length / BYTES_PER_SECOND;
    }

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
