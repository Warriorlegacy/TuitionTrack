import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Parent-facing attendance queries.
 *
 * The `attendance` table has RLS: `public.can_access_student(student_id)` guards
 * every SELECT, so a guardian can only read records for their verified child.
 *
 * IMPORTANT: attendance percentage is always expressed as
 *   daysPresent / daysMarked (not daysPresent / totalSchoolDays)
 * because TuitionTrack cannot know the school calendar. Never divide by an
 * assumed number of working days — that would fabricate a percentage (§111).
 */

export type AttendanceRecord = {
  id: string;
  date: string; // ISO date "YYYY-MM-DD"
  present: boolean;
};

export type AttendanceMonth = {
  year: number;
  month: number; // 1-12
  records: AttendanceRecord[];
  /** Map date-string → present|absent for fast calendar lookup */
  byDate: Map<string, boolean>;
  daysMarked: number;
  daysPresent: number;
  daysAbsent: number;
  /** null when daysMarked === 0 */
  percentPresent: number | null;
};

export type AttendanceSummary = {
  daysMarked: number;
  daysPresent: number;
  daysAbsent: number;
  percentPresent: number | null;
  lastMarkedAt: string | null;
  /** Today's status — null if not yet recorded */
  todayStatus: boolean | null;
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetch one calendar-month of attendance records.
 * Month is 1-indexed (January = 1).
 */
export async function getAttendanceForMonth(
  studentId: string,
  year: number,
  month: number,
): Promise<AttendanceMonth> {
  const supabase = createSupabaseServerClient();

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10); // last day of month

  const { data } = await supabase
    .from("attendance")
    .select("id, date, present")
    .eq("student_id", studentId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  type Raw = { id: string; date: string; present: boolean };
  const rows: AttendanceRecord[] = ((data as Raw[] | null) ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    present: r.present,
  }));

  const byDate = new Map<string, boolean>();
  for (const r of rows) byDate.set(r.date, r.present);

  const daysPresent = rows.filter((r) => r.present).length;
  const daysAbsent = rows.filter((r) => !r.present).length;
  const daysMarked = rows.length;

  return {
    year,
    month,
    records: rows,
    byDate,
    daysMarked,
    daysPresent,
    daysAbsent,
    percentPresent: daysMarked > 0 ? (daysPresent / daysMarked) * 100 : null,
  };
}

/**
 * Aggregate attendance summary across all recorded history.
 * Used on the home dashboard and the attendance overview.
 */
export async function getAttendanceSummary(
  studentId: string,
): Promise<AttendanceSummary> {
  const supabase = createSupabaseServerClient();
  const today = todayString();

  const { data } = await supabase
    .from("attendance")
    .select("id, date, present")
    .eq("student_id", studentId)
    .order("date", { ascending: false });

  type Raw = { id: string; date: string; present: boolean };
  const rows: AttendanceRecord[] = ((data as Raw[] | null) ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    present: r.present,
  }));

  const daysMarked = rows.length;
  const daysPresent = rows.filter((r) => r.present).length;
  const daysAbsent = rows.filter((r) => !r.present).length;
  const lastMarkedAt = rows[0]?.date ?? null;

  const todayRecord = rows.find((r) => r.date === today);
  const todayStatus = todayRecord ? todayRecord.present : null;

  return {
    daysMarked,
    daysPresent,
    daysAbsent,
    percentPresent: daysMarked > 0 ? (daysPresent / daysMarked) * 100 : null,
    lastMarkedAt,
    todayStatus,
  };
}
