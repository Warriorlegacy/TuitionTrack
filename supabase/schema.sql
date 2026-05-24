-- =====================================================
-- TuitionTrack + EduPulse AI — Unified Database Schema
-- =====================================================
-- This schema covers:
--   Module A  – TuitionTrack (operational SaaS)
--   Module B  – EduPulse AI (parent-intelligence layer)
-- All statements are idempotent — safe to run multiple times.
-- =====================================================

-- ── Extensions ─────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- ── Custom Enums ───────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('teacher', 'parent', 'student');
  end if;

  if not exists (select 1 from pg_type where typname = 'homework_status') then
    create type public.homework_status as enum ('pending', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'fee_status') then
    create type public.fee_status as enum ('paid', 'unpaid', 'overdue');
  end if;

  if not exists (select 1 from pg_type where typname = 'subscription_plan') then
    create type public.subscription_plan as enum ('free', 'solo', 'pro', 'center', 'white_label');
  end if;

  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum ('active', 'cancelled', 'past_due');
  end if;

  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('draft', 'approved', 'sent', 'failed');
  end if;
end $$;

-- ── Tables — Module A: TuitionTrack ───────────────────────────────────────────

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text not null unique,
  role public.user_role not null default 'teacher',
  plan public.subscription_plan not null default 'free',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class text not null,
  parent_name text not null,
  parent_phone text not null,
  parent_email text,
  student_email text,
  teacher_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date date not null,
  student_id uuid not null references public.students (id) on delete cascade,
  teacher_id uuid not null references public.users (id) on delete cascade,
  status public.homework_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null,
  present boolean not null default true,
  teacher_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (student_id, date)
);

create table if not exists public.fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  amount numeric(10, 2) not null,
  status public.fee_status not null default 'unpaid',
  due_date date not null,
  teacher_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  subject text not null,
  marks numeric(6, 2) not null,
  total numeric(6, 2) not null,
  date date not null,
  teacher_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  teacher_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

-- ── Tables — Module B: EduPulse AI ────────────────────────────────────────────

create table if not exists public.performance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  period_label text not null default to_char(now(), 'YYYY-MM'),
  attendance_pct numeric(5, 2) check (attendance_pct between 0 and 100),
  score_1 numeric(6, 2) check (score_1 between 0 and 100),
  score_2 numeric(6, 2) check (score_2 between 0 and 100),
  score_3 numeric(6, 2) check (score_3 between 0 and 100),
  homework_pct numeric(5, 2) check (homework_pct between 0 and 100),
  tutor_notes text,
  risk_score numeric(5, 2),
  risk_level text check (risk_level in ('low', 'medium', 'high')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (student_id, period_label)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  performance_record_id uuid references public.performance_records (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  content text not null,
  subject text,
  language text not null default 'en',
  status public.report_status not null default 'draft',
  sent_at timestamptz,
  sent_to text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  razorpay_subscription_id text unique,
  razorpay_customer_id text,
  plan public.subscription_plan not null default 'free',
  status public.subscription_status not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, plan)
);

-- ── Helper Functions ───────────────────────────────────────────────────────────

create or replace function public.user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.can_access_student(target_student_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.students s
    where s.id = target_student_id
      and (
        s.teacher_id = auth.uid()
        or lower(coalesce(s.parent_email, '')) = public.user_email()
        or lower(coalesce(s.student_email, '')) = public.user_email()
      )
  )
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.update_risk_level()
returns trigger
language plpgsql
as $$
declare
  attendance_val numeric;
  score_val numeric;
  homework_val numeric;
  weighted_score numeric;
begin
  attendance_val := coalesce(new.attendance_pct, 100);
  score_val := coalesce(
    (coalesce(new.score_1, 0) + coalesce(new.score_2, 0) + coalesce(new.score_3, 0)) / nullif(3, 0),
    100
  );
  homework_val := coalesce(new.homework_pct, 100);

  weighted_score := (100 - attendance_val) * 0.4
    + (100 - score_val)       * 0.4
    + (100 - homework_val)    * 0.2;

  new.risk_score := round(weighted_score, 2);

  if weighted_score > 60 then
    new.risk_level := 'high';
  elsif weighted_score >= 40 then
    new.risk_level := 'medium';
  else
    new.risk_level := 'low';
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- ── assign_user_role RPC ───────────────────────────────────────────────────────

create or replace function public.assign_user_role(target_email text, new_role public.user_role)
returns void
language plpgsql
security definer
as $$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(email) = lower(target_email);

  if target_user_id is null then
    raise exception 'No user found with email: %', target_email;
  end if;

  update public.users
  set role = new_role
  where id = target_user_id;

  if not found then
    insert into public.users (id, email, role)
    values (target_user_id, lower(target_email), new_role)
    on conflict (id) do update set role = new_role;
  end if;

  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  where id = target_user_id;
