import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

type Db = SupabaseClient<Database, "public">;

export type DigestFacts = {
  studentId: string;
  studentName: string;
  studentClass: string;
  attendancePct: number | null;
  attendancePresent: number;
  attendanceTotal: number;
  hwTotal: number;
  hwDone: number;
  hwPending: number;
  latestScores: { subject: string; marks: number; total: number; date: string }[];
  thinData: boolean;
  signalCount: number;
};

// Existing ops tables (see src/lib/queries.ts): students, attendance,
// homework (status pending|completed), tests (subject/marks/total/date).
export async function buildDigestFacts(supabase: Db, studentId: string): Promise<DigestFacts> {
  const [{ data: student }, { data: attendance }, { data: homework }, { data: tests }] =
    await Promise.all([
      supabase.from("students").select("id, name, class").eq("id", studentId).maybeSingle(),
      supabase.from("attendance").select("present").eq("student_id", studentId).limit(200),
      supabase.from("homework").select("status").eq("student_id", studentId).limit(200),
      supabase
        .from("tests")
        .select("subject, marks, total, date")
        .eq("student_id", studentId)
        .order("date", { ascending: false })
        .limit(3),
    ]);

  const s = (student ?? {}) as unknown as { name?: string; class?: string };
  const att = ((attendance ?? []) as unknown as { present: boolean }[]);
  const hw = ((homework ?? []) as unknown as { status: string }[]);
  const latestScores = ((tests ?? []) as unknown as DigestFacts["latestScores"]).filter(Boolean);

  const present = att.filter((a) => a.present).length;
  const hwDone = hw.filter((h) => h.status === "completed").length;
  const signalCount = att.length + hw.length + latestScores.length;

  return {
    studentId,
    studentName: s.name ?? "Student",
    studentClass: s.class ?? "",
    attendancePct: att.length > 0 ? Math.round((present / att.length) * 100) : null,
    attendancePresent: present,
    attendanceTotal: att.length,
    hwTotal: hw.length,
    hwDone,
    hwPending: hw.length - hwDone,
    latestScores,
    // ponytail: template first, no LLM call in MVP — LLM rewrite is a later flag.
    thinData: signalCount < 5,
    signalCount,
  };
}

function pct(marks: number, total: number): number {
  return total > 0 ? Math.round((marks / total) * 100) : 0;
}

// Deterministic 6-line digest: covered / did-well / work-on /
// attendance / next-test / thin-data-honesty. Facts from SQL only.
export function renderDigest(f: DigestFacts): string {
  const subjects = f.latestScores.map((s) => s.subject);
  const covered =
    subjects.length > 0 ? `Covered: ${Array.from(new Set(subjects)).join(", ")}.` : "Covered: regular classwork (no tagged tests this week).";
  let didWell = "Did well: nothing scored yet — keep an eye on the next test.";
  let workOn = "Work on: steady homework completion.";
  if (f.latestScores.length > 0) {
    const ranked = [...f.latestScores].sort(
      (a, b) => pct(b.marks, b.total) - pct(a.marks, a.total),
    );
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    didWell = `Did well: ${best.subject} ${best.marks}/${best.total}.`;
    workOn =
      ranked.length > 1 && worst.subject !== best.subject
        ? `Work on: ${worst.subject} (${worst.marks}/${worst.total}) — a little practice there.`
        : `Work on: keep ${best.subject} steady with regular revision.`;
  }
  const attendance =
    f.attendancePct === null
      ? "Attendance: not marked yet this week."
      : `Attendance: ${f.attendancePct}% (${f.attendancePresent}/${f.attendanceTotal} classes).`;
  const nextTest = "Next test: not scheduled in the app — tutor will confirm in class.";
  const honesty = f.thinData
    ? `Note: thin data this week (${f.signalCount} records) — treat this summary as partial, not final.`
    : `Data: full week (${f.signalCount} records) behind this summary.`;
  return [covered, didWell, workOn, attendance, nextTest, honesty].join("\n");
}

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - first.getTime()) / 86_400_000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function queueDigest(
  supabase: Db,
  studentId: string,
): Promise<{ approvalId: string | null; deduped: boolean }> {
  const facts = await buildDigestFacts(supabase, studentId);
  const preview = renderDigest(facts);
  const dedupeKey = `digest:${isoWeekKey(new Date())}:student:${studentId}`;

  const { data: student } = await supabase
    .from("students")
    .select("id, org_id, teacher_id, parent_phone")
    .eq("id", studentId)
    .maybeSingle();
  const st = student as unknown as {
    org_id: string | null;
    teacher_id: string;
    parent_phone: string | null;
  } | null;
  if (!st) return { approvalId: null, deduped: false };
  let orgId = st.org_id;
  if (!orgId) {
    const { data: org } = await supabase
      .from("orgs")
      .select("id")
      .eq("created_by", st.teacher_id)
      .limit(1)
      .maybeSingle();
    orgId = (org as unknown as { id: string } | null)?.id ?? null;
  }
  if (!orgId) return { approvalId: null, deduped: false };

  const { data: existing } = await supabase
    .from("approvals")
    .select("id, payload")
    .eq("kind", "message")
    .limit(500);
  const dupe = ((existing ?? []) as unknown as { id: string; payload: { dedupe_key?: string } }[]).find(
    (r) => r.payload?.dedupe_key === dedupeKey,
  );
  if (dupe) return { approvalId: dupe.id, deduped: true };

  const { data: run } = await supabase
    .from("agent_runs")
    .insert({ org_id: orgId, agent: "digest", trigger: "manual", autonomy: "L3", status: "success", input: { student_id: studentId } })
    .select("id")
    .maybeSingle();
  const { data: approval } = await supabase
    .from("approvals")
    .insert({
      org_id: orgId,
      agent_run_id: (run as unknown as { id: string } | null)?.id ?? null,
      kind: "message",
      payload: {
        channel: "whatsapp",
        recipient_type: "parent",
        to: st.parent_phone,
        body: preview,
        dedupe_key: dedupeKey,
        template_key: "parent_digest_weekly",
        student_id: studentId,
      },
      preview,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  return { approvalId: (approval as unknown as { id: string } | null)?.id ?? null, deduped: false };
}
