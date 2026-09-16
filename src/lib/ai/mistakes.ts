// Mistake Book 2.0 auto-classifier (blueprint #14). Rule-based Tier-A logic;
// LLM writes the explanation, this assigns the category deterministically.

export type MistakeCategory =
  | "concept" | "formula" | "calc" | "misread" | "sign" | "unit"
  | "guess" | "time" | "careless" | "strategy" | "memory" | "presentation";

export function classifyMistake(opts: {
  studentAnswer: string; correctAnswer: string; qtype: string;
  timeMs?: number | null; timeExpectedMs?: number;
  confidence?: number | null; hintsUsed?: number;
}): { category: MistakeCategory; rootCause: string; severity: "low" | "medium" | "high" } {
  const s = opts.studentAnswer.trim();
  const c = opts.correctAnswer.trim();
  if (!s) return { category: "guess", rootCause: "No answer given (blank/unattempted).", severity: "medium" };
  if (opts.timeMs != null && opts.timeExpectedMs) {
    const r = opts.timeMs / Math.max(1, opts.timeExpectedMs);
    if (r < 0.25) return { category: "guess", rootCause: "Answered far too fast — likely guessed.", severity: "medium" };
    if (r > 3) return { category: "time", rootCause: "Spent far too long — time pressure issue.", severity: "low" };
  }
  const sn = Number(s.replace(/,/g, "")); const cn = Number(c.replace(/,/g, ""));
  if (!Number.isNaN(sn) && !Number.isNaN(cn) && cn !== 0) {
    if (Math.abs(sn + cn) <= Math.max(1e-6, Math.abs(cn) * 1e-6) && sn !== cn)
      return { category: "sign", rootCause: "Sign error: magnitude right, sign flipped.", severity: "medium" };
    const unitM = [[1000, "km↔m / g↔kg scale"], [100, "cm↔m / % scale"], [60, "min↔hr scale"]];
    for (const [f, label] of unitM as [number, string][])
      if (Math.abs(Math.abs(sn / cn) - f) < 0.01 || Math.abs(Math.abs(cn / sn) - f) < 0.01)
        return { category: "unit", rootCause: `Unit/scale error (${label}).`, severity: "medium" };
    const rel = Math.abs(sn - cn) / Math.abs(cn);
    if (rel < 0.05) return { category: "calc", rootCause: "Small arithmetic slip near correct value.", severity: "low" };
    if (/[+\-*/^]/.test(s) || /formula/i.test(c))
      return { category: "formula", rootCause: "Likely wrong formula or substitution.", severity: "high" };
    return { category: "concept", rootCause: "Method/concept gap — value far from expected.", severity: "high" };
  }
  if (opts.confidence != null && opts.confidence <= 2)
    return { category: "guess", rootCause: "Low confidence — guessed.", severity: "low" };
  if (s.length < Math.max(3, c.length * 0.3))
    return { category: "misread", rootCause: "Answer incomplete — possibly misread question.", severity: "medium" };
  return { category: "concept", rootCause: "Concept gap (default for unverified text).", severity: "medium" };
}
