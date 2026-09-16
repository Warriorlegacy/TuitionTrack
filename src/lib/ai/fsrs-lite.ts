// FSRS-lite scheduler (blueprint #19). Simplified stability/difficulty model;
// upgrade to full FSRS when review volume justifies it.

export type FsrsItem = { stability: number; difficulty: number; state: string; lapseCount: number };
export type FsrsResult = {
  stability: number; difficulty: number; dueAt: Date; scheduledDays: number; state: string;
};

export function scheduleReview(item: FsrsItem, grade: 1 | 2 | 3 | 4, now = new Date()): FsrsResult {
  // grade: 1 again, 2 hard, 3 good, 4 easy
  let { stability: S, difficulty: D } = item;
  if (grade === 1) {
    D = Math.min(1, D + 0.08);
    S = Math.max(0.2, S * 0.25);
  } else {
    D = Math.max(0, D - (grade === 4 ? 0.06 : grade === 3 ? 0.03 : 0.0));
    const factor = grade === 4 ? 2.4 : grade === 3 ? 1.6 : 1.15;
    S = Math.min(365, S * factor * (1.05 - D * 0.3));
  }
  const days = grade === 1 ? 1 : Math.max(1, Math.round(S));
  const dueAt = new Date(now.getTime() + days * 86_400_000);
  const state = grade === 1 ? "relearning" : days > 21 ? "stable" : S > 6 ? "due" : "learning";
  return {
    stability: Number(S.toFixed(3)), difficulty: Number(D.toFixed(3)),
    dueAt, scheduledDays: days, state,
  };
}

export function initialFsrs(): FsrsItem {
  return { stability: 1, difficulty: 0.3, state: "new", lapseCount: 0 };
}

// ponytail: self-check — `npx tsx src/lib/ai/fsrs-lite.ts`
if (require.main === module) {
  const r = scheduleReview(initialFsrs(), 3);
  console.assert(r.scheduledDays >= 1 && r.dueAt > new Date(), "fsrs-lite self-check failed");
  console.log("fsrs-lite ok:", r);
}
