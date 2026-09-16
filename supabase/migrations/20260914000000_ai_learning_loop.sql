-- TuitionTrack AI MVP-1: closed learning loop (vertical slice)
-- Preserves ops layer (students/homework/attendance/fees/tests/announcements).
-- New: curriculum + content + question engine + attempts/events + mastery +
--      mistakes + spaced repetition + plans + conversations + governance.
-- All statements idempotent. RLS pattern reuses public.can_access_student().
-- Apply: supabase db push (or SQL editor). Requires pgvector for embeddings.

create extension if not exists pgcrypto;
create extension if not exists vector;
create extension if not exists pg_trgm;

-- ── Enums ──────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'syllabus_level') then
    create type public.syllabus_level as enum ('exam','subject','unit','chapter','topic','concept','skill');
  end if;
  if not exists (select 1 from pg_type where typname = 'tutor_mode') then
    create type public.tutor_mode as enum ('socratic','exam_coach','concept_teacher','doubt_solver','mistake_coach','viva','revision','homework','teacher_clone','parent_safe');
  end if;
  if not exists (select 1 from pg_type where typname = 'question_type') then
    create type public.question_type as enum ('mcq','numeric','short','long','assertion_reason','true_false','fill_blank','match','case_study','diagram');
  end if;
  if not exists (select 1 from pg_type where typname = 'mistake_category') then
    create type public.mistake_category as enum ('concept','formula','calc','misread','sign','unit','guess','time','careless','strategy','memory','presentation');
  end if;
  if not exists (select 1 from pg_type where typname = 'mistake_status') then
    create type public.mistake_status as enum ('open','practicing','fixed','relapsed','mastered');
  end if;
  if not exists (select 1 from pg_type where typname = 'assessment_status') then
    create type public.assessment_status as enum ('draft','published','archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'attempt_status') then
    create type public.attempt_status as enum ('started','submitted','graded');
  end if;
  if not exists (select 1 from pg_type where typname = 'plan_task_status') then
    create type public.plan_task_status as enum ('pending','done','skipped','rescheduled');
  end if;
  if not exists (select 1 from pg_type where typname = 'spaced_state') then
    create type public.spaced_state as enum ('new','learning','due','relearning','stable','mastered','at_risk');
  end if;
  if not exists (select 1 from pg_type where typname = 'content_status') then
    create type public.content_status as enum ('uploaded','processing','ready','failed','quarantined');
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_tier') then
    create type public.ai_tier as enum ('A','B','C','deterministic');
  end if;
end $$;

-- ── Curriculum ─────────────────────────────────────────────────────
create table if not exists public.syllabus_nodes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.users (id) on delete cascade,
  parent_id uuid references public.syllabus_nodes (id) on delete cascade,
  level public.syllabus_level not null,
  title text not null,
  code text,
  exam text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_syllabus_parent on public.syllabus_nodes (parent_id);
create index if not exists idx_syllabus_level on public.syllabus_nodes (level);
create index if not exists idx_syllabus_teacher on public.syllabus_nodes (teacher_id);

-- ── Sources / RAG ──────────────────────────────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.users (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  title text not null,
  source_type text not null default 'pdf',
  storage_path text,
  status public.content_status not null default 'uploaded',
  quality_score numeric(5,2),
  language text not null default 'en',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_documents_teacher on public.documents (teacher_id);
create index if not exists idx_documents_student on public.documents (student_id);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  page_no int,
  section text,
  token_count int,
  embedding public.vector(1536),
  concept_id uuid references public.syllabus_nodes (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (document_id, chunk_index)
);
create index if not exists idx_chunks_document on public.document_chunks (document_id);
-- ponytail: ivfflat index created concurrently post-backfill when rows > 10k; skip for slice.

-- ── Questions ──────────────────────────────────────────────────────
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.users (id) on delete cascade,
  syllabus_node_id uuid references public.syllabus_nodes (id) on delete set null,
  stem text not null,
  qtype public.question_type not null default 'mcq',
  difficulty int not null default 3 check (difficulty between 1 and 5),
  marks numeric(6,2) not null default 1,
  negative_marks numeric(6,2) not null default 0,
  time_sec int not null default 60,
  bloom text,
  language text not null default 'en',
  source_document_id uuid references public.documents (id) on delete set null,
  generated_by text not null default 'teacher',
  model text,
  prompt_version text,
  quality_score numeric(5,2),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high')),
  status text not null default 'published' check (status in ('draft','published','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_questions_teacher on public.questions (teacher_id);
create index if not exists idx_questions_concept on public.questions (syllabus_node_id);
create index if not exists idx_questions_stem_trgm on public.questions using gin (stem gin_trgm_ops);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label text not null,
  text text not null,
  is_correct boolean not null default false,
  rationale text,
  unique (question_id, label)
);

create table if not exists public.question_solutions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  steps jsonb not null default '[]'::jsonb,
  final_answer text not null,
  verified_by text not null default 'none' check (verified_by in ('none','deterministic','teacher')),
  verified_at timestamptz,
  unique (question_id)
);

-- ── Assessments / attempts / events ─────────────────────────────────
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  exam text,
  subject text,
  total_marks numeric(8,2) not null default 0,
  duration_sec int,
  negative_marking boolean not null default false,
  status public.assessment_status not null default 'draft',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  position int not null,
  marks numeric(6,2) not null default 1,
  unique (assessment_id, position),
  unique (assessment_id, question_id)
);
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.attempt_status not null default 'started',
  score numeric(8,2) not null default 0,
  total numeric(8,2) not null default 0,
  started_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_attempts_student on public.attempts (student_id);
create index if not exists idx_attempts_assessment on public.attempts (assessment_id);

create table if not exists public.attempt_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  assessment_item_id uuid not null references public.assessment_items (id) on delete restrict,
  question_id uuid not null references public.questions (id) on delete restrict,
  student_answer jsonb,
  is_correct boolean,
  marks_awarded numeric(6,2) not null default 0,
  time_ms int,
  confidence int check (confidence is null or (confidence between 1 and 5)),
  hints_used int not null default 0,
  unique (attempt_id, assessment_item_id)
);
create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_events_student_type on public.learning_events (student_id, event_type, created_at desc);