end;
$$;

-- ── check_report_quota RPC ─────────────────────────────────────────────────────

create or replace function public.check_report_quota(tutor_id uuid, plan public.subscription_plan)
returns boolean
language plpgsql
stable
as $$
begin
  if plan in ('solo', 'pro', 'center', 'white_label') then
    return true;
  end if;

  declare
    monthly_count integer;
  begin
    select count(*)
    into monthly_count
    from public.reports r
    join public.students s on r.student_id = s.id
    where s.teacher_id = tutor_id
      and date_trunc('month', r.created_at) = date_trunc('month', now());

    return monthly_count < 5;
  end;
end;
$$;

-- ── Tables — Module A: TuitionTrack ───────────────────────────────────────────

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text not null unique,
  role public.user_role not null default 'teacher',
  plan public.subscription_plan not null default 'free',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class text not null,
  parent_name text not null,
  parent_phone text not null,
  parent_email text,
  student_email text,
  teacher_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date date not null,
  student_id uuid not null references public.students (id) on delete cascade,
  teacher_id uuid not null references public.users (id) on delete cascade,
  status public.homework_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null,
  present boolean not null default true,
  teacher_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (student_id, date)
);

create table if not exists public.fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  amount numeric(10, 2) not null,
  status public.fee_status not null default 'unpaid',
  due_date date not null,
  teacher_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  subject text not null,
  marks numeric(6, 2) not null,
  total numeric(6, 2) not null,
  date date not null,
  teacher_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  teacher_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

-- ── Tables — Module B: EduPulse AI ────────────────────────────────────────────

create table if not exists public.performance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  period_label text not null default to_char(now(), 'YYYY-MM'),
  attendance_pct numeric(5, 2) check (attendance_pct between 0 and 100),
  score_1 numeric(6, 2) check (score_1 between 0 and 100),
  score_2 numeric(6, 2) check (score_2 between 0 and 100),
  score_3 numeric(6, 2) check (score_3 between 0 and 100),
  homework_pct numeric(5, 2) check (homework_pct between 0 and 100),
  tutor_notes text,
  risk_score numeric(5, 2),
  risk_level text check (risk_level in ('low', 'medium', 'high')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (student_id, period_label)
);

drop trigger if exists performance_records_update_risk on public.performance_records;
create trigger performance_records_update_risk
before insert or update of attendance_pct, score_1, score_2, score_3, homework_pct
on public.performance_records
for each row
execute function public.update_risk_level();

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  performance_record_id uuid references public.performance_records (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  content text not null,
  subject text,
  language text not null default 'en',
  status public.report_status not null default 'draft',
  sent_at timestamptz,
  sent_to text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  razorpay_subscription_id text unique,
  razorpay_customer_id text,
  plan public.subscription_plan not null default 'free',
  status public.subscription_status not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, plan)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_students_teacher_id              on public.students (teacher_id);
create index if not exists idx_students_parent_email            on public.students (lower(parent_email));
create index if not exists idx_students_student_email           on public.students (lower(student_email));
create index if not exists idx_homework_teacher_id              on public.homework (teacher_id);
create index if not exists idx_homework_student_id              on public.homework (student_id);
create index if not exists idx_homework_due_date                on public.homework (due_date);
create index if not exists idx_attendance_teacher_id            on public.attendance (teacher_id);
create index if not exists idx_attendance_student_id            on public.attendance (student_id);
create index if not exists idx_fees_teacher_id                  on public.fees (teacher_id);
create index if not exists idx_fees_student_id                  on public.fees (student_id);
create index if not exists idx_tests_teacher_id                 on public.tests (teacher_id);
create index if not exists idx_tests_student_id                 on public.tests (student_id);
create index if not exists idx_announcements_teacher_id         on public.announcements (teacher_id);

create index if not exists idx_performance_records_student_id    on public.performance_records (student_id);
create index if not exists idx_performance_records_period        on public.performance_records (period_label);
create index if not exists idx_reports_student_id                on public.reports (student_id);
create index if not exists idx_reports_status                    on public.reports (status);
create index if not exists idx_subscriptions_user_id             on public.subscriptions (user_id);
create index if not exists idx_subscriptions_razorpay_id         on public.subscriptions (razorpay_subscription_id);

-- ── Triggers ─────────────────────────────────────────────────────────────────

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row
execute function public.set_updated_at();

drop trigger if exists homework_set_updated_at on public.homework;
create trigger homework_set_updated_at
before update on public.homework
for each row
execute function public.set_updated_at();

drop trigger if exists fees_set_updated_at on public.fees;
create trigger fees_set_updated_at
before update on public.fees
for each row
execute function public.set_updated_at();

