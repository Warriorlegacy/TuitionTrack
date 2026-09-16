-- Phase 0: orgs + batches + guardian links (additive, legacy-safe).
-- Preserves single-teacher model: students.teacher_id stays; students.org_id
-- is nullable and backfilled (one org per teacher). All statements idempotent.
-- Also: document_chunks embedding ivfflat index, ai_budgets, audit/model_usage hardening.
-- Apply: supabase db push (or paste in SQL editor).

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ── Tables ───────────────────────────────────────────────────────
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.org_members (
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner','tutor','parent','student')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (org_id, user_id)
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null,
  teacher_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.batch_enrollments (
  batch_id uuid not null references public.batches (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (batch_id, student_id)
);

create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  guardian_user_id uuid references public.users (id) on delete set null,
  guardian_email text,
  relationship text not null default 'parent',
  verified_consent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

-- per-student AI spend guard: monthly cap + per-student kill switch
create table if not exists public.ai_budgets (
  student_id uuid primary key references public.students (id) on delete cascade,
  monthly_cap_usd numeric(10,2) not null default 5 check (monthly_cap_usd >= 0),
  kill_switch boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

-- legacy bridge: nullable org on students (teacher_id stays source of truth until cutover)
alter table public.students add column if not exists org_id uuid references public.orgs (id) on delete set null;

-- ── Indexes ──────────────────────────────────────────────────────
create index if not exists idx_org_members_user on public.org_members (user_id);
create index if not exists idx_batches_org on public.batches (org_id);
create index if not exists idx_enrollments_student on public.batch_enrollments (student_id);
create index if not exists idx_guardian_student on public.guardian_links (student_id);
create index if not exists idx_guardian_email on public.guardian_links (lower(guardian_email));
create index if not exists idx_students_org on public.students (org_id);
create index if not exists idx_usage_student_created on public.model_usage (student_id, created_at desc);
create index if not exists idx_audit_actor on public.audit_logs (actor_id, created_at desc);

-- embeddings: ivfflat for semantic rank; NULL-safe (index skips nulls, queries must too)
-- ponytail: lists=100 is fine <1M rows; rebuild with higher lists past that.
create index if not exists idx_chunks_embedding
  on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ── Grants (policies alone don't grant) ──────────────────────────
grant select, insert, update, delete on public.orgs to authenticated;
grant select, insert, update, delete on public.org_members to authenticated;
grant select, insert, update, delete on public.batches to authenticated;
grant select, insert, update, delete on public.batch_enrollments to authenticated;
grant select, insert, update, delete on public.guardian_links to authenticated;
grant select, insert, update, delete on public.ai_budgets to authenticated;

-- ── Org helpers (SECURITY DEFINER so policies never recurse) ─────
create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.org_members m
  where m.org_id = target_org and m.user_id = auth.uid()
) $$;

create or replace function public.is_org_staff(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.org_members m
  where m.org_id = target_org and m.user_id = auth.uid() and m.role in ('owner','tutor')
) $$;

create or replace function public.is_org_owner(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.org_members m
  where m.org_id = target_org and m.user_id = auth.uid() and m.role = 'owner'
) $$;

create or replace function public.org_is_empty(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select not exists (
  select 1 from public.org_members m where m.org_id = target_org
) $$;

-- verified guardian (parent/student login linked to a student, consent timestamped)
create or replace function public.has_verified_guardian_link(sid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.guardian_links g
  where g.student_id = sid and g.verified_consent_at is not null
    and (g.guardian_user_id = auth.uid()
      or lower(coalesce(g.guardian_email, '')) = public.user_email())
) $$;

-- staff for a student: legacy teacher OR tutor/owner of the student's org OR of any enrolled batch
create or replace function public.is_student_staff(sid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.students s
  where s.id = sid and (
    s.teacher_id = auth.uid()
    or (s.org_id is not null and public.is_org_staff(s.org_id))
    or exists (
      select 1 from public.batch_enrollments be
      join public.batches b on b.id = be.batch_id
      where be.student_id = sid and public.is_org_staff(b.org_id)
    )
  )
) $$;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_staff(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.org_is_empty(uuid) to authenticated;
grant execute on function public.has_verified_guardian_link(uuid) to authenticated;
grant execute on function public.is_student_staff(uuid) to authenticated;

-- widen student access: legacy (teacher/email) + guardian link + org/batch staff
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
  or public.has_verified_guardian_link(target_student_id)
  or public.is_student_staff(target_student_id)
$$;

-- ── Backfill (idempotent; re-runnable via scripts/backfill-orgs.sql) ──
do $$
declare
  r record; v_org uuid; v_batch uuid;
begin
  for r in select id, coalesce(nullif(name, ''), email, 'Tutor') as tname
           from public.users where role = 'teacher' loop
    select id into v_org from public.orgs where created_by = r.id limit 1;
    if v_org is null then
      insert into public.orgs (name, created_by)
      values (r.tname || '''s Tuition', r.id) returning id into v_org;
    end if;
    insert into public.org_members (org_id, user_id, role)
    values (v_org, r.id, 'owner') on conflict do nothing;
    update public.students set org_id = v_org
    where teacher_id = r.id and org_id is null;
    select id into v_batch from public.batches
    where org_id = v_org and name = 'Default batch' limit 1;
    if v_batch is null then
      insert into public.batches (org_id, name, teacher_id)
      values (v_org, 'Default batch', r.id) returning id into v_batch;
    end if;
    insert into public.batch_enrollments (batch_id, student_id)
    select v_batch, s.id from public.students s where s.org_id = v_org
    on conflict do nothing;
    -- unverified email links preserve legacy parent access until consent is captured
    insert into public.guardian_links (student_id, guardian_email, relationship)
    select s.id, lower(s.parent_email), 'parent'
    from public.students s where s.org_id = v_org and s.parent_email is not null
      and not exists (
        select 1 from public.guardian_links g
        where g.student_id = s.id
          and lower(coalesce(g.guardian_email, '')) = lower(s.parent_email)
      );
  end loop;
end $$;

-- ── RLS: new tables ──────────────────────────────────────────────
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.batches enable row level security;
alter table public.batch_enrollments enable row level security;
alter table public.guardian_links enable row level security;
alter table public.ai_budgets enable row level security;

-- orgs
drop policy if exists "orgs member select" on public.orgs;
create policy "orgs member select" on public.orgs for select to authenticated
  using (public.is_org_member(id));
drop policy if exists "orgs create" on public.orgs;
create policy "orgs create" on public.orgs for insert to authenticated with check (true);
drop policy if exists "orgs owner update" on public.orgs;
create policy "orgs owner update" on public.orgs for update to authenticated
  using (public.is_org_owner(id)) with check (public.is_org_owner(id));
drop policy if exists "orgs owner delete" on public.orgs;
create policy "orgs owner delete" on public.orgs for delete to authenticated
  using (public.is_org_owner(id));

-- org_members (policies use definer helpers only — no self-recursion)
drop policy if exists "members select" on public.org_members;
create policy "members select" on public.org_members for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists "members owner write" on public.org_members;
create policy "members owner write" on public.org_members for all to authenticated
  using (public.is_org_owner(org_id) or public.org_is_empty(org_id))
  with check (public.is_org_owner(org_id) or public.org_is_empty(org_id));

-- batches
drop policy if exists "batches member select" on public.batches;
create policy "batches member select" on public.batches for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists "batches staff write" on public.batches;
create policy "batches staff write" on public.batches for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

-- batch_enrollments
drop policy if exists "enrollments member select" on public.batch_enrollments;
create policy "enrollments member select" on public.batch_enrollments for select to authenticated
  using (exists (
    select 1 from public.batches b
    where b.id = batch_enrollments.batch_id and public.is_org_member(b.org_id)
  ));
drop policy if exists "enrollments staff write" on public.batch_enrollments;
create policy "enrollments staff write" on public.batch_enrollments for all to authenticated
  using (exists (
    select 1 from public.batches b
    where b.id = batch_enrollments.batch_id and public.is_org_staff(b.org_id)
  ))
  with check (exists (
    select 1 from public.batches b
    where b.id = batch_enrollments.batch_id and public.is_org_staff(b.org_id)
  ));

-- guardian_links (never call can_access_student here — it reads this table)
drop policy if exists "guardian select" on public.guardian_links;
create policy "guardian select" on public.guardian_links for select to authenticated
  using (guardian_user_id = auth.uid() or public.is_student_staff(student_id));
drop policy if exists "guardian staff write" on public.guardian_links;
create policy "guardian staff write" on public.guardian_links for all to authenticated
  using (public.is_student_staff(student_id))
  with check (public.is_student_staff(student_id));

-- ai_budgets (readable by anyone with student access; writable by staff)
drop policy if exists "budgets access select" on public.ai_budgets;
create policy "budgets access select" on public.ai_budgets for select to authenticated
  using (public.can_access_student(student_id));
drop policy if exists "budgets staff write" on public.ai_budgets;
create policy "budgets staff write" on public.ai_budgets for all to authenticated
  using (public.is_student_staff(student_id))
  with check (public.is_student_staff(student_id));

-- ── RLS: widen students to org/guardian (legacy teacher_id untouched) ──
drop policy if exists "students teacher full access" on public.students;
create policy "students teacher full access"
on public.students for all to authenticated
using (public.is_student_staff(id))
with check (public.is_student_staff(id));

drop policy if exists "students parent student select" on public.students;
create policy "students parent student select"
on public.students for select to authenticated
using (
  lower(coalesce(parent_email, '')) = public.user_email()
  or lower(coalesce(student_email, '')) = public.user_email()
  or public.has_verified_guardian_link(id)
);

-- ── RLS: audit_logs actor-scoped (no spoofing other actors) ──────
drop policy if exists "audit insert" on public.audit_logs;
create policy "audit insert" on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid());

-- ── updated_at triggers ──────────────────────────────────────────
drop trigger if exists orgs_set_updated_at on public.orgs;
create trigger orgs_set_updated_at before update on public.orgs
  for each row execute function public.set_updated_at();
drop trigger if exists ai_budgets_set_updated_at on public.ai_budgets;
create trigger ai_budgets_set_updated_at before update on public.ai_budgets
  for each row execute function public.set_updated_at();
