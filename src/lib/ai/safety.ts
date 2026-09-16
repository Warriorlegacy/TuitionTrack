// Safety/quality agent (blueprint #47, #49, #64). Runs on every tutor turn.
// ponytail: regex blocklist + PII redact; swap for moderation API when volume justifies.

const BLOCKED = [
  /ignore (all |any )?previous instructions/i,
  /ignore (all |any )?system prompt/i,
  /reveal (your |the )?system prompt/i,
  /jailbreak/i,
  /bypass (safety|filter|guardrail)/i,
];

const SELF_HARM = [/suicid/i, /self[- ]?harm/i, /hurt myself/i, /end my life/i];
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(\+91[\s-]?)?[6-9]\d{9}/g;

export type SafetyVerdict = { ok: boolean; reason?: string; redacted: string };

export function stripInjection(input: string): string {
  let out = input;
  for (const re of BLOCKED) out = out.replace(re, "[removed instruction]");
  return out.slice(0, 4000);
}

export function redactPii(input: string): string {
  return input.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
}

export function checkSafety(raw: string): SafetyVerdict {
  const redacted = redactPii(raw);
  if (SELF_HARM.some((re) => re.test(raw))) {
    return {
      ok: false,
      redacted,
      reason:
        "I'm really glad you told me. I'm an AI tutor and can't provide counselling, " +
        "but please talk right now to a parent, teacher, or trusted adult. " +
        "In India you can call Tele-MANAS 14416 or 112 in an emergency.",
    };
  }
  return { ok: true, redacted };
}

// Citation guard (#21, #49): source_only answers need real chunk ids.
export function validateCitations(
  sourceOnly: boolean,
  citations: { document_id: string; chunk_id: string }[],
  chunkIds: Set<string>,
): { ok: boolean; confidence: "high" | "medium" | "low" } {
  if (!sourceOnly) return { ok: true, confidence: citations.length ? "high" : "medium" };
  if (citations.length === 0) return { ok: false, confidence: "low" };
  const allReal = citations.every((c) => chunkIds.has(c.chunk_id));
  return allReal ? { ok: true, confidence: "high" } : { ok: false, confidence: "low" };
}

export const NOT_FOUND_IN_SOURCES =
  "I couldn't find this in your uploaded materials, so I won't guess from them. " +
  "Ask your teacher, or turn off 'my sources only' for a general explanation.";