-- ── Mastery / mistakes / spaced / plans ─────────────────────────────
create table if not exists public.concept_mastery (
  student_id uuid not null references public.students (id) on delete cascade,
  concept_id uuid not null references public.syllabus_nodes (id) on delete cascade,
  mastery numeric(5,4) not null default 0.3 check (mastery between 0 and 1),
  attempt_count int not null default 0,
  correct_count int not null default 0,
  streak int not null default 0,
  last_practiced_at timestamptz,
  next_review_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (student_id, concept_id)
);
create table if not exists public.mistakes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  question_id uuid references public.questions (id) on delete set null,
  attempt_response_id uuid references public.attempt_responses (id) on delete set null,
  concept_id uuid references public.syllabus_nodes (id) on delete set null,
  category public.mistake_category not null default 'concept',
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  root_cause text,
  student_answer jsonb,
  correct_answer text,
  explanation text,
  status public.mistake_status not null default 'open',
  recurrence_count int not null default 1,
  next_review_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_mistakes_student_status on public.mistakes (student_id, status);

create table if not exists public.spaced_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  concept_id uuid references public.syllabus_nodes (id) on delete set null,
  question_id uuid references public.questions (id) on delete set null,
  front text not null,
  back text not null,
  stability numeric(8,3) not null default 1.0,
  difficulty numeric(5,3) not null default 0.3 check (difficulty between 0 and 1),
  due_at timestamptz not null default timezone('utc', now()),
  state public.spaced_state not null default 'new',
  lapse_count int not null default 0,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_spaced_due on public.spaced_items (student_id, due_at);
create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  spaced_item_id uuid not null references public.spaced_items (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  grade int not null check (grade between 1 and 4),
  response_ms int,
  scheduled_days numeric(6,2),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  teacher_id uuid references public.users (id) on delete set null,
  title text not null default 'Study plan',
  start_date date not null default current_date,
  end_date date,
  target_score numeric(5,2),
  status text not null default 'active' check (status in ('active','paused','completed')),
  version int not null default 1,
  generated_by text not null default 'deterministic',
  created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null,
  concept_id uuid references public.syllabus_nodes (id) on delete set null,
  task_type text not null default 'practice',
  estimated_min int not null default 15,
  priority numeric(6,3) not null default 0,
  status public.plan_task_status not null default 'pending',
  source text
);
create index if not exists idx_plan_tasks_student_date on public.plan_tasks (student_id, date, priority desc);

