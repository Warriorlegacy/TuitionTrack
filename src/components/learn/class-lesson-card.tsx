"use client";

// One chapter-wise lesson row: click-to-mount Remotion 3D preview (same
// script the HyperFrames file render is baked from) + deep links to the AI
// clip generator and the file render. Players mount on click so a
// 30-chapter subject page stays light until the student presses play.
import { useState } from "react";
import Link from "next/link";
import { ClapperboardIcon, FilePlayIcon, PlayIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RemotionLessonPlayer } from "./remotion-lesson-player";
import type { VideoLesson } from "@/lib/learn/video-catalog";
import type { LessonScript } from "@/lib/ai/video";

export function ClassLessonCard({ lesson, script, hasNarrated }: { lesson: VideoLesson; script: LessonScript; hasNarrated?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const topics = script.topics?.slice(0, 5) ?? [];
  const segments = script.segments ?? [];
  const totalMin = script.totalMinutes ?? segments.reduce((n, s) => n + (Number(s.minutes) || 5), 0);
  const runtime = segments.length ? `~${totalMin} min` : topics.length ? `0:${18 + topics.length * 10}` : "0:18";

  return (
    <article className="grid items-center gap-6 rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft md:grid-cols-[1.1fr_0.9fr]">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="secondary" className="w-fit">
            Ch {lesson.chapter} · {lesson.subject}
          </Badge>
          <span className="tt-tnum rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">{runtime}</span>
          {topics.length ? (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              {topics.length} topics · full explanation
            </span>
          ) : null}
          {segments.length ? (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              1-hour lesson · {segments.length} parts + voice
            </span>
          ) : null}
        </div>
        {playing ? (
          <RemotionLessonPlayer script={script} />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play 3D preview: ${lesson.concept}`}
            className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-tt-md bg-slate-950 text-center ring-1 ring-white/20 transition-colors hover:bg-slate-900"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <PlayIcon className="size-6" aria-hidden />
            </span>
            <span className="max-w-xs px-4 text-sm font-medium text-slate-200">{lesson.concept}</span>
            <span className="text-xs text-slate-500">Tap to play the 3D preview</span>
          </button>
        )}
      </div>
      <div>
        <h3 className="tt-display text-lg font-semibold text-slate-950">{script.title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{script.subtitle}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            className="border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100/70"
            render={
              <Link href={`/app/notes/${lesson.slug}`} />
            }
          >
            <FileTextIcon className="mr-1 size-4 text-indigo-600" aria-hidden />
            PDF Notes
          </Button>
          <Button
            size="sm"
            render={
              <Link
                href={`/app/today?concept=${encodeURIComponent(lesson.concept)}`}
              />
            }
          >
            <ClapperboardIcon className="mr-1 size-4" aria-hidden />
            Generate AI clip
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={<a href={`/videos/${lesson.slug}/`} target="_blank" rel="noreferrer" />}
          >
            <FilePlayIcon className="mr-1 size-4" aria-hidden />
            File render
          </Button>
          {segments.length ? (
            <Button
              size="sm"
              render={<a href={`/videos/${lesson.slug}/full.html`} target="_blank" rel="noreferrer" />}
            >
              <PlayIcon className="mr-1 size-4" aria-hidden />
              1-hour full lesson
            </Button>
          ) : null}
          {hasNarrated ? (
            <Button
              size="sm"
              variant="outline"
              render={<a href={`/videos/${lesson.slug}/narrated.mp4`} target="_blank" rel="noreferrer" />}
            >
              <PlayIcon className="mr-1 size-4" aria-hidden />
              Narrated clip
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-400">
          Remotion 3D preview + HyperFrames file — same story on both engines.
        </p>
        {topics.length ? (
          <details className="mt-3 rounded-tt-md border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Full explanation · {topics.length} topics
            </summary>
            <ol className="mt-2 space-y-3">
              {topics.map((t, i) => (
                <li key={t.heading}>
                  <p className="text-sm font-semibold text-slate-900">
                    {i + 1}. {t.heading}
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-slate-600">{t.explain}</p>
                  <ul className="mt-1 list-disc pl-5 text-sm leading-6 text-slate-600">
                    {t.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-sm italic text-slate-500">{t.example}</p>
                </li>
              ))}
            </ol>
            {script.misconception ? (
              <p className="mt-2 text-sm leading-6 text-slate-600">
                <span className="font-semibold text-slate-800">Watch out: </span>
                {script.misconception}
              </p>
            ) : null}
            {script.examTip ? (
              <p className="mt-1 text-sm leading-6 text-slate-600">
                <span className="font-semibold text-slate-800">Exam tip: </span>
                {script.examTip}
              </p>
            ) : null}
          </details>
        ) : null}
      </div>
    </article>
  );
}
