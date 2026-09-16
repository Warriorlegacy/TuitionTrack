// Embeddings backfill hook: fills document_chunks.embedding where NULL.
// NULL-safe: chunks that fail (or have no key configured) stay NULL and the
// app keeps keyword RAG. Run: DATABASE_URL=... OPENAI_API_KEY=... node scripts/backfill-embeddings.mjs [--limit 200]
// ponytail: no new deps (global fetch + pg, already installed).

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small"; // 1536 dims = vector(1536)
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 200);

if (!DATABASE_URL) {
  console.error("Set DATABASE_URL (or SUPABASE_DB_URL) to the Postgres connection string.");
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.log("No OPENAI_API_KEY — nothing to embed. Chunks stay NULL, keyword RAG active. Exiting 0.");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });

async function embedBatch(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

const { rows } = await pool.query(
  `select id, content from public.document_chunks
   where embedding is null order by created_at limit $1`,
  [LIMIT],
);
console.log(`backfill: ${rows.length} chunks need embeddings (model ${MODEL})`);
for (let i = 0; i < rows.length; i += 32) {
  const batch = rows.slice(i, i + 32);
  try {
    const vecs = await embedBatch(batch.map((r) => r.content.slice(0, 6000)));
    for (let j = 0; j < batch.length; j++) {
      await pool.query(`update public.document_chunks set embedding = $2 where id = $1`, [
        batch[j].id,
        JSON.stringify(vecs[j]),
      ]);
    }
    console.log(`  embedded ${Math.min(i + 32, rows.length)}/${rows.length}`);
  } catch (e) {
    console.error(`  batch at ${i} failed (left NULL): ${e.message}`);
  }
}
await pool.end();
console.log("done.");
