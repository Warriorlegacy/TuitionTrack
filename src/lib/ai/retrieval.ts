// Retrieval: keyword now, semantic when embeddings land (blueprint #21).
// NULL-safe by contract: chunks with null/unparsable embeddings are skipped,
// never scored; when no semantic signal exists callers fall back to keyword.

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
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// Semantic-first, keyword fallback. Pass queryEmbedding=null to force keyword.
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