drop trigger if exists performance_records_set_updated_at on public.performance_records;
create trigger performance_records_set_updated_at
before update on public.performance_records
for each row
execute function public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.users                  enable row level security;
alter table public.students               enable row level security;
alter table public.homework               enable row level security;
alter table public.attendance             enable row level security;
alter table public.fees                   enable row level security;
alter table public.tests                  enable row level security;
alter table public.announcements          enable row level security;
alter table public.performance_records    enable row level security;
alter table public.reports                enable row level security;
alter table public.subscriptions          enable row level security;

-- Users RLS

drop policy if exists "users select self" on public.users;
create policy "users select self"
on public.users
for select
using (auth.uid() = id);

drop policy if exists "users insert self" on public.users;
create policy "users insert self"
on public.users
for insert
with check (auth.uid() = id);

drop policy if exists "users update self" on public.users;
create policy "users update self"
on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Students RLS

drop policy if exists "students teacher full access" on public.students;
create policy "students teacher full access"
on public.students
for all
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "students parent student select" on public.students;
create policy "students parent student select"
on public.students
for select
to authenticated
using (
  lower(coalesce(parent_email, '')) = public.user_email()
  or lower(coalesce(student_email, '')) = public.user_email()
);

-- Homework RLS

drop policy if exists "homework teacher full access" on public.homework;
create policy "homework teacher full access"
on public.homework
for all
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "homework parent student select" on public.homework;
create policy "homework parent student select"
on public.homework
for select
to authenticated
using (public.can_access_student(student_id));

-- Attendance RLS

drop policy if exists "attendance teacher full access" on public.attendance;
create policy "attendance teacher full access"
on public.attendance
for all
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "attendance parent select" on public.attendance;
create policy "attendance parent select"
on public.attendance
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = attendance.student_id
      and lower(coalesce(s.parent_email, '')) = public.user_email()
  )
);

-- Fees RLS

drop policy if exists "fees teacher full access" on public.fees;
create policy "fees teacher full access"
on public.fees
for all
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "fees parent select" on public.fees;
create policy "fees parent select"
on public.fees
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = fees.student_id
      and lower(coalesce(s.parent_email, '')) = public.user_email()
  )
);

-- Tests RLS

drop policy if exists "tests teacher full access" on public.tests;
create policy "tests teacher full access"
on public.tests
for all
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "tests parent student select" on public.tests;
create policy "tests parent student select"
on public.tests
for select
to authenticated
using (public.can_access_student(student_id));

-- Announcements RLS

drop policy if exists "announcements teacher full access" on public.announcements;
create policy "announcements teacher full access"
on public.announcements
for all
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "announcements linked select" on public.announcements;
create policy "announcements linked select"
on public.announcements
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.teacher_id = announcements.teacher_id
      and (
        lower(coalesce(s.parent_email, '')) = public.user_email()
        or lower(coalesce(s.student_email, '')) = public.user_email()
      )
  )
);

-- performance_records RLS

drop policy if exists "perf_records teacher full access" on public.performance_records;
create policy "perf_records teacher full access"
on public.performance_records
for all
to authenticated
using (
  student_id in (
    select id from public.students where teacher_id = auth.uid()
  )
)
with check (
  student_id in (
    select id from public.students where teacher_id = auth.uid()
  )
);

drop policy if exists "perf_records parent select" on public.performance_records;
create policy "perf_records parent select"
on public.performance_records
for select
to authenticated
using (
  student_id in (
    select id from public.students
    where lower(coalesce(parent_email, '')) = public.user_email()
  )
);

-- reports RLS

drop policy if exists "reports teacher full access" on public.reports;
create policy "reports teacher full access"
on public.reports
for all
to authenticated
using (
  student_id in (
    select id from public.students where teacher_id = auth.uid()
  )
)
with check (
  student_id in (
    select id from public.students where teacher_id = auth.uid()
  )
);

drop policy if exists "reports parent select" on public.reports;
create policy "reports parent select"
on public.reports
for select
to authenticated
using (
  student_id in (
    select id from public.students
    where lower(coalesce(parent_email, '')) = public.user_email()
  )
);

-- subscriptions RLS

drop policy if exists "subscriptions user own" on public.subscriptions;
create policy "subscriptions user own"
on public.subscriptions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ── Realtime Publication ──────────────────────────────────────────────────────

alter publication supabase_realtime add table public.students;
alter publication supabase_realtime add table public.homework;
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.fees;
alter publication supabase_realtime add table public.tests;
alter publication supabase_realtime add table public.announcements;

alter publication supabase_realtime add table public.performance_records;
alter publication supabase_realtime add table public.reports;
