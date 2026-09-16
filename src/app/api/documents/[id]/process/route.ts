import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { logUsage } from "@/lib/ai/usage";
import { embedTexts, EMBEDDING_DIM } from "@/lib/ai/provider";
import { getEmbeddingKey } from "@/lib/ai/byok";

export const dynamic = "force-dynamic";

// POST /api/documents/:id/process — validate→chunk→embed→curriculum-map→quality (#10).
// Embedding is best-effort: a failed/absent key leaves chunk embeddings NULL and
// the retrieval RPC's keyword leg covers those chunks — ingestion never blocks
// on AI (blueprint #63: background ingestion must not block the UI).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const context = await getAuthContext();
  if (!context.configured || !context.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data: doc } = await supabase.from("documents")
    .select("id, teacher_id, student_id, title, status, metadata").eq("id", params.id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if ((doc as { teacher_id: string }).teacher_id !== context.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabase.from("documents").update({ status: "processing" as never }).eq("id", params.id);
  try {
    const raw: string = (doc as { metadata: { raw?: string } }).metadata?.raw ?? "";
    if (!raw) throw new Error("empty content");
    // deterministic chunking (~600 chars on paragraph boundaries)
    const paras = raw.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean);
    const chunks: { content: string }[] = [];
    let buf = "";
    for (const p of paras) {
      if ((buf + "\n" + p).length > 600 && buf) { chunks.push({ content: buf }); buf = p; }
      else buf = buf ? buf + "\n" + p : p;
    }
    if (buf) chunks.push({ content: buf });
    // naive curriculum map: match longest concept title substring
    const { data: concepts } = await supabase.from("syllabus_nodes").select("id, title").eq("level", "concept").limit(200);
    const cmap = ((concepts ?? []) as { id: string; title: string }[]).map((c) => ({ ...c, t: c.title.toLowerCase() }));

    // embeddings: one batched call for all chunks (best-effort, non-blocking path)
    const embeddingKey = await getEmbeddingKey(supabase, context.user.id);
    let vectors: number[][] = [];
    let embedError: string | null = null;
    if (embeddingKey) {
      try {
        const emb = await embedTexts(chunks.slice(0, 100).map((c) => c.content), {
          apiKeyOverride: embeddingKey.key,
          providerKind: embeddingKey.kind,
          modelOverride: embeddingKey.model,
        });
        vectors = emb.vectors;
      } catch (e) {
        embedError = (e as Error).message;
      }
    }

    await supabase.from("document_chunks").delete().eq("document_id", params.id);
    let i = 0;
    for (const ch of chunks.slice(0, 100)) {
      const low = ch.content.toLowerCase();
      const hit = cmap.find((c) => c.t.length > 3 && low.includes(c.t)) ?? null;
      const vec = vectors[i] && vectors[i].length === EMBEDDING_DIM ? vectors[i] : null;
      await supabase.from("document_chunks").insert({
        document_id: params.id, chunk_index: i++, content: ch.content,
        token_count: Math.ceil(ch.content.length / 4),
        embedding: vec, // NULL → keyword leg still retrieves this chunk
        concept_id: hit?.id ?? null,
      });
    }
    const quality = Number(Math.min(0.95, 0.5 + chunks.length * 0.03).toFixed(2));
    await supabase.from("documents").update({ status: "ready" as never, quality_score: quality }).eq("id", params.id);
    await logUsage(supabase, {
      user_id: context.user.id, student_id: (doc as { student_id: string | null }).student_id,
      tier: "deterministic", model: "chunker-v1", endpoint: "/api/documents/:id/process",
      input_tokens: Math.ceil(raw.length / 4), output_tokens: 0, cost_usd: 0,
    });
    return NextResponse.json({
      document_id: params.id, status: "ready", chunks: Math.min(chunks.length, 100),
      quality_score: quality,
      embedded: vectors.length, embedding_model: embeddingKey?.model ?? null,
      ...(embedError ? { embedding_error: embedError } : {}),
    });
  } catch (e) {
    await supabase.from("documents").update({ status: "failed" as never }).eq("id", params.id);
    return NextResponse.json({ error: "Processing failed", details: (e as Error).message }, { status: 500 });
  }
}
