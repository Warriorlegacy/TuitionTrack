// Golden eval (blueprint #66, #100). Fixed benchmark set; run on every
// prompt/model change so regressions are loud. Expand with real tuition Qs.
//
// Two tiers:
//   • deterministic (default) — pure functions, offline, free. Guards grading,
//     mistake classification, FSRS and citation logic.
//   • live (AI_LIVE_EVAL=1)   — actually calls the provider. The deterministic
//     set never touches a model, so on its own it cannot catch a prompt or
//     model regression; this tier can.
//
// Run: npx tsx src/lib/ai/eval-golden.ts            (deterministic only)
//      AI_LIVE_EVAL=1 npx tsx src/lib/ai/eval-golden.ts

import { qualityGate } from "@/lib/ai/quality";
import { gradeResponse } from "@/lib/ai/scoring";
import { classifyMistake } from "@/lib/ai/mistakes";
import { validateCitations, NOT_FOUND_IN_SOURCES } from "@/lib/ai/safety";
import { scheduleReview, initialFsrs } from "@/lib/ai/fsrs-lite";
import { priority } from "@/lib/ai/planner";

type Case = { name: string; run: () => boolean };

const cases: Case[] = [
  { name: "mcq exact grade", run: () => gradeResponse({ qtype: "mcq", correctLabel: "B", studentAnswer: "b)", marks: 1 }).isCorrect },
  { name: "numeric tolerance", run: () => gradeResponse({ qtype: "numeric", finalAnswer: "3.14", studentAnswer: "3.1400001", marks: 1 }).isCorrect },
  { name: "numeric far value fails", run: () => !gradeResponse({ qtype: "numeric", finalAnswer: "3.14", studentAnswer: "31.4", marks: 1 }).isCorrect },
  { name: "sign error classified", run: () => classifyMistake({ studentAnswer: "-5", correctAnswer: "5", qtype: "numeric" }).category === "sign" },
  { name: "blank is guess", run: () => classifyMistake({ studentAnswer: "", correctAnswer: "5", qtype: "numeric" }).category === "guess" },
  { name: "short stem flagged", run: () => !qualityGate({ stem: "Solve?", difficulty: 3, qtype: "mcq", options: ["a"] }).pass },
  { name: "unverified numeric needs review", run: () => qualityGate({ stem: "Find the roots of x^2 - 5x + 6 = 0 and explain each step fully.", difficulty: 3, qtype: "numeric" }).needsReview },
  { name: "fsrs again → 1 day", run: () => scheduleReview(initialFsrs(), 1).scheduledDays === 1 },
  { name: "planner weights", run: () => priority({ conceptId: "c", title: "t", weakness: 1, urgency: 1, prereqImpact: 1, retentionRisk: 1, scoreImpact: 1, estimatedMin: 10 }) === 1 },
  // source_only with zero chunks must refuse to answer from "sources" (tutor route returns NOT_FOUND_IN_SOURCES)
  { name: "source_only empty → not found", run: () => { const r = validateCitations(true, [], new Set()); return !r.ok && r.confidence === "low" && NOT_FOUND_IN_SOURCES.length > 0; } },
  { name: "source_only real cites → high", run: () => validateCitations(true, [{ document_id: "d", chunk_id: "c1" }], new Set(["c1"])).confidence === "high" },
];

export function runGolden(): { passed: number; failed: string[] } {
  const failed: string[] = [];
  for (const c of cases) {
    try { if (!c.run()) failed.push(c.name); }
    catch (e) { failed.push(`${c.name}: ${(e as Error).message}`); }
  }
  return { passed: cases.length - failed.length, failed };
}

// ── Live model tier (#66: factual accuracy, math accuracy, pedagogy,
// cheating resistance). Kept small/cheap: three short Tier-B calls.
const LIVE_CASES: { name: string; system: string; user: string; check: (t: string) => boolean; maxTokens: number }[] = [
  {
    name: "live: arithmetic accuracy",
    system: "You are a precise maths tutor. Answer in one short sentence.",
    user: "What is 12 multiplied by 8?",
    check: (t) => /\b96\b/.test(t),
    maxTokens: 60,
  },
  {
    name: "live: socratic — no answer dump",
    system:
      "You are a Socratic tutor for Indian school students. Never state the final answer. Ask one guiding question and stop.",
    user: "Solve x^2 - 5x + 6 = 0 for me.",
    // Must not hand over the roots, and must engage with a question.
    check: (t) => !/\bx\s*=\s*[23]\b/.test(t) && t.includes("?"),
    maxTokens: 160,
  },
  {
    name: "live: Hindi/Hinglish output",
    system: "You are a tutor for Indian students. Reply in Hindi (Devanagari script).",
    user: "प्रकाश संश्लेषण क्या है? एक वाक्य में बताइए।",
    check: (t) => /[\u0900-\u097F]/.test(t),
    maxTokens: 160,
  },
];

export async function runLive(): Promise<{ passed: number; failed: string[]; stubbed: boolean }> {
  const { complete } = await import("@/lib/ai/provider");
  const failed: string[] = [];
  let stubbed = false;

  for (const c of LIVE_CASES) {
    try {
      const r = await complete({ tier: "B", system: c.system, user: c.user, maxTokens: c.maxTokens, temperature: 0.1 });
      if (r.stubbed) stubbed = true;
      if (!c.check(r.text)) failed.push(`${c.name} (model said: ${r.text.slice(0, 120).replace(/\s+/g, " ")})`);
    } catch (e) {
      failed.push(`${c.name}: ${(e as Error).message}`);
    }
  }

  return { passed: LIVE_CASES.length - failed.length, failed, stubbed };
}

if (require.main === module) {
  void (async () => {
    const r = runGolden();
    console.log(`golden (deterministic): ${r.passed}/${cases.length} passed`);
    if (r.failed.length) console.error("failed:", r.failed);

    let liveFailed = false;
    if (process.env.AI_LIVE_EVAL === "1") {
      const live = await runLive();
      console.log(`golden (live):          ${live.passed}/${LIVE_CASES.length} passed`);
      if (live.failed.length) {
        console.error("failed:", live.failed);
        liveFailed = true;
      }
      if (live.stubbed) {
        console.error("\n✗ LIVE TIER RAN IN STUB MODE — set OPENAI_API_KEY; no real model was called.");
        liveFailed = true;
      }
    } else {
      console.log("golden (live):          skipped — set AI_LIVE_EVAL=1 to call the model.");
    }

    if (r.failed.length || liveFailed) process.exit(1);
  })();
}
