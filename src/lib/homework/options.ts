export type QuestionOption = {
  label: string;
  text: string;
  isCorrect?: boolean;
};

export const DEFAULT_ASSERTION_REASON_OPTIONS: readonly QuestionOption[] = [
  {
    label: "A",
    text: "Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).",
    isCorrect: false,
  },
  {
    label: "B",
    text: "Both Assertion (A) and Reason (R) are true but Reason (R) is NOT the correct explanation of Assertion (A).",
    isCorrect: false,
  },
  {
    label: "C",
    text: "Assertion (A) is true but Reason (R) is false.",
    isCorrect: false,
  },
  {
    label: "D",
    text: "Assertion (A) is false but Reason (R) is true.",
    isCorrect: false,
  },
];

export function cleanAnswerToken(str?: string | null): string {
  if (!str) return "";
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/^(option\s*|ans(?:wer)?[:\s]*)/i, "")
    .replace(/^[(\[]+|[)\]]+$/g, "")
    .trim();
}

export function extractOptionsFromStem(stem?: string | null): QuestionOption[] {
  if (!stem || typeof stem !== "string") return [];
  // Look for patterns like (A) ... (B) ... (C) ... (D) ... or A) ... B) ... or A. ... B. ...
  const regex = /(?:^|\s|\n)(?:\(?([A-D])[\).:]|([A-D])\))\s*([^\n\r]+?)(?=(?:\s*(?:\(?[A-D][\).:]|[A-D]\))\s*)|$)/gi;
  const matches: QuestionOption[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(stem)) !== null) {
    const label = (m[1] || m[2]).toUpperCase();
    const text = m[3].trim().replace(/^[,\s;]+|[,\s;]+$/g, "");
    if (text.length > 0) {
      matches.push({ label, text, isCorrect: false });
    }
  }
  // Only accept if at least 2 distinct options (e.g. A and B or A, B, C, D) found in order
  if (matches.length >= 2) {
    const labels = matches.map((x) => x.label);
    if (labels[0] === "A" && labels[1] === "B") {
      return matches;
    }
  }
  return [];
}

export function isOptionMatch(
  tokenOrRaw: string | undefined | null,
  opt: QuestionOption
): boolean {
  if (!tokenOrRaw) return false;
  const raw = String(tokenOrRaw).trim();
  if (!raw) return false;
  const clean = cleanAnswerToken(raw);
  const l = opt.label.trim().toLowerCase();
  const t = opt.text.trim().toLowerCase();

  if (clean && (clean === l || clean === t)) return true;
  const lowerRaw = raw.toLowerCase();
  if (lowerRaw === l || lowerRaw === t) return true;
  if (lowerRaw.startsWith(l + ".") || lowerRaw.startsWith(l + ")") || lowerRaw.startsWith(l + ":")) return true;
  if (clean.startsWith(l + ".") || clean.startsWith(l + ")")) return true;
  return false;
}

export function normalizeQuestionOptions(
  raw: unknown,
  qtype?: string | null,
  stem?: string | null,
  correctAnswer?: string | null
): QuestionOption[] {
  let list: QuestionOption[] = [];

  // Parse if string
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  // If wrapped in { options: [...] }
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Array.isArray((parsed as { options?: unknown }).options)
  ) {
    parsed = (parsed as { options: unknown[] }).options;
  }

  // Object map: { "A": "...", "B": "..." }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const entries = Object.entries(parsed as Record<string, unknown>);
    list = entries
      .map(([key, val], idx) => {
        const label = key.trim().toUpperCase() || String.fromCharCode(65 + idx);
        let text = "";
        let isCorrect = false;

        if (typeof val === "string") {
          text = val.trim();
        } else if (typeof val === "number" || typeof val === "boolean") {
          text = String(val).trim();
        } else if (val && typeof val === "object") {
          const r = val as Record<string, unknown>;
          const rawText = r.text ?? r.value ?? r.choice ?? r.statement ?? r.option ?? "";
          text = typeof rawText === "string" ? rawText.trim() : String(rawText ?? "").trim();
          isCorrect = Boolean(r.isCorrect || r.correct || r.is_correct);
        }
        return { label, text, isCorrect };
      })
      .filter((opt) => opt.text.length > 0 || opt.label.length > 0);
  } else if (Array.isArray(parsed) && parsed.length > 0) {
    list = (parsed as unknown[])
      .map((item, idx) => {
        if (typeof item === "string" || typeof item === "number") {
          const defaultLabel = String.fromCharCode(65 + idx);
          return { label: defaultLabel, text: String(item).trim(), isCorrect: false };
        }
        if (item && typeof item === "object") {
          const r = item as Record<string, unknown>;
          const label = String(r.label || r.key || String.fromCharCode(65 + idx)).trim().toUpperCase();
          const rawText = r.text ?? r.value ?? r.choice ?? r.option ?? r.statement ?? r.content ?? r.title ?? "";
          const text = typeof rawText === "string" ? rawText.trim() : String(rawText ?? "").trim();
          const isCorrect = r.isCorrect === true || r.correct === true || r.is_correct === true;
          return { label, text, isCorrect };
        }
        return { label: String.fromCharCode(65 + idx), text: String(item ?? "").trim(), isCorrect: false };
      })
      .filter((opt) => opt.text.length > 0 || opt.label.length > 0);
  }

  // Fallback 1: If empty and assertion_reason, return standard CBSE Assertion-Reason options
  const normalizedQtype = (qtype || "").trim().toLowerCase();
  const isAR =
    normalizedQtype === "assertion_reason" ||
    normalizedQtype === "ar" ||
    /assertion.*reason/i.test(stem || "");

  if (list.length === 0 && isAR) {
    list = DEFAULT_ASSERTION_REASON_OPTIONS.map((opt) => ({ ...opt }));
  }

  // Fallback 2: If empty and stem has embedded options (A) ... (B) ...
  if (list.length === 0 && stem) {
    const extracted = extractOptionsFromStem(stem);
    if (extracted.length > 0) {
      list = extracted;
    }
  }

  // Fallback 3: If question type is MCQ but options list is empty and correctAnswer is A/B/C/D
  if (list.length === 0 && (normalizedQtype === "mcq" || normalizedQtype === "multiple_choice")) {
    const cleanKey = cleanAnswerToken(correctAnswer).toUpperCase();
    if (["A", "B", "C", "D"].includes(cleanKey)) {
      list = ["A", "B", "C", "D"].map((l) => ({
        label: l,
        text: `Option ${l}`,
        isCorrect: l === cleanKey,
      }));
    }
  }

  // Normalize correct answer marking if correctAnswer is provided
  if (correctAnswer && list.length > 0) {
    const cleanKey = cleanAnswerToken(correctAnswer);
    list = list.map((opt) => {
      const matchesKey =
        isOptionMatch(correctAnswer, opt) ||
        (cleanKey.length > 0 && cleanKey === opt.label.toLowerCase());
      return {
        ...opt,
        isCorrect: Boolean(opt.isCorrect || matchesKey),
      };
    });
  }

  return list;
}
