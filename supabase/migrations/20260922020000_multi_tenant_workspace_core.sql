-- ============================================================================
-- Migration: 20260922020000_multi_tenant_workspace_core.sql
-- Description: Multi-tenant Teacher Workspace, Workspace Codes, Memberships,
--              RBAC, Workspace-scoped Homework with Teacher-only Deletion,
--              and Safe Audit Logging.
-- ============================================================================

-- 1. Helper function: Generate a friendly, unambiguous workspace code (e.g., TT-7K4X9P)
create or replace function public.generate_workspace_code()
returns text
language plpgsql
as $$
declare
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- No 0, O, 1, I to avoid confusion
  result text := 'TT-';
  i integer;
  candidate text;
  exists_already boolean;
begin
  loop
    result := 'TT-';
    for i in 1..6 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    end loop;
    
    -- Check uniqueness against workspaces table if it exists
    begin
      select exists(select 1 from public.workspaces where code = result) into exists_already;
    exception when undefined_table then
      exists_already := false;
    end;
    
    if not exists_already then
      return result;
    end if;
  end loop;
end;
$$;

-- 2. Create public.workspaces table
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  owner_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'archived', 'suspended')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_code_unique unique (code)
);

-- Case-insensitive index on code for fast normalized lookup
create index if not exists idx_workspaces_code_lower on public.workspaces (lower(code));
create index if not exists idx_workspaces_owner_id on public.workspaces (owner_id);

-- 3. Create public.workspace_members table
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'teacher', 'student', 'parent')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_members_user_unique unique (workspace_id, user_id)
);

create index if not exists idx_workspace_members_workspace on public.workspace_members (workspace_id);
create index if not exists idx_workspace_members_user on public.workspace_members (user_id);
create index if not exists idx_workspace_members_role on public.workspace_members (workspace_id, role);

-- 4. Create public.workspace_audit_logs table
create table if not exists public.workspace_audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_audit_logs_workspace on public.workspace_audit_logs (workspace_id, created_at desc);

-- 5. Add columns to existing domain tables
alter table public.students
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
create index if not exists idx_students_workspace_id on public.students (workspace_id);

alter table public.homework
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists deleted_at timestamptz;
create index if not exists idx_homework_workspace_id on public.homework (workspace_id);
create index if not exists idx_homework_deleted_at on public.homework (deleted_at);

alter table public.assignments
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists deleted_at timestamptz;
create index if not exists idx_assignments_workspace_id on public.assignments (workspace_id);
create index if not exists idx_assignments_deleted_at on public.assignments (deleted_at);

alter table public.guardian_student_relationships
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
create index if not exists idx_guardian_student_rel_workspace_id on public.guardian_student_relationships (workspace_id);

alter table public.portal_access_grants
  drop constraint if exists portal_access_grants_workspace_id_fkey;

alter table public.portal_access_grants
  add column if not exists workspace_id uuid;

alter table public.portal_access_grants
  add constraint portal_access_grants_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;

create index if not exists idx_portal_access_grants_workspace_id on public.portal_access_grants (workspace_id);

-- 6. Seed / Backfill workspaces for existing teachers
do $$
declare
  t record;
  ws_id uuid;
  ws_code text;
