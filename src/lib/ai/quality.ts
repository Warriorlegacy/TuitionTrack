// Question quality pipeline stub (blueprint #22).
// Full chain: schema→consistency→dedupe→difficulty→curriculum→ambiguity→
// solution-verify (SymPy/sandbox)→risk review. Slice implements the cheap
// deterministic gates; LLM-risky steps queue teacher review instead of blocking.

export type QualityVerdict = {
  pass: boolean; qualityScore: number; risk: "low" | "medium" | "high";
  flags: string[]; needsReview: boolean;
};

const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export function jaccard(a: string, b: string): number {
  const A = new Set(normalize(a).split(" ")); const B = new Set(normalize(b).split(" "));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const w of Array.from(A)) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function qualityGate(opts: {
  stem: string; options?: string[]; finalAnswer?: string | null;
  existingStems?: string[]; difficulty: number; qtype: string;
}): QualityVerdict {
  const flags: string[] = [];
  let score = 1;
  if (opts.stem.trim().length < 20) { flags.push("stem_too_short"); score -= 0.3; }
  if (/\?\s*\?/.test(opts.stem) || opts.stem.split("?").length > 3) { flags.push("ambiguous_multi_q"); score -= 0.15; }
  if (opts.qtype === "mcq") {
    if (!opts.options || opts.options.length < 3) { flags.push("too_few_options"); score -= 0.3; }
    const uniq = new Set((opts.options ?? []).map(normalize));
    if (uniq.size !== (opts.options ?? []).length) { flags.push("duplicate_options"); score -= 0.2; }
  }
  if (opts.qtype === "numeric" && !opts.finalAnswer) { flags.push("unverified_numeric"); score -= 0.25; }
  for (const s of opts.existingStems ?? []) {
    if (jaccard(opts.stem, s) > 0.85) { flags.push("near_duplicate"); score -= 0.3; break; }
  }
  if (opts.difficulty < 1 || opts.difficulty > 5) { flags.push("bad_difficulty"); score -= 0.1; }
  score = Math.max(0, Number(score.toFixed(2)));
  const risk = score >= 0.8 ? "low" : score >= 0.5 ? "medium" : "high";
  return {
    pass: score >= 0.5, qualityScore: score, risk,
    flags, needsReview: risk === "high" || flags.includes("unverified_numeric"),
  };
}
