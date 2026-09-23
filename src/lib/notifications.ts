import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

type Db = SupabaseClient<Database, "public">;

export type HomeworkNotice = {
  assignmentId?: string;
  title: string;
  subject?: string;
  classLevel?: number | string;
  dueDate?: string;
  studentIds: string[];
};

export type AnnouncementNotice = {
  teacherId: string;
  announcementId?: string | null;
  title: string;
  message?: string;
};

type StudentLite = { id: string; name: string; student_email?: string | null };

async function studentsByIds(supabase: Db, ids: string[]): Promise<StudentLite[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase.from("students").select("id, name, student_email").in("id", ids);
  return ((data ?? []) as unknown as StudentLite[]).filter(Boolean);
}

async function guardianIdsFor(supabase: Db, studentIds: string[]): Promise<string[]> {
  if (studentIds.length === 0) return [];
  const { data } = await supabase
    .from("guardian_student_relationships")
    .select("guardian_user_id")
    .in("student_id", studentIds)
    .eq("status", "active")
    .not("verified_at", "is", null);
  return Array.from(
    new Set(
      ((data ?? []) as unknown as { guardian_user_id: string }[]).map((r) => r.guardian_user_id),
    ),
  );
}

async function userIdsForEmails(supabase: Db, emails: string[]): Promise<Map<string, string>> {
  const clean = Array.from(
    new Set(emails.map((e) => (e ?? "").trim().toLowerCase()).filter(Boolean)),
  );
  const map = new Map<string, string>();
  if (clean.length === 0) return map;
  const { data } = await supabase.from("users").select("id, email").in("email", clean);
  for (const u of ((data ?? []) as unknown as { id: string; email: string }[])) {
    map.set(u.email.toLowerCase(), u.id);
  }
  return map;
}

/**
 * Ping every targeted student (login account) and every verified guardian
 * through their in-app Notifications feeds. Best-effort — never throws.
 */
export async function notifyHomeworkAssigned(supabase: Db, n: HomeworkNotice): Promise<void> {
  try {
    const ids = Array.from(new Set(n.studentIds)).filter(Boolean);
    if (ids.length === 0) return;
    const [students, rels] = await Promise.all([
      studentsByIds(supabase, ids),
      (async () => {
        const { data } = await supabase
          .from("guardian_student_relationships")
          .select("guardian_user_id, student_id")
          .in("student_id", ids)
          .eq("status", "active")
          .not("verified_at", "is", null);
        return ((data ?? []) as unknown as { guardian_user_id: string; student_id: string }[]);
      })(),
    ]);
    const byId = new Map(students.map((s) => [s.id, s]));
    const accountByEmail = await userIdsForEmails(
      supabase,
      students.map((s) => s.student_email ?? ""),
    );
    const base = {
      assignmentId: n.assignmentId ?? null,
      title: n.title,
      subject: n.subject ?? null,
      classLevel: n.classLevel ?? null,
      dueDate: n.dueDate ?? null,
    };
    const rows: Record<string, unknown>[] = [];
    for (const sid of ids) {
      const meta = { ...base, studentId: sid, studentName: byId.get(sid)?.name ?? "your child" };
      const uid = accountByEmail.get((byId.get(sid)?.student_email ?? "").toLowerCase());
      if (uid) {
        rows.push({ actor_id: uid, action: "homework_assigned", entity: "assignment", entity_id: n.assignmentId ?? null, metadata: meta });
      }
    }
    const seenPairs = new Set<string>();
    for (const r of rels) {
      const key = `${r.guardian_user_id}:${r.student_id}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      rows.push({
        actor_id: r.guardian_user_id,
        action: "homework_assigned",
        entity: "assignment",
        entity_id: n.assignmentId ?? null,
        metadata: { ...base, studentId: r.student_id, studentName: byId.get(r.student_id)?.name ?? "your child" },
      });
    }
    if (rows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("audit_logs").insert(rows as any);
    }
  } catch (err) {
    console.error("notifyHomeworkAssigned failed (non-blocking):", err);
  }
}

export type HomeworkSubmittedNotice = {
  assignmentId: string;
  teacherId: string;
  title: string;
  subject?: string;
  studentId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  isLate: boolean;
};

/**
 * Targeted submission fan-out (real event only — call after a saved submit):
 * - the submitting student gets a confirmation,
 * - the assignment's teacher gets a new-submission row,
 * - verified guardians of THAT student get a parent update.
 * Nobody else is notified. Best-effort — never throws.
 */
export async function notifyHomeworkSubmitted(supabase: Db, n: HomeworkSubmittedNotice): Promise<void> {
  try {
    const students = await studentsByIds(supabase, [n.studentId]);
    const student = students[0];
    const studentName = student?.name ?? "your child";
    const accountByEmail = await userIdsForEmails(supabase, [student?.student_email ?? ""]);
    const guardianIds = await guardianIdsFor(supabase, [n.studentId]);

    const meta = {
      assignmentId: n.assignmentId,
      title: n.title,
      subject: n.subject ?? null,
      studentId: n.studentId,
      studentName,
      score: n.score,
      totalMarks: n.totalMarks,
      percentage: n.percentage,
      isLate: n.isLate,
    };
    const rows: Record<string, unknown>[] = [];
    const studentUid = accountByEmail.get((student?.student_email ?? "").toLowerCase());
    if (studentUid) {
      rows.push({ actor_id: studentUid, action: "homework_submitted", entity: "submission", entity_id: n.assignmentId, metadata: meta });
    }
    if (n.teacherId) {
      rows.push({ actor_id: n.teacherId, action: "homework_submitted", entity: "submission", entity_id: n.assignmentId, metadata: meta });
    }
    for (const gid of guardianIds) {
      rows.push({ actor_id: gid, action: "homework_submitted", entity: "submission", entity_id: n.assignmentId, metadata: meta });
    }
    if (rows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("audit_logs").insert(rows as any);
    }
  } catch (err) {
    console.error("notifyHomeworkSubmitted failed (non-blocking):", err);
  }
}

/**
 * Ping every student of a teacher (login accounts) and their verified
 * guardians when an announcement is made. Best-effort — never throws.
 */
export async function notifyAnnouncement(supabase: Db, a: AnnouncementNotice): Promise<void> {
  try {
    const { data } = await supabase
      .from("students")
      .select("id, name, student_email")
      .eq("teacher_id", a.teacherId);
    const students = ((data ?? []) as unknown as StudentLite[]).filter(Boolean);
    if (students.length === 0) return;
    const ids = students.map((s) => s.id);
    const [guardians, accountByEmail] = await Promise.all([
      guardianIdsFor(supabase, ids),
      userIdsForEmails(
        supabase,
        students.map((s) => s.student_email ?? ""),
      ),
    ]);
    const rows: Record<string, unknown>[] = [];
    const message = (a.message ?? "").slice(0, 200);
    for (const s of students) {
      const uid = accountByEmail.get((s.student_email ?? "").toLowerCase());
      if (!uid) continue;
      rows.push({
        actor_id: uid,
        action: "announcement_made",
        entity: "announcement",
        entity_id: a.announcementId ?? null,
        metadata: { title: a.title, message, studentId: s.id, studentName: s.name },
      });
    }
    for (const gid of guardians) {
      rows.push({
        actor_id: gid,
        action: "announcement_made",
        entity: "announcement",
        entity_id: a.announcementId ?? null,
        metadata: { title: a.title, message },
      });
    }
    if (rows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("audit_logs").insert(rows as any);
    }
  } catch (err) {
    console.error("notifyAnnouncement failed (non-blocking):", err);
  }
}
