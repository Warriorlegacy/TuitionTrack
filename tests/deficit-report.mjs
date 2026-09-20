// Reports the curriculum render/research deficit against the authoritative
// catalog (src/lib/learn/video-catalog.ts), not against a directory listing —
// the directory contains non-lesson entries (research/, quadratic-explainer/)
// that inflate a naive count.
//
// Run: NODE_OPTIONS="" npx tsx tests/deficit-report.mjs
import { existsSync, readdirSync } from "node:fs";
import { ALL_LESSONS } from "../src/lib/learn/video-catalog";

const slugs = ALL_LESSONS.map((l) => l.slug);
const research = new Set(
  readdirSync("public/videos/research")
    .filter((f) => f.endsWith(".extended.json"))
    .map((f) => f.replace(".extended.json", "")),
);

const noResearch = [];
const noRender = [];
const researchNoRender = [];

for (const slug of slugs) {
  const hasRes = research.has(slug);
  const hasHtml = existsSync(`public/videos/${slug}/full.html`);
  if (!hasRes) noResearch.push(slug);
  if (!hasHtml) noRender.push(slug);
  if (hasRes && !hasHtml) researchNoRender.push(slug);
}

console.log("catalog lessons     :", slugs.length);
console.log("research present    :", slugs.length - noResearch.length);
console.log("research missing    :", noResearch.length);
console.log("renders missing     :", noRender.length);
console.log("res-done/render-pend:", researchNoRender.length, researchNoRender.join(", ") || "(none)");

const bySubject = {};
for (const s of noResearch) {
  const key = s.split("-").slice(0, 2).join("-");
  bySubject[key] = (bySubject[key] || 0) + 1;
}
console.log("--- research deficit by subject ---");
for (const [k, v] of Object.entries(bySubject).sort((a, b) => b[1] - a[1])) {
  console.log("  " + k.padEnd(14), v);
}
