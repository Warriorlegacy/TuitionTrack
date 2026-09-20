import Link from "next/link";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requireStudentContext } from "@/lib/student/auth";
import { PageHeader } from "@/components/shared/page-header";
import { VIDEO_CATALOG, getClassEntry, getSubjects } from "@/lib/learn/video-catalog";
import { resolveLessonScript } from "@/lib/learn/lesson-research";
import { ClassLessonCard } from "@/components/learn/class-lesson-card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StudentLessonsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const context = await requireStudentContext();
  const student = context.student!;

  let narrated = new Set<string>();
  try {
    const manifestPath = join(process.cwd(), "public", "videos", "manifest.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, { narrated?: boolean }>;
      narrated = new Set(Object.entries(manifest).filter(([, v]) => v?.narrated).map(([k]) => k));
    }
  } catch {
    // no manifest
  }

  const studentClassNum = Number(student.class);
  const wantedClass = typeof searchParams?.class === "string" ? Number(searchParams.class) : studentClassNum;
  const entry = getClassEntry(wantedClass) ?? getClassEntry(studentClassNum) ?? VIDEO_CATALOG[3];
  const subjects = getSubjects(entry.classLevel);
  const wantedSubject = typeof searchParams?.subject === "string" ? searchParams.subject : "";
  const subject = subjects.includes(wantedSubject) ? wantedSubject : subjects[0];
  const lessons = entry.lessons.filter((l) => l.subject === subject);

  const pill = (active: boolean) =>
    cn(
      "rounded-full px-4 py-1.5 text-xs font-medium ring-1 transition-colors",
      active
        ? "bg-emerald-600 text-white ring-emerald-600 shadow-xs"
        : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
    );

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="3D NCERT Lessons & Notes"
        description={`Interactive visual 3D lessons, formula cheatsheets, and audio narrations for Class ${entry.classLevel} ${subject}.`}
      />

      {/* Class Switcher */}
      <nav aria-label="Filter by class" className="flex flex-wrap gap-2">
        {VIDEO_CATALOG.map((c) => (
          <Link
            key={c.classLevel}
            href={`/student/lessons?class=${c.classLevel}`}
            className={pill(c.classLevel === entry.classLevel)}
          >
            Class {c.classLevel}
            {c.classLevel === studentClassNum ? " (Yours)" : ""}
          </Link>
        ))}
      </nav>

      {/* Subject Filter */}
      <nav aria-label="Filter by subject" className="flex flex-wrap gap-2">
        {subjects.map((s) => (
          <Link
            key={s}
            href={`/student/lessons?class=${entry.classLevel}&subject=${encodeURIComponent(s)}`}
            className={pill(s === subject)}
          >
            {s}
          </Link>
        ))}
      </nav>

      {/* Lesson Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map((lesson) => {
          const script = resolveLessonScript(lesson);
          return (
            <ClassLessonCard
              key={lesson.slug}
              lesson={lesson}
              script={script}
              hasNarrated={narrated.has(lesson.slug)}
            />
          );
        })}
      </div>
    </div>
  );
}
