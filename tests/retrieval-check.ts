// Temporary offline check for retrieval reranking. Run: npx tsx tests/retrieval-check.ts
import { rerankChunks, keywordRank, type RetrievedChunk } from "../src/lib/ai/retrieval";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed++;
};

const mk = (id: string, content: string, sim: number, kw: number): RetrievedChunk => ({
  id, document_id: `doc-${id}`, content, chunk_index: 0, similarity: sim, keyword_score: kw,
});

// 1. Exact-term coverage beats a high-cosine chunk that never mentions the terms.
const chunks: RetrievedChunk[] = [
  mk("vec-strong", "photosynthesis converts light energy into chemical energy stored in glucose bonds.", 0.92, 0),
  mk("kw-hit", "Quadratic equations: solving x squared minus five x plus six by factorisation gives the roots.", 0.55, 0.8),
];
const q = "how do I solve quadratic equations by factorisation";
const top = rerankChunks(chunks, q, 2);
check("coverage reranks exact-term chunk first", top[0]?.id === "kw-hit", `got ${top[0]?.id}`);

// 2. With no query terms (e.g. Hinglish), original fusion order is preserved.
const hinglish = rerankChunks(chunks, "bhai ye batao", 2);
check("no-overlap query preserves fusion order", hinglish[0]?.id === "vec-strong", `got ${hinglish[0]?.id}`);

// 3. k-limit respected.
const many = Array.from({ length: 10 }, (_, i) => mk(`c${i}`, `content ${i}`, i / 20, 0));
check("respects k limit", rerankChunks(many, "content", 3).length === 3);

// 4. keywordRank still works for the memory fallback path.
const mem = keywordRank(
  [{ id: "a", content: "the mitochondria is the powerhouse of the cell", document_id: "d1" },
   { id: "b", content: " Photosynthesis uses sunlight.", document_id: "d1" }],
  "what is the powerhouse of the cell", 2,
);
check("memory keyword fallback ranks mitochondria", mem[0]?.id === "a");

console.log(failed === 0 ? "ALL RETRIEVAL CHECKS PASSED" : `${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
