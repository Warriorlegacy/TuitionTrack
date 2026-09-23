// AI Homework Generation Engine — fully AI-powered, curriculum-grounded.
//
// Contract (production, no mocks):
// - Every question comes from a live AI provider call. There is NO static
//   question bank, NO deterministic template fallback, NO placeholder output.
// - On AI failure / invalid output the call THROWS with an actionable error so
//   the UI shows a real error state — never fake success with dummy questions.
// - Freshness: each run sends a random variation seed + higher temperature, and
//   recent question stems are passed as avoidance context, so Generate #1 ≠ #2.
// - Curriculum grounding: Class + Subject + Chapter (+ level descriptor,
//   learning objectives, key topics) are embedded in the prompt, and output is
//   validated (schema, chapter relevance, duplicates, difficulty) with retries.

import { createHash } from "node:crypto";
import { getOfficialChapterBySlug, type OfficialChapter } from "@/lib/curriculum/official-registry";
import { complete, type CompleteArgs, type ProviderKind } from "@/lib/ai/provider";

/** Server-resolved key override (BYOK preferred, platform chain otherwise). Never comes from the client. */
export type AiKeyOverride = Pick<CompleteArgs, "apiKeyOverride" | "providerKind" | "baseUrlOverride" | "modelOverride">;

export type QuestionType = "mcq" | "numeric" | "short" | "long" | "assertion_reason" | "fill_blank" | "case_study";
export type HomeworkMode = "class" | "variant" | "adaptive";

export type GeneratedQuestion = {
  id: string;
  fingerprint: string;
  blueprintId: string;
  position: number;
  studentId?: string;
  qtype: QuestionType;
  difficulty: number;
  marks: number;
  timeSec: number;
  stem: string;
  options: { label: string; text: string; isCorrect: boolean }[];
  correctAnswer: string;
  solutionSteps: string[];
  rubric: { criterion: string; marks: number }[];
  competency: string;
  learningObjective: string;
};

export type QuestionFormat = "mixed" | "mcq";

export type HomeworkGenerationRequest = {
  chapterSlug: string;
  classLevel: number;
  subject: string;
  questionCount?: number;
  difficulty?: number;
  questionTypes?: QuestionType[];
  questionFormat?: QuestionFormat;
  mode?: HomeworkMode;
  studentIds?: string[];
  excludeFingerprints?: string[];
  /** Normalized or raw stems of recently assigned questions (same workspace/class/subject/chapter) to avoid repeating. */
  recentStems?: string[];
  teacherInstructions?: string;
};

export type HomeworkGenerationResult = {
  assignmentTitle: string;
  chapterTitle: string;
  classLevel: number;
  subject: string;
  mode: HomeworkMode;
  totalMarks: number;
  questions: GeneratedQuestion[];
  // If in variant mode, mapped by student ID
  studentVariants?: Record<string, GeneratedQuestion[]>;
  /** REAL provider/model that served this generation — show in UI, never hardcode. */
  provider: ProviderKind;
  model: string;
  generatedAt: string;
  validation: { checked: number; rejected: number; attempts: number };
  /** Fallback trail ("provider/model → …") when the router had to switch models. */
  fallbackTrail?: string[];
  fallbackUsed?: boolean;
};

// Computes a deterministic canonical fingerprint for duplicate detection.
// Stable across runs on purpose: the DB can detect re-issued questions even
// when stems differ only by numbers/whitespace.
export function computeQuestionFingerprint(
  concept: string,
  stemPattern: string,
  qtype: string,
  variables: Record<string, unknown>
): string {
  const norm = `${concept}:${qtype}:${stemPattern.toLowerCase().replace(/\s+/g, " ").trim()}:${JSON.stringify(variables)}`;
  return createHash("sha256").update(norm).digest("hex").slice(0, 24);
}

// ── Curriculum context pipeline: Class → Subject → Chapter → Level ──

/** Age-appropriate level line shared by studio + daily generation. */
export function classLevelDescriptor(classLevel: number): string {
  if (classLevel <= 5)
    return "FOUNDATIONAL stage (age ~10-11). Use very simple vocabulary, single-step problems, concrete everyday examples, and short sentences. NEVER use abstract formalism, board-exam jargon, or multi-step derivations.";
  if (classLevel <= 8)
    return "MIDDLE stage (age ~11-14). Use clear grade-level vocabulary, guided single-concept problems with worked structure, and simple real-life contexts. Avoid senior-level abstraction.";
  if (classLevel <= 10)
    return "SECONDARY stage (board-exam rigor). NCERT exercise style: precise definitions, MCQ + assertion-reason + short/long problems, and CBSE marking-scheme expectations.";
  return "SENIOR SECONDARY stage (age ~16-18). Advanced derivations, multi-step numericals, previous-year-question style rigor, and precise technical terminology.";
}

