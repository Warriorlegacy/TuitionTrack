// Batch-research 1-hour one-shot lesson scripts (12 x 5-min voiced segments).
//
// A full 60-min narration (~9,000 words) never fits one free-tier completion,
// so each chapter is researched in chunks: 1 plan call + 1 call per segment.
// Progress saves after every segment — re-running resumes where it stopped:
//   npx tsx scripts/research-extended.ts --only c10-maths-04
//   npx tsx scripts/research-extended.ts --class 10 --limit 3
// Flags: --subject X --force (redo) --delay-ms 2500 --segments 12 --minutes 5
//
// Writes public/videos/research/<slug>.extended.json, then:
//   npx tsx scripts/make-extended-videos.ts [--only ...]
// bakes public/videos/<slug>/full.html (HyperFrames 1-hour one-shot + voice).
// The in-app Remotion ExtendedLesson reads the same JSON via resolveLessonScript.
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_LESSONS } from "../src/lib/learn/video-catalog";
import { extendedPath, type ExtendedFile } from "../src/lib/learn/lesson-research";
import type { VideoLesson } from "../src/lib/learn/video-catalog";
import type { LessonSegment } from "../src/lib/ai/video";
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
const delayMs = Number(flag("delay-ms") ?? 2500) || 2500;
const SEGMENTS = Math.min(Math.max(Number(flag("segments") ?? 12) || 12, 4), 16);
const MINUTES = Math.min(Math.max(Number(flag("minutes") ?? 5) || 5, 3), 10);

