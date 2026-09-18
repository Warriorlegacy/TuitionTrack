import Link from "next/link";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requireAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { VIDEO_CATALOG, getClassEntry, getSubjects } from "@/lib/learn/video-catalog";
import { resolveLessonScript } from "@/lib/learn/lesson-research";
import { ClassLessonCard } from "@/components/learn/class-lesson-card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// /app/videos — class-wise 3D animated learning videos (Classes 6–12, every
// chapter of every core subject). Filter by class, then subject. Every lesson
// plays on BOTH engines from one researched full-topic script: Remotion 3D
// in-app preview and the HyperFrames file render at /videos/<slug>/.
export default async function VideosPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  await requireAuthContext();

  // MoneyPrinterTurbo narrated clips (offline batch, see
  // docs/MONEYPRINTER_SETUP.md). Absent until a batch run lands mp4s.
  let narrated = new Set<string>();
  try {
    const manifestPath = join(process.cwd(), "public", "videos", "manifest.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, { narrated?: boolean }>;
      narrated = new Set(Object.entries(manifest).filter(([, v]) => v?.narrated).map(([k]) => k));
    }
  } catch { /* no manifest yet — cards simply hide the Narrated button */ }

  const wantedClass = typeof searchParams?.class === "string" ? Number(searchParams.class) : NaN;
  const entry = getClassEntry(wantedClass) ?? VIDEO_CATALOG[3]; // default: Class 9
  const subjects = getSubjects(entry.classLevel);
  const wantedSubject = typeof searchParams?.subject === "string" ? searchParams.subject : "";
  const subject = subjects.includes(wantedSubject) ? wantedSubject : subjects[0];
  const lessons = entry.lessons.filter((l) => l.subject === subject);
  const totalLessons = VIDEO_CATALOG.reduce((n, c) => n + c.lessons.length, 0);

  const pill = (active: boolean) =>
    cn(
      "rounded-full px-4 py-2 text-sm font-medium ring-1 transition-colors",
      active
        ? "bg-primary text-primary-foreground ring-primary"
        : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
    );

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader
        title="Learning Videos & Chapter Notes"
        description={`${totalLessons} chapter-wise 3D lessons and downloadable PDF revision notes across Classes 6–12 — interactive previews, in-depth topic explainers, formulas, and solved exam problems.`}
      />
      <nav aria-label="Filter by class" className="flex flex-wrap gap-2">
        {VIDEO_CATALOG.map((c) => (
          <Link
            key={c.classLevel}
            href={`/app/videos?class=${c.classLevel}`}
            aria-current={c.classLevel === entry.classLevel ? "page" : undefined}
            className={pill(c.classLevel === entry.classLevel)}
          >
            {c.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Filter by subject" className="flex flex-wrap gap-2">
        {subjects.map((s) => (
          <Link
            key={s}
            href={`/app/videos?class=${entry.classLevel}&subject=${encodeURIComponent(s)}`}
            aria-current={s === subject ? "page" : undefined}
            className={pill(s === subject)}
          >
            {s}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-slate-500">
        {entry.label} · {subject} · {lessons.length} chapters
      </p>
      <div className="space-y-5">
        {lessons.map((lessonItem) => (
          <ClassLessonCard
            key={lessonItem.slug}
            lesson={lessonItem}
            script={resolveLessonScript(lessonItem)}
            hasNarrated={narrated.has(lessonItem.slug)}
          />
        ))}
      </div>
    </div>
  );
}