begin
  for t in (
    select distinct u.id, u.name, u.email
    from public.users u
    where u.role = 'teacher'
       or exists (select 1 from public.students s where s.teacher_id = u.id)
       or exists (select 1 from public.assignments a where a.teacher_id = u.id)
  ) loop
    -- Check if workspace already exists for this owner
    select id into ws_id from public.workspaces where owner_id = t.id limit 1;
    
    if ws_id is null then
      ws_code := public.generate_workspace_code();
      insert into public.workspaces (id, name, code, owner_id, status)
      values (
        gen_random_uuid(),
        coalesce(nullif(trim(t.name), ''), 'Teacher') || '''s Classroom',
        ws_code,
        t.id,
        'active'
      )
      returning id into ws_id;
    end if;

    -- Ensure owner has 'teacher' / 'owner' member record
    insert into public.workspace_members (workspace_id, user_id, role, status)
    values (ws_id, t.id, 'teacher', 'active')
    on conflict (workspace_id, user_id) do update set role = 'teacher', status = 'active';

    -- Backfill students belonging to this teacher
    update public.students
    set workspace_id = ws_id
    where teacher_id = t.id and workspace_id is null;

    -- Backfill assignments belonging to this teacher
    update public.assignments
    set workspace_id = ws_id
    where teacher_id = t.id and workspace_id is null;

    -- Backfill homework belonging to this teacher
    update public.homework
    set workspace_id = ws_id
    where teacher_id = t.id and workspace_id is null;

  end loop;

  -- Backfill relationships and grants with their student's workspace_id
  update public.guardian_student_relationships g
  set workspace_id = s.workspace_id
  from public.students s
  where s.id = g.student_id and g.workspace_id is null and s.workspace_id is not null;

  update public.portal_access_grants p
  set workspace_id = s.workspace_id
  from public.students s
  where s.id = p.student_id and p.workspace_id is null and s.workspace_id is not null;

  -- Backfill student users into workspace_members
  insert into public.workspace_members (workspace_id, user_id, role, status)
  select distinct s.workspace_id, u.id, 'student', 'active'
  from public.students s
  join public.users u on lower(u.email) = lower(s.student_email)
  where s.workspace_id is not null
  on conflict (workspace_id, user_id) do nothing;

  -- Also check portal_access_grants for student users
  insert into public.workspace_members (workspace_id, user_id, role, status)
  select distinct p.workspace_id, p.user_id, 'student', 'active'
  from public.portal_access_grants p
  where p.workspace_id is not null and p.portal_type = 'student' and p.status = 'active'
  on conflict (workspace_id, user_id) do nothing;

  -- Backfill parent users into workspace_members
  insert into public.workspace_members (workspace_id, user_id, role, status)
  select distinct s.workspace_id, u.id, 'parent', 'active'
  from public.students s
  join public.users u on lower(u.email) = lower(s.parent_email)
  where s.workspace_id is not null
  on conflict (workspace_id, user_id) do nothing;

  -- Also check guardian relationships
  insert into public.workspace_members (workspace_id, user_id, role, status)
  select distinct g.workspace_id, g.guardian_user_id, 'parent', 'active'
  from public.guardian_student_relationships g
  where g.workspace_id is not null and g.guardian_user_id is not null
  on conflict (workspace_id, user_id) do nothing;

  -- Also check portal_access_grants for parent users
  insert into public.workspace_members (workspace_id, user_id, role, status)
  select distinct p.workspace_id, p.user_id, 'parent', 'active'
  from public.portal_access_grants p
  where p.workspace_id is not null and p.portal_type = 'parent' and p.status = 'active'
  on conflict (workspace_id, user_id) do nothing;

end;
$$;

-- 7. Helper functions for RLS & Access
create or replace function public.is_workspace_teacher(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ws_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'teacher')
  ) or exists (
    select 1
    from public.workspaces w
    where w.id = ws_id
      and w.owner_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = ws_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  ) or exists (
    select 1
    from public.workspaces w
    where w.id = ws_id
      and w.owner_id = auth.uid()
  );
$$;

-- 8. Enable Row Level Security
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_audit_logs enable row level security;

-- Policies for public.workspaces
drop policy if exists "workspaces_read" on public.workspaces;
create policy "workspaces_read"
on public.workspaces
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_workspace_member(id)
);

drop policy if exists "workspaces_modify" on public.workspaces;
create policy "workspaces_modify"
on public.workspaces
for all
to authenticated
using (
  owner_id = auth.uid()
  or public.is_workspace_teacher(id)
)
with check (
  owner_id = auth.uid()
  or public.is_workspace_teacher(id)
);

-- Policies for public.workspace_members
drop policy if exists "workspace_members_read" on public.workspace_members;
create policy "workspace_members_read"
on public.workspace_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_workspace_teacher(workspace_id)
);

drop policy if exists "workspace_members_modify" on public.workspace_members;
create policy "workspace_members_modify"
on public.workspace_members
for all
to authenticated
using (
  public.is_workspace_teacher(workspace_id)
)
with check (
  public.is_workspace_teacher(workspace_id)
);

-- Policies for public.workspace_audit_logs
drop policy if exists "workspace_audit_logs_read" on public.workspace_audit_logs;
create policy "workspace_audit_logs_read"
on public.workspace_audit_logs
for select
to authenticated
using (
  public.is_workspace_teacher(workspace_id)
);

drop policy if exists "workspace_audit_logs_insert" on public.workspace_audit_logs;
create policy "workspace_audit_logs_insert"
on public.workspace_audit_logs
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
);

-- 9. Homework & Assignments Deletion RLS Protection
-- Teachers can delete or update; students/parents cannot delete homework or assignments!

-- Assignments Delete Policy
drop policy if exists "assignments_delete_teacher_only" on public.assignments;
create policy "assignments_delete_teacher_only"
on public.assignments
for delete
to authenticated
using (
  public.is_workspace_teacher(workspace_id)
  or teacher_id = auth.uid()
);

-- Homework Delete Policy
drop policy if exists "homework_delete_teacher_only" on public.homework;
create policy "homework_delete_teacher_only"
on public.homework
for delete
to authenticated
using (
  public.is_workspace_teacher(workspace_id)
  or teacher_id = auth.uid()
);

-- Homework Update Policy (guarding deletion and updates)
drop policy if exists "homework_update_teacher_only" on public.homework;
create policy "homework_update_teacher_only"
on public.homework
for update
to authenticated
using (
  public.is_workspace_teacher(workspace_id)
  or teacher_id = auth.uid()
)
with check (
  public.is_workspace_teacher(workspace_id)
  or teacher_id = auth.uid()
);

-- Students/Homework reading respects workspace membership and soft-delete
drop policy if exists "homework_read_workspace" on public.homework;
create policy "homework_read_workspace"
on public.homework
for select
to authenticated
using (
  (deleted_at is null or public.is_workspace_teacher(workspace_id) or teacher_id = auth.uid())
  and (
    public.is_workspace_teacher(workspace_id)
    or teacher_id = auth.uid()
    or public.can_access_student(student_id)
  )
);