let queue = ALL_LESSONS.filter(
  (l) =>
    (!only.size || only.has(l.slug)) &&
    (!Number.isFinite(classFilter) || l.classLevel === classFilter) &&
    (!subjectFilter || l.subject.toLowerCase() === subjectFilter),
);
if (Number.isFinite(limit)) queue = queue.slice(0, limit);
if (!queue.length) {
  console.log("no lessons match.");
  process.exit(0);
}

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const asJson = (text: string): Record<string, unknown> | null => {
  try {
    const t = stripReasoningTrace(text);
    return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function loadExtended(slug: string): ExtendedFile | null {
  try {
    if (!existsSync(extendedPath(slug))) return null;
    return JSON.parse(readFileSync(extendedPath(slug), "utf8")) as ExtendedFile;
  } catch {
    return null;
  }
}

function saveExtended(file: ExtendedFile): void {
  mkdirSync(join(process.cwd(), "public", "videos", "research"), { recursive: true });
  writeFileSync(extendedPath(file.slug), JSON.stringify({ ...file, updatedAt: new Date().toISOString() }, null, 2));
}

async function planLesson(lessonItem: VideoLesson): Promise<string[]> {
  const result = await complete({
    tier: "A",
    system: "You plan NCERT chapter video lessons as JSON. JSON only, no markdown fences.",
    user: [
      `Plan a ${SEGMENTS}-part 1-hour video lesson for Class ${lessonItem.classLevel} ${lessonItem.subject}, chapter "${lessonItem.concept}" (NCERT syllabus).`,
      `The ${SEGMENTS} parts must cover EVERY sub-topic of this chapter with nothing excluded: concepts, definitions, formulas, derivations, diagrams, activities, worked examples, word problems, common mistakes, exam technique.`,
      `Part 1 hooks with why the chapter matters; the last part is an exam masterclass + full recap. Reply with ONLY JSON: {"plan": ["<part 1 heading>", ... exactly ${SEGMENTS} headings]}.`,
    ].join("\n"),
    maxTokens: 600,
    temperature: 0.3,
  });
  if (result.stubbed) throw new Error("no AI provider configured (stubbed)");
  const j = asJson(result.text);
  const plan = Array.isArray(j?.plan) ? (j.plan as unknown[]).filter((h): h is string => typeof h === "string" && h.trim().length > 0).map((h) => h.trim().slice(0, 90)) : [];
  if (plan.length < 4) throw new Error("model returned no plan");
  return plan.slice(0, SEGMENTS);
}

async function researchSegment(lessonItem: VideoLesson, plan: string[], index: number): Promise<LessonSegment> {
  const ask = async (retry: boolean): Promise<LessonSegment> => {
    const result = await complete({
      tier: "A",
      system: "You write NCERT video-lesson voice scripts as JSON. JSON only, no markdown fences.",
      user: [
        `Class ${lessonItem.classLevel} ${lessonItem.subject}, chapter "${lessonItem.concept}". Part ${index + 1} of ${plan.length}: "${plan[index]}".`,
        `Full chapter outline: ${plan.map((h, i) => `${i + 1}. ${h}`).join(" | ")}`,
        `Write the complete ~${MINUTES}-minute spoken script for THIS part only (target ${MINUTES * 150} words of narration; teach every detail of this part, do not summarize other parts, one-line continuity nod max).`,
        `Reply with ONLY JSON: {"heading": "<part heading>", "narration": "<full voice script, plain sentences a teacher speaks — formulas spelled out>", "points": ["<5 on-screen bullets, max 90 chars each>"], "visual": "<one 3D animation scene line>"}.`,
        retry ? "The previous draft was too short — expand with more explanation, worked steps, and examples." : "",
      ].join("\n"),
      maxTokens: 2000,
      temperature: 0.4,
    });
    if (result.stubbed) throw new Error("no AI provider configured (stubbed)");
    const j = asJson(result.text);
    const narration = str(j?.narration);
    const points = Array.isArray(j?.points)
      ? (j.points as unknown[]).filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim().slice(0, 120)).slice(0, 5)
      : [];
    return {
      heading: str(j?.heading) || plan[index],
      minutes: MINUTES,
      narration,
      points: points.length ? points : [plan[index]],
      visual: str(j?.visual) || `Slow 3D camera drift over glowing "${plan[index]}" title cards`,
    };
  };
  let seg = await ask(false);
  if (words(seg.narration) < 350) seg = await ask(true); // ponytail: one retry, then ship
  if (words(seg.narration) < 200) throw new Error(`segment too thin (${words(seg.narration)} words)`);
  return seg;
}

async function main(): Promise<void> {
  let okSeg = 0;
  let failed = 0;
  for (let qi = 0; qi < queue.length; qi++) {
    const lessonItem = queue[qi];
    let file = force ? null : loadExtended(lessonItem.slug);
    try {
      if (!file || !file.plan?.length) {
        const plan = await planLesson(lessonItem);
        file = { slug: lessonItem.slug, model: "tier-A", updatedAt: "", plan, segments: [] };
        console.log(`[${qi + 1}/${queue.length}] ${lessonItem.slug}: plan — ${plan.length} parts`);
        await sleep(delayMs);
      }
      for (let i = file.segments.length; i < file.plan.length; i++) {
        const seg = await researchSegment(lessonItem, file.plan, i);
        file.segments[i] = seg;
        file.model = file.model || "tier-A";
        saveExtended(file);
        okSeg++;
        console.log(`[${qi + 1}/${queue.length}] ${lessonItem.slug} part ${i + 1}/${file.plan.length} ok — ${words(seg.narration)} words`);
        await sleep(delayMs);
      }
      const total = file.segments.reduce((n, s) => n + (Number(s.minutes) || MINUTES), 0);
      console.log(`[${qi + 1}/${queue.length}] ${lessonItem.slug} DONE — ${file.segments.length} parts, ~${total} min`);
    } catch (e) {
      failed++;
      console.log(`[${qi + 1}/${queue.length}] ${lessonItem.slug} FAIL — ${(e as Error).message.slice(0, 140)}`);
    }
  }
  console.log(`done: ${okSeg} segments researched, ${failed} lessons failed.`);
  process.exit(failed && !okSeg ? 1 : 0);
}

main().catch((e) => {
  console.error(`fatal: ${(e as Error).message}`);
  process.exit(1);
});
