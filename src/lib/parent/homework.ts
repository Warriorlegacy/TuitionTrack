import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Parent-facing homework queries.
 *
 * All reads go through the RLS-scoped client, so a guardian can only ever see
 * homework for their own verified child. No client-supplied IDs are trusted —
 * the caller must already hold a validated `studentId` from `requireParentContext`.
 */

export type HomeworkEntry = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  due_date: string;
  status: "pending" | "completed";
  created_at: string;
  updated_at: string;
  /** Derived: true if due_date < today AND status is still pending */
  isOverdue: boolean;
  /** Derived: true if due_date is today */
  isDueToday: boolean;
};

export type HomeworkPeriod = "today" | "week" | "month" | "all";

export type HomeworkCompletionRate = {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  rate: number | null; // null when total === 0
  period: HomeworkPeriod;
};

function deriveOverdue(entry: { due_date: string; status: string }, today: string): boolean {
  return entry.status === "pending" && entry.due_date < today;
}

function deriveDueToday(entry: { due_date: string }, today: string): boolean {
  return entry.due_date === today;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function periodStartDate(period: HomeworkPeriod): string | null {
  const now = new Date();
  if (period === "today") return todayString();
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }
  if (period === "month") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * List all homework for a student, optionally filtered by period.
 * Returns newest-first for display.
 */
export async function listHomeworkForStudent(
  studentId: string,
  period: HomeworkPeriod = "all",
): Promise<HomeworkEntry[]> {
  const supabase = createSupabaseServerClient();
  const today = todayString();

  let q = supabase
    .from("homework")
    .select("id, title, description, due_date, status, created_at, updated_at")
    .is("deleted_at", null)
    .eq("student_id", studentId)
    .order("due_date", { ascending: false });

  const from = periodStartDate(period);
  if (from) {
    if (period === "today") {
      q = q.eq("due_date", from);
    } else {
      q = q.gte("due_date", from);
    }
  }

  const { data, error } = await q;
  if (error) return [];

  type Raw = {
    id: string;
    title: string;
    description: string | null;
    due_date: string;
    status: "pending" | "completed";
    created_at: string;
    updated_at: string;
  };

  return ((data as Raw[] | null) ?? []).map((row) => ({
    ...row,
    subject: null, // `homework` table has no subject column yet; safe fallback
    isOverdue: deriveOverdue(row, today),
    isDueToday: deriveDueToday(row, today),
  }));
}

/**
 * Completion rate for the given period.
 * Returns null rate when there is no homework — not 0%, because 0 of 0 is not 0%.
 */
export async function getHomeworkCompletionRate(
  studentId: string,
  period: HomeworkPeriod = "week",
): Promise<HomeworkCompletionRate> {
  const entries = await listHomeworkForStudent(studentId, period);
  const today = todayString();

  const completed = entries.filter((e) => e.status === "completed").length;
  const overdue = entries.filter((e) => deriveOverdue(e, today)).length;
  const pending = entries.length - completed;

  return {
    total: entries.length,
    completed,
    pending,
    overdue,
    rate: entries.length > 0 ? (completed / entries.length) * 100 : null,
    period,
  };
}

/** Today's homework for a specific student. Used by the home dashboard. */
export async function getTodayHomework(studentId: string): Promise<HomeworkEntry[]> {
  return listHomeworkForStudent(studentId, "today");
}
