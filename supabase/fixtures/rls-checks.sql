-- RLS review checklist for the MVP-1 slice (run as postgres owner in SQL editor).
-- RUN ORDER (manual, staging): 1) supabase/migrations/20260914000000_ai_learning_loop.sql
--   2) supabase/fixtures/mvp1-slice.sql  3) THIS file top-to-bottom (§1, §2, §4, §5).
--   §3/§6/§7 are curl/app-level probes against a running dev server (see commands inline).
-- 1. Inventory: every new table must have RLS enabled + ≥1 policy.
select c.relname as table,
  c.relrowsecurity as rls_enabled,
  count(p.polname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relname in ('syllabus_nodes','documents','document_chunks','questions','question_options',
    'question_solutions','assessments','assessment_items','attempts','attempt_responses',
    'learning_events','concept_mastery','mistakes','spaced_items','review_events',
    'study_plans','plan_tasks','conversations','messages','tool_calls',
    'model_usage','ai_evaluations','audit_logs','consent_records')
group by 1, 2 order by 1;
-- EXPECT: 24 rows, rls_enabled = true, policies >= 1 (syllabus/questions have 2+).

-- 2. Cross-tenant leak probe (owner view): no chunk reachable outside its doc owner.
-- EXPECT: 0 rows = a chunk whose document's student belongs to a different teacher.
select ch.id as leaked_chunk
from public.document_chunks ch
join public.documents d on d.id = ch.document_id
join public.students s on s.id = d.student_id
where d.teacher_id <> s.teacher_id
limit 5;

-- 3. Manual app-level test (two logins required):
--    a. Teacher A creates doc for student A → student B session GET /api/ai/tutor
--       with source_only=true must NOT cite teacher A's doc (expect "not found in your materials").
--    b. Parent of A can GET /api/students/<A>/mistakes; parent of B gets 403.
--    c. Signed-out curl to any /api/ai/* or /api/students/* must return 401.

-- ── Phase 0 (orgs/batches/guardians): MERGE BLOCKERS ──────────────
-- 4. Inventory: 6 Phase-0 tables must have RLS + ≥1 policy.
select c.relname as table,
  c.relrowsecurity as rls_enabled,
  count(p.polname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relname in ('orgs','org_members','batches','batch_enrollments',
    'guardian_links','ai_budgets')
group by 1, 2 order by 1;
-- EXPECT: 6 rows, rls_enabled = true, policies >= 1.

-- 5. Cross-org leak probe (owner view): no enrollment may join a student
--    whose org differs from the batch's org. EXPECT: 0 rows.
select be.batch_id, be.student_id as leaked_enrollment
from public.batch_enrollments be
join public.batches b on b.id = be.batch_id
join public.students s on s.id = be.student_id
where s.org_id is distinct from b.org_id
limit 5;

-- 6. Cross-org guardian probe: no verified link may point at a guardian who
--    is not a member of the student's org. EXPECT: 0 rows.
select g.id as leaked_guardian_link
from public.guardian_links g
join public.students s on s.id = g.student_id
where g.verified_consent_at is not null
  and g.guardian_user_id is not null
  and not exists (
    select 1 from public.org_members m
    where m.org_id = s.org_id and m.user_id = g.guardian_user_id
  )
limit 5;

-- 7. Orphan-student probe: every student must belong to exactly one org
--    after backfill. EXPECT: 0 rows (run post-backfill).
select s.id as orphan_student
from public.students s
where s.org_id is null
limit 5;

-- 8. Manual app-level tests (two logins required — tutor A in org A, tutor B in org B):
--    a. B GET /api/students/<A-student-id>/mastery → 403; B POST
--       /api/plans/generate {student_id: <A>} → 403. (Tutor A cannot read org B.)
--    b. Unverified guardian GET /api/students/<kid>/mistakes → 403; after
--       verified_consent_at is set → 200.
--    c. POST /api/plans/generate as signed-out user → 401.
--    d. AI_KILL_SWITCH=1 → POST /api/plans/generate → 429 "temporarily disabled".

-- 4. Cross-org leak probe: tutor route scoping predicate, teacher B's view.
--    Mirrors src/app/api/ai/tutor/route.ts §documents query: a teacher must see
--    ZERO chunks of another teacher's private student docs. Run once per teacher
--    pair by replacing the two ids (defaults: two earliest distinct teachers).
--    EXPECT: 0 rows for every other_teacher.
with teachers as (
  select id, row_number() over (order by created_at) as rn
  from public.users where role = 'teacher'
), me as (select id as me from teachers where rn = 1),
   other_teacher as (select id as them from teachers where rn = 2)
select ch.id as leaked_chunk
from public.document_chunks ch
join public.documents d on d.id = ch.document_id
cross join me cross join other_teacher
where d.teacher_id = other_teacher.them          -- victim org's docs
  and (d.student_id = any (select s.id from public.students s where s.teacher_id = me.me)
       or (d.student_id is null and d.teacher_id = me.me));  -- ...visible to MY tutor scope?
-- EXPECT: 0 rows. Any row = tutor for my students could cite/cross-read their docs.

-- 5. source_only no-chunks case (deterministic, uses mvp1-slice.sql fixtures).
--    A nonsense term matches nothing → tutor route returns NOT_FOUND_IN_SOURCES.
--    EXPECT: 0 rows (proves the empty-ranked path is reachable, not a dead branch).
select ch.id
from public.document_chunks ch
where ch.document_id = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0'
  and ch.content ilike '%zzzqqqxjkl%';

-- 6. Signed-out 401 probe (no session cookie; run against dev server).
--    EXPECT: HTTP 401 on every line, never 200/500.
--    curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/ai/tutor -H "Content-Type: application/json" -d '{"student_id":"00000000-0000-0000-0000-000000000000","message":"hi","mode":"socratic"}'
--    curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/ai/quiz -H "Content-Type: application/json" -d '{"student_id":"00000000-0000-0000-0000-000000000000","count":2}'
--    curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/ai/flashcards -H "Content-Type: application/json" -d '{"student_id":"00000000-0000-0000-0000-000000000000","count":2}'
--    curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/students/00000000-0000-0000-0000-000000000000/mistakes

-- 7. Wrong-parent 403 probe (two parent sessions required; $A = own student, $B = other's).
--    EXPECT: 200 for own student, 403 for the other — never 200 with rows, never 500.
--    curl -s -w "\n%{http_code}\n" $BASE/api/students/$A/mistakes -b parentA.cookies
--    curl -s -w "\n%{http_code}\n" $BASE/api/students/$B/mistakes -b parentA.cookies
