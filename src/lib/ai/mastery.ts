// Mastery engine MVP: weighted Bayesian/IRT-inspired estimate (blueprint #15).
// Start simple; DKT only after behavioral data exists.

export type MasteryState = {
  mastery: number; attemptCount: number; correctCount: number; streak: number;
};

export function updateMastery(
  prev: MasteryState,
  opts: {
    correct: boolean; difficulty: number; // 1..5
    confidence?: number | null; // 1..5
    hintsUsed?: number; timeMs?: number | null; timeExpectedMs?: number;
  },
): MasteryState {
  const base = opts.correct ? 0.12 : -0.15;
  // harder questions move mastery more; easy misses hurt more
  const diffW = 0.6 + (opts.difficulty / 5) * 0.8;
  let delta = base * diffW;
  if (opts.correct && (opts.hintsUsed ?? 0) > 0) delta *= Math.max(0.3, 1 - 0.25 * opts.hintsUsed!);
  if (opts.confidence != null) {
    // calibration: confident+wrong penalized; unsure+right rewarded less
    if (!opts.correct && opts.confidence >= 4) delta -= 0.05;
    if (opts.correct && opts.confidence <= 2) delta *= 0.7;
  }
  if (opts.timeMs != null && opts.timeExpectedMs) {
    const ratio = opts.timeMs / Math.max(1, opts.timeExpectedMs);
    if (opts.correct && ratio > 3) delta *= 0.6; // slow correct
    if (!opts.correct && ratio < 0.25) delta -= 0.03; // too-fast incorrect → guess
  }
  const mastery = clamp(prev.mastery + delta, 0.01, 0.99);
  return {
    mastery: Number(mastery.toFixed(4)),
    attemptCount: prev.attemptCount + 1,
    correctCount: prev.correctCount + (opts.correct ? 1 : 0),
    streak: opts.correct ? prev.streak + 1 : 0,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Readiness estimate (#16): always labelled estimate, never guarantee.
export function readinessBreakdown(args: {
  avgMastery: number; retention: number; avgAccuracy: number;
  avgSpeedRatio: number; // actual/expected, 1 = on pace
  trend: number; // -1..1 recent score slope
}): { total: number; parts: Record<string, number> } {
  const speed = clamp(1.2 - args.avgSpeedRatio * 0.4, 0, 1);
  const parts = {
    knowledge: args.avgMastery,
    retention: args.retention,
    speed,
    accuracy: args.avgAccuracy,
    strategy: clamp(0.5 + args.trend * 0.5, 0, 1),
  };
  const total = Math.round(
    (parts.knowledge * 0.3 + parts.retention * 0.2 + parts.speed * 0.15 +
      parts.accuracy * 0.25 + parts.strategy * 0.1) * 100,
  );
  return { total, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v * 100)])) };
}
