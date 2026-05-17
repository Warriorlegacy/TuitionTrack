create extension if not exists pgcrypto;

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
end $$;

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

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text not null unique,
  role public.user_role not null default 'teacher',
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

create index if not exists idx_students_teacher_id on public.students (teacher_id);
create index if not exists idx_students_parent_email on public.students (lower(parent_email));
create index if not exists idx_students_student_email on public.students (lower(student_email));
create index if not exists idx_homework_teacher_id on public.homework (teacher_id);
create index if not exists idx_homework_student_id on public.homework (student_id);
create index if not exists idx_homework_due_date on public.homework (due_date);
create index if not exists idx_attendance_teacher_id on public.attendance (teacher_id);
create index if not exists idx_attendance_student_id on public.attendance (student_id);
create index if not exists idx_fees_teacher_id on public.fees (teacher_id);
create index if not exists idx_fees_student_id on public.fees (student_id);
create index if not exists idx_tests_teacher_id on public.tests (teacher_id);
create index if not exists idx_tests_student_id on public.tests (student_id);
create index if not exists idx_announcements_teacher_id on public.announcements (teacher_id);

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

alter table public.users enable row level security;
alter table public.students enable row level security;
alter table public.homework enable row level security;
alter table public.attendance enable row level security;
alter table public.fees enable row level security;
alter table public.tests enable row level security;
alter table public.announcements enable row level security;

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

drop policy if exists "students teacher full access" on public.students;
create policy "students teacher full access"
on public.students
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "students parent student select" on public.students;
create policy "students parent student select"
on public.students
for select
using (
  lower(coalesce(parent_email, '')) = public.user_email()
  or lower(coalesce(student_email, '')) = public.user_email()
);

drop policy if exists "homework teacher full access" on public.homework;
create policy "homework teacher full access"
on public.homework
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "homework parent student select" on public.homework;
create policy "homework parent student select"
on public.homework
for select
using (public.can_access_student(student_id));

drop policy if exists "attendance teacher full access" on public.attendance;
create policy "attendance teacher full access"
on public.attendance
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "attendance parent select" on public.attendance;
create policy "attendance parent select"
on public.attendance
for select
using (
  exists (
    select 1
    from public.students s
    where s.id = attendance.student_id
      and lower(coalesce(s.parent_email, '')) = public.user_email()
  )
);

drop policy if exists "fees teacher full access" on public.fees;
create policy "fees teacher full access"
on public.fees
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "fees parent select" on public.fees;
create policy "fees parent select"
on public.fees
for select
using (
  exists (
    select 1
    from public.students s
    where s.id = fees.student_id
      and lower(coalesce(s.parent_email, '')) = public.user_email()
  )
);

drop policy if exists "tests teacher full access" on public.tests;
create policy "tests teacher full access"
on public.tests
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "tests parent student select" on public.tests;
create policy "tests parent student select"
on public.tests
for select
using (public.can_access_student(student_id));

drop policy if exists "announcements teacher full access" on public.announcements;
create policy "announcements teacher full access"
on public.announcements
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "announcements linked select" on public.announcements;
create policy "announcements linked select"
on public.announcements
for select
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

alter publication supabase_realtime add table public.students;
alter publication supabase_realtime add table public.homework;
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.fees;
alter publication supabase_realtime add table public.tests;
alter publication supabase_realtime add table public.announcements;
