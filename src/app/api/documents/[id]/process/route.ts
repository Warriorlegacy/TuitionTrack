import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { logUsage } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

// POST /api/documents/:id/process — validate→chunk→embed-stub→curriculum-map→quality (#10).
// OCR + real embeddings + malware scan are queued behind this same state machine.
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
    await supabase.from("document_chunks").delete().eq("document_id", params.id);
    let i = 0;
    for (const ch of chunks.slice(0, 100)) {
      const low = ch.content.toLowerCase();
      const hit = cmap.find((c) => c.t.length > 3 && low.includes(c.t)) ?? null;
      await supabase.from("document_chunks").insert({
        document_id: params.id, chunk_index: i++, content: ch.content,
        token_count: Math.ceil(ch.content.length / 4),
        // ponytail: embedding NULL until EMBEDDINGS key wired; keyword RAG works now.
        embedding: null, concept_id: hit?.id ?? null,
      });
    }
    const quality = Number(Math.min(0.95, 0.5 + chunks.length * 0.03).toFixed(2));
    await supabase.from("documents").update({ status: "ready" as never, quality_score: quality }).eq("id", params.id);
    await logUsage(supabase, {
      user_id: context.user.id, student_id: (doc as { student_id: string | null }).student_id,
      tier: "A", model: "chunker-v1", endpoint: "/api/documents/:id/process",
      input_tokens: Math.ceil(raw.length / 4), output_tokens: 0, cost_usd: 0,
    });
    return NextResponse.json({ document_id: params.id, status: "ready", chunks: Math.min(chunks.length, 100), quality_score: quality });
  } catch (e) {
    await supabase.from("documents").update({ status: "failed" as never }).eq("id", params.id);
    return NextResponse.json({ error: "Processing failed", details: (e as Error).message }, { status: 500 });
  }
}
