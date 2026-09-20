// Generates real TTS narration audio for every extended lesson and writes
// public/videos/<slug>/narration.json + audio/part-NN.mp3.
//
// Why a dedicated driver: the engine (src/lib/learn/narration.ts) is
// per-lesson and idempotent — it skips parts that already have usable audio —
// but generating 517 lessons / ~6,200 parts / ~380 h of speech against a
// free-tier rate limit of 10 requests/minute is a multi-hour, interruptible
// job. This driver makes it resumable and observable:
//   * walks the whole catalog, skipping lessons already complete
//   * writes a progress ledger so a interrupted run picks up where it stopped
//   * backs off on HTTP 429 instead of burning its retry budget
//
// Run:
//   npx tsx scripts/narrate-all.ts [--only c9-maths-01] [--limit N] [--force]
//   npx tsx scripts/narrate-all.ts --status     (report coverage only)
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ALL_LESSONS } from "../src/lib/learn/video-catalog";
import { extendedPath } from "../src/lib/learn/lesson-research";
import { readNarrationManifest, narrateLesson } from "../src/lib/learn/narration";

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? "";
const only = new Set(onlyArg.split(",").map((s) => s.trim()).filter(Boolean));
const limit = Number(args.find((a) => a.startsWith("--limit="))?.slice("--limit=".length)) || 0;
const force = args.includes("--force");
const statusOnly = args.includes("--status");

// The batch job is long and must survive a rolling rate limit. Wait out the
// quota window (the engine reads this and the server-stated delay) instead of
// failing a lesson the moment the bucket is empty.
process.env.TTS_RATE_WAITS = process.env.TTS_RATE_WAITS ?? "4";
process.env.TTS_MAX_WAIT_MS = process.env.TTS_MAX_WAIT_MS ?? "90000";

// Free-tier TTS allows ~10 requests/minute. Space calls so we rarely trip the
// limit at all, rather than repeatedly sleeping out a 40 s window.
const TTS_GAP_MS = process.env.TTS_GAP_MS ?? "6500";
process.env.TTS_GAP_MS = TTS_GAP_MS;

const LEDGER = join(process.cwd(), "public", "videos", "narration-progress.json");

type Ledger = {
  updatedAt: string;
  done: string[];
  failed: Record<string, string>;
  totalSeconds: number;
};

function loadLedger(): Ledger {
  if (!existsSync(LEDGER)) return { updatedAt: new Date().toISOString(), done: [], failed: {}, totalSeconds: 0 };
  try {
    return JSON.parse(readFileSync(LEDGER, "utf8")) as Ledger;
  } catch {
    return { updatedAt: new Date().toISOString(), done: [], failed: {}, totalSeconds: 0 };
  }
}

function saveLedger(l: Ledger): void {
  l.updatedAt = new Date().toISOString();
  mkdirSync(join(process.cwd(), "public", "videos"), { recursive: true });
  writeFileSync(LEDGER, JSON.stringify(l, null, 2));
}

// Lessons that have narration text worth speaking AND not already complete.
const candidates = ALL_LESSONS.filter((l) => existsSync(extendedPath(l.slug))).filter(
  (l) => !only.size || only.has(l.slug),
);

const ledger = loadLedger();

function covered(slug: string): boolean {
  const m = readNarrationManifest(slug);
  return !!m && m.parts.length > 0 && m.parts.every((p) => p.seconds > 1);
}

// ── status mode: report coverage, change nothing ──────────────────────────
if (statusOnly) {
  let complete = 0;
  let partial = 0;
  let empty = 0;
  let seconds = 0;
  for (const l of candidates) {
    const m = readNarrationManifest(l.slug);
    if (!m || !m.parts.length) empty++;
    else if (m.parts.every((p) => p.seconds > 1)) {
      complete++;
      seconds += m.totalSeconds;
    } else partial++;
  }
  console.log(`narration coverage (${candidates.length} lessons with research):`);
  console.log(`  complete : ${complete}`);
  console.log(`  partial  : ${partial}`);
  console.log(`  missing  : ${empty}`);
  console.log(`  audio    : ${(seconds / 3600).toFixed(1)} h generated`);
  process.exit(0);
}

const queue = candidates.filter((l) => !(covered(l.slug) && !force));
const run = limit ? queue.slice(0, limit) : queue;

async function main(): Promise<void> {
  console.log(`narration run: ${run.length} lesson(s) to generate (${candidates.length} candidates, ${candidates.length - queue.length} already complete)`);
  if (!run.length) {
    console.log("nothing to do — all narration already generated. Use --force to regenerate.");
    return;
  }

  let ok = 0;
  let failed = 0;
  const started = Date.now();

  for (const lessonItem of run) {
    const t0 = Date.now();
    try {
      const manifest = await narrateLesson(lessonItem, {
        force,
        onLog: (line) => console.log(line),
      });
      ledger.done = Array.from(new Set([...ledger.done, lessonItem.slug]));
      delete ledger.failed[lessonItem.slug];
      ledger.totalSeconds += manifest.totalSeconds;
      saveLedger(ledger);
      ok++;
      const mins = (manifest.totalSeconds / 60).toFixed(1);
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`OK   ${lessonItem.slug} — ${manifest.parts.length} parts, ${mins} min audio in ${secs}s`);
    } catch (e) {
      const msg = (e as Error).message.slice(0, 200);
      ledger.failed[lessonItem.slug] = msg;
      saveLedger(ledger);
      failed++;
      console.error(`FAIL ${lessonItem.slug} — ${msg}`);
    }
  }

  const totalMin = ((Date.now() - started) / 1000 / 60).toFixed(1);
  console.log(`\ndone: ${ok} ok, ${failed} failed, in ${totalMin} min`);
  console.log(`ledger: public/videos/narration-progress.json`);
  if (failed) console.log(`re-run the same command to retry the failed lessons (completed parts are cached).`);
}

main().catch((e) => {
  console.error(`fatal: ${(e as Error).message}`);
  process.exit(1);
});
