// Researched full-explanation scripts for class-wise lesson videos.
//
// Batch flow (no per-request cost):
//   npx tsx scripts/research-lessons.ts [--only slug,...] [--class N] [--limit N] [--force]
// writes public/videos/research/<slug>.json (one LLM call per chapter).
// resolveFullScript() prefers that JSON and falls back to the deterministic
// scaffold, so pages + both render engines work before AND after research.
//
// Server-only (node:fs): imported by server components, Remotion Studio
// (Node), and build scripts — never by client components (they receive the
// resolved script as props).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { deterministicStoryboard, type LessonScript } from "../ai/video";
import type { VideoLesson } from "./video-catalog";

export const EXTENDED_MINUTES = 60;
export const EXTENDED_SEGMENTS = 12;

export type ResearchedFile = {
  slug: string;
  model: string;
  researchedAt: string;
  script: LessonScript;
};

export function researchPath(slug: string): string {
  return join(process.cwd(), "public", "videos", "research", `${slug}.json`);
}

// Researched script for one lesson, or null when not yet researched (or the
// file is corrupt — never throw from the render path).
export function readResearchedScript(slug: string): LessonScript | null {
  try {
    const p = researchPath(slug);
    if (!existsSync(p)) return null;
    const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<ResearchedFile>;
    const s = raw?.script as Partial<LessonScript> | undefined;
    if (!s || typeof s.title !== "string" || !Array.isArray(s.topics) || s.topics.length === 0) return null;
    return s as LessonScript;
  } catch {
    return null;
  }
}

// Full topic-wise script: researched JSON when present, else the
// deterministic scaffold with the lesson badge. One object feeds Remotion,
// HyperFrames, and the topics accordion — all three stay in sync.
export function resolveFullScript(lessonItem: VideoLesson): LessonScript {
  const base = deterministicStoryboard(lessonItem.concept);
  base.badge = lessonItem.badge;
  const researched = readResearchedScript(lessonItem.slug);
  if (!researched) return base;
  return { ...researched, badge: lessonItem.badge };
}

export type ExtendedFile = {
  slug: string;
  model: string;
  updatedAt: string;
  plan: string[];
  segments: import("../ai/video").LessonSegment[];
};

export function extendedPath(slug: string): string {
  return join(process.cwd(), "public", "videos", "research", `${slug}.extended.json`);
}

export function hasExtended(slug: string): boolean {
  try {
    return existsSync(extendedPath(slug));
  } catch {
    return false;
  }
}

// Segments + total minutes for the 1-hour one-shot, or null when the lesson
// hasn't been extended yet (never throws from the render path).
export function readExtended(slug: string): Pick<LessonScript, "segments" | "totalMinutes"> | null {
  try {
    const p = extendedPath(slug);
    if (!existsSync(p)) return null;
    const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<ExtendedFile>;
    if (!Array.isArray(raw?.segments) || raw.segments.length < 2) return null;
    const segments = raw.segments
      .filter((s) => s && typeof s.narration === "string" && s.narration.trim().length > 0)
      .slice(0, 16);
    if (segments.length < 2) return null;
    const totalMinutes = segments.reduce((n, s) => n + (Number(s.minutes) || 5), 0);
    return { segments, totalMinutes };
  } catch {
    return null;
  }
}

// Everything the players need: short hook + topics + (when researched)
// the 1-hour segments. Single call for pages and renderers.
export function resolveLessonScript(lessonItem: VideoLesson): LessonScript {
  const base = resolveFullScript(lessonItem);
  const ext = readExtended(lessonItem.slug);
  if (!ext) return base;
  return { ...base, ...ext };
}

// One LLM call per chapter. Demands NCERT sub-topic headings, grade-level
// explanations, exam-facing examples, and a 3D scene line per topic so the
// same JSON scripts the video AND the written explanation.
export function buildResearchPrompt(lessonItem: VideoLesson): string {
  return [
    `Write a full chapter explainer for Indian school students: Class ${lessonItem.classLevel} ${lessonItem.subject}, chapter "${lessonItem.concept}" (${lessonItem.board} board, NCERT syllabus).`,
    "Cover EVERY major sub-topic of this chapter (4-5 topics). Reply with ONLY a JSON object, no markdown fences, no commentary:",
    "{",
    '  "kicker": "TUITIONTRACK · MOTION LESSON",',
    `  "title": "<chapter, visualized — max 8 words>",`,
    '  "subtitle": "<one-line promise of what the student will master>",',
    '  "steps": [{"tag": "STEP 1 · <name>", "body": "<one-line rule or formula>"}, ...3 steps],',
    '  "example": "<one fully worked exam-style example with answer>",',
    '  "ctaTitle": "<short mastery nudge>", "ctaBody": "<one-line next step>",',
    '  "videoPrompt": "<one 3D animation scene line for this chapter>",',
    '  "topics": [{"heading": "<NCERT sub-topic name>", "explain": "<2-3 sentence grade-level explanation with one analogy>", "bullets": ["<fact, formula, or step>", "<x3>"], "example": "<one concrete worked mini-example>", "visual": "<one 3D scene line>"} x4-5],',
    '  "misconception": "<the #1 mistake students make here + correction>",',
    '  "examTip": "<one marking-scheme tip: presentation, units, steps>",',
    `  "sources": ["NCERT Class ${lessonItem.classLevel} ${lessonItem.subject}: ${lessonItem.concept}"]`,
    "}",
    "Rules: every formula with correct symbols; every topic needs a distinct NCERT sub-topic heading (never generic SEE/SPA labels); explanations must be teachable, not placeholders; keep each string under 220 chars except explain (under 400).",
  ].join("\n");
}
