import { NextResponse } from "next/server";
import { tutorSchema, type TutorInput } from "@/lib/ai/schemas";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { complete, streamComplete, estimateUsageResult, PROMPT_VERSION } from "@/lib/ai/provider";
import type { CompleteResult } from "@/lib/ai/provider";
import { getBestKeyForTier, getEmbeddingKey } from "@/lib/ai/byok";
import { embedAndRetrieve } from "@/lib/ai/retrieval";
import { stripInjection, checkSafety, validateCitations, NOT_FOUND_IN_SOURCES } from "@/lib/ai/safety";
import { checkRateLimit, logUsage, logEvent } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

const MODE_SYSTEM: Record<string, string> = {
  socratic: "You are a Socratic tutor for Indian school/competitive exams. Never dump the final answer first. Ask one guiding question, give one hint, wait. Be warm, concise, bilingual-aware (English + Hindi terms, never blind-translate terminology).",
  exam_coach: "You are an exam coach: scoring, speed, question selection, traps. Concrete tactics only.",
  concept_teacher: "You are a concept teacher: explain from zero, then standard, then topper depth. Check understanding.",
  doubt_solver: "You are a doubt solver: resolve the exact doubt with steps, then one check question.",
  mistake_coach: "You are a mistake coach: reference the student's past mistake patterns, fix the root cause not the symptom.",
  viva: "You are a viva examiner: ask one oral question at a time, evaluate, probe deeper.",
  revision: "You are a revision coach: only review weak concepts already seen. Short recall prompts.",
  homework: "You are a homework coach: guide with hints, never give copy-paste final answers. Record hint usage.",
  teacher_clone: "You are the teacher's clone: follow teacher tone in context; stay exam-focused.",
  parent_safe: "You convert learning data into simple, encouraging parent language. No jargon, no shaming.",
};

// GET /api/ai/tutor?student_id=…&conversation_id=… — conversation history for resume.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get("student_id");
  if (!studentId) return badRequest("student_id required");
  const { error, context } = await requireStudentAccess(studentId);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();

  const conversationId = url.searchParams.get("conversation_id");
  if (conversationId) {
    const { data: msgs, error: merr } = await supabase
      .from("messages")
      .select("id, role, content, citations, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }).limit(100);
    if (merr) return NextResponse.json({ error: merr.message }, { status: 500 });
    return NextResponse.json({ messages: msgs ?? [] });
  }

  const { data: convos, error: cerr } = await supabase
    .from("conversations")
    .select("id, mode, title, updated_at")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false }).limit(20);
  if (cerr) return NextResponse.json({ error: cerr.message }, { status: 500 });
  return NextResponse.json({ conversations: convos ?? [] });
}

// ── Shared turn pipeline (JSON + SSE paths) ────────────────────────
type Citations = { document_id: string; chunk_id: string; title: string }[];

type TutorPrep = {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  userId: string;
  studentId: string;
  mode: string;
  conversationId: string;
  system: string;
  userMessage: string;
  citations: Citations;
  chunkIds: Set<string>;
  weakList: string;
  mistakeList: string;
  sourceOnly: boolean;
  retrievalMode: "hybrid" | "keyword-rpc" | "keyword-memory";
};

