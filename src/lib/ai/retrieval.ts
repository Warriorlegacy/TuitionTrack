// Retrieval for tutor RAG (blueprint #21, #50).
//
// Pipeline: embed query → Postgres RPC `match_document_chunks` (hybrid:
// pgvector cosine + tsvector keyword, max-fused) → heuristic rerank → top-k.
// Every stage degrades gracefully:
//   no embedding key  → keyword-only RPC   → in-memory keyword prefilter
//   (the last one is the pre-pgvector behaviour, kept as final fallback).

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedTexts } from "./provider";
import type { ProviderKind } from "./provider";

export type RankChunk = {
  id: string;
  content: string;
  document_id: string;
  embedding?: number[] | string | null;
};

const tokens = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);

export function keywordRank(chunks: RankChunk[], query: string, k = 4): RankChunk[] {
  const words = new Set(tokens(query));
  if (!words.size) return [];
  return chunks
    .map((c) => ({
      c,
      hit: tokens(c.content).filter((w) => words.has(w)).length,
    }))
    .filter((x) => x.hit > 0)
    .sort((a, b) => b.hit - a.hit)
    .slice(0, k)
    .map((x) => x.c);
}

function toVector(e: RankChunk["embedding"]): number[] | null {
  if (!e) return null;
  if (Array.isArray(e)) return e.length ? (e as number[]) : null;
  try {
    const v = JSON.parse(e as string);
    return Array.isArray(v) && v.length ? v : null;
  } catch {
    return null;
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0, n = Math.min(a.length, b.length); i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// Legacy in-memory ranker (kept for non-RPC callers / final fallback).
export function rankChunks(
  chunks: RankChunk[],
  query: string,
  queryEmbedding: number[] | null,
  k = 4,
): { chunks: RankChunk[]; mode: "semantic" | "keyword" } {
  if (queryEmbedding?.length) {
    const scored = chunks
      .map((c) => ({ c, v: toVector(c.embedding) }))
      .filter((x): x is { c: RankChunk; v: number[] } => x.v !== null)
      .map((x) => ({ c: x.c, s: cosine(queryEmbedding, x.v) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, k)
      .map((x) => x.c);
    if (scored.length) return { chunks: scored, mode: "semantic" };
  }
  return { chunks: keywordRank(chunks, query, k), mode: "keyword" };
}

// ── Hybrid RPC retrieval ──────────────────────────────────────────
export type RetrievedChunk = {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  similarity: number;   // cosine similarity (0 when keyword-only)
  keyword_score: number; // ts_rank (0 when semantic-only)
};

export type RetrieveOptions = {
  supabase: SupabaseClient;
  userId: string;
  embeddingKey: { key: string; kind: ProviderKind; model: string } | null;
  query: string;
  matchCount?: number;
  candidateLimit?: number;
};

export type RetrieveOutcome = {
  chunks: RetrievedChunk[];
  mode: "hybrid" | "keyword-rpc" | "keyword-memory";
  queryEmbedding: number[] | null;
  error?: string;
};

/**
 * embed → RPC → rerank. Never throws: any failure downgrades the mode and
 * still returns the best chunks available, because a tutor answer with
 * keyword grounding beats an exception.
 */
export async function embedAndRetrieve(opts: RetrieveOptions): Promise<RetrieveOutcome> {
  const matchCount = opts.matchCount ?? 6;
  const candidateLimit = opts.candidateLimit ?? 60;

  // 1. Embed the query (skip entirely when no key — saves a failed call).
  let queryEmbedding: number[] | null = null;
  if (opts.embeddingKey && opts.query.trim()) {
    try {
      const emb = await embedTexts([opts.query], {
        apiKeyOverride: opts.embeddingKey.key,
        providerKind: opts.embeddingKey.kind,
        modelOverride: opts.embeddingKey.model,
      });
      if (emb.vectors[0]?.length) queryEmbedding = emb.vectors[0];
    } catch {
      // embedding failure is non-fatal: fall through to keyword RPC
    }
  }

  // 2. Hybrid retrieval in Postgres (RLS-enforced tenant safety).
  const { data, error } = await opts.supabase.rpc("match_document_chunks", {
    p_query_embedding: queryEmbedding,
    p_query_text: opts.query,
    p_match_count: matchCount,
    p_candidate_limit: candidateLimit,
  });
  if (!error) {
    const rows = (data ?? []) as unknown as RetrievedChunk[];
    const chunks = rerankChunks(rows, opts.query, matchCount);
    return { chunks, mode: queryEmbedding ? "hybrid" : "keyword-rpc", queryEmbedding };
  }

  // 3. RPC missing/failed → last-resort in-memory keyword fallback over a
  //    bounded doc set (the pre-pgvector behaviour).
  const { data: docs } = await opts.supabase
    .from("documents").select("id, title").eq("status", "ready").limit(20);
  const docList = (docs ?? []) as unknown as { id: string; title: string }[];
  const { data: chunks } = docList.length
    ? await opts.supabase.from("document_chunks")
        .select("id, content, document_id")
        .in("document_id", docList.map((d) => d.id)).limit(60)
    : { data: [] as unknown[] };
  const mem = keywordRank((chunks ?? []) as unknown as RankChunk[], opts.query, matchCount);
  return {
    chunks: mem.map((c) => ({ id: c.id, document_id: c.document_id, content: c.content, chunk_index: 0, similarity: 0, keyword_score: 0 })),
    mode: "keyword-memory",
    queryEmbedding,
    error: error.message,
  };
}

// ── Reranking (deterministic, #22/#50) ────────────────────────────
// Cost-free cross-encoder stand-in: the hybrid fusion ordering is re-scored
// with query-term coverage + document position prior, so a chunk that the
// vector leg surfaced but that never mentions the student's actual terms can
// no longer crowd out an exact-phrase hit. Deterministic (no model call), so
// it is testable offline and adds no latency budget.
export function rerankChunks(
  chunks: RetrievedChunk[],
  query: string,
  k: number,
): RetrievedChunk[] {
  const q = new Set(tokens(query));
  if (!q.size || chunks.length <= 1) return chunks.slice(0, k);

  const rescored = chunks.map((c, idx) => {
    const toks = tokens(c.content);
    const distinct = new Set(toks);
    let covered = 0;
    for (const t of Array.from(q)) if (distinct.has(t)) covered++;
    const coverage = covered / q.size;                                  // 0..1
    const positional = 1 - idx / (chunks.length + 1);                    // fusion order prior
    const fused = Math.max(c.similarity, c.keyword_score);
    const score = 0.45 * fused + 0.4 * coverage + 0.15 * positional;
    return { c, score };
  });

  return rescored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}
