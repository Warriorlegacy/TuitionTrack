-- ── Custom Enums for Module B ──────────────────────────────────────────────
do $$
begin
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

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_performance_records_student_id    on public.performance_records (student_id);
create index if not exists idx_performance_records_period        on public.performance_records (period_label);
create index if not exists idx_reports_student_id                on public.reports (student_id);
create index if not exists idx_reports_status                    on public.reports (status);
create index if not exists idx_subscriptions_user_id             on public.subscriptions (user_id);
create index if not exists idx_subscriptions_razorpay_id         on public.subscriptions (razorpay_subscription_id);

-- ── Triggers ─────────────────────────────────────────────────────────────────

drop trigger if exists performance_records_set_updated_at on public.performance_records;
create trigger performance_records_set_updated_at
before update on public.performance_records
for each row
execute function public.set_updated_at();

drop trigger if exists performance_records_update_risk on public.performance_records;
create trigger performance_records_update_risk
before insert or update of attendance_pct, score_1, score_2, score_3, homework_pct
on public.performance_records
for each row
execute function public.update_risk_level();

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.performance_records    enable row level security;
alter table public.reports                enable row level security;
alter table public.subscriptions          enable row level security;

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

-- ── Realtime Publication ──────────────────────────────────────

