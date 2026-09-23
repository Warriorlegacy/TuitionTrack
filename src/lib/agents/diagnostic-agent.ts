import type { Flex } from "@/lib/db/types";
import { chunk, disabledOrgIds, orgResolver, todayISO, type Db } from "./shared";

// Guide A7 Diagnostic + Readiness: mastery and readiness are code, not model
// output. Columns match migration 20260914 (concept_mastery PK
// (student_id, concept_id); spaced_items needs front/back; responses carry
// is_correct + question_id → questions.syllabus_node_id).

// Bayesian-lite update: prior counts as 4 pseudo-attempts. Default prior 0.3
// matches the concept_mastery column default.
export function updateMastery(prev: number, correct: number, total: number): number {
  if (total <= 0) return prev;
  const p = Math.min(0.99, Math.max(0.01, prev));
  const post = (correct + p * 4) / (total + 4);
  return Math.round(Math.min(0.99, Math.max(0.01, post)) * 10000) / 10000;
}

export type ReadinessParts = {
  knowledgePct: number | null; // avg mastery × 100
  attendancePct: number | null;
  trendPp: number | null; // attempts second-half minus first-half, pp
};

// Score over available signals only — missing signals are omitted from the
// weights, never zero-filled, and the detail string says what went in.
export function computeReadiness(p: ReadinessParts): { score: number | null; detail: string } {
  const raw: [number, string, number | null][] = [
    [3, "knowledge", p.knowledgePct],
    [1, "attendance", p.attendancePct],
    [1, "momentum", p.trendPp === null ? null : Math.min(100, Math.max(0, 50 + p.trendPp * 2.5))],
  ];
  const parts: [number, string, number][] = [];
  for (const [wt, n, v] of raw) {
    if (v !== null) parts.push([wt, n, v]);
  }
  if (parts.length === 0) return { score: null, detail: "thin data — no readiness yet" };
  const w = parts.reduce((a, [wt]) => a + wt, 0);
  const score = Math.round(parts.reduce((a, [wt, , v]) => a + wt * v, 0) / w);
  return { score, detail: parts.map(([, n, v]) => `${n} ${Math.round(v)}`).join(" · ") };
}

// FSRS-lite: success stretches the interval, a lapse resets to 1 day.
export function nextReviewDue(mastery: number, today: Date = new Date()): string {
  const days = mastery >= 0.8 ? 7 : mastery >= 0.5 ? 3 : 1;
  return new Date(today.getTime() + days * 86_400_000).toISOString();
}

export function weakest<T extends { concept_id: string; mastery: number }>(rows: T[], k = 3): T[] {
  return [...rows].sort((a, b) => a.mastery - b.mastery).slice(0, k);
}

type StudentLite = { id: string; name: string; org_id: string | null; teacher_id: string };

export type DiagnosticResult = {
  studentId: string;
  readiness: number | null;
  readinessDetail: string;
  weakest: string[]; // concept titles
};

const WEAK_AT = 0.6;
const MAX_CARDS_PER_STUDENT = 5;
const MAX_CARDS_PER_RUN = 200;

