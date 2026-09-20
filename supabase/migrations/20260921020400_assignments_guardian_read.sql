-- Parent/student read access to assignments, rebuilt on the relationship model.
--
-- GAP FOUND DURING IMPLEMENTATION
-- ------------------------------------------------------------------
-- The existing `assignments_student_parent_read` policy was:
--
--   exists (select 1 from students s
--           where (lower(coalesce(s.student_email,'')) = user_email()
--                  or lower(coalesce(s.parent_email,'')) = user_email())
--             and s.class = assignments.class_level::text)
--
-- Two problems, both in the same class as the exploit removed in
-- 20260921000000 for students/fees/homework/attendance:
--
--   1. It keys off EMAIL, not the guardian relationship. A properly invited
--      guardian whose email differs from `students.parent_email` sees NOTHING,
--      which silently breaks the parent progress view.
--   2. It is over-broad in the other direction: matching a class grants every
--      assignment at that class level, including ones targeted at other
--      children in the same class.
--
-- Replacement: access is granted per-student, via the same
-- `can_access_student()` gate every other parent-facing table uses, and only
-- when the assignment actually targets that student (or is class-wide).
--
-- `can_access_student()` is SECURITY DEFINER and reads only students /
-- guardian_student_relationships / users, so calling it from a policy on
-- `assignments` cannot recurse.
--
-- Teachers are unaffected: `assignments_teacher_manage` (FOR ALL,
-- teacher_id = auth.uid()) is left untouched.

drop policy if exists assignments_student_parent_read on public.assignments;

drop policy if exists assignments_guardian_read on public.assignments;
create policy assignments_guardian_read
  on public.assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where public.can_access_student(s.id)
        and s.class = assignments.class_level::text
        and (
          -- class-wide assignment: no explicit target list
          assignments.target_student_ids is null
          or jsonb_array_length(assignments.target_student_ids) = 0
          -- or this child is explicitly targeted
          or assignments.target_student_ids @> jsonb_build_array(s.id::text)
        )
    )
  );

comment on policy assignments_guardian_read on public.assignments is
  'A guardian (or the student) may read an assignment only if it targets a student they have a verified relationship with. Replaces the old email-matching policy.';
