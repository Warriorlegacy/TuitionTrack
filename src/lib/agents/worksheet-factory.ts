import { z } from "zod";
import { todayISO, type Db } from "./shared";

// Guide A5 Worksheet Factory: L3 permanently for newly generated questions.
// Drafts a tiered (support/core/stretch) worksheet into approvals kind
// 'worksheet'. Checker pass is a deterministic proxy (verified solution on
// file + duplicate check); an LLM re-solve is the later flag, not this step.

export const draftQuestionSchema = z.object({
  question_id: z.string().uuid(),
  stem: z.string().min(1),
  concept_id: z.string().uuid().nullable(),
  difficulty: z.number().int().min(1).max(5),
  marks: z.number().positive(),
});

export const worksheetDraftSchema = z.object({
  subject: z.string().min(1),
  class_level: z.string().min(1),
  chapter: z.string().min(1),
  chapter_node_id: z.string().uuid().nullable(),
  weak_concepts: z.array(z.string().uuid()),
  bank_size: z.number().int().nonnegative(),
  tiers: z.object({
    support: z.array(draftQuestionSchema).min(1).max(10),
    core: z.array(draftQuestionSchema).min(1).max(10),
    stretch: z.array(draftQuestionSchema).min(1).max(10),
  }),
});

export type WorksheetDraft = z.infer<typeof worksheetDraftSchema>;
export type Tier = keyof WorksheetDraft["tiers"];
const TIERS: Tier[] = ["support", "core", "stretch"];

export type BankRow = {
  id: string;
  stem: string;
  difficulty: number;
  marks: number;
  syllabus_node_id: string | null;
};

function tierOf(difficulty: number): Tier {
  return difficulty <= 2 ? "support" : difficulty === 3 ? "core" : "stretch";
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200);
}

// Deterministic tier fill: weak concepts first, then round-robin across
// concepts so the sheet interleaves instead of cloning one problem type.
export function buildWorksheetDraft(input: {
  subject: string;
  class_level: string;
  chapter: string;
  chapter_node_id: string | null;
  weakConceptIds: string[];
  bank: BankRow[];
  perTier?: number;
}): WorksheetDraft {
  const perTier = input.perTier ?? 3;
  const weak = new Set(input.weakConceptIds);
  const tiers = {} as WorksheetDraft["tiers"];
  for (const tier of TIERS) {
    const pool = input.bank
      .filter((b) => tierOf(b.difficulty) === tier)
      .sort(
        (a, b) =>
          Number(weak.has(b.syllabus_node_id ?? "")) - Number(weak.has(a.syllabus_node_id ?? "")) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      );
    if (pool.length === 0) {
      throw new Error(`bank too thin for ${tier}: no published questions at this difficulty — add questions first`);
    }
    // Round-robin across concepts for interleaving.
    const groups = new Map<string, BankRow[]>();
    for (const b of pool.slice(0, perTier * 3)) {
      const g = groups.get(b.syllabus_node_id ?? "none") ?? [];
      g.push(b);
      groups.set(b.syllabus_node_id ?? "none", g);
    }
    const picked: BankRow[] = [];
    let guard = 0; // ponytail: groups shrink every pass, guard is belt-and-braces
    while (picked.length < Math.min(perTier, pool.length) && guard < perTier * 4) {
      guard += 1;
      groups.forEach((g) => {
        const b = g.shift();
        if (b && picked.length < perTier) picked.push(b);
      });
      if (Array.from(groups.values()).every((g) => g.length === 0)) break;
    }
    tiers[tier] = picked.map((b) => ({
      question_id: b.id,
      stem: b.stem,
      concept_id: b.syllabus_node_id,
      difficulty: b.difficulty,
      marks: Number(b.marks) > 0 ? Number(b.marks) : 1,
    }));
  }
  return worksheetDraftSchema.parse({
    subject: input.subject,
    class_level: input.class_level,
    chapter: input.chapter,
    chapter_node_id: input.chapter_node_id,
    weak_concepts: input.weakConceptIds,
    bank_size: input.bank.length,
    tiers,
  });
}

export type CheckerReport = { passed: number; failed: { question_id: string; reason: string }[] };

// Checker pass (stub): every drafted question must have a verified solution
// on file, non-empty stem, positive marks, and no duplicate (in-draft or in
// bank). Mismatches are dropped by the caller, never shown to the tutor.
export function checkerPass(
  draft: WorksheetDraft,
  hasSolution: (questionId: string) => boolean,
  bankStems: Map<string, string>,
): CheckerReport {
  const failed: CheckerReport["failed"] = [];
  const seen = new Set<string>();
  let passed = 0;
  for (const tier of TIERS) {
    for (const q of draft.tiers[tier]) {
      const n = norm(q.stem);
      let dupBank = false;
      bankStems.forEach((s, id) => {
        if (id !== q.question_id && s === n) dupBank = true;
      });
      const reason =
        !n
          ? "empty stem"
          : !(q.marks > 0)
            ? "non-positive marks"
            : seen.has(n)
              ? "duplicate within draft"
              : dupBank
                ? "duplicate of bank question"
                : !hasSolution(q.question_id)
                  ? "no verified solution on file"
                  : null;
      if (reason) failed.push({ question_id: q.question_id, reason });
      else {
        seen.add(n);
        passed += 1;
      }
    }
  }
  return { passed, failed };
}

