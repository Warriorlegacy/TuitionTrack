-- ==============================================================================
-- TuitionTrack Migration: Teacher-manual grading workflow
-- - assignments.question_format ('mixed' | 'mcq') for AI Homework Studio
-- - assignment_submissions: grading_status + per-question teacher review store
-- - ai_grading_enabled default -> false (AI must not finalize grades)
-- All statements idempotent. Never destructive; history preserved.
-- ==============================================================================

-- ── 1. assignments.question_format ──────────────────────────────────────────
alter table public.assignments
  add column if not exists question_format text not null default 'mixed';

-- ai_grading_enabled: new rows default to OFF. Existing rows untouched.
do $$
begin
  alter table public.assignments alter column ai_grading_enabled set default false;
exception when others then null;
end $$;

-- ── 2. assignment_submissions manual-review columns ─────────────────────────
alter table public.assignment_submissions
  add column if not exists grading_status text not null default 'pending';
alter table public.assignment_submissions
  add column if not exists teacher_marks jsonb not null default '{}'::jsonb;
alter table public.assignment_submissions
  add column if not exists question_feedback jsonb not null default '{}'::jsonb;
alter table public.assignment_submissions
  add column if not exists reviewed_questions jsonb not null default '[]'::jsonb;
alter table public.assignment_submissions
  add column if not exists grading_method text not null default 'teacher_manual';
alter table public.assignment_submissions
  add column if not exists finalized_at timestamptz;

-- Backfill legacy auto-graded rows so reports can distinguish them.
-- History is preserved; nothing is re-graded or deleted.
update public.assignment_submissions
  set grading_method = 'ai_auto_legacy', grading_status = 'completed'
  where status = 'ai_evaluated' and grading_method = 'teacher_manual';

update public.assignment_submissions
  set grading_status = 'completed'
  where status in ('graded', 'teacher_reviewed', 'returned') and grading_status = 'pending';

update public.assignment_submissions
  set grading_status = 'in_review'
  where status = 'submitted' and grading_status = 'pending' and teacher_marks != '{}'::jsonb;

create index if not exists idx_submissions_grading_status
  on public.assignment_submissions (assignment_id, grading_status);