export async function runDiagnostic(
  supabase: Db,
  opts: { studentId?: string; today?: Date } = {},
): Promise<{ students: number; conceptsUpdated: number; dueScheduled: number; results: DiagnosticResult[] }> {
  const today = opts.today ?? new Date();
  const nowISO = today.toISOString();
  const out = { students: 0, conceptsUpdated: 0, dueScheduled: 0, results: [] as DiagnosticResult[] };
  const resolveOrg = orgResolver(supabase);

  const { data: rules } = await supabase
    .from("automation_rules")
    .select("org_id, agent, enabled")
    .in("agent", ["diagnostic", "global"]);
  const off = disabledOrgIds(
    ((rules ?? []) as unknown as { org_id: string; agent: string; enabled: boolean }[]),
    ["diagnostic", "global"],
  );

  let q = supabase.from("students").select("id, name, org_id, teacher_id").limit(200);
  if (opts.studentId) q = q.eq("id", opts.studentId);
  const { data: students } = await q;
  const list = ((students ?? []) as unknown as StudentLite[]).filter(Boolean);
  if (list.length === 0) return out;
  const ids = list.map((s) => s.id);

  // Batched evidence reads.
  const attemptRows: { id: string; student_id: string; score: number; total: number; submitted_at: string | null }[] = [];
  const mistakeRows: { student_id: string; concept_id: string | null; status: string }[] = [];
  const masteryRows: { student_id: string; concept_id: string; mastery: number; attempt_count: number; correct_count: number; streak: number }[] = [];
  const attRows: { student_id: string; present: boolean; date: string }[] = [];
  for (const c of chunk(ids)) {
    const [a, m, cm, at] = await Promise.all([
      supabase.from("attempts").select("id, student_id, score, total, submitted_at").in("student_id", c).eq("status", "graded").limit(2000),
      supabase.from("mistakes").select("student_id, concept_id, status").in("student_id", c).limit(2000),
      supabase.from("concept_mastery").select("student_id, concept_id, mastery, attempt_count, correct_count, streak").in("student_id", c).limit(2000),
      supabase.from("attendance").select("student_id, present, date").in("student_id", c).order("date", { ascending: false }).limit(3000),
    ]);
    attemptRows.push(...((a.data ?? []) as unknown as typeof attemptRows));
    mistakeRows.push(...((m.data ?? []) as unknown as typeof mistakeRows));
    masteryRows.push(...((cm.data ?? []) as unknown as typeof masteryRows));
    attRows.push(...((at.data ?? []) as unknown as typeof attRows));
  }
  // Responses join: response → question → concept (syllabus_nodes).
  const attemptStudent = new Map(attemptRows.map((a) => [a.id, a.student_id]));
  const respRows: { attempt_id: string; question_id: string; is_correct: boolean | null }[] = [];
  for (const c of chunk(attemptRows.map((a) => a.id))) {
    if (c.length === 0) break;
    const { data } = await supabase.from("attempt_responses").select("attempt_id, question_id, is_correct").in("attempt_id", c).limit(5000);
    respRows.push(...((data ?? []) as unknown as typeof respRows));
  }
  const NEED_WORK = new Set(["open", "practicing", "relapsed"]);
  const questionIds = Array.from(new Set(respRows.map((r) => r.question_id)));
  const questionConcept = new Map<string, string | null>();
  for (const c of chunk(questionIds)) {
    if (c.length === 0) break;
    const { data } = await supabase.from("questions").select("id, syllabus_node_id").in("id", c).limit(1000);
    for (const r of ((data ?? []) as unknown as { id: string; syllabus_node_id: string | null }[])) {
      questionConcept.set(r.id, r.syllabus_node_id);
    }
  }

  // Aggregate new evidence per (student, concept).
  type Ev = { correct: number; total: number; openMistakes: number };
  const ev = new Map<string, Ev>();
  const key = (s: string, c: string) => `${s}|${c}`;
  let unattributed = 0;
  for (const r of respRows) {
    if (r.is_correct === null) continue; // ungraded — not evidence
    const sid = attemptStudent.get(r.attempt_id);
    const cid = questionConcept.get(r.question_id);
    if (!sid || !cid) {
      unattributed += 1;
      continue;
    }
    const e = ev.get(key(sid, cid)) ?? { correct: 0, total: 0, openMistakes: 0 };
    e.total += 1;
    if (r.is_correct) e.correct += 1;
    ev.set(key(sid, cid), e);
  }
  for (const m of mistakeRows) {
    if (!m.concept_id || !NEED_WORK.has(m.status)) continue;
    const e = ev.get(key(m.student_id, m.concept_id)) ?? { correct: 0, total: 0, openMistakes: 0 };
    e.openMistakes += 1; // each open mistake counts as one incorrect pseudo-attempt
    ev.set(key(m.student_id, m.concept_id), e);
  }

  const prior = new Map(masteryRows.map((r) => [key(r.student_id, r.concept_id), r]));
  const upserts: Flex[] = [];
  const finalMastery = new Map<string, { concept_id: string; mastery: number }[]>();
  for (const m of masteryRows) {
    const arr = finalMastery.get(m.student_id) ?? [];
    arr.push({ concept_id: m.concept_id, mastery: Number(m.mastery) });
    finalMastery.set(m.student_id, arr);
  }
  ev.forEach((e, k) => {
    const [sid, cid] = k.split("|");
    const total = e.total + e.openMistakes;
    if (total === 0) return;
    const p = prior.get(k);
    const mastery = updateMastery(p ? Number(p.mastery) : 0.3, e.correct, total);
    const incorrect = total - e.correct;
    upserts.push({
      student_id: sid,
      concept_id: cid,
      mastery,
      attempt_count: (p?.attempt_count ?? 0) + e.total,
      correct_count: (p?.correct_count ?? 0) + e.correct,
      streak: incorrect > 0 ? 0 : (p?.streak ?? 0) + e.correct,
      last_practiced_at: nowISO,
      next_review_at: nextReviewDue(mastery, today),
      updated_at: nowISO,
    });
    const arr = finalMastery.get(sid) ?? [];
    const i = arr.findIndex((r) => r.concept_id === cid);
    if (i >= 0) arr[i] = { concept_id: cid, mastery };
    else arr.push({ concept_id: cid, mastery });
    finalMastery.set(sid, arr);
  });
  if (upserts.length > 0) {
    const { error } = await supabase
      .from("concept_mastery")
      .upsert(upserts, { onConflict: "student_id,concept_id" });
    if (error) throw new Error(`concept_mastery upsert failed: ${error.message}`);
    out.conceptsUpdated = upserts.length;
  }

  // FSRS due items for weak concepts — skip pairs that already have an item
  // (any question link counts), cap per student and per run.
  const conceptIds = Array.from(new Set(Array.from(ev.keys()).map((k) => k.split("|")[1])));
  const titles = new Map<string, string>();
  for (const c of chunk(conceptIds)) {
    if (c.length === 0) break;
    const { data } = await supabase.from("syllabus_nodes").select("id, title").in("id", c).limit(1000);
    for (const r of ((data ?? []) as unknown as { id: string; title: string }[])) titles.set(r.id, r.title);
  }
  const { data: spaced } = await supabase
    .from("spaced_items")
    .select("student_id, concept_id")
    .in("student_id", ids)
    .limit(2000);
  const haveCard = new Set(
    ((spaced ?? []) as unknown as { student_id: string; concept_id: string | null }[])
      .filter((r) => r.concept_id)
      .map((r) => `${r.student_id}|${r.concept_id}`),
  );
  const cards: Flex[] = [];
  finalMastery.forEach((concepts, sid) => {
    let added = 0;
    for (const w of weakest(concepts, 99)) {
      if (cards.length >= MAX_CARDS_PER_RUN || added >= MAX_CARDS_PER_STUDENT) break;
      if (w.mastery >= WEAK_AT || haveCard.has(`${sid}|${w.concept_id}`)) continue;
      if (!ev.has(`${sid}|${w.concept_id}`)) continue; // only schedule off fresh evidence
      const title = titles.get(w.concept_id) ?? "this concept";
      cards.push({
        student_id: sid,
        concept_id: w.concept_id,
        front: `Recall: ${title}`,
        back: `${title} — revise from class notes, then re-attempt.`,
        stability: 1.0,
        difficulty: Math.round((1 - w.mastery) * 1000) / 1000,
        due_at: new Date(today.getTime() + 86_400_000).toISOString(),
        state: "new",
        lapse_count: 0,
      });
      haveCard.add(`${sid}|${w.concept_id}`);
      added += 1;
    }
  });
  if (cards.length > 0) {
    const { error } = await supabase.from("spaced_items").insert(cards);
    if (error) throw new Error(`spaced_items insert failed: ${error.message}`);
    out.dueScheduled = cards.length;
  }

  // Readiness per student + per-org run log.
  const perOrg = new Map<string, { students: number }>();
  for (const s of list) {
    const orgId = await resolveOrg(s);
    if (!orgId || off.has(orgId)) continue;
    out.students += 1;
    perOrg.set(orgId, { students: (perOrg.get(orgId)?.students ?? 0) + 1 });
    const concepts = finalMastery.get(s.id) ?? [];
    const knowledge = concepts.length > 0
      ? (concepts.reduce((a, c) => a + c.mastery, 0) / concepts.length) * 100
      : null;
    const att = attRows
      .filter((r) => r.student_id === s.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 14);
    const attendance = att.length > 0
      ? (att.filter((r) => r.present).length / att.length) * 100
      : null;
    const scored = attemptRows
      .filter((a) => a.student_id === s.id && a.total > 0 && a.submitted_at)
      .sort((a, b) => ((a.submitted_at ?? "") < (b.submitted_at ?? "") ? -1 : 1));
    let trend: number | null = null;
    if (scored.length >= 4) {
      const half = Math.floor(scored.length / 2);
      const avg = (xs: typeof scored) => xs.reduce((a, x) => a + (x.score / x.total) * 100, 0) / xs.length;
      trend = Math.round((avg(scored.slice(half)) - avg(scored.slice(0, half))) * 10) / 10;
    }
    const { score, detail } = computeReadiness({ knowledgePct: knowledge, attendancePct: attendance, trendPp: trend });
    out.results.push({
      studentId: s.id,
      readiness: score,
      readinessDetail: `${detail} (${concepts.length} concepts)`,
      weakest: weakest(concepts, 3).map((w) => titles.get(w.concept_id) ?? w.concept_id),
    });
  }
  for (const [orgId, o] of Array.from(perOrg.entries())) {
    await supabase.from("agent_runs").insert({
      org_id: orgId,
      agent: "diagnostic",
      trigger: "cron",
      autonomy: "L4",
      status: "success",
      input: { date: todayISO(today), students: o.students },
      output: {
        concepts_updated: out.conceptsUpdated,
        due_scheduled: out.dueScheduled,
        unattributed_responses: unattributed,
      },
    });
  }
  return out;
}
