-- TuitionTrack RAG: pgvector hybrid retrieval for the tutor (blueprint #21, #50).
--
-- Replaces the tutor's in-memory keyword prefilter (60-chunk fetch + token
-- overlap) with a single tenant-safe RPC:
--   query embedding ─┐
--                    ├─ score fusion (cosine + tsvector overlap) → top-k chunks
--   keyword tsquery ─┘
--
-- Tenant safety: the RPC runs under the caller's JWT with RLS enforced
-- (SECURITY INVOKER, no SECURITY DEFINER). document_chunks policies
-- ("chunks teacher full" / "chunks linked select") filter rows exactly as
-- direct table reads would — a student can only ever match their own docs or
-- their teacher's shared docs, never another tenant's content.
--
-- NULL-safe: chunks without embeddings still match on the keyword leg. When
-- the query embedding is NULL, only the keyword leg scores.
--
-- Type safety: every float the CTEs produce (ts_rank → real, 1 - cosine
-- distance → real/float8) is cast to ::numeric at the source so the final
-- projection matches RETURNS TABLE exactly — plpgsql's RETURN QUERY is strict
-- about column count AND column types.
--
-- Apply: node --env-file-if-exists=.env.local scripts/apply-migrations.mjs

-- ── Hybrid retrieval RPC ──────────────────────────────────────────
create or replace function public.match_document_chunks(
  p_query_embedding public.vector,   -- NULL → keyword-only
  p_query_text text,                 -- plain text; websearch_to_tsquery parses it
  p_match_count int default 6,       -- final rows returned
  p_candidate_limit int default 60   -- semantic candidates before fusion
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  similarity numeric,   -- cosine similarity 0..1 (0 on keyword-only rows)
  keyword_score numeric -- ts_rank ~0..1 (0 on semantic-only rows)
)
language plpgsql
stable
-- No SECURITY DEFINER: RLS applies to every row this returns.
as $$
declare
  v_dims int := coalesce(vector_dims(p_query_embedding), 0);
begin
  -- pgvector index scans require a fixed dimension; a mismatched embedding
  -- (user swapped EMBEDDING_MODEL mid-flight) must fail loudly, not silently
  -- return unrelated neighbours.
  if v_dims > 0 and v_dims <> 1536 then
    raise exception 'embedding dimension mismatch: got %, expected 1536', v_dims
      using hint = 'Re-embed chunks (scripts/backfill-embeddings.mjs) after changing EMBEDDING_MODEL.';
  end if;

  return query
  with semantic as (
    -- ivfflat cosine scan; RLS filters rows before the index sees them
    select c.id, c.document_id, c.content, c.chunk_index,
           (1 - (c.embedding <=> p_query_embedding))::numeric as sim
    from public.document_chunks c
    where p_query_embedding is not null
      and c.embedding is not null
    order by c.embedding <=> p_query_embedding
    limit greatest(p_candidate_limit, p_match_count)
  ),
  keyword as (
    -- websearch_to_tsquery parses unquoted student text safely (no syntax errors)
    select c.id,
           ts_rank(to_tsvector('english', c.content),
                   websearch_to_tsquery('english', coalesce(p_query_text, '')))::numeric as kw
    from public.document_chunks c
    where p_query_text is not null and length(trim(p_query_text)) > 0
  ),
  -- candidates = union of both legs (RLS applies to each scan independently).
  -- All refs are table-qualified so plpgsql OUT-param names (id, content, …)
  -- are never substituted.
  candidates as (
    select s.id, s.document_id, s.content, s.chunk_index,
           s.sim, 0::numeric as kw, s.sim as fused
    from semantic s
    union all
    select c.id, c.document_id, c.content, c.chunk_index,
           0::numeric as sim, k.kw, k.kw as fused
    from keyword k
    join public.document_chunks c on c.id = k.id
    where not exists (select 1 from semantic s where s.id = k.id)
      and k.kw > 0
  )
  select p.id, p.document_id, p.content, p.chunk_index,
         p.sim as similarity, p.kw as keyword_score
  from candidates p
  order by p.fused desc
  limit greatest(p_match_count, 1);
end;
$$;

grant execute on function public.match_document_chunks(public.vector, text, int, int) to authenticated;

comment on function public.match_document_chunks is $$
Hybrid pgvector + tsvector retrieval for tutor RAG.
Runs under caller RLS (SECURITY INVOKER). p_query_embedding NULL → keyword-only.
Fusion: max(cosine_similarity, ts_rank) per chunk, ordered desc.
$$;
