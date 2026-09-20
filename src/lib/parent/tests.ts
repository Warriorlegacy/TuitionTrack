import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Parent-facing test/assessment queries.
 *
 * Source: `assignment_submissions` joined to `assignments` for titles/subjects.
 * Only graded submissions (status = 'ai_evaluated' | 'teacher_reviewed' | 'graded'
 * or a non-null percentage) are surfaced as "results".
 *
 * We deliberately do NOT show class-wide comparative ranks (§20).
 * Performance is personal — score, percentage, subject, trend.
 */

export type TestResult = {
  id: string;
  /** Assignment (test) title */
  title: string;
  subject: string | null;
  chapterSlug: string | null;
  score: number | null;
  totalMarks: number | null;
  percentage: number | null;
  gradedAt: string | null;
  /** Status as recorded in submission */
  status: string;
  teacherFeedback: string | null;
};

export type SubjectPerformance = {
  subject: string;
  averagePercentage: number;
  count: number;
  lastResultAt: string | null;
};

export type TestTrendPoint = {
  date: string;
  percentage: number;
  title: string;
};

const GRADED_STATUSES = [
  "ai_evaluated",
  "teacher_reviewed",
  "graded",
  "returned",
];

/**
 * List all graded test results for a student, newest first.
 */
export async function listTestResultsForStudent(
  studentId: string,
  limit = 50,
): Promise<TestResult[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assignment_submissions")
    .select(
      `id, status, score, total_marks, percentage, graded_at, teacher_feedback,
       assignment:assignments(id, title, subject, chapter_slug)`,
    )
    .eq("student_id", studentId)
    .in("status", GRADED_STATUSES)
    .not("percentage", "is", null)
    .order("graded_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  type Raw = {
    id: string;
    status: string;
    score: number | null;
    total_marks: number | null;
    percentage: number | null;
    graded_at: string | null;
    teacher_feedback: string | null;
    assignment: {
      id: string;
      title: string;
      subject: string | null;
      chapter_slug: string | null;
    } | null;
  };

  return ((data as unknown as Raw[]) ?? []).map((row) => ({
    id: row.id,
    title: row.assignment?.title ?? "Assessment",
    subject: row.assignment?.subject ?? null,
    chapterSlug: row.assignment?.chapter_slug ?? null,
    score: row.score,
    totalMarks: row.total_marks,
    percentage: row.percentage !== null ? Number(row.percentage) : null,
    gradedAt: row.graded_at,
    status: row.status,
    teacherFeedback: row.teacher_feedback,
  }));
}

/**
 * Chronological trend of test scores for charting.
 * Returns oldest → newest so a trend line reads left-to-right.
 */
export async function getTestTrend(studentId: string, limit = 20): Promise<TestTrendPoint[]> {
  const results = await listTestResultsForStudent(studentId, limit);
  return results
    .filter((r) => r.percentage !== null && r.gradedAt !== null)
    .map((r) => ({
      date: r.gradedAt!,
      percentage: Math.round(r.percentage!),
      title: r.title,
    }))
    .reverse(); // oldest first for chart
}

/**
 * Average percentage per subject across all graded results.
 */
export async function getSubjectPerformance(studentId: string): Promise<SubjectPerformance[]> {
  const results = await listTestResultsForStudent(studentId, 200);
  const map = new Map<string, { total: number; count: number; lastAt: string | null }>();

  for (const r of results) {
    if (r.percentage === null) continue;
    const subj = r.subject ?? "Other";
    const existing = map.get(subj) ?? { total: 0, count: 0, lastAt: null };
    existing.total += r.percentage;
    existing.count += 1;
    if (r.gradedAt && (!existing.lastAt || r.gradedAt > existing.lastAt)) {
      existing.lastAt = r.gradedAt;
    }
    map.set(subj, existing);
  }

  return Array.from(map.entries())
    .map(([subject, v]) => ({
      subject,
      averagePercentage: Math.round(v.total / v.count),
      count: v.count,
      lastResultAt: v.lastAt,
    }))
    .sort((a, b) => b.averagePercentage - a.averagePercentage);
}