async function prepareTutorTurn(input: TutorInput): Promise<{ error?: NextResponse; prep?: TutorPrep }> {
  const { error, context } = await requireStudentAccess(input.student_id);
  if (error || !context?.user) return { error: error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const supabase = createSupabaseServerClient();

  const rl = await checkRateLimit(supabase, context.user.id, "/api/ai/tutor");
  if (!rl.ok) return { error: NextResponse.json({ error: rl.reason }, { status: 429 }) };

  const clean = stripInjection(input.message);
  const verdict = checkSafety(clean);
  if (!verdict.ok) return { error: NextResponse.json({ reply: verdict.reason, refused: true }, { status: 200 }) };

  // conversation (bounded Tutor agent owns teaching; tools below are its only side-effects)
  let conversationId = input.conversation_id;
  if (!conversationId) {
    const { data } = await supabase.from("conversations").insert({
      student_id: input.student_id, mode: input.mode,
      title: clean.slice(0, 60), context: { concept_id: input.concept_id ?? null },
    }).select("id").single();
    conversationId = data?.id;
  }
  if (!conversationId) return { error: NextResponse.json({ error: "Could not open conversation" }, { status: 500 }) };
  await supabase.from("messages").insert({ conversation_id: conversationId, role: "user", content: verdict.redacted });

  // tools: mastery + mistakes (parallel) + hybrid RAG retrieval (#21, #50).
  // Tenant boundary is enforced inside the RPC by RLS: student's own docs +
  // teacher-shared docs only. Never another student's private docs.
  const [{ data: mastery }, { data: mistakes }] = await Promise.all([
    supabase.from("concept_mastery").select("mastery, concept_id, syllabus_nodes:syllabus_nodes!inner(title)")
      .eq("student_id", input.student_id).order("mastery", { ascending: true }).limit(5),
    supabase.from("mistakes").select("category, root_cause, recurrence_count")
      .eq("student_id", input.student_id).eq("status", "open").order("recurrence_count", { ascending: false }).limit(5),
  ]);
  // Hybrid retrieval: embed query → pgvector+tsvector RPC → rerank. Falls back
  // keyword-RPC → in-memory keyword when embeddings or the RPC are unavailable.
  const embeddingKey = await getEmbeddingKey(supabase, context.user.id);
  const retrieval = await embedAndRetrieve({
    supabase, userId: context.user.id, embeddingKey, query: clean, matchCount: 4,
  });
  const ranked = retrieval.chunks;
  const retrievalMode = retrieval.mode;
  const docTitles = new Map<string, string>();
  if (ranked.length) {
    const { data: docs } = await supabase.from("documents").select("id, title")
      .in("id", Array.from(new Set(ranked.map((c) => c.document_id))));
    for (const d of ((docs ?? []) as unknown as { id: string; title: string }[])) docTitles.set(d.id, d.title);
  }
  const chunkIds = new Set(ranked.map((c) => c.id));
  const citations: Citations = ranked.map((c) => ({ document_id: c.document_id, chunk_id: c.id, title: docTitles.get(c.document_id) ?? "source" }));

  const weakList = ((mastery ?? []) as unknown as { mastery: number; syllabus_nodes: { title: string } }[])
    .map((m) => `${m.syllabus_nodes.title} (${Math.round(Number(m.mastery) * 100)}%)`).join("; ") || "none yet";
  const mistakeList = ((mistakes ?? []) as { category: string; root_cause: string; recurrence_count: number }[])
    .map((m) => `${m.category}×${m.recurrence_count}: ${m.root_cause}`).join(" | ") || "none";
  const contextBlock = ranked.length
    ? ranked.map((c, i) => `[${i + 1}] (${docTitles.get(c.document_id) ?? "source"}) ${c.content.slice(0, 600)}`).join("\n")
    : "(no matching source chunks)";

  const system = `${MODE_SYSTEM[input.mode] ?? MODE_SYSTEM.socratic}\nStudent weak concepts: ${weakList}\nRecurring mistakes: ${mistakeList}\nSources:\n${contextBlock}\nRules: cite [n] for source claims; structured output; age-appropriate; Hindi/Hinglish ok on request.`;

  return {
    prep: {
      supabase, userId: context.user.id, studentId: input.student_id, mode: input.mode,
      conversationId, system, userMessage: verdict.redacted,
      citations, chunkIds, weakList, mistakeList, sourceOnly: input.source_only,
      retrievalMode,
    },
  };
}

// Persistence + billing shared by JSON and SSE paths. Returns citation confidence.
async function persistTutorTurn(prep: TutorPrep, result: CompleteResult): Promise<"high" | "medium" | "low"> {
  const citeCheck = validateCitations(prep.sourceOnly, prep.citations, prep.chunkIds);
  const { data: assistantMsg } = await prep.supabase.from("messages").insert({
    conversation_id: prep.conversationId, role: "assistant", content: result.text,
    citations: prep.citations, model: result.model, prompt_version: PROMPT_VERSION,
    input_tokens: result.inputTokens, output_tokens: result.outputTokens, cost_usd: result.costUsd,
  }).select("id").single();
  if (assistantMsg) {
    await prep.supabase.from("tool_calls").insert({
      message_id: assistantMsg.id, tool_name: "retrieve_source",
      args: { query: prep.userMessage.slice(0, 200), source_only: prep.sourceOnly },
      result: { chunk_ids: Array.from(prep.chunkIds), mastery_used: prep.weakList, mistakes_used: prep.mistakeList, retrieval_mode: prep.retrievalMode },
    });
  }
  await logUsage(prep.supabase, {
    user_id: prep.userId, student_id: prep.studentId, tier: "B",
    model: result.model, endpoint: "/api/ai/tutor",
    input_tokens: result.inputTokens, output_tokens: result.outputTokens,
    cost_usd: result.costUsd, latency_ms: result.latencyMs,
    status: result.stubbed ? "stub" : "ok",
  });
  await logEvent(prep.supabase, prep.studentId, "ai_doubt_asked", { conversation_id: prep.conversationId, mode: prep.mode });
  return citeCheck.confidence;
}

// Minimal SSE response wrapper: `event:`/`data:` frames, no buffering headers.
function sseResponse(run: (send: (event: string, data: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true; // client disconnected mid-stream
        }
      };
      try { await run(send); } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = tutorSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request", parsed.error.flatten());
  const input = parsed.data;

  const wantsStream = new URL(request.url).searchParams.get("stream") === "1";

  const { error, prep } = await prepareTutorTurn(input);
  if (error || !prep) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // source grounding guard (#21): refuse to hallucinate from "sources" when empty
  if (input.source_only && prep.citations.length === 0) {
    if (!wantsStream) {
      await prep.supabase.from("messages").insert({
        conversation_id: prep.conversationId, role: "assistant", content: NOT_FOUND_IN_SOURCES,
        citations: [], model: "deterministic-v1", prompt_version: PROMPT_VERSION,
      });
      return NextResponse.json({ conversation_id: prep.conversationId, reply: NOT_FOUND_IN_SOURCES, citations: [], confidence: "low", stubbed: true });
    }
    return sseResponse(async (send) => {
      send("meta", { conversation_id: prep.conversationId, citations: [], model: "deterministic-v1" });
      send("delta", { text: NOT_FOUND_IN_SOURCES });
      send("done", {
        conversation_id: prep.conversationId, citations: [], confidence: "low",
        model: "deterministic-v1", prompt_version: PROMPT_VERSION, cost_usd: 0, stubbed: true,
      });
    });
  }

  let best;
  try {
    best = await getBestKeyForTier(prep.supabase, prep.userId, "B");
  } catch (e) {
    const details = (e as Error).message;
    if (!wantsStream) return NextResponse.json({ error: "Tutor unavailable", details }, { status: 502 });
    return sseResponse(async (send) => send("error", { error: "Tutor unavailable", details }));
  }

  if (!wantsStream) {
    let result;
    try {
      result = await complete({
        tier: "B", system: prep.system, user: prep.userMessage, maxTokens: 600, task: "tutor_copilot",
          ...(best ? { apiKeyOverride: best.key, providerKind: best.provider.kind, baseUrlOverride: best.provider.baseUrl, modelOverride: best.model, allowFallbacks: best.allowFallbacks, freeOnly: best.freeOnly } : {}),
      });
    } catch (e) {
      return NextResponse.json({ error: "Tutor unavailable", details: (e as Error).message }, { status: 502 });
    }
    const confidence = await persistTutorTurn(prep, result);
    return NextResponse.json({
      conversation_id: prep.conversationId, reply: result.text, citations: prep.citations,
      confidence, model: result.model,
      prompt_version: PROMPT_VERSION, cost_usd: result.costUsd, stubbed: result.stubbed,
    });
  }

  // ── SSE streaming path ──
  // Abort the upstream request when the client disconnects so we never keep
  // generating (and billing) tokens nobody will read.
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const startedAt = Date.now();

  return sseResponse(async (send) => {
    send("meta", {
      conversation_id: prep.conversationId,
      citations: prep.citations.map(({ document_id, title }) => ({ document_id, title })),
      model: best?.model ?? null,
    });

    let acc = "";
    let result: CompleteResult | null = null;
    try {
      result = await streamComplete(
        {
          tier: "B", system: prep.system, user: prep.userMessage, maxTokens: 600, task: "tutor_copilot",
          signal: abort.signal,
        ...(best ? { apiKeyOverride: best.key, providerKind: best.provider.kind, baseUrlOverride: best.provider.baseUrl, modelOverride: best.model, allowFallbacks: best.allowFallbacks, freeOnly: best.freeOnly } : {}),
        },
        (delta) => { acc += delta; send("delta", { text: delta }); },
      );
    } catch (e) {
      if (!acc) {
        send("error", { error: "Tutor unavailable", details: (e as Error).message });
        return;
      }
      // Client disconnected or provider died mid-stream: keep what was already
      // shown so the conversation history matches what the student saw.
      result = estimateUsageResult({ model: best?.model ?? "unknown", system: prep.system, user: prep.userMessage, text: acc, startedAt });
      send("error", { error: "Stream interrupted — partial reply saved." });
    }
    if (!result) return;

    const confidence = await persistTutorTurn(prep, result);
    send("done", {
      conversation_id: prep.conversationId,
      citations: prep.citations.map(({ document_id, title }) => ({ document_id, title })),
      confidence, model: result.model,
      prompt_version: PROMPT_VERSION, cost_usd: result.costUsd, stubbed: result.stubbed,
    });
  });
}
