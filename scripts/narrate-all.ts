// Generates real TTS narration audio for every extended lesson and writes
// public/videos/<slug>/narration.json + audio/part-NN.mp3.
//
// Why a dedicated driver: the engine (src/lib/learn/narration.ts) is
// per-lesson and idempotent — it skips parts that already have usable audio —
// but generating 517 lessons / ~6,200 parts / ~380 h of speech is a long,
// interruptible job. This driver makes it resumable and observable:
//   * walks the whole catalog, skipping lessons already complete
//   * writes a progress ledger so an interrupted run picks up where it stopped
//   * backs off on HTTP 429 instead of burning its retry budget (gemini)
//
// Run:
//   npx tsx scripts/narrate-all.ts [--only c9-maths-01] [--limit N] [--force]
//   npx tsx scripts/narrate-all.ts --class 9 --subject maths
//   npx tsx scripts/narrate-all.ts --status     (report coverage only)
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ALL_LESSONS } from "../src/lib/learn/video-catalog";
import { extendedPath, type ExtendedFile } from "../src/lib/learn/lesson-research";
import { readNarrationManifest, narrateLesson, narrationProviderReady } from "../src/lib/learn/narration";

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? "";
const only = new Set(onlyArg.split(",").map((s) => s.trim()).filter(Boolean));
const limit = Number(args.find((a) => a.startsWith("--limit="))?.slice("--limit=".length)) || 0;
const force = args.includes("--force");
const statusOnly = args.includes("--status");
// Staged rollout: narrate one class or subject at a time.
const classArg = Number(args.find((a) => a.startsWith("--class="))?.slice("--class=".length));
const subjectArg = (args.find((a) => a.startsWith("--subject="))?.slice("--subject=".length) ?? "").toLowerCase();

// The batch job is long and must survive a rolling rate limit. Wait out the
// quota window (the engine reads this and the server-stated delay) instead of
// failing a lesson the moment the bucket is empty.
process.env.TTS_RATE_WAITS = process.env.TTS_RATE_WAITS ?? "4";
process.env.TTS_MAX_WAIT_MS = process.env.TTS_MAX_WAIT_MS ?? "90000";

// Pacing is provider-dependent:
//   gemini — ~10 requests/minute, so space calls out to avoid burning retries
//   edge   — keyless and not meaningfully throttled; a long gap only wastes time
const providerName = narrationProviderReady().provider;
const defaultGap = providerName === "edge" ? "300" : "6500";
const TTS_GAP_MS = process.env.TTS_GAP_MS ?? defaultGap;
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
const candidates = ALL_LESSONS.filter((l) => existsSync(extendedPath(l.slug)))
  .filter((l) => !only.size || only.has(l.slug))
  .filter((l) => !Number.isFinite(classArg) || l.classLevel === classArg)
  .filter((l) => !subjectArg || l.subject.toLowerCase() === subjectArg);

const ledger = loadLedger();

// How many narration parts a lesson actually needs = its segments that carry
// non-empty narration text. Read from the research file so an interrupted run
// can be told apart from a finished one.
function requiredParts(slug: string): number {
  const ep = extendedPath(slug);
  if (!existsSync(ep)) return 0;
  try {
    const file = JSON.parse(readFileSync(ep, "utf8")) as ExtendedFile;
    return (file.segments ?? []).filter(
      (s) => s && typeof s.narration === "string" && s.narration.trim().length > 0,
    ).length;
  } catch {
    return 0;
  }
}

// A lesson is covered only when EVERY required part is present and usable.
//
// The earlier version checked that all parts *in the manifest* were usable,
// which a half-finished lesson satisfies trivially: 9 valid parts out of 12
// required read as "complete", so an interrupted run was never resumed. That
// is why the count must come from the research file, not from the manifest.
function covered(slug: string): boolean {
  const want = requiredParts(slug);
  if (want <= 0) return false;
  const m = readNarrationManifest(slug);
  if (!m || !m.parts.length) return false;
  const usable = m.parts.filter((p) => p.seconds > 1);
  if (usable.length < want) return false;
  // Every required part index must be present, not merely enough of them.
  for (let i = 1; i <= want; i++) {
    if (!usable.some((p) => p.part === i)) return false;
  }
  return true;
}

// ── status mode: report coverage, change nothing ──────────────────────────
if (statusOnly) {
  let complete = 0;
  let partial = 0;
  let empty = 0;
  let seconds = 0;
  let partsHave = 0;
  let partsWant = 0;
  for (const l of candidates) {
    const want = requiredParts(l.slug);
    const m = readNarrationManifest(l.slug);
    const have = m ? m.parts.filter((p) => p.seconds > 1).length : 0;
    partsWant += want;
    partsHave += have;
    if (have === 0) empty++;
    else if (covered(l.slug)) {
      complete++;
      seconds += m!.totalSeconds;
    } else partial++;
  }
  const pct = partsWant ? ((partsHave / partsWant) * 100).toFixed(1) : "0";
  console.log(`narration coverage (${candidates.length} lessons with research):`);
  console.log(`  provider : ${narrationProviderReady().provider}${narrationProviderReady().ok ? "" : " (NO KEY)"}`);
  console.log(`  complete : ${complete}`);
  console.log(`  partial  : ${partial}   <- interrupted; re-run WITHOUT --force to resume`);
  console.log(`  missing  : ${empty}`);
  console.log(`  parts    : ${partsHave}/${partsWant} (${pct}%)`);
  console.log(`  audio    : ${(seconds / 3600).toFixed(1)} h generated`);
  process.exit(0);
}

const queue = candidates.filter((l) => !(covered(l.slug) && !force));
const run = limit ? queue.slice(0, limit) : queue;

async function main(): Promise<void> {
  // Fail once, clearly, rather than once per lesson.
  const ready = narrationProviderReady();
  if (!ready.ok && !statusOnly) {
    console.error(`TTS provider "${ready.provider}" is not configured: ${ready.reason}`);
    console.error(`set it in .env.local, or switch provider with TTS_PROVIDER=gemini|openai`);
    process.exit(2);
  }

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
