"use client";

// One chapter-wise lesson row: click-to-mount Remotion 3D preview (same
// script the HyperFrames file render is baked from) + deep links to the AI
// clip generator and the file render. Players mount on click so a
// 30-chapter subject page stays light until the student presses play.
import { useState } from "react";
import Link from "next/link";
import { ClapperboardIcon, FilePlayIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RemotionLessonPlayer } from "./remotion-lesson-player";
import type { VideoLesson } from "@/lib/learn/video-catalog";
import type { LessonScript } from "@/lib/ai/video";

export function ClassLessonCard({ lesson, script, hasNarrated }: { lesson: VideoLesson; script: LessonScript; hasNarrated?: boolean }) {
  const [playing, setPlaying] = useState(false);

  return (
    <article className="grid items-center gap-6 rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft md:grid-cols-[1.1fr_0.9fr]">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="secondary" className="w-fit">
            Ch {lesson.chapter} · {lesson.subject}
          </Badge>
          <span className="tt-tnum rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">0:18</span>
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
          Remotion 3D preview + HyperFrames file — same 18-second story on both engines.
        </p>
      </div>
    </article>
  );
}
