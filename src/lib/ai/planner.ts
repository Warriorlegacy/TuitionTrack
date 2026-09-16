// Planner priority + replan (blueprint #18) and 3-action analysis (#13 action layer).

export type PlanCandidate = {
  conceptId: string; title: string;
  weakness: number; urgency: number; prereqImpact: number;
  retentionRisk: number; scoreImpact: number; estimatedMin: number;
};

// Priority = 0.35*weakness + 0.25*urgency + 0.20*prereq + 0.10*retention + 0.10*score_impact
export function priority(c: PlanCandidate): number {
  return Number((
    0.35 * c.weakness + 0.25 * c.urgency + 0.2 * c.prereqImpact +
    0.1 * c.retentionRisk + 0.1 * c.scoreImpact
  ).toFixed(3));
}

export function rankPlan(cands: PlanCandidate[], budgetMin: number): (PlanCandidate & { priority: number })[] {
  const ranked = cands.map((c) => ({ ...c, priority: priority(c) }))
    .sort((a, b) => b.priority - a.priority);
  const out: typeof ranked = [];
  let used = 0;
  for (const c of ranked) {
    if (used + c.estimatedMin > budgetMin && out.length > 0) break;
    out.push(c); used += c.estimatedMin;
  }
  return out;
}

// Dynamic replan: preserve high-value, drop low-priority on miss (#18).
export function replan<T extends { priority: number; status: string }>(
  tasks: T[], missedDates: number,
): { keep: T[]; drop: T[] } {
  if (missedDates <= 0) return { keep: tasks, drop: [] };
  const sorted = [...tasks].sort((a, b) => b.priority - a.priority);
  const keepCount = Math.max(1, Math.ceil(sorted.length / (1 + missedDates)));
  return { keep: sorted.slice(0, keepCount), drop: sorted.slice(keepCount) };
}

export type AttemptLayers = {
  score: number; total: number; percent: number;
  correct: number; incorrect: number; unattempted: number; guessed: number; careless: number;
  avgTimeMs: number | null; overtimeCount: number; tooFastIncorrect: number;
  weakestConcepts: { conceptId: string | null; title: string; accuracy: number }[];
  topMistakeCategory: string | null;
};

// Action layer: never end with charts — always "Do these 3 things next" (#13).
export function threeActions(l: AttemptLayers): string[] {
  const actions: string[] = [];
  if (l.weakestConcepts[0])
    actions.push(`Repair "${l.weakestConcepts[0].title}" — 8 targeted problems at one level easier than the test.`);
  if (l.topMistakeCategory && (l.careless + l.guessed) > 0)
    actions.push(
      l.topMistakeCategory === "time" || l.overtimeCount > 0
        ? `Do a 10-question speed drill with a visible timer (avg ${l.avgTimeMs ? Math.round(l.avgTimeMs / 1000) + "s" : "—"}/q now).`
        : `Fix "${l.topMistakeCategory}" errors: re-attempt each missed question aloud before checking the solution.`,
    );
  else actions.push("Re-attempt every missed question tomorrow before any new topic.");
  if (l.tooFastIncorrect > 0)
    actions.push("Slow down on first reads — underline given values before solving (you rushed " + l.tooFastIncorrect + ").");
  else if (l.percent < 90) actions.push("Book a 15-min revision of the prerequisite concept behind your weakest topic.");
  else actions.push("Attempt 5 harder transfer questions to lock in mastery.");
  return actions.slice(0, 3);
}
