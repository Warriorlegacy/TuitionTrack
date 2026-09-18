-- ==============================================================================
-- TuitionTrack Migration: AI Homework, Assignment Submission & Curriculum Engine
-- Covers: Curriculum truth, official NCERT/CBSE sources, question blueprints,
--         student-specific variant homework, handwritten submission & AI rubrics.
-- All statements idempotent.
-- ==============================================================================

-- ── 1. Custom Types & Enums ──────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'assignment_mode') then
    create type public.assignment_mode as enum ('class', 'variant', 'adaptive');
  end if;
  if not exists (select 1 from pg_type where typname = 'assignment_preset') then
    create type public.assignment_preset as enum ('quick', 'daily', 'chapter', 'revision', 'exam', 'remedial', 'challenge', 'project');
  end if;
  if not exists (select 1 from pg_type where typname = 'submission_mode') then
    create type public.submission_mode as enum ('online', 'handwritten', 'mixed');
  end if;
  if not exists (select 1 from pg_type where typname = 'assignment_lifecycle') then
    create type public.assignment_lifecycle as enum (
      'draft', 'generating', 'generated', 'teacher_review', 'published',
      'started', 'in_progress', 'submitted', 'ai_evaluated', 'teacher_reviewed',
      'graded', 'returned', 'archived'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'curriculum_status') then
    create type public.curriculum_status as enum ('draft', 'active', 'superseded', 'archived');
  end if;
end $$;

-- ── 2. Official Curriculum & NCERT Registry ──────────────────────────────────
create table if not exists public.curriculum_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  authority text not null,
  base_url text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null default '2026-27',
  board text not null default 'CBSE',
  class_level int not null check (class_level between 1 and 12),
  subject text not null,
  version text not null default '1.0',
  source_authority text not null default 'CBSE/NCERT',
  source_url text,
  document_url text,
  status public.curriculum_status not null default 'active',
  content_hash text,
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_curriculum_version_lookup 
  on public.curriculum_versions (academic_year, board, class_level, subject);

