-- Weekly sync RPCs (blueprint #30 parent communication, #55 API design, #63 security).
--
-- Why this exists: /api/cron/monday-sync aggregated its weekly data by POSTing SQL
-- to https://api.supabase.com/v1/projects/{ref}/database/query with the
-- service_role/secret key as a Bearer token. That endpoint is the Supabase
-- *Management* API and requires a Personal Access Token (sbp_…), so every run
-- 401'd. The route then read `.length` off an error object, took the
-- `if (records.length > 0)` branch as false, and still returned
-- `{ success: true }` — i.e. the cron looked healthy while sending nothing.
--
-- These functions do the aggregation in-database and are read over PostgREST
-- with the secret key, so no Management API and no PAT are needed.

-- ── High-risk tutor alerts ────────────────────────────────────────────────
create or replace function public.weekly_high_risk_students()
returns table (
  student_id uuid,
  risk_level text,
  risk_score numeric,
  attendance_pct numeric,
  homework_pct numeric,
  student_name text,
  student_class text,
  teacher_id uuid,
  teacher_email text,
  teacher_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.student_id,
    pr.risk_level,
    pr.risk_score,
    pr.attendance_pct,
    pr.homework_pct,
    s.name,
    s.class,
    u.id,
    u.email,
    u.name
  from public.performance_records pr
  join public.students s on s.id = pr.student_id
  join public.users u on u.id = s.teacher_id
  where pr.risk_level = 'high'
    and pr.created_at >= (now() - interval '7 days');
$$;

-- ── Weekly parent digests ─────────────────────────────────────────────────
create or replace function public.weekly_parent_digests()
returns table (
  student_id uuid,
  student_name text,
  parent_email text,
  parent_name text,
  teacher_name text,
  classes_total int,
  classes_attended int,
  hw_total int,
  hw_completed int,
  test_scores json
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.parent_email,
    s.parent_name,
    u.name,
    (select count(*)::int from public.attendance a
      where a.student_id = s.id and a.date >= (now() - interval '7 days')),
    (select count(*)::int from public.attendance a
      where a.student_id = s.id and a.date >= (now() - interval '7 days') and a.present = true),
    (select count(*)::int from public.homework h
      where h.student_id = s.id and h.due_date >= (now() - interval '7 days')),
    (select count(*)::int from public.homework h
      where h.student_id = s.id and h.due_date >= (now() - interval '7 days') and h.status = 'completed'),
    (select json_agg(t) from (
      select subject, marks, total from public.tests
      where student_id = s.id and date >= (now() - interval '7 days')
    ) t)
  from public.students s
  join public.users u on u.id = s.teacher_id
  where s.parent_email is not null and s.parent_email <> '';
$$;

-- Both functions bypass RLS by design (the cron reads across every tenant), so
-- execution is restricted to the service role only — never anon/authenticated.
revoke all on function public.weekly_high_risk_students() from public, anon, authenticated;
revoke all on function public.weekly_parent_digests() from public, anon, authenticated;
grant execute on function public.weekly_high_risk_students() to service_role;
grant execute on function public.weekly_parent_digests() to service_role;
