import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Progress aggregation for the parent portal.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE INVARIANT (brief, repeatedly): "Curriculum Covered" MUST NEVER equal
 * "Concept Mastery". They are different questions.
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   Curriculum covered  = how much ground the TEACHER has walked through.
 *                         Evidence: published assignments/lessons that name a
 *                         chapter. It says nothing about what the child knows.
 *
 *   Concept mastery     = what the CHILD has actually demonstrated.
 *                         Evidence: recorded practice/assessment outcomes in
 *                         `concept_mastery`. It says nothing about how far the
 *                         syllabus has advanced.
 *
 * A class can have covered 100% of a chapter with 20% mastery, or 30% coverage
 * with 95% mastery. Collapsing both into one "progress: 62%" would be a lie in
 * either direction, so this module is deliberately shaped to make that
 * impossible: there is no function here that returns a single combined score,
 * and the two dimensions are separate fields on separate types.
 *
 * Equally important: when there is no recorded evidence, these functions
 * return zeros/nulls and the UI renders an honest "not recorded yet" state.
 * Nothing here estimates, interpolates, or infers a number (§111).
 */

/** Mastery at or above this value counts as "mastered". Applied only to
 *  recorded `concept_mastery.mastery` values — never used to invent one. */
export const MASTERY_THRESHOLD = 0.7;

export type ChapterCoverage = {
  slug: string;
  label: string;
  assignmentCount: number;
  firstAssignedAt: string | null;
};

export type SubjectCoverage = {
  subject: string;
  chapters: ChapterCoverage[];
};

export type CurriculumCoverage = {
  /** Distinct chapters with at least one published assignment for this child. */
  chaptersCovered: number;
  bySubject: SubjectCoverage[];
  /**
   * Chapters in the formal curriculum plan for this class, or null when no
   * plan has been recorded. Coverage is only meaningful against a plan, so
   * `percentOfPlan` is null whenever this is null.
   */
  planChapters: number | null;
  percentOfPlan: number | null;
};

export type ConceptMasterySummary = {
  conceptsTracked: number;
  conceptsMastered: number;
  /** Mean of recorded mastery values. null when nothing has been recorded. */
  averageMastery: number | null;
  lastPracticedAt: string | null;
  /** Named concepts, only where the concept could actually be resolved. */
  topConcepts: { id: string; label: string; mastery: number }[];
};

export type AssessmentSummary = {
  submissions: number;
  averagePercentage: number | null;
  recent: {
    /** Submission id. */
    id: string;
    /** Assignment id — use with `getAssignmentTitles` to get a real title. */
    assignmentId: string;
    percentage: number | null;
    gradedAt: string | null;
  }[];
};

export type AttendanceSummary = {
  daysMarked: number;
  daysPresent: number;
  percentPresent: number | null;
  lastMarkedAt: string | null;
};

export type ProgressOverview = {
  studentId: string;
  generatedAt: string;
  curriculumCoverage: CurriculumCoverage;
  conceptMastery: ConceptMasterySummary;
  assessments: AssessmentSummary;
  attendance: AttendanceSummary;
};

type AssignmentLite = {
  id: string;
  title: string;
  subject: string | null;
  chapter_slug: string | null;
  class_level: number | null;
  lifecycle: string | null;
  target_student_ids: unknown;
  created_at: string | null;
};

function targetsStudent(target: unknown, studentId: string): boolean {
  // No target list (null/empty) means the assignment was set for the whole
  // class, so every child in that class is covered by it.
  if (target === null || target === undefined) return true;
  if (Array.isArray(target)) {
    if (target.length === 0) return true;
    return target.some((v) => String(v) === studentId);
  }
  return false;
}

function humaniseSlug(slug: string): string {
  // "c8-maths-02" → "Chapter 2". Only used as a display label; the slug is the
  // source of truth. Never guess a topic name that isn't in the data.
  const m = slug.match(/^c(\d+)-[a-z0-9-]+?-(\d+)$/i);
  if (m) return `Chapter ${Number(m[2])}`;
  const n = slug.match(/-(\d+)$/);
  if (n) return `Chapter ${Number(n[1])}`;
  return slug;
}

