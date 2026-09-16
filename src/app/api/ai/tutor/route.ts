import { NextResponse } from "next/server";
import { tutorSchema } from "@/lib/ai/schemas";
import { requireStudentAccess, badRequest } from "@/lib/ai/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { complete, PROMPT_VERSION } from "@/lib/ai/provider";
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = tutorSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request", parsed.error.flatten());
  const input = parsed.data;

  const { error, context } = await requireStudentAccess(input.student_id);
  if (error || !context?.user) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();

  const rl = await checkRateLimit(supabase, context.user.id, "/api/ai/tutor");
  if (!rl.ok) return NextResponse.json({ error: rl.reason }, { status: 429 });

  const clean = stripInjection(input.message);
  const verdict = checkSafety(clean);
  if (!verdict.ok) return NextResponse.json({ reply: verdict.reason, refused: true }, { status: 200 });

  // conversation (bounded Tutor agent owns teaching; tools below are its only side-effects)
  let conversationId = input.conversation_id;
  if (!conversationId) {
    const { data } = await supabase.from("conversations").insert({
      student_id: input.student_id, mode: input.mode,
      title: clean.slice(0, 60), context: { concept_id: input.concept_id ?? null },
    }).select("id").single();
    conversationId = data?.id;
  }
  if (!conversationId) return NextResponse.json({ error: "Could not open conversation" }, { status: 500 });
  await supabase.from("messages").insert({ conversation_id: conversationId, role: "user", content: verdict.redacted });

  // tools: mastery + mistakes + source chunks (tenant-scoped RAG #21).
  // Strict boundary: student's own docs + teacher-shared docs (student_id null
  // from this student's teacher). Never another student's private docs.
  const studentRec = context.accessibleStudents.find((s) => s.id === input.student_id);
  const [{ data: mastery }, { data: mistakes }, { data: docs }] = await Promise.all([
    supabase.from("concept_mastery").select("mastery, concept_id, syllabus_nodes:syllabus_nodes!inner(title)")
      .eq("student_id", input.student_id).order("mastery", { ascending: true }).limit(5),
    supabase.from("mistakes").select("category, root_cause, recurrence_count")
      .eq("student_id", input.student_id).eq("status", "open").order("recurrence_count", { ascending: false }).limit(5),
    supabase.from("documents").select("id, title").eq("status", "ready")
      .or(`student_id.eq.${input.student_id},and(student_id.is.null,teacher_id.eq.${studentRec?.teacher_id ?? "00000000-0000-0000-0000-000000000000"})`)
      .limit(20),
  ]);
  const docList = ((docs ?? []) as unknown as { id: string; title: string }[]);
  const titleOf = new Map(docList.map((d) => [d.id, d.title]));
  const { data: chunks } = docList.length
    ? await supabase.from("document_chunks").select("id, content, document_id")
        .in("document_id", docList.map((d) => d.id)).limit(60)
    : { data: [] as unknown[] };
  // ponytail: keyword prefilter now; pgvector semantic rank is the next upgrade (#21).
  const words = new Set(clean.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const ranked = ((chunks ?? []) as unknown as { id: string; content: string; document_id: string }[])
    .map((c) => ({ c, hit: c.content.toLowerCase().split(/[^a-z0-9]+/).filter((w) => words.has(w)).length }))
    .filter((x) => x.hit > 0).sort((a, b) => b.hit - a.hit).slice(0, 4)
    .map((x) => x.c);
  const chunkIds = new Set(ranked.map((c) => c.id));
  const citations = ranked.map((c) => ({ document_id: c.document_id, chunk_id: c.id, title: titleOf.get(c.document_id) ?? "source" }));

  const weakList = ((mastery ?? []) as unknown as { mastery: number; syllabus_nodes: { title: string } }[])
    .map((m) => `${m.syllabus_nodes.title} (${Math.round(Number(m.mastery) * 100)}%)`).join("; ") || "none yet";
  const mistakeList = ((mistakes ?? []) as { category: string; root_cause: string; recurrence_count: number }[])
    .map((m) => `${m.category}×${m.recurrence_count}: ${m.root_cause}`).join(" | ") || "none";
  const contextBlock = ranked.length
    ? ranked.map((c, i) => `[${i + 1}] (${titleOf.get(c.document_id) ?? "source"}) ${c.content.slice(0, 600)}`).join("\n")
    : "(no matching source chunks)";

  // source grounding guard: refuse to hallucinate from "sources" when empty
  if (input.source_only && ranked.length === 0) {
    await supabase.from("messages").insert({
      conversation_id: conversationId, role: "assistant", content: NOT_FOUND_IN_SOURCES,
      citations: [], model: "deterministic-v1", prompt_version: PROMPT_VERSION,
    });
    return NextResponse.json({ conversation_id: conversationId, reply: NOT_FOUND_IN_SOURCES, citations: [], confidence: "low", stubbed: true });
  }

  const system = `${MODE_SYSTEM[input.mode] ?? MODE_SYSTEM.socratic}\nStudent weak concepts: ${weakList}\nRecurring mistakes: ${mistakeList}\nSources:\n${contextBlock}\nRules: cite [n] for source claims; structured output; age-appropriate; Hindi/Hinglish ok on request.`;
  let result;
  try {
    result = await complete({ tier: "B", system, user: verdict.redacted, maxTokens: 600 });
  } catch (e) {
    return NextResponse.json({ error: "Tutor unavailable", details: (e as Error).message }, { status: 502 });
  }
  const citeCheck = validateCitations(input.source_only, citations, chunkIds);
  const { data: assistantMsg } = await supabase.from("messages").insert({
    conversation_id: conversationId, role: "assistant", content: result.text,
    citations, model: result.model, prompt_version: PROMPT_VERSION,
    input_tokens: result.inputTokens, output_tokens: result.outputTokens, cost_usd: result.costUsd,
  }).select("id").single();
  if (assistantMsg) {
    await supabase.from("tool_calls").insert({
      message_id: assistantMsg.id, tool_name: "retrieve_source",
      args: { query: clean.slice(0, 200), source_only: input.source_only },
      result: { chunk_ids: Array.from(chunkIds), mastery_used: weakList, mistakes_used: mistakeList },
    });
  }
  await logUsage(supabase, {
    user_id: context.user.id, student_id: input.student_id, tier: "B",
    model: result.model, endpoint: "/api/ai/tutor",
    input_tokens: result.inputTokens, output_tokens: result.outputTokens,
    cost_usd: result.costUsd, latency_ms: result.latencyMs,
  });
  await logEvent(supabase, input.student_id, "ai_doubt_asked", { conversation_id: conversationId, mode: input.mode });

  // NOTE: streaming upgrade path is SSE (`?stream=1`) via Vercel AI SDK; JSON first for slice testability.
  return NextResponse.json({
    conversation_id: conversationId, reply: result.text, citations,
    confidence: citeCheck.confidence, model: result.model,
    prompt_version: PROMPT_VERSION, cost_usd: result.costUsd, stubbed: result.stubbed,
  });
}
