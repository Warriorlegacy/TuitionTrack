import type { Flex } from "@/lib/db/types";
import { chunk, disabledOrgIds, orgResolver, todayISO, type Db } from "./shared";

// Guide A10 Risk Sentinel: nightly weighted score computed in code,
// L4 to compute + flag, L0 to act (never messages — tasks only).
// Output is restricted to observable behaviour, never inferences about
// home circumstances, health, or ability.

export type RiskSignals = {
  studentId: string;
  attendancePct: number | null; // last 14 marked records
  absentStreak: number; // trailing consecutive absences
  hwCompletionPct: number | null;
  hwOverdue: number;
  testDropPp: number | null; // latest pct vs previous-3 avg (positive = drop)
  feesOverdue: number;
  signalCount: number;
};

export type RiskResult = {
  studentId: string;
  score: number; // 0–100
  level: "low" | "medium" | "high";
  reasons: string[];
  flagged: boolean;
};

const FLAG_AT = 40;
const HIGH_AT = 65;

export function computeRisk(s: RiskSignals): RiskResult {
  let score = 0;
  const reasons: string[] = [];
  if (s.attendancePct !== null) {
    if (s.attendancePct < 70) {
      score += 35;
      reasons.push(`attendance ${s.attendancePct}% (last 14 classes)`);
    } else if (s.attendancePct < 85) {
      score += 15;
      reasons.push(`attendance ${s.attendancePct}% (last 14 classes)`);
    }
  }
  if (s.absentStreak >= 3) {
    score += 15;
    reasons.push(`${s.absentStreak} consecutive absences`);
  } else if (s.absentStreak === 2) {
    score += 8;
    reasons.push("2 consecutive absences");
  }
  if (s.hwCompletionPct !== null) {
    if (s.hwCompletionPct < 50) {
      score += 25;
      reasons.push(`homework completion ${s.hwCompletionPct}%`);
    } else if (s.hwCompletionPct < 75) {
      score += 10;
      reasons.push(`homework completion ${s.hwCompletionPct}%`);
    }
  }
  if (s.testDropPp !== null && s.testDropPp >= 8) {
    score += s.testDropPp >= 15 ? 20 : 10;
    reasons.push(`test scores down ${s.testDropPp}pp vs recent average`);
  }
  if (s.feesOverdue > 0) {
    score += 10;
    reasons.push(`${s.feesOverdue} overdue fee(s)`);
  }
  // ponytail: thin data can't flag — cap below threshold, say so honestly.
  if (s.signalCount < 5) {
    score = Math.min(score, FLAG_AT - 1);
    reasons.push(`thin data (${s.signalCount} records) — not flaggable yet`);
  }
  score = Math.min(100, score);
  const level = score >= HIGH_AT ? "high" : score >= FLAG_AT ? "medium" : "low";
  return { studentId: s.studentId, score, level, reasons, flagged: score >= FLAG_AT };
}

// Deterministic 2-sentence flag summary. An LLM rewrite of this draft is a
// later flag (same L3→L4 promotion path as the parent digest); facts stay SQL.
export function renderRiskSummary(studentName: string, r: RiskResult): string {
  return (
    `${studentName}: ${r.reasons.join("; ")}. ` +
    `Suggested next step: check in during class and assign a short recovery drill on the weakest topic.`
  );
}

type StudentLite = { id: string; name: string; org_id: string | null; teacher_id: string };

