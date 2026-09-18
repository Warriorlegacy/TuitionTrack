// Batch-research full topic-wise scripts for every lesson video.
//
// One cheap LLM call per chapter (tier A, free-first provider chain):
//   npx tsx scripts/research-lessons.ts [--only c10-maths-04,c10-science-01]
//     [--class 10] [--subject Science] [--limit 20] [--force] [--delay-ms 1500]
//
// Writes public/videos/research/<slug>.json; skips slugs already researched
// unless --force. Re-run scripts/make-lesson-videos.ts afterwards to bake the
// researched topics into the HyperFrames file renders (Remotion + the topics
// accordion pick them up automatically via resolveFullScript).
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_LESSONS } from "../src/lib/learn/video-catalog";
import { buildResearchPrompt, researchPath } from "../src/lib/learn/lesson-research";
import { parseStoryboard } from "../src/lib/ai/video";
import { complete, stripReasoningTrace } from "../src/lib/ai/provider";

// ponytail: 10-line .env loader — avoids a dotenv dependency for one script.
try {
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
} catch { /* env-only — platform vars still work */ }

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return null;
  const a = args[i];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "");
};

const only = new Set((flag("only") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
const classFilter = Number(flag("class") ?? NaN);
const subjectFilter = (flag("subject") ?? "").toLowerCase();
const limit = Number(flag("limit") ?? NaN);
const force = args.includes("--force");
const delayMs = Number(flag("delay-ms") ?? 1500) || 1500;

let queue = ALL_LESSONS.filter(
  (l) =>
    (!only.size || only.has(l.slug)) &&
    (!Number.isFinite(classFilter) || l.classLevel === classFilter) &&
    (!subjectFilter || l.subject.toLowerCase() === subjectFilter),
);
if (!force) queue = queue.filter((l) => !existsSync(researchPath(l.slug)));
if (Number.isFinite(limit)) queue = queue.slice(0, limit);

if (!queue.length) {
  console.log("nothing to research (all cached — pass --force to redo).");
  process.exit(0);
}

async function main(): Promise<void> {
  let ok = 0;
  let failed = 0;
  for (let idx = 0; idx < queue.length; idx++) {
    const lessonItem = queue[idx];
    const label = `${lessonItem.slug} (C${lessonItem.classLevel} ${lessonItem.subject} Ch${lessonItem.chapter}: ${lessonItem.concept})`;
    try {
      const result = await complete({
        tier: "A",
        system: "You write NCERT chapter explainers as JSON. JSON only, no markdown fences.",
        user: buildResearchPrompt(lessonItem),
        maxTokens: 1800,
        temperature: 0.3,
      });
      if (result.stubbed || !result.text.trim()) throw new Error("no AI provider configured (stubbed)");
      const script = parseStoryboard(stripReasoningTrace(result.text), lessonItem.concept);
      if (!script.topics?.length || script.topics.length < 3) throw new Error("model returned no topics");
      mkdirSync(join(process.cwd(), "public", "videos", "research"), { recursive: true });
      writeFileSync(
        researchPath(lessonItem.slug),
        JSON.stringify({ slug: lessonItem.slug, model: result.model, researchedAt: new Date().toISOString(), script }, null, 2),
      );
      ok++;
      console.log(`[${idx + 1}/${queue.length}] ok ${label} — ${script.topics.length} topics (${result.model})`);
    } catch (e) {
      failed++;
      console.log(`[${idx + 1}/${queue.length}] FAIL ${label} — ${(e as Error).message.slice(0, 140)}`);
    }
    if (idx < queue.length - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  console.log(`done: ${ok} researched, ${failed} failed, ${queue.length} attempted.`);
  process.exit(failed && !ok ? 1 : 0);
}

main().catch((e) => {
  console.error(`fatal: ${(e as Error).message}`);
  process.exit(1);
});