function isGrammarSubject(subject: string): boolean {
  return subject.toLowerCase().includes("grammar");
}

function grammarGuidance(classLevel: number): string {
  if (classLevel <= 5)
    return "Focus ONLY on the named grammar topic. Use short, familiar sentences (family, school, animals). One clear rule per question; avoid metalanguage beyond the topic name.";
  if (classLevel <= 8)
    return "Focus ONLY on the named grammar topic. Use everyday school-life sentences. Test usage (choose/correct/complete), not definitions of unrelated topics.";
  if (classLevel <= 10)
    return "Focus ONLY on the named grammar topic in CBSE board format (gap filling, editing, omission, sentence reordering/transformation, reported speech). Every question must be solvable by the topic rule alone.";
  return "Focus ONLY on the named grammar topic at board-plus level (error correction, integrated grammar, subtle usage distinctions). Sentences should resemble authentic editorials and literature.";
}

// ── Validation helpers ──

const ALLOWED_QTYPES: QuestionType[] = ["mcq", "numeric", "short", "long", "assertion_reason", "fill_blank", "case_study"];

/** Normalized stem for exact/near-duplicate detection across runs. */
export function normalizeStem(stem: string): string {
  return stem.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

function contentWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4);
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

type ValidateCtx = {
  chapter: OfficialChapter;
  difficulty: number;
  position: number;
  seed: number;
  runToken: string;
  seen: Set<string>;
  fingerprintBlocklist: Set<string>;
  allowedTypes?: QuestionType[];
};

function validateOne(raw: unknown, ctx: ValidateCtx): GeneratedQuestion | null {
  const item = asRecord(raw);
  const qtype = asString(item.qtype) as QuestionType;
  if (!ALLOWED_QTYPES.includes(qtype)) return null;
  if (ctx.allowedTypes && !ctx.allowedTypes.includes(qtype)) return null;

  const stem = asString(item.stem).trim();
  // Reject stubs/placeholders and one-liners that carry no assessable content.
  if (stem.length < 20) return null;
  if (/^(question on|lorem|todo|placeholder|sample question)/i.test(stem)) return null;

  const correctAnswer = asString(item.correctAnswer).trim();
  if (correctAnswer.length === 0) return null;

  const solutionSteps = asArray(item.solutionSteps).map(asString).map((s) => s.trim()).filter(Boolean);
  if (solutionSteps.length === 0) return null;

  const norm = normalizeStem(stem);
  if (ctx.seen.has(norm)) return null; // exact/near duplicate

  // Chapter/topic relevance heuristic: the stem must share at least one
  // content word with the chapter title, key topics, or subject. Prefix
  // matching absorbs singular/plural and inflections ("noun" ≈ "nouns").
  // The prompt carries the full curriculum context; this is the backstop.
  const chapterVocab = new Set([
    ...contentWords(ctx.chapter.title),
    ...ctx.chapter.keyTopics.flatMap(contentWords),
    ...contentWords(ctx.chapter.subject),
  ]);
  const stemWords = new Set(contentWords(stem));
  const overlaps = Array.from(stemWords).some((w) =>
    Array.from(chapterVocab).some((v) => v === w || (v.length >= 4 && w.length >= 4 && (v.startsWith(w) || w.startsWith(v))))
  );
  if (!overlaps) return null;

  // MCQ-style questions need real options with a marked key.
  const rawOptions = asArray(item.options);
  const options = rawOptions.map((o) => {
    const r = asRecord(o);
    return { label: asString(r.label).trim().toUpperCase().slice(0, 2) || "?", text: asString(r.text).trim(), isCorrect: r.isCorrect === true };
  }).filter((o) => o.text.length > 0);
  if ((qtype === "mcq" || qtype === "assertion_reason") && (options.length < 2 || !options.some((o) => o.isCorrect))) return null;

  const marksRaw = Number(item.marks);
  const marks = Number.isFinite(marksRaw) ? Math.min(10, Math.max(1, Math.round(marksRaw))) : qtype === "long" ? 5 : 1;
  const diffRaw = Number(item.difficulty);
  const qDifficulty = Number.isFinite(diffRaw) ? Math.min(5, Math.max(1, Math.round(diffRaw))) : ctx.difficulty;

  const fingerprint = computeQuestionFingerprint(ctx.chapter.title, stem, qtype, { seed: ctx.seed });
  if (ctx.fingerprintBlocklist.has(fingerprint)) return null;

  ctx.seen.add(norm);
  const rubric = asArray(item.rubric).map((r) => {
    const rr = asRecord(r);
    return { criterion: asString(rr.criterion).trim() || "Accuracy", marks: Number(rr.marks) || marks };
  });

  return {
    id: `gen-q-${ctx.chapter.slug}-${ctx.position}-${ctx.runToken}`,
    fingerprint,
    blueprintId: `bp-${ctx.chapter.slug}-${qtype}-${qDifficulty}`,
    position: ctx.position,
    qtype,
    difficulty: qDifficulty,
    marks,
    timeSec: marks * 90,
    stem,
    options,
    correctAnswer,
    solutionSteps,
    rubric: rubric.length > 0 ? rubric : [{ criterion: "Accuracy", marks }],
    competency: asString(item.competency).trim() || `Applies core concepts of ${ctx.chapter.title}`,
    learningObjective: asString(item.learningObjective).trim() || `Mastery of ${ctx.chapter.title}`,
  };
}