export async function runRiskSentinel(
  supabase: Db,
  today: Date = new Date(),
): Promise<{ flagged: number; tasksCreated: number }> {
  const counts = { flagged: 0, tasksCreated: 0 };
  const todayStr = todayISO(today);
  const resolveOrg = orgResolver(supabase);

  const { data: rules } = await supabase
    .from("automation_rules")
    .select("org_id, agent, enabled")
    .in("agent", ["risk", "global"]);
  const off = disabledOrgIds(
    ((rules ?? []) as unknown as { org_id: string; agent: string; enabled: boolean }[]),
    ["risk", "global"],
  );

  const { data: students } = await supabase
    .from("students")
    .select("id, name, org_id, teacher_id")
    .limit(500);
  const list = ((students ?? []) as unknown as StudentLite[]).filter(Boolean);
  if (list.length === 0) return counts;
  const ids = list.map((s) => s.id);

  // Batched reads (chunked .in() — one 500-id IN would blow URL limits).
  const attRows: { student_id: string; present: boolean; date: string }[] = [];
  const hwRows: { student_id: string; status: string; due_date: string }[] = [];
  const testRows: { student_id: string; marks: number; total: number; date: string }[] = [];
  const feeRows: { student_id: string }[] = [];
  for (const c of chunk(ids)) {
    const [a, h, t, f] = await Promise.all([
      supabase
        .from("attendance")
        .select("student_id, present, date")
        .in("student_id", c)
        .order("date", { ascending: false })
        .limit(3000),
      supabase
        .from("homework")
        .select("student_id, status, due_date")
        .in("student_id", c)
        .limit(3000),
      supabase
        .from("tests")
        .select("student_id, marks, total, date")
        .in("student_id", c)
        .order("date", { ascending: false })
        .limit(2000),
      supabase
        .from("fees")
        .select("student_id")
        .in("student_id", c)
        .neq("status", "paid")
        .lt("due_date", todayStr)
        .limit(1000),
    ]);
    attRows.push(...((a.data ?? []) as unknown as typeof attRows));
    hwRows.push(...((h.data ?? []) as unknown as typeof hwRows));
    testRows.push(...((t.data ?? []) as unknown as typeof testRows));
    feeRows.push(...((f.data ?? []) as unknown as typeof feeRows));
  }
  const { data: openTasks } = await supabase
    .from("tasks")
    .select("subject_id")
    .eq("source", "risk")
    .eq("status", "open")
    .limit(1000);
  const alreadyFlagged = new Set(
    ((openTasks ?? []) as unknown as { subject_id: string | null }[])
      .map((t) => t.subject_id)
      .filter((v): v is string => !!v),
  );

  const scoreRows: Flex[] = [];
  const perOrg = new Map<string, { screened: number; flagged: number; tasks: number }>();

  for (const s of list) {
    const orgId = await resolveOrg(s);
    if (!orgId || off.has(orgId)) continue;
    const org = perOrg.get(orgId) ?? { screened: 0, flagged: 0, tasks: 0 };
    org.screened += 1;
    perOrg.set(orgId, org);

    const att = attRows
      .filter((r) => r.student_id === s.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    let streak = 0;
    for (const r of att) {
      if (!r.present) streak += 1;
      else break;
    }
    const recent = att.slice(0, 14);
    const hw = hwRows.filter((r) => r.student_id === s.id);
    const hwDone = hw.filter((r) => r.status === "completed").length;
    const tst = testRows
      .filter((r) => r.student_id === s.id && r.total > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    let drop: number | null = null;
    if (tst.length >= 2) {
      const latest = (tst[0].marks / tst[0].total) * 100;
      const prev = tst.slice(1, 4).reduce((acc, r) => acc + (r.marks / r.total) * 100, 0) / Math.min(3, tst.length - 1);
      drop = Math.round(prev - latest);
      if (drop < 0) drop = 0; // improvement is not risk; risk sentinel only flags decline
    }
    const signals: RiskSignals = {
      studentId: s.id,
      attendancePct: recent.length > 0 ? Math.round((recent.filter((r) => r.present).length / recent.length) * 100) : null,
      absentStreak: streak,
      hwCompletionPct: hw.length > 0 ? Math.round((hwDone / hw.length) * 100) : null,
      hwOverdue: hw.filter((r) => r.status !== "completed" && r.due_date < todayStr).length,
      testDropPp: drop,
      feesOverdue: feeRows.filter((r) => r.student_id === s.id).length,
      signalCount: att.length + hw.length + tst.length,
    };
    const r = computeRisk(signals);
    if (!r.flagged) continue;
    org.flagged += 1;
    counts.flagged += 1;
    scoreRows.push({
      org_id: orgId,
      student_id: s.id,
      score: r.score,
      level: r.level,
      reasons: r.reasons,
      computed_on: todayStr,
    });
    if (alreadyFlagged.has(s.id)) continue; // an open risk task already exists — don't spam
    const summary = renderRiskSummary(s.name, r);
    await supabase.from("tasks").insert({
      org_id: orgId,
      title: `Risk flag (${r.level}): ${s.name} — ${r.reasons[0] ?? "drift detected"}`,
      detail: `${summary} (score ${r.score}/100)`,
      priority: r.level === "high" ? 1 : 2,
      due_on: todayStr,
      subject_type: "student",
      subject_id: s.id,
      source: "risk",
      status: "open",
    });
    alreadyFlagged.add(s.id);
    org.tasks += 1;
    counts.tasksCreated += 1;
  }

  if (scoreRows.length > 0) {
    // Best-effort history: risk_scores is optional (migration 20260917 defers
    // it). Tasks above carry the flag regardless; a failed insert is ignored.
    const { error } = await supabase.from("risk_scores" as unknown as "tasks").insert(scoreRows);
    if (error) console.warn(`[risk-sentinel] risk_scores insert skipped: ${error.message}`);
  }
  for (const [orgId, o] of Array.from(perOrg.entries())) {
    if (o.screened === 0) continue;
    await supabase.from("agent_runs").insert({
      org_id: orgId,
      agent: "risk",
      trigger: "cron",
      autonomy: "L4",
      status: "success",
      input: { date: todayStr, screened: o.screened },
      output: { flagged: o.flagged, tasks_created: o.tasks },
    });
  }
  return counts;
}