export function stripFailed(draft: WorksheetDraft, failedIds: Set<string>): WorksheetDraft {
  const tiers = {} as WorksheetDraft["tiers"];
  for (const tier of TIERS) {
    tiers[tier] = draft.tiers[tier].filter((q) => !failedIds.has(q.question_id));
    if (tiers[tier].length === 0) {
      throw new Error(`checker emptied the ${tier} tier — review bank quality before drafting`);
    }
  }
  return worksheetDraftSchema.parse({ ...draft, tiers });
}

export function renderPreview(draft: WorksheetDraft, report: CheckerReport): string {
  const lines = [
    `Worksheet draft: ${draft.subject} — ${draft.chapter} (class ${draft.class_level})`,
    `Checker: ${report.passed} passed, ${report.failed.length} dropped (mismatches discarded, not shown).`,
  ];
  for (const tier of TIERS) {
    lines.push(`--- ${tier.toUpperCase()} (${draft.tiers[tier].length}) ---`);
    for (const q of draft.tiers[tier]) lines.push(`[${q.marks}m] ${q.stem}`);
  }
  return lines.join("\n");
}

export type QueueResult =
  | { ok: true; approvalId: string | null; deduped: boolean; checker: CheckerReport }
  | { ok: false; approvalId: null; error: string };

export async function queueWorksheet(
  supabase: Db,
  input: {
    orgId: string;
    subject: string;
    class_level: string;
    chapter: string;
    chapter_node_id?: string | null;
    weakConceptIds?: string[];
    perTier?: number;
  },
  today: Date = new Date(),
): Promise<QueueResult> {
  const nodeIds = [input.chapter_node_id, ...(input.weakConceptIds ?? [])].filter(
    (v): v is string => !!v,
  );
  if (nodeIds.length === 0) {
    return { ok: false, approvalId: null, error: "pass chapter_node_id or weakConceptIds to scope the bank" };
  }
  const { data: rule } = await supabase
    .from("automation_rules")
    .select("enabled")
    .eq("org_id", input.orgId)
    .eq("agent", "worksheet")
    .maybeSingle();
  if ((rule as unknown as { enabled: boolean } | null)?.enabled === false) {
    return { ok: false, approvalId: null, error: "worksheet agent is switched off for this org" };
  }

  const { data: bank } = await supabase
    .from("questions")
    .select("id, stem, difficulty, marks, syllabus_node_id")
    .in("syllabus_node_id", nodeIds)
    .eq("status", "published")
    .limit(200);
  const bankRows = ((bank ?? []) as unknown as BankRow[]).filter((b) => b.stem?.trim());
  let draft: WorksheetDraft;
  try {
    draft = buildWorksheetDraft({
      subject: input.subject,
      class_level: input.class_level,
      chapter: input.chapter,
      chapter_node_id: input.chapter_node_id ?? null,
      weakConceptIds: input.weakConceptIds ?? [],
      bank: bankRows,
      perTier: input.perTier,
    });
  } catch (err) {
    return { ok: false, approvalId: null, error: (err as Error).message };
  }

  const selectedIds = TIERS.flatMap((t) => draft.tiers[t].map((q) => q.question_id));
  const { data: solutions } = await supabase
    .from("question_solutions")
    .select("question_id")
    .in("question_id", selectedIds)
    .limit(selectedIds.length);
  const solved = new Set(
    ((solutions ?? []) as unknown as { question_id: string }[]).map((s) => s.question_id),
  );
  const bankStems = new Map(bankRows.map((b) => [b.id, norm(b.stem)]));
  const report = checkerPass(draft, (id) => solved.has(id), bankStems);
  try {
    draft = stripFailed(draft, new Set(report.failed.map((f) => f.question_id)));
  } catch (err) {
    return { ok: false, approvalId: null, error: (err as Error).message };
  }
  const preview = renderPreview(draft, report);

  const dedupeKey = `worksheet:${todayISO(today)}:${norm(`${input.subject}-${input.chapter}-${input.class_level}`).replace(/[^a-z0-9]+/g, "-")}`;
  const { data: existing } = await supabase
    .from("approvals")
    .select("id, payload")
    .eq("org_id", input.orgId)
    .eq("kind", "worksheet")
    .limit(200);
  const dupe = ((existing ?? []) as unknown as { id: string; payload: { dedupe_key?: string } }[]).find(
    (r) => r.payload?.dedupe_key === dedupeKey,
  );
  if (dupe) return { ok: true, approvalId: dupe.id, deduped: true, checker: report };

  const { data: run } = await supabase
    .from("agent_runs")
    .insert({
      org_id: input.orgId,
      agent: "worksheet",
      trigger: "manual",
      autonomy: "L3",
      status: "success",
      input: { subject: input.subject, chapter: input.chapter, class_level: input.class_level },
      output: { tiers: TIERS.map((t) => draft.tiers[t].length), checker: report },
    })
    .select("id")
    .maybeSingle();
  const { data: approval } = await supabase
    .from("approvals")
    .insert({
      org_id: input.orgId,
      agent_run_id: (run as unknown as { id: string } | null)?.id ?? null,
      kind: "worksheet",
      payload: {
        dedupe_key: dedupeKey,
        subject: input.subject,
        chapter: input.chapter,
        class_level: input.class_level,
        tiers: draft.tiers,
        weak_concepts: draft.weak_concepts,
        checker: report,
      },
      preview,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  return {
    ok: true,
    approvalId: (approval as unknown as { id: string } | null)?.id ?? null,
    deduped: false,
    checker: report,
  };
}
