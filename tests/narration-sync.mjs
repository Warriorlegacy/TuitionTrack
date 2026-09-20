// Audits narration ↔ visual synchronisation for every lesson.
//
// The bug this exists to catch: section timing in the render used to come from
// `segment.minutes` (always 5), so every part got exactly 300 s of screen time
// regardless of how long its narration actually takes. A ~500-word part is
// ~3.5 min of speech, leaving ~1.5 min of silent visuals; a longer part
// overruns into the next part's visuals.
//
// IMPORTANT: the budget is read from the BAKED artifact
// (public/videos/<slug>/full.html → each section's data-duration), not from the
// source JSON. The generator no longer uses segment.minutes, so auditing that
// field would report the defect even after it is fixed. We verify what ships.
//
// Two durations are reported per part:
//   * budget  — screen time allotted by the shipped timeline (data-duration)
//   * spoken  — estimated speech time (words / WPM)
// and, when real TTS exists, the MEASURED audio duration from narration.json,
// which is ground truth and beats any estimate.
//
// Run: NODE_OPTIONS="" npx tsx tests/narration-sync.mjs [--limit N] [--wpm N]
import { existsSync, readFileSync, readdirSync } from "node:fs";

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith("--limit="))?.slice(8)) || 0;
const WPM = Number(args.find((a) => a.startsWith("--wpm="))?.slice(6)) || 140;
// --slug=<slug>[,<slug>...] audits specific lessons instead of the head of the
// sorted list — useful when narration exists for only part of the catalog.
const slugArg = args.find((a) => a.startsWith("--slug="))?.slice("--slug=".length) ?? "";
const slugs = new Set(slugArg.split(",").map((s) => s.trim()).filter(Boolean));
// A part whose speech is shorter than its budget by more than this many
// seconds is "silent tail" — visuals running with nothing to listen to.
const TOLERANCE_S = 20;
// The generator deliberately pads each part by SPEECH_PAD (default 1.06) so
// speech is never clipped by the visual moving on. On a 450 s part that pad is
// itself ~27 s, which would otherwise be reported as a defect on every long
// part. Compare against the pad-adjusted target, not the raw estimate.
const SPEECH_PAD = Number(process.env.SPEECH_PAD ?? 1.06);

const dirs = readdirSync("public/videos", { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "research")
  .map((d) => d.name)
  .filter((s) => existsSync(`public/videos/research/${s}.extended.json`))
  .sort();

const targets = slugs.size ? dirs.filter((d) => slugs.has(d)) : limit ? dirs.slice(0, limit) : dirs;

// Pull `data-duration="N"` off the part sections in the baked render, in order.
// Returns null when the lesson has not been baked yet.
function bakedDurations(slug) {
  const p = `public/videos/${slug}/full.html`;
  if (!existsSync(p)) return null;
  const html = readFileSync(p, "utf8");
  const out = [];
  const re = /<section id="qx-part(\d+)"[^>]*data-duration="(\d+)"/g;
  let m;
  while ((m = re.exec(html))) out[Number(m[1]) - 1] = Number(m[2]);
  return out.length ? out : null;
}

let withAudio = 0;
let unbaked = 0;
let totalSilent = 0;
let totalOverrun = 0;
let totalBudget = 0;
let partsChecked = 0;
const worst = [];

for (const slug of targets) {
  const research = JSON.parse(readFileSync(`public/videos/research/${slug}.extended.json`, "utf8"));
  const segs = (research.segments ?? []).filter((s) => s && typeof s.narration === "string" && s.narration.trim());
  if (!segs.length) continue;

  const manifestPath = `public/videos/${slug}/narration.json`;
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  if (manifest) withAudio++;

  const baked = bakedDurations(slug);
  if (!baked) unbaked++;

  let silent = 0;
  let overrun = 0;

  for (let i = 0; i < segs.length; i++) {
    const words = segs[i].narration.trim().split(/\s+/).length;

    // Prefer the shipped duration; fall back to declared minutes only if unbaked.
    const budget =
      baked && Number.isFinite(baked[i]) ? baked[i] : (Number(segs[i].minutes) || 5) * 60;

    // Prefer measured audio duration; fall back to a words/minutes estimate.
    const rec = manifest?.parts?.find((p) => p.part === i + 1);
    const measuredAudio = Boolean(rec && rec.seconds > 1);
    const spoken = measuredAudio ? rec.seconds : (words / WPM) * 60;

    // Target = what the generator SHOULD have allotted: the spoken length plus
    // its intentional pad. Anything beyond that is genuine dead air.
    const target = spoken * SPEECH_PAD;

    const delta = budget - target; // >0 = silence, <0 = overruns into next part
    totalBudget += budget;
    partsChecked++;
    if (delta > TOLERANCE_S) silent += delta;
    else if (delta < -TOLERANCE_S) overrun += -delta;

    if (delta > TOLERANCE_S || delta < -TOLERANCE_S) {
      worst.push({ slug, part: i + 1, delta, budget, spoken, measured: measuredAudio });
    }
  }

  totalSilent += silent;
  totalOverrun += overrun;
}

console.log(`audited ${targets.length} lessons (${WPM} wpm estimate, target = spoken × ${SPEECH_PAD}, ${TOLERANCE_S}s tolerance)`);
console.log(`lessons with real TTS audio : ${withAudio}/${targets.length}`);
console.log(`lessons not baked yet       : ${unbaked}/${targets.length}${unbaked ? " (budget from declared minutes)" : ""}`);
console.log(`total silent tail           : ${(totalSilent / 60).toFixed(0)} min`);
console.log(`total overrun (speech > visual): ${(totalOverrun / 60).toFixed(0)} min`);
console.log(`timeline budget             : ${(totalBudget / 60).toFixed(0)} min  (${partsChecked} parts)`);

if (worst.length) {
  console.log(`\nparts out of tolerance: ${worst.length} (showing worst 10)`);
  worst
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 10)
    .forEach((w) =>
      console.log(
        `  ${w.slug.padEnd(17)} part ${String(w.part).padStart(2)}  ` +
          `budget ${w.budget.toFixed(0)}s  spoken ${w.spoken.toFixed(0)}s  ` +
          `delta ${w.delta > 0 ? "+" : ""}${w.delta.toFixed(0)}s${w.measured ? " (measured)" : ""}`,
      ),
    );
}

process.exit(0);
