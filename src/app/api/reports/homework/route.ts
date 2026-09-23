import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Homework analytics from REAL application data only: completion/submission
// rates, missed + late counts, average marks, and per-chapter performance.
// Deterministic aggregation — no AI, no fabricated metrics. Teacher-scoped:
// only assignments owned by the signed-in teacher are included.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // ponytail: getAuthContext (not requireTeacherContext) — require*
    // helpers throw NEXT_REDIRECT, which route handlers surface as a 500.
    const context = await getAuthContext();
    if (!context.configured || !context.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (context.role !== "teacher") {
      return NextResponse.json({ error: "Only teachers can view homework reports." }, { status: 403 });
    }

    const url = new URL(request.url);
    const assignmentId = url.searchParams.get("assignmentId");
    const classLevel = url.searchParams.get("classLevel");
    const subject = url.searchParams.get("subject");

    const supabase = createSupabaseAdminClient();
    let aq = supabase
      .from("assignments")
      .select("id, title, class_level, subject, chapter_slug, total_marks, target_student_ids, due_date, created_at")
      .eq("teacher_id", context.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (assignmentId) aq = aq.eq("id", assignmentId);
    if (classLevel) aq = aq.eq("class_level", Number(classLevel));
    if (subject) aq = aq.eq("subject", subject);
    const { data: assignments, error: aErr } = await aq;
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

    const rows = ((assignments ?? []) as {
      id: string; title: string; class_level: number; subject: string;
      chapter_slug: string; total_marks: number | string; target_student_ids: unknown;
    }[]);
    if (rows.length === 0) {
      return NextResponse.json({
        success: true, assignments: [], overall: null,
        message: "No assignments match these filters.",
      });
    }

    const ids = rows.map((r) => r.id);
    const { data: subs, error: sErr } = await supabase
      .from("assignment_submissions")
      .select("assignment_id, student_id, score, total_marks, percentage, is_late, status, submitted_at")
      .in("assignment_id", ids);
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    const submissions = ((subs ?? []) as {
      assignment_id: string; student_id: string; score: number | string;
      total_marks: number | string; percentage: number | string;
      is_late: boolean; status: string;
    }[]);
    // ponytail: averages use teacher-finalized grades only. Pending-review
    // submissions count toward submission rates, never toward scores.
    const GRADED = new Set(["teacher_reviewed", "graded", "returned"]);

    const byAssignment = new Map<string, typeof submissions>();
    for (const s of submissions) {
      const arr = byAssignment.get(s.assignment_id) ?? [];
      arr.push(s);
      byAssignment.set(s.assignment_id, arr);
    }

    const perAssignment = rows.map((a) => {
      const list = byAssignment.get(a.id) ?? [];
      const gradedList = list.filter((s) => GRADED.has(s.status));
      const targets = Array.isArray(a.target_student_ids) ? (a.target_student_ids as unknown[]).map(String) : [];
      const assigned = targets.length > 0 ? targets.length : list.length;
      const submitted = new Set(list.map((s) => String(s.student_id))).size;
      const pendingReview = list.filter((s) => !GRADED.has(s.status)).length;
      const late = list.filter((s) => s.is_late).length;
      const avg = gradedList.length > 0
        ? Number((gradedList.reduce((t, s) => t + (Number(s.percentage) || 0), 0) / gradedList.length).toFixed(1))
        : null;
      return {
        id: a.id, title: a.title, classLevel: a.class_level, subject: a.subject,
        chapterSlug: a.chapter_slug, totalMarks: Number(a.total_marks) || 0,
        assigned, submitted, pendingReview, graded: gradedList.length,
        missing: Math.max(0, assigned - submitted), late,
        submissionRate: assigned > 0 ? Number(((submitted / assigned) * 100).toFixed(1)) : null,
        averagePercentage: avg,
      };
    });

    const totalAssigned = perAssignment.reduce((t, a) => t + a.assigned, 0);
    const totalSubmitted = perAssignment.reduce((t, a) => t + a.submitted, 0);
    const totalLate = perAssignment.reduce((t, a) => t + a.late, 0);
    const avgs = perAssignment.map((a) => a.averagePercentage).filter((v): v is number => v !== null);

    const byChapter = new Map<string, { submissions: number; total: number; subject: string; classLevel: number }>();
    for (const a of perAssignment) {
      const e = byChapter.get(a.chapterSlug) ?? { submissions: 0, total: 0, subject: a.subject, classLevel: a.classLevel };
      if (a.averagePercentage !== null) {
        e.submissions += a.submitted;
        e.total += a.averagePercentage * a.submitted;
      }
      byChapter.set(a.chapterSlug, e);
    }

    console.log(JSON.stringify({
      event: "homework_report", teacher: context.user.id,
      assignments: rows.length, submissions: submissions.length,
    }));

    return NextResponse.json({
      success: true,
      filters: { assignmentId, classLevel, subject },
      overall: {
        assignments: rows.length,
        assigned: totalAssigned,
        submitted: totalSubmitted,
        missing: Math.max(0, totalAssigned - totalSubmitted),
        late: totalLate,
        submissionRate: totalAssigned > 0 ? Number(((totalSubmitted / totalAssigned) * 100).toFixed(1)) : null,
        averagePercentage: avgs.length > 0 ? Number(((avgs.reduce((t, v) => t + v, 0)) / avgs.length).toFixed(1)) : null,
      },
      chapterPerformance: Array.from(byChapter.entries()).map(([slug, e]) => ({
        chapterSlug: slug, subject: e.subject, classLevel: e.classLevel,
        submissions: e.submissions,
        averagePercentage: e.submissions > 0 ? Number((e.total / e.submissions).toFixed(1)) : null,
      })),
      assignments: perAssignment,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
