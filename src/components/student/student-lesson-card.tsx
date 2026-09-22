"use client";

import { useState } from "react";
import Link from "next/link";
import { PlayIcon, FileTextIcon, Volume2Icon, ChevronDownIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RemotionLessonPlayer } from "@/components/learn/remotion-lesson-player";
import type { VideoLesson } from "@/lib/learn/video-catalog";
import type { LessonScript } from "@/lib/ai/video";

export function StudentLessonCard({
  lesson,
  script,
  hasNarrated,
}: {
  lesson: VideoLesson;
  script: LessonScript;
  hasNarrated?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);

  const topics = script.topics ?? [];
  const segments = script.segments ?? [];
  const totalMin = script.totalMinutes ?? segments.reduce((n, s) => n + (Number(s.minutes) || 5), 0);
  const runtime = segments.length ? `~${totalMin} min` : "1-hr lesson";

  return (
    <article className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-soft transition-all duration-200 hover:border-emerald-300 hover:shadow-md">
      <div>
        {/* Top Video Preview Area */}
        <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
          {playing ? (
            <RemotionLessonPlayer script={script} />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={`Play 3D preview: ${lesson.concept}`}
              className="group relative flex size-full flex-col items-center justify-center gap-2.5 p-4 text-center transition-colors hover:bg-slate-900"
            >
              <div className="absolute inset-0 bg-radial from-emerald-500/10 to-transparent opacity-60 pointer-events-none" />
              <span className="flex size-13 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-transform duration-200 group-hover:scale-110">
                <PlayIcon className="ml-0.5 size-6 fill-current" aria-hidden />
              </span>
              <span className="max-w-[220px] text-xs font-semibold text-slate-200 line-clamp-1">
                {lesson.concept}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300 backdrop-blur-sm">
                <SparklesIcon className="size-3" />
                Tap to preview 3D scene
              </span>
            </button>
          )}

          {/* Floating runtime badge */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 pointer-events-none">
            <span className="rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
              {runtime}
            </span>
          </div>
        </div>

        {/* Card Content Area */}
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold">
              Ch {lesson.chapter} · {lesson.subject}
            </Badge>
            {segments.length ? (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200/60">
                {segments.length} parts + voice
              </span>
            ) : null}
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-950 line-clamp-1">
              {script.title || lesson.concept}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 line-clamp-2">
              {script.subtitle || `Interactive visual concepts and comprehensive revision for Class ${lesson.classLevel} ${lesson.subject}.`}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons & Topics */}
      <div className="p-5 pt-0 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {segments.length > 0 ? (
            <a
              href={`/videos/${lesson.slug}/full.html`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
            >
              <PlayIcon className="size-3.5 fill-current" aria-hidden />
              1-Hr Lesson
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
            >
              <PlayIcon className="size-3.5 fill-current" aria-hidden />
              Play 3D
            </button>
          )}

          <Link
            href={`/app/notes/${lesson.slug}`}
            target="_blank"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <FileTextIcon className="size-3.5 text-indigo-600" aria-hidden />
            PDF Notes
          </Link>
        </div>

        {hasNarrated ? (
          <a
            href={`/videos/${lesson.slug}/narrated.mp4`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
          >
            <Volume2Icon className="size-3 text-slate-500" />
            Listen to Voice Narration
          </a>
        ) : null}

        {/* Collapsible Key Topics Drawer */}
        {topics.length > 0 ? (
          <div className="border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => setTopicsOpen(!topicsOpen)}
              className="flex w-full items-center justify-between py-1 text-left text-xs font-semibold text-slate-700 hover:text-emerald-700"
            >
              <span>{topics.length} Key Concepts & Exam Tips</span>
              <ChevronDownIcon
                className={`size-3.5 text-slate-400 transition-transform ${
                  topicsOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {topicsOpen ? (
              <div className="mt-2 space-y-2.5 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-xs">
                {topics.map((t, i) => (
                  <div key={t.heading} className="space-y-0.5">
                    <p className="font-semibold text-slate-900">
                      {i + 1}. {t.heading}
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      {t.explain}
                    </p>
                  </div>
                ))}
                {script.examTip ? (
                  <p className="mt-1.5 rounded-lg bg-emerald-50 p-2 text-[11px] font-medium text-emerald-900 border border-emerald-200/60">
                    <span className="font-bold">Exam Tip: </span>
                    {script.examTip}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
