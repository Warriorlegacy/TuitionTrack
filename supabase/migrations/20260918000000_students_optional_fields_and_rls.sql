-- Migration: Make parent fields optional on students & fix RLS policy for insert
-- Date: 2026-09-18
-- Author: TuitionTrack

-- 1. Make parent_name and parent_phone optional (drop NOT NULL constraint and set empty string default)
alter table public.students alter column parent_name drop not null;
alter table public.students alter column parent_name set default '';

alter table public.students alter column parent_phone drop not null;
alter table public.students alter column parent_phone set default '';

-- 2. Fix students teacher full access RLS policy
-- On INSERT, with check (public.is_student_staff(id)) failed because the new row does not exist in public.students yet.
-- Allow insert/update when teacher_id = auth.uid() or caller is staff of student's org.
drop policy if exists "students teacher full access" on public.students;
create policy "students teacher full access"
on public.students for all to authenticated
using (
  teacher_id = auth.uid()
  or public.is_student_staff(id)
)
with check (
  teacher_id = auth.uid()
  or (org_id is not null and public.is_org_staff(org_id))
  or public.is_student_staff(id)
);
