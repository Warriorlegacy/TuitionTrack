"use client";

// Motion lesson card — bridges the HyperFrames `public/videos/quadratic-explainer`
// composition into the student Today flow (marketing + learning vision).
// Deep-links to Tutor (highest-impact session) + Planner. No invented data.

import Link from "next/link";
import { CalendarDaysIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RemotionLessonPlayer } from "./remotion-lesson-player";

export function MotionLessonCard({
  studentId,
  concept = "Quadratic formula",
  duration = "0:18",
}: {
  studentId: string;
  concept?: string;
  duration?: string;
}) {
  const tutorHref = `/app/tutor?student=${encodeURIComponent(studentId)}`;
  const plannerHref = `/app/planner?student=${encodeURIComponent(studentId)}`;

  return (
    <section
      aria-labelledby="motion-lesson-heading"
      className="rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8"
    >
      <div className="grid items-center gap-6 md:grid-cols-[1.1fr_0.9fr]">
        {/* Remotion interactive preview (HyperFrames file render in videos/) */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary" className="w-fit">{concept}</Badge>
            <span className="tt-tnum rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">{duration}</span>
          </div>
          <RemotionLessonPlayer concept={concept} />
        </div>

        {/* Copy + deep-link CTAs */}
        <div>
          <p className="tt-mono-label text-[11px] text-primary">Motion lesson · /videos/quadratic-explainer</p>
          <h3 id="motion-lesson-heading" className="tt-display mt-2 text-xl font-semibold text-slate-950">
            Watch the idea, then fix it with your Tutor.
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {concept} in {duration} — then start your highest-impact session where you left off.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="lg" render={<Link href={tutorHref} />}>
              <PlayIcon className="mr-1 size-4" aria-hidden />
              Start highest-impact session
            </Button>
            <Button variant="outline" render={<Link href={plannerHref} />}>
              <CalendarDaysIcon className="mr-1 size-4" aria-hidden />
              Open week plan
            </Button>
          </div>
        </div>
      </div>
      <CardContent className="px-0 pb-0 pt-4">
        <Card className="border-0 bg-slate-50 shadow-none ring-1 ring-slate-200/80">
          <p className="px-4 py-3 text-xs leading-5 text-slate-500">
            Render: Remotion Player in-app · HyperFrames file 1280×720 · 18s. Studio with{" "}
            <code className="rounded bg-white px-1 ring-1 ring-slate-200">npx remotion studio</code>, file render with{" "}
            <code className="rounded bg-white px-1 ring-1 ring-slate-200">npx hyperframes preview</code>.
          </p>
        </Card>
      </CardContent>
    </section>
  );
}