-- ── Conversations / AI governance ───────────────────────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  mode public.tutor_mode not null default 'socratic',
  title text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  model text,
  prompt_version text,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,6),
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_messages_conversation on public.messages (conversation_id, created_at);
create table if not exists public.tool_calls (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  tool_name text not null,
  args jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.model_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  student_id uuid references public.students (id) on delete set null,
  tier public.ai_tier not null,
  model text not null,
  endpoint text not null,
  prompt_version text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10,6) not null default 0,
  latency_ms int,
  cached boolean not null default false,
  status text not null default 'ok',
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_usage_user_created on public.model_usage (user_id, created_at desc);
create table if not exists public.ai_evaluations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt_version text not null,
  model text not null,
  score jsonb not null default '{}'::jsonb,
  passed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  granted_by text not null,
  purpose text not null,
  granted boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

-- ── updated_at triggers (reuse public.set_updated_at) ──────────────
drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at before update on public.documents for each row execute function public.set_updated_at();
drop trigger if exists mistakes_set_updated_at on public.mistakes;
create trigger mistakes_set_updated_at before update on public.mistakes for each row execute function public.set_updated_at();
drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at before update on public.conversations for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────
-- Helper: student-scoped tables use can_access_student(student_id).
-- Teacher-owned tables use teacher_id = auth.uid().

alter table public.syllabus_nodes enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_solutions enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_items enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_responses enable row level security;
alter table public.learning_events enable row level security;
alter table public.concept_mastery enable row level security;
alter table public.mistakes enable row level security;
alter table public.spaced_items enable row level security;
alter table public.review_events enable row level security;
alter table public.study_plans enable row level security;
alter table public.plan_tasks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tool_calls enable row level security;
alter table public.model_usage enable row level security;
alter table public.ai_evaluations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.consent_records enable row level security;

-- syllabus: global curriculum read, teachers manage own rows
drop policy if exists "syllabus read all" on public.syllabus_nodes;
create policy "syllabus read all" on public.syllabus_nodes for select to authenticated using (true);
drop policy if exists "syllabus teacher write" on public.syllabus_nodes;
create policy "syllabus teacher write" on public.syllabus_nodes for all to authenticated
  using (teacher_id = auth.uid() or teacher_id is null and false)
  with check (teacher_id = auth.uid());

-- documents
drop policy if exists "documents teacher full" on public.documents;
create policy "documents teacher full" on public.documents for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
drop policy if exists "documents linked select" on public.documents;
create policy "documents linked select" on public.documents for select to authenticated
  using (student_id is not null and public.can_access_student(student_id));

-- chunks via parent document
drop policy if exists "chunks teacher full" on public.document_chunks;
create policy "chunks teacher full" on public.document_chunks for all to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id and d.teacher_id = auth.uid()))
  with check (exists (select 1 from public.documents d where d.id = document_id and d.teacher_id = auth.uid()));
drop policy if exists "chunks linked select" on public.document_chunks;
create policy "chunks linked select" on public.document_chunks for select to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id
    and (d.teacher_id = auth.uid() or (d.student_id is not null and public.can_access_student(d.student_id)))));

-- questions (+children via question)
drop policy if exists "questions teacher full" on public.questions;
create policy "questions teacher full" on public.questions for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
drop policy if exists "questions linked select" on public.questions;
create policy "questions linked select" on public.questions for select to authenticated
  using (status = 'published');
-- ponytail: published-only keeps slice simple; tighten to batch/enrollment when batches land.

drop policy if exists "qoptions teacher full" on public.question_options;
create policy "qoptions teacher full" on public.question_options for all to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id and q.teacher_id = auth.uid()))
  with check (exists (select 1 from public.questions q where q.id = question_id and q.teacher_id = auth.uid()));
drop policy if exists "qoptions read" on public.question_options;
create policy "qoptions read" on public.question_options for select to authenticated using (true);