create table if not exists public.curriculum_textbooks (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid references public.curriculum_versions(id) on delete cascade,
  class_level int not null check (class_level between 1 and 12),
  subject text not null,
  title text not null,
  book_code text,
  language text not null default 'en',
  official_url text,
  cover_image text,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_curriculum_textbooks_class 
  on public.curriculum_textbooks (class_level, subject);

create table if not exists public.curriculum_chapters (
  id uuid primary key default gen_random_uuid(),
  textbook_id uuid references public.curriculum_textbooks(id) on delete cascade,
  class_level int not null check (class_level between 1 and 12),
  subject text not null,
  chapter_number int not null,
  title text not null,
  slug text not null unique,
  syllabus_node_id uuid references public.syllabus_nodes(id) on delete set null,
  learning_objectives jsonb not null default '[]'::jsonb,
  competencies jsonb not null default '[]'::jsonb,
  ncert_pdf_url text,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_curriculum_chapters_slug 
  on public.curriculum_chapters (slug);

-- ── 3. Chapter Knowledge: FAQs & Mind Maps ───────────────────────────────────
create table if not exists public.chapter_faqs (
  id uuid primary key default gen_random_uuid(),
  chapter_slug text not null,
  category text not null check (category in ('Basics', 'Conceptual', 'Formula', 'Examples', 'Exam', 'Common Mistakes', 'Application')),
  question text not null,
  answer text not null,
  source_reference text,
  confidence numeric(4,3) not null default 0.95,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_chapter_faqs_slug_cat 
  on public.chapter_faqs (chapter_slug, category);

create table if not exists public.chapter_mindmaps (
  id uuid primary key default gen_random_uuid(),
  chapter_slug text not null unique,
  graph_data jsonb not null default '{}'::jsonb,
  svg_content text,
  updated_at timestamptz not null default timezone('utc', now())
);

-- ── 4. Question Blueprints & Variation Engine ────────────────────────────────
create table if not exists public.question_blueprints (
  id uuid primary key default gen_random_uuid(),
  chapter_slug text not null,
  concept text not null,
  learning_objective text not null,
  competency text,
  question_type public.question_type not null default 'mcq',
  difficulty int not null default 3 check (difficulty between 1 and 5),
  cognitive_level text not null default 'apply',
  marks numeric(6,2) not null default 1,
  expected_time_sec int not null default 120,
  variation_dimensions jsonb not null default '{}'::jsonb,
  template_stem text not null,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_question_blueprints_slug 
  on public.question_blueprints (chapter_slug, difficulty);

-- ── 5. Rich Assignments System ──────────────────────────────────────────────
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  academic_year text not null default '2026-27',
  class_level int not null,
  subject text not null,
  chapter_slug text not null,
  preset public.assignment_preset not null default 'chapter',
  mode public.assignment_mode not null default 'variant',
  submission_mode public.submission_mode not null default 'mixed',
  lifecycle public.assignment_lifecycle not null default 'published',
  due_date timestamptz not null,
  time_limit_min int,
  total_marks numeric(8,2) not null default 10,
  passing_marks numeric(8,2) not null default 4,
  allow_late boolean not null default true,
  allow_resubmission boolean not null default false,
  ai_grading_enabled boolean not null default true,
  target_student_ids jsonb not null default '[]'::jsonb,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_assignments_teacher 
  on public.assignments (teacher_id, created_at desc);
create index if not exists idx_assignments_class_subject 
  on public.assignments (class_level, subject, chapter_slug);

create table if not exists public.assignment_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  blueprint_id uuid references public.question_blueprints(id) on delete set null,
  question_id uuid references public.questions(id) on delete set null,
  position int not null,
  student_id uuid references public.students(id) on delete cascade,
  stem text not null,
  qtype public.question_type not null default 'mcq',
  marks numeric(6,2) not null default 1,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  solution_steps jsonb not null default '[]'::jsonb,
  rubric jsonb not null default '{}'::jsonb,
  fingerprint text not null,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_assignment_questions_assign 
  on public.assignment_questions (assignment_id, position);
create index if not exists idx_assignment_questions_student 
  on public.assignment_questions (assignment_id, student_id);

-- ── 6. Assignment Submissions & Handwritten Evaluations ──────────────────────
create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attempt_number int not null default 1,
  status public.assignment_lifecycle not null default 'submitted',
  answers jsonb not null default '{}'::jsonb,
  handwritten_files jsonb not null default '[]'::jsonb,
  extracted_ocr_text text,
  score numeric(8,2) not null default 0,
  total_marks numeric(8,2) not null default 0,
  percentage numeric(5,2) not null default 0,
  ai_confidence numeric(4,3) default 0.9,
  ai_evaluation_notes text,
  mistake_breakdown jsonb not null default '[]'::jsonb,
  teacher_feedback text,
  teacher_overridden boolean not null default false,
  is_late boolean not null default false,
  submitted_at timestamptz not null default timezone('utc', now()),
  graded_at timestamptz,
  unique (assignment_id, student_id, attempt_number)
);
create index if not exists idx_submissions_student 
  on public.assignment_submissions (student_id, submitted_at desc);
create index if not exists idx_submissions_assignment 
  on public.assignment_submissions (assignment_id, status);

create table if not exists public.remedial_homework_triggers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  chapter_slug text not null,
  trigger_concept text not null,
  mastery_level numeric(5,2) not null,
  remedial_assignment_id uuid references public.assignments(id) on delete set null,
  status text not null default 'suggested' check (status in ('suggested', 'assigned', 'completed')),
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_remedial_student 
  on public.remedial_homework_triggers (student_id, status);

-- ── 7. Enable Row-Level Security ─────────────────────────────────────────────
alter table public.curriculum_sources enable row level security;
alter table public.curriculum_versions enable row level security;
alter table public.curriculum_textbooks enable row level security;
alter table public.curriculum_chapters enable row level security;
alter table public.chapter_faqs enable row level security;
alter table public.chapter_mindmaps enable row level security;
alter table public.question_blueprints enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_questions enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.remedial_homework_triggers enable row level security;

-- ── 8. RLS Policies ─────────────────────────────────────────────────────────

-- Curriculum & Chapter Knowledge: read access to all authenticated users
create policy "curriculum_sources_read" on public.curriculum_sources
  for select using (auth.role() = 'authenticated');
create policy "curriculum_sources_manage" on public.curriculum_sources
  for all using (public.current_user_role() = 'teacher');

create policy "curriculum_versions_read" on public.curriculum_versions
  for select using (auth.role() = 'authenticated');
create policy "curriculum_versions_manage" on public.curriculum_versions
  for all using (public.current_user_role() = 'teacher');

create policy "curriculum_textbooks_read" on public.curriculum_textbooks
  for select using (auth.role() = 'authenticated');
create policy "curriculum_textbooks_manage" on public.curriculum_textbooks
  for all using (public.current_user_role() = 'teacher');

create policy "curriculum_chapters_read" on public.curriculum_chapters
  for select using (auth.role() = 'authenticated');
create policy "curriculum_chapters_manage" on public.curriculum_chapters
  for all using (public.current_user_role() = 'teacher');

create policy "chapter_faqs_read" on public.chapter_faqs
  for select using (auth.role() = 'authenticated');
create policy "chapter_faqs_manage" on public.chapter_faqs
  for all using (public.current_user_role() = 'teacher');

create policy "chapter_mindmaps_read" on public.chapter_mindmaps
  for select using (auth.role() = 'authenticated');
create policy "chapter_mindmaps_manage" on public.chapter_mindmaps
  for all using (public.current_user_role() = 'teacher');

create policy "question_blueprints_read" on public.question_blueprints
  for select using (auth.role() = 'authenticated');
create policy "question_blueprints_manage" on public.question_blueprints
  for all using (public.current_user_role() = 'teacher');

-- Assignments: teachers manage their own; students/parents view accessible
create policy "assignments_teacher_manage" on public.assignments
  for all using (teacher_id = auth.uid());

create policy "assignments_student_parent_read" on public.assignments
  for select using (
    exists (
      select 1 from public.students s
      where (
        lower(coalesce(s.student_email, '')) = public.user_email()
        or lower(coalesce(s.parent_email, '')) = public.user_email()
      )
      and s.class = cast(assignments.class_level as text)
    )
  );

-- Assignment Questions: accessible if assignment is accessible
create policy "assignment_questions_read" on public.assignment_questions
  for select using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_questions.assignment_id
      and (
        a.teacher_id = auth.uid()
        or exists (
          select 1 from public.students s
          where (
            lower(coalesce(s.student_email, '')) = public.user_email()
            or lower(coalesce(s.parent_email, '')) = public.user_email()
          )
          and s.class = cast(a.class_level as text)
        )
      )
    )
  );

create policy "assignment_questions_manage" on public.assignment_questions
  for all using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_questions.assignment_id
      and a.teacher_id = auth.uid()
    )
  );

-- Assignment Submissions: students create & view own; teachers view for their students
create policy "submissions_student_create_read" on public.assignment_submissions
  for all using (
    public.can_access_student(student_id)
  );

create policy "submissions_teacher_manage" on public.assignment_submissions
  for all using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_submissions.assignment_id
      and a.teacher_id = auth.uid()
    )
  );

-- Remedial triggers: student access or teacher manage
create policy "remedial_read" on public.remedial_homework_triggers
  for select using (public.can_access_student(student_id));
create policy "remedial_manage" on public.remedial_homework_triggers
  for all using (
    exists (
      select 1 from public.students s
      where s.id = remedial_homework_triggers.student_id
      and s.teacher_id = auth.uid()
    )
  );