export async function getProgressOverview(
  studentId: string,
  classLevel: string | number | null | undefined,
): Promise<ProgressOverview> {
  const supabase = createSupabaseServerClient();

  const [assignmentsRes, masteryRes, submissionsRes, attendanceRes, planRes] =
    await Promise.all([
      supabase
        .from("assignments")
        .select("id, title, subject, chapter_slug, class_level, lifecycle, target_student_ids, created_at")
        .eq("lifecycle", "published")
        .returns<AssignmentLite[]>(),
      supabase
        .from("concept_mastery")
        .select("concept_id, mastery, attempt_count, correct_count, last_practiced_at")
        .eq("student_id", studentId),
      supabase
        .from("assignment_submissions")
        .select("id, assignment_id, percentage, score, total_marks, graded_at, status")
        .eq("student_id", studentId)
        .in("status", ["teacher_reviewed", "graded", "returned"])
        .order("graded_at", { ascending: false })
        .limit(10),
      supabase
        .from("attendance")
        .select("date, present")
        .eq("student_id", studentId),
      classLevel
        ? supabase
            .from("curriculum_chapters")
            .select("id, subject, chapter_number, title, slug")
            .eq("class_level", Number(classLevel))
        : Promise.resolve({ data: null, error: null } as const),
    ]);

  // ── Curriculum covered ───────────────────────────────────────────────────
  const assignments = (assignmentsRes.data ?? []).filter((a) =>
    targetsStudent(a.target_student_ids, studentId),
  );

  const bySubjectMap = new Map<string, Map<string, ChapterCoverage>>();
  for (const a of assignments) {
    if (!a.chapter_slug) continue;
    const subject = a.subject ?? "Other";
    if (!bySubjectMap.has(subject)) bySubjectMap.set(subject, new Map());
    const chapters = bySubjectMap.get(subject)!;
    const existing = chapters.get(a.chapter_slug);
    if (existing) {
      existing.assignmentCount += 1;
      if (a.created_at && (!existing.firstAssignedAt || a.created_at < existing.firstAssignedAt)) {
        existing.firstAssignedAt = a.created_at;
      }
    } else {
      chapters.set(a.chapter_slug, {
        slug: a.chapter_slug,
        label: humaniseSlug(a.chapter_slug),
        assignmentCount: 1,
        firstAssignedAt: a.created_at ?? null,
      });
    }
  }

  const bySubject: SubjectCoverage[] = Array.from(bySubjectMap.entries())
    .map(([subject, chapters]) => ({
      subject,
      chapters: Array.from(chapters.values()).sort((x, y) => x.slug.localeCompare(y.slug)),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const chaptersCovered = bySubject.reduce((n, s) => n + s.chapters.length, 0);
  const planRows = (planRes.data ?? []) as unknown as { id: string; subject: string }[];
  const planChapters = planRows.length > 0 ? planRows.length : null;

  const curriculumCoverage: CurriculumCoverage = {
    chaptersCovered,
    bySubject,
    planChapters,
    // Only computable against a recorded plan. No plan → no percentage, ever.
    percentOfPlan:
      planChapters && planChapters > 0
        ? Math.min(100, Math.round((chaptersCovered / planChapters) * 100))
        : null,
  };

  // ── Concept mastery ──────────────────────────────────────────────────────
  type MasteryLite = {
    concept_id: string;
    mastery: number | string | null;
    last_practiced_at: string | null;
  };
  const masteryRows = (masteryRes.data ?? []) as unknown as MasteryLite[];
  const masteryValues = masteryRows
    .map((r) => (r.mastery === null ? null : Number(r.mastery)))
    .filter((v): v is number => v !== null && !Number.isNaN(v));

  const conceptMastery: ConceptMasterySummary = {
    conceptsTracked: masteryValues.length,
    conceptsMastered: masteryValues.filter((v) => v >= MASTERY_THRESHOLD).length,
    averageMastery:
      masteryValues.length > 0
        ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length
        : null,
    lastPracticedAt:
      masteryRows
        .map((r) => r.last_practiced_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
    // Concept names are only shown when they can be resolved from real data.
    // An unresolvable id is never given an invented label, so this stays empty
    // until a concept lookup exists.
    topConcepts: [],
  };

  // ── Assessments ──────────────────────────────────────────────────────────
  type SubmissionLite = {
    id: string;
    assignment_id: string;
    percentage: number | string | null;
    graded_at: string | null;
  };
  const submissionRows = (submissionsRes.data ?? []) as unknown as SubmissionLite[];
  const percentages = submissionRows
    .map((s) => (s.percentage === null ? null : Number(s.percentage)))
    .filter((v): v is number => v !== null && !Number.isNaN(v));

  const assessments: AssessmentSummary = {
    submissions: submissionRows.length,
    averagePercentage:
      percentages.length > 0
        ? percentages.reduce((a, b) => a + b, 0) / percentages.length
        : null,
    recent: submissionRows.slice(0, 5).map((s) => ({
      id: s.id,
      assignmentId: s.assignment_id,
      percentage: s.percentage === null ? null : Number(s.percentage),
      gradedAt: s.graded_at,
    })),
  };

  // ── Attendance ───────────────────────────────────────────────────────────
  type AttendanceLite = { date: string; present: boolean | null };
  const attendanceRows = (attendanceRes.data ?? []) as unknown as AttendanceLite[];
  const daysMarked = attendanceRows.length;
  const daysPresent = attendanceRows.filter((r) => r.present === true).length;

  const attendance: AttendanceSummary = {
    daysMarked,
    daysPresent,
    percentPresent: daysMarked > 0 ? (daysPresent / daysMarked) * 100 : null,
    lastMarkedAt: attendanceRows.map((r) => r.date).sort().at(-1) ?? null,
  };

  return {
    studentId,
    generatedAt: new Date().toISOString(),
    curriculumCoverage,
    conceptMastery,
    assessments,
    attendance,
  };
}

/**
 * Titles for the submissions list. Kept separate so the aggregation above
 * never has to invent a label — if an assignment title can't be found the
 * caller renders "Assessment", not a guess.
 */
export async function getAssignmentTitles(
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("assignments")
    .select("id, title")
    .in("id", ids)
    .returns<{ id: string; title: string }[]>();
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.id] = row.title;
  return map;
}
