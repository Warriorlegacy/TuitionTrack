// Class-wise 3D animated learning-video catalog (Classes 6–12, every
// chapter of every core subject).
//
// Single source of truth for BOTH render engines:
//   - Remotion  → src/remotion/Root.tsx registers one composition per lesson,
//     rendered interactively in-app via RemotionLessonPlayer.
//   - HyperFrames → scripts/make-lesson-videos.ts emits
//     public/videos/<slug>/index.html (18s GSAP file render) from the same
//     script object, so both engines always tell the same story.
//
// Chapter titles live in ./video-chapters (one line per chapter); this module
// builds stable slugs (`c9-maths-03`), badges, and concept scripts.
// Scripts resolve via deterministicStoryboard(concept): concept-specific copy
// with zero hand-maintenance. /api/ai/video upgrades the same script with an
// LLM storyboard + AI clip when free quota allows.
import { deterministicStoryboard, type LessonScript } from "../ai/video";
import { CHAPTER_BANDS } from "./video-chapters";
import type { Board } from "./video-chapters";

export type VideoLesson = {
  slug: string;
  classLevel: number;
  subject: string;
  board: Board;
  chapter: number;
  concept: string;
  badge: string;
};

export type ClassEntry = {
  classLevel: number;
  label: string;
  lessons: VideoLesson[];
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

function buildCatalog(): ClassEntry[] {
  return CHAPTER_BANDS.map((band) => ({
    classLevel: band.classLevel,
    label: `Class ${band.classLevel}`,
    lessons: band.bands.flatMap((b) =>
      b.chapters.map((concept, i) => ({
        slug: `c${band.classLevel}-${slugify(b.subject)}-${String(i + 1).padStart(2, "0")}`,
        classLevel: band.classLevel,
        subject: b.subject,
        board: b.board,
        chapter: i + 1,
        concept,
        badge: `Class ${band.classLevel} · ${b.subject}`,
      })),
    ),
  }));
}

export const VIDEO_CATALOG: ClassEntry[] = buildCatalog();

export const ALL_LESSONS: VideoLesson[] = VIDEO_CATALOG.flatMap((c) => c.lessons);

export function getClassEntry(classLevel: number): ClassEntry | null {
  return VIDEO_CATALOG.find((c) => c.classLevel === classLevel) ?? null;
}

export function getSubjects(classLevel: number): string[] {
  const entry = getClassEntry(classLevel);
  if (!entry) return [];
  return Array.from(new Set(entry.lessons.map((l) => l.subject)));
}

export function getLesson(slug: string): VideoLesson | null {
  return ALL_LESSONS.find((l) => l.slug === slug) ?? null;
}

// Concept-specific 3D script for a catalog lesson: deterministic base with
// the lesson badge, upgraded in place when /api/ai/video returns an LLM
// storyboard for the same concept.
export function resolveScript(lessonItem: VideoLesson): LessonScript {
  const base = deterministicStoryboard(lessonItem.concept);
  return { ...base, badge: lessonItem.badge };
}
