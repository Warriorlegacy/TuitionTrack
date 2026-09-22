-- TuitionTrack Migration: Align assignment_questions RLS with portal access grants & can_access_student()
-- 
-- PROBLEM:
-- The original `assignment_questions_read` policy used naive email matching:
--   lower(coalesce(s.student_email, '')) = user_email()
-- which bypassed `can_access_student()` and ignored `portal_access_grants`.
-- Consequently, students logging in via portal links or whose student_email
-- was not set could not read assignment questions under RLS (returned []).
--
-- REPLACEMENT:
-- Question read access is tied to assignment access and can_access_student(s.id).
-- Base questions (student_id is null) and student-specific variants (student_id = s.id)
-- are accessible to the student.

drop policy if exists "assignment_questions_read" on public.assignment_questions;

create policy "assignment_questions_read"
  on public.assignment_questions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_questions.assignment_id
      and (
        a.teacher_id = auth.uid()
        or exists (
          select 1 from public.students s
          where public.can_access_student(s.id)
            and s.class = a.class_level::text
            and (
              a.target_student_ids is null
              or jsonb_array_length(a.target_student_ids) = 0
              or a.target_student_ids @> jsonb_build_array(s.id::text)
            )
            and (
              assignment_questions.student_id is null
              or assignment_questions.student_id = s.id
            )
        )
      )
    )
  );

comment on policy "assignment_questions_read" on public.assignment_questions is
  'Teachers can read all questions for their assignments. Students and guardians can read questions for assignments targeting them via can_access_student().';
