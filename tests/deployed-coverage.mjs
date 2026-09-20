// Verifies the DEPLOYED curriculum, not the local files.
//
// Local coverage (tests/deficit-report.mjs) proves the files exist on disk.
// This proves they are actually reachable in production with the WebGL scene
// engine present — a lesson can be perfectly baked locally and still be absent
// from the deploy if it was never committed or the build dropped it.
//
// Run: NODE_OPTIONS="" npx tsx tests/deployed-coverage.mjs [--sample N] [--all]
const BASE = process.env.BASE_URL || "https://tuitiontrack-app.vercel.app";
const args = process.argv.slice(2);
const all = args.includes("--all");
const sampleArg = args.find((a) => a.startsWith("--sample="))?.slice("--sample=".length);
const SAMPLE = Number(sampleArg) || 12;
const CONCURRENCY = 8;
const MARKER = "qe-scene-canvas";

const { readdirSync, existsSync } = await import("node:fs");

const slugs = readdirSync("public/videos", { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(`public/videos/${d.name}/full.html`))
  .map((d) => d.name);

// Deterministic sample: stride through the sorted list so a re-run checks the
// same lessons and results are comparable over time.
let targets;
if (all) {
  targets = slugs;
} else {
  const stride = Math.max(1, Math.floor(slugs.length / SAMPLE));
  targets = [];
  for (let i = 0; i < slugs.length && targets.length < SAMPLE; i += stride) targets.push(slugs[i]);
}

console.log(`deployed coverage: checking ${targets.length} of ${slugs.length} lessons`);
console.log(`base: ${BASE}\n`);

let ok = 0;
const failures = [];

async function check(slug) {
  const url = `${BASE}/videos/${slug}/full.html`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      failures.push(`${slug}: HTTP ${res.status}`);
      return;
    }
    const body = await res.text();
    const count = body.split(MARKER).length - 1;
    if (count === 0) failures.push(`${slug}: served but NO scene canvases`);
    else ok++;
  } catch (e) {
    failures.push(`${slug}: ${e.message}`);
  }
}

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  await Promise.all(targets.slice(i, i + CONCURRENCY).map(check));
}

console.log(`reachable with scenes : ${ok}/${targets.length}`);
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) console.log("  " + f);
} else {
  console.log("\nall sampled lessons are live and rendering scenes.");
}
process.exit(failures.length ? 1 : 0);
