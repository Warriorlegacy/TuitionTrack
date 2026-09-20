-- Hardens can_access_student() and user_email() against unauthenticated / empty email leaks.
--
-- VULNERABILITY FOUND DURING RLS VERIFICATION:
-- If an unauthenticated caller queried a table with can_access_student(), user_email()
-- returned '' (empty string). Any student row with student_email NULL or '' evaluated
-- lower(coalesce(s.student_email, '')) = '' which matched TRUE.
--
-- FIX:
-- 1. auth.uid() is not null guard at the top of can_access_student().
-- 2. user_email() returns NULL if unauthenticated or email is empty string.
-- 3. student self-access requires authenticated student_email match with non-empty email.

create or replace function public.user_email()
returns text
language sql
stable
as $$
  select nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
$$;

create or replace function public.can_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      public.is_student_staff(target_student_id)
      or public.has_verified_guardian_link(target_student_id)
      or exists (
        select 1
        from public.students s
        where s.id = target_student_id
          and s.student_email is not null
          and s.student_email <> ''
          and lower(s.student_email) = public.user_email()
      )
    )
$$;

comment on function public.can_access_student(uuid) is
  'Parent and staff access control gate. Requires authenticated session. Prevents anonymous access to students with null or empty student_email.';
