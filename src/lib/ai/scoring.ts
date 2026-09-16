// Deterministic scoring (blueprint #22: LLM explains, deterministic verifies).
// MCQ exact; numeric with tolerance; negative marking applied by caller config.

export type GradeResult = { isCorrect: boolean; marksAwarded: number; normalized: string };

export function normalizeAnswer(a: unknown): string {
  if (a === null || a === undefined) return "";
  if (typeof a === "object") return JSON.stringify(a);
  return String(a).trim();
}

export function gradeResponse(opts: {
  qtype: string;
  correctLabel?: string | null; // mcq
  finalAnswer?: string | null; // numeric/short verified answer
  studentAnswer: unknown;
  marks: number;
  negativeMarks?: number;
}): GradeResult {
  const student = normalizeAnswer(opts.studentAnswer);
  if (!student) return { isCorrect: false, marksAwarded: 0, normalized: student };
  if (opts.qtype === "mcq" && opts.correctLabel) {
    // accept "B" or "b)" or full option text match (case-insensitive)
    const s = student.toLowerCase().replace(/[^a-z0-9]/g, "");
    const c = opts.correctLabel.toLowerCase().replace(/[^a-z0-9]/g, "");
    const ok = s === c || s.startsWith(c) || c.startsWith(s);
    return {
      isCorrect: ok,
      marksAwarded: ok ? opts.marks : -(opts.negativeMarks ?? 0),
      normalized: student,
    };
  }
  if ((opts.qtype === "numeric" || opts.qtype === "short") && opts.finalAnswer) {
    const sn = Number(student.replace(/,/g, ""));
    const cn = Number(opts.finalAnswer.replace(/,/g, ""));
    if (!Number.isNaN(sn) && !Number.isNaN(cn)) {
      // ponytail: relative tolerance 1e-6; SymPy sandbox is the upgrade path (#22).
      const tol = Math.max(1e-6, Math.abs(cn) * 1e-6);
      const ok = Math.abs(sn - cn) <= tol;
      return { isCorrect: ok, marksAwarded: ok ? opts.marks : 0, normalized: student };
    }
    const ok = student.toLowerCase() === opts.finalAnswer.toLowerCase();
    return { isCorrect: ok, marksAwarded: ok ? opts.marks : 0, normalized: student };
  }
  // long/case/diagram: deterministic can't verify → 0 + teacher review flag
  return { isCorrect: false, marksAwarded: 0, normalized: student };
}

export function scoreToPercent(score: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Number(((score / total) * 100).toFixed(1));
}