drop policy if exists "qsolutions teacher full" on public.question_solutions;
create policy "qsolutions teacher full" on public.question_solutions for all to authenticated
  using (exists (select 1 from public.questions q where q.id = question_id and q.teacher_id = auth.uid()))
  with check (exists (select 1 from public.questions q where q.id = question_id and q.teacher_id = auth.uid()));
drop policy if exists "qsolutions read" on public.question_solutions;
create policy "qsolutions read" on public.question_solutions for select to authenticated using (true);

-- assessments / items
drop policy if exists "assessments teacher full" on public.assessments;
create policy "assessments teacher full" on public.assessments for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
drop policy if exists "assessments read published" on public.assessments;
create policy "assessments read published" on public.assessments for select to authenticated
  using (status = 'published');

drop policy if exists "aitems teacher full" on public.assessment_items;
create policy "aitems teacher full" on public.assessment_items for all to authenticated
  using (exists (select 1 from public.assessments a where a.id = assessment_id and a.teacher_id = auth.uid()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));
drop policy if exists "aitems read" on public.assessment_items;
create policy "aitems read" on public.assessment_items for select to authenticated using (true);

-- generic student-scoped helper pattern applied per table below:
-- teacher full via student's teacher; linked select via can_access_student.

drop policy if exists "attempts teacher full" on public.attempts;
create policy "attempts teacher full" on public.attempts for all to authenticated
  using (exists (select 1 from public.students s where s.id = student_id and s.teacher_id = auth.uid()))
  with check (exists (select 1 from public.students s where s.id = student_id and s.teacher_id = auth.uid()));
drop policy if exists "attempts linked rw" on public.attempts;
create policy "attempts linked rw" on public.attempts for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists "responses rw" on public.attempt_responses;
create policy "responses rw" on public.attempt_responses for all to authenticated
  using (exists (select 1 from public.attempts a where a.id = attempt_id and public.can_access_student(a.student_id)))
  with check (exists (select 1 from public.attempts a where a.id = attempt_id and public.can_access_student(a.student_id)));

drop policy if exists "events rw" on public.learning_events;
create policy "events rw" on public.learning_events for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists "mastery rw" on public.concept_mastery;
create policy "mastery rw" on public.concept_mastery for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists "mistakes rw" on public.mistakes;
create policy "mistakes rw" on public.mistakes for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists "spaced rw" on public.spaced_items;
create policy "spaced rw" on public.spaced_items for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists "reviews rw" on public.review_events;
create policy "reviews rw" on public.review_events for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists "plans rw" on public.study_plans;
create policy "plans rw" on public.study_plans for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists "plantasks rw" on public.plan_tasks;
create policy "plantasks rw" on public.plan_tasks for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists "conversations rw" on public.conversations;
create policy "conversations rw" on public.conversations for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists "messages rw" on public.messages;
create policy "messages rw" on public.messages for all to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and public.can_access_student(c.student_id)))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and public.can_access_student(c.student_id)));

drop policy if exists "toolcalls rw" on public.tool_calls;
create policy "toolcalls rw" on public.tool_calls for all to authenticated
  using (exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and public.can_access_student(c.student_id)))
  with check (exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and public.can_access_student(c.student_id)));

-- governance: users see own usage; teachers see usage for their students
drop policy if exists "usage own+teacher" on public.model_usage;
create policy "usage own+teacher" on public.model_usage for select to authenticated
  using (user_id = auth.uid() or (student_id is not null and public.can_access_student(student_id)));
drop policy if exists "usage insert" on public.model_usage;
create policy "usage insert" on public.model_usage for insert to authenticated with check (true);

drop policy if exists "evals read" on public.ai_evaluations;
create policy "evals read" on public.ai_evaluations for select to authenticated using (true);
drop policy if exists "evals teacher insert" on public.ai_evaluations;
create policy "evals teacher insert" on public.ai_evaluations for insert to authenticated with check (true);

drop policy if exists "audit own" on public.audit_logs;
create policy "audit own" on public.audit_logs for select to authenticated using (actor_id = auth.uid());
drop policy if exists "audit insert" on public.audit_logs;
create policy "audit insert" on public.audit_logs for insert to authenticated with check (true);

drop policy if exists "consent rw" on public.consent_records;
create policy "consent rw" on public.consent_records for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));