function extractJsonArray(text: string, provider: string, model: string): unknown[] {
  let raw = text.trim();
  if (raw.startsWith("```json")) raw = raw.slice(7);
  if (raw.startsWith("```")) raw = raw.slice(3);
  if (raw.endsWith("```")) raw = raw.slice(0, -3);
  raw = raw.trim();
  const startIdx = raw.indexOf("[");
  const endIdx = raw.lastIndexOf("]");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    // ponytail: 200-char preview tells us refusal vs truncation vs prose
    // without dumping tokens into logs.
    throw new Error(`AI (${provider}/${model}) did not return a question list. Preview: ${text.slice(0, 200)}`);
  }
  try {
    const parsed: unknown = JSON.parse(raw.substring(startIdx, endIdx + 1));
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed;
  } catch {
    throw new Error(`AI (${provider}/${model}) returned malformed questions. Please retry generation.`);
  }
}

// ── Live AI generation (throws on failure — never falls back to templates) ──

const MAX_ATTEMPTS = 3;

async function generateQuestionsWithAI(
  chapter: OfficialChapter,
  count: number,
  difficulty: number,
  types: QuestionType[],
  opts: {
    teacherInstructions?: string;
    userId?: string;
    studentSeed?: number;
    avoidStems?: string[];
    excludeFingerprints?: string[];
    key?: AiKeyOverride;
    allowFallbacks?: boolean;
    freeOnly?: boolean;
  } = {}
): Promise<{ questions: GeneratedQuestion[]; provider: ProviderKind; model: string; stats: { checked: number; rejected: number; attempts: number }; fallbackTrail: string[] }> {
  const seed = opts.studentSeed ?? 0;
  // ponytail: per-run randomness so every Generate click yields a fresh set
  // while the chapter/curriculum constraints stay fixed.
  const runToken = `${Date.now().toString(36)}${Math.floor(Math.random() * 0xffffff).toString(36)}`;
  const seen = new Set((opts.avoidStems ?? []).map(normalizeStem).filter(Boolean));
  const fingerprintBlocklist = new Set(opts.excludeFingerprints ?? []);

  const levelLine = classLevelDescriptor(chapter.classLevel);
  const grammarLine = isGrammarSubject(chapter.subject) ? grammarGuidance(chapter.classLevel) : null;
  const objectives = chapter.learningObjectives.slice(0, 4).map((o, i) => `${i + 1}. ${o}`).join("\n");
  const topics = chapter.keyTopics.slice(0, 6).join("; ");
  const competencies = (chapter.competencies ?? []).slice(0, 3).map((c) => `- ${c.statement} [${c.bloomLevel}]`).join("\n");

  const system = `You are a CBSE & NCERT master curriculum educator and exam question creator for Class ${chapter.classLevel} ${chapter.subject}.
STRICT SCOPE: generate questions ONLY for the chapter/topic below, at the class level specified. NEVER borrow questions from other chapters, other classes, or general knowledge. If a question does not test this chapter's concepts, it is WRONG.
Output ONLY a strictly valid JSON array of question objects. No markdown fences, no commentary.`;

  const user = `Generate ${count} FRESH, high-quality homework questions (never before published, varied from any previous set).

CURRICULUM CONTEXT (exact scope — do not leave it):
- Class: ${chapter.classLevel} | Subject: ${chapter.subject} | Chapter ${chapter.chapterNumber}: ${chapter.title}
- Textbook: ${chapter.bookTitle} (${chapter.board} aligned)
- Level: ${levelLine}
${grammarLine ? `- GRAMMAR MODE: ${grammarLine}\n` : ""}- Learning objectives:
${objectives}
- Key topics to draw from: ${topics}
- Competencies:
${competencies || "- Applies core concepts of the chapter"}
- Difficulty: ${difficulty}/5 | Allowed types: ${types.join(", ")}
${opts.teacherInstructions ? `- Teacher instructions: ${opts.teacherInstructions}\n` : ""}${seed > 0 ? `- Variant set for learner #${seed}: change all numbers, names, and scenarios while testing the SAME concepts at the SAME difficulty.\n` : ""}- Variation seed ${runToken}: every question must differ in wording, numbers, and scenarios from any previous generation.

JSON schema per question:
[{"position":1,"qtype":"mcq","difficulty":${difficulty},"marks":1,"stem":"...","options":[{"label":"A","text":"...","isCorrect":false},{"label":"B","text":"...","isCorrect":true},{"label":"C","text":"...","isCorrect":false},{"label":"D","text":"...","isCorrect":false}],"correctAnswer":"...","solutionSteps":["Step 1: ...","Step 2: ..."],"rubric":[{"criterion":"...","marks":1}],"competency":"...","learningObjective":"..."}]
Rules: exactly one option isCorrect for mcq/assertion_reason; non-option types use "options":[]; solutionSteps must show the full working; correctAnswer must be exact and verifiable.`;

  const collected: GeneratedQuestion[] = [];
  let checked = 0;
  let rejected = 0;
  let attempts = 0;
  let provider: ProviderKind = "custom";
  let model = "unknown";
  const allowedTypes: QuestionType[] = types;
  const fallbackSteps: string[] = [];
  const noteTrail = (trail: { provider: string; model: string; ok: boolean }[] | undefined) => {
    for (const t of trail ?? []) {
      const step = `${t.provider}/${t.model}`;
      if (!fallbackSteps.includes(step)) fallbackSteps.push(step);
    }
  };

  while (collected.length < count && attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const aiRes = await complete({
      tier: "B",
      system,
      user,
      userId: opts.userId,
      task: "homework_generation",
      // ponytail: questions carry full solutions + rubrics (~500-800 tokens
      // each); a small cap truncates the JSON mid-array and fails validation.
      maxTokens: Math.max(3000, count * 800),
      temperature: 0.75,
      allowFallbacks: opts.allowFallbacks,
      freeOnly: opts.freeOnly,
      ...(opts.key ?? {}),
    });
    noteTrail(aiRes.attempts);
    if (aiRes.stubbed) {
      throw new Error("AI is not configured. Add a provider key (Settings → AI, or GROQ/GEMINI/OPENROUTER_API_KEY) to generate homework.");
    }
    provider = aiRes.provider ?? provider;
    if (aiRes.model) model = aiRes.model;

    const parsed = extractJsonArray(aiRes.text, provider, model);
    for (const item of parsed) {
      if (collected.length >= count) break;
      checked += 1;
      const q = validateOne(item, {
        chapter,
        difficulty,
        position: collected.length + 1,
        seed,
        runToken: `${runToken}-${seed}-${collected.length}`,
        seen,
        fingerprintBlocklist,
        allowedTypes,
      });
      if (!q) {
        rejected += 1;
        continue;
      }
      collected.push(q);
    }
  }

  if (collected.length < count) {
    throw new Error(
      `AI (${provider}/${model}) produced only ${collected.length}/${count} valid chapter-aligned questions after ${attempts} attempts (${rejected} rejected). Please retry generation.`
    );
  }

  return { questions: collected, provider, model, stats: { checked, rejected, attempts }, fallbackTrail: fallbackSteps };
}

/**
 * Generates unique homework questions for a given chapter using the live AI
 * provider chain. Throws on AI failure — callers must surface the error.
 * In 'variant'/'adaptive' mode with student IDs, creates distinct variants
 * per student testing the same concepts.
 */
export async function generateHomeworkAssignment(
  req: HomeworkGenerationRequest,
  userId?: string,
  key?: AiKeyOverride,
  opts: { allowFallbacks?: boolean; freeOnly?: boolean } = {}
): Promise<HomeworkGenerationResult> {
  const chapter = getOfficialChapterBySlug(req.chapterSlug);
  if (!chapter) {
    throw new Error(`Official chapter with slug '${req.chapterSlug}' not found in curriculum registry.`);
  }
  // Defense in depth: the requested class/subject must match the chapter's own
  // registry entry, so a mismatched client payload can't silently generate
  // out-of-scope questions.
  if (req.classLevel !== chapter.classLevel || req.subject.toLowerCase() !== chapter.subject.toLowerCase()) {
    throw new Error(
      `Request mismatch: chapter '${chapter.title}' belongs to Class ${chapter.classLevel} ${chapter.subject}, not Class ${req.classLevel} ${req.subject}.`
    );
  }

  const questionCount = Math.min(25, Math.max(1, req.questionCount || 5));
  const difficulty = Math.min(5, Math.max(1, req.difficulty || 3));
  const mode = req.mode || "variant";
  // ponytail: MCQ-only studio option — frontend + backend enforce the same
  // rule. "mcq" forces every question to MCQ; nothing else is generated.
  const types: QuestionType[] =
    req.questionFormat === "mcq" ? ["mcq"] : req.questionTypes || ["mcq", "numeric", "short", "assertion_reason"];

  const base = await generateQuestionsWithAI(chapter, questionCount, difficulty, types, {
    teacherInstructions: req.teacherInstructions,
    userId,
    studentSeed: 0,
    avoidStems: req.recentStems,
    excludeFingerprints: req.excludeFingerprints,
    key,
    allowFallbacks: opts.allowFallbacks,
    freeOnly: opts.freeOnly,
  });
  const totalMarks = base.questions.reduce((acc, q) => acc + q.marks, 0);
  const fallbackTrail = [...base.fallbackTrail];

  const result: HomeworkGenerationResult = {
    assignmentTitle: `${chapter.title} — Homework Practice`,
    chapterTitle: chapter.title,
    classLevel: chapter.classLevel,
    subject: chapter.subject,
    mode,
    totalMarks,
    questions: base.questions,
    provider: base.provider,
    model: base.model,
    generatedAt: new Date().toISOString(),
    validation: base.stats,
    fallbackTrail,
    fallbackUsed: fallbackTrail.length > 1,
  };

  // If in Variant or Adaptive mode and students are specified, each learner
  // gets a distinct variant set; base stems are avoided so variants differ.
  if ((mode === "variant" || mode === "adaptive") && req.studentIds && req.studentIds.length > 0) {
    const studentVariants: Record<string, GeneratedQuestion[]> = {};
    const variantAvoid = [...(req.recentStems ?? []), ...base.questions.map((q) => q.stem)];

    for (let idx = 0; idx < req.studentIds.length; idx++) {
      const studentId = req.studentIds[idx];
      const studentQuestions = await generateQuestionsWithAI(chapter, questionCount, difficulty, types, {
        teacherInstructions: req.teacherInstructions,
        userId,
        studentSeed: idx + 1,
        avoidStems: [...variantAvoid, ...Object.values(studentVariants).flat().map((q) => q.stem)],
        excludeFingerprints: req.excludeFingerprints,
        key,
        allowFallbacks: opts.allowFallbacks,
        freeOnly: opts.freeOnly,
      });
      for (const step of studentQuestions.fallbackTrail) {
        if (!fallbackTrail.includes(step)) fallbackTrail.push(step);
      }
      studentVariants[studentId] = studentQuestions.questions.map((q) => ({
        ...q,
        studentId,
        id: `gen-q-${chapter.slug}-${q.position}-${studentId.slice(0, 8)}`,
      }));
    }

    result.studentVariants = studentVariants;
    result.fallbackTrail = fallbackTrail;
    result.fallbackUsed = fallbackTrail.length > 1;
  }

  return result;
}
