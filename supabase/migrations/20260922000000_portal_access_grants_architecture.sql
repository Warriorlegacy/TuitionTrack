-- ============================================================================
-- Portal Access Architecture: Unified Parent + Student Portal Grants
-- ============================================================================
-- Implements single-auth, portal-scoped access grants for TuitionTrack.
-- Gives teachers direct control to generate, copy, regenerate, and revoke
-- Parent Portal and Student Portal links with opaque, hashed tokens.
-- Integrates with Supabase Auth (Google & Email) and enforces strict RLS.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Tables
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.portal_access_grants (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.users (id) on delete cascade,
  teacher_id         uuid references public.users (id) on delete cascade,
  workspace_id       uuid references public.orgs (id) on delete set null,
  student_id         uuid not null references public.students (id) on delete cascade,
  portal_type        text not null check (portal_type in ('parent', 'student')),
  status             text not null check (status in ('pending', 'active', 'revoked', 'expired')) default 'pending',
  token_hash         text unique not null,
  target_email       text,
  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now()),
  expires_at         timestamptz not null default (timezone('utc', now()) + interval '30 days'),
  last_used_at       timestamptz,
  revoked_at         timestamptz,
  created_by         uuid references public.users (id) on delete set null
);

create index if not exists idx_portal_access_grants_lookup
  on public.portal_access_grants (student_id, portal_type, status);

create index if not exists idx_portal_access_grants_user
  on public.portal_access_grants (user_id, status);

create index if not exists idx_portal_access_grants_token_hash
  on public.portal_access_grants (token_hash);

create table if not exists public.portal_access_events (
  id                 uuid primary key default gen_random_uuid(),
  grant_id           uuid references public.portal_access_grants (id) on delete cascade,
  user_id            uuid references public.users (id) on delete set null,
  student_id         uuid references public.students (id) on delete set null,
  portal_type        text not null,
  event              text not null check (event in ('CREATED', 'OPENED', 'ACTIVATED', 'AUTHENTICATED', 'USED', 'REGENERATED', 'REVOKED')),
  ip                 text,
  user_agent         text,
  created_at         timestamptz not null default timezone('utc', now())
);

create index if not exists idx_portal_access_events_grant
  on public.portal_access_events (grant_id, created_at desc);

create index if not exists idx_portal_access_events_student
  on public.portal_access_events (student_id, created_at desc);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Stored Functions
-- ────────────────────────────────────────────────────────────────────────────

-- Create or regenerate portal grant for a student (staff only)
create or replace function public.create_or_regenerate_portal_grant(
  p_student_id   uuid,
  p_portal_type  text,
  p_target_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller_id   uuid := auth.uid();
  v_student     record;
  v_token       text;
  v_hash        text;
  v_grant_id    uuid;
  v_is_regen    boolean := false;
  v_expires_at  timestamptz := timezone('utc', now()) + interval '30 days';
begin
  if v_caller_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_portal_type not in ('parent', 'student') then
    return jsonb_build_object('ok', false, 'error', 'invalid_portal_type');
  end if;

  select id, teacher_id, org_id, name, class, parent_email, student_email
  into v_student
  from public.students
  where id = p_student_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'student_not_found');
  end if;

  if not public.is_student_staff(p_student_id) then
    return jsonb_build_object('ok', false, 'error', 'not_permitted');
  end if;

  -- Generate 32-byte cryptographically secure random token (URL-safe base64) and SHA-256 hash
  v_token := translate(
    replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'),
    E'\n=', ''
  );
  v_hash  := encode(extensions.digest(v_token, 'sha256'), 'hex');

  -- Check if a grant already exists for this (student, portal_type)
  select id into v_grant_id
  from public.portal_access_grants
  where student_id = p_student_id
    and portal_type = p_portal_type
  order by created_at desc
  limit 1;

  if v_grant_id is not null then
    v_is_regen := true;
    update public.portal_access_grants
    set token_hash   = v_hash,
        status       = 'pending',
        expires_at   = v_expires_at,
        revoked_at   = null,
        target_email = coalesce(nullif(trim(lower(p_target_email)), ''), target_email),
        updated_at   = timezone('utc', now())
    where id = v_grant_id;
  else
    insert into public.portal_access_grants (
      teacher_id,
      workspace_id,
      student_id,
      portal_type,
      status,
      token_hash,
      target_email,
      expires_at,
      created_by
    ) values (
      v_student.teacher_id,
      v_student.org_id,
      p_student_id,
      p_portal_type,
      'pending',
      v_hash,
      nullif(trim(lower(p_target_email)), ''),
      v_expires_at,
      v_caller_id
    )
    returning id into v_grant_id;
  end if;

  insert into public.portal_access_events (
    grant_id,
    user_id,
    student_id,
    portal_type,
    event
  ) values (
    v_grant_id,
    v_caller_id,
    p_student_id,
    p_portal_type,
    case when v_is_regen then 'REGENERATED' else 'CREATED' end
  );

  return jsonb_build_object(
    'ok', true,
    'grant_id', v_grant_id,
    'token', v_token,
    'portal_type', p_portal_type,
    'student_id', p_student_id,
    'student_name', v_student.name,
    'expires_at', v_expires_at,
    'is_regenerated', v_is_regen
  );
end;
$$;

-- Revoke portal grant (staff only)
create or replace function public.revoke_portal_grant(p_grant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id   uuid := auth.uid();
  v_grant       record;
begin
  if v_caller_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select id, student_id, portal_type, user_id, status
  into v_grant
  from public.portal_access_grants
  where id = p_grant_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'grant_not_found');
  end if;

  if not public.is_student_staff(v_grant.student_id) then
    return jsonb_build_object('ok', false, 'error', 'not_permitted');
  end if;

  update public.portal_access_grants
  set status = 'revoked',
      revoked_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_grant_id;

  -- If parent grant and has active guardian link, revoke it
  if v_grant.portal_type = 'parent' and v_grant.user_id is not null then
    update public.guardian_student_relationships
    set status = 'revoked',
        revoked_at = timezone('utc', now()),
        revoked_by = v_caller_id,
        revoked_reason = 'teacher_revoked_portal_access'
    where guardian_user_id = v_grant.user_id
      and student_id = v_grant.student_id;
  end if;

  insert into public.portal_access_events (
    grant_id,
    user_id,
    student_id,
    portal_type,
    event
  ) values (
    p_grant_id,
    v_caller_id,
    v_grant.student_id,
    v_grant.portal_type,
    'REVOKED'
  );

  return jsonb_build_object('ok', true, 'grant_id', p_grant_id);
end;
$$;

-- Preview portal grant (Public / Anonymous safe)
create or replace function public.preview_portal_grant(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash      text;
  v_grant     record;
  v_student   record;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select id, student_id, portal_type, status, expires_at, revoked_at, target_email, user_id
  into v_grant
  from public.portal_access_grants
  where token_hash = v_hash;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_grant.revoked_at is not null or v_grant.status = 'revoked' then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;

  if v_grant.expires_at < timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select name, class
  into v_student
  from public.students
  where id = v_grant.student_id;

  -- Log OPENED event
  insert into public.portal_access_events (
    grant_id,
    user_id,
    student_id,
    portal_type,
    event
  ) values (
    v_grant.id,
    auth.uid(),
    v_grant.student_id,
    v_grant.portal_type,
    'OPENED'
  );

  -- Safe public response: no student_id, no token_hash, no teacher contact info
  return jsonb_build_object(
    'ok', true,
    'portal_type', v_grant.portal_type,
    'student_name', v_student.name,
    'student_class', v_student.class,
    'target_email', v_grant.target_email,
    'is_active', (v_grant.status = 'active'),
    'requires_auth', (auth.uid() is null)
  );
end;
$$;

-- Redeem portal grant (Authenticated user)
create or replace function public.redeem_portal_grant(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller_id  uuid := auth.uid();
  v_caller_email text := public.user_email();
  v_hash       text;
  v_grant      record;
begin
  if v_caller_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_token is null or length(trim(p_token)) < 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select id, student_id, portal_type, status, expires_at, revoked_at, target_email, user_id
  into v_grant
  from public.portal_access_grants
  where token_hash = v_hash;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_grant.revoked_at is not null or v_grant.status = 'revoked' then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;

  if v_grant.expires_at < timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  -- If bound to specific target email, enforce match
  if v_grant.target_email is not null and v_grant.target_email <> '' then
    if v_caller_email is null or lower(v_grant.target_email) <> lower(v_caller_email) then
      return jsonb_build_object('ok', false, 'error', 'email_mismatch');
    end if;
  end if;

  -- Update grant to active and bind to caller user_id
  update public.portal_access_grants
  set user_id      = v_caller_id,
      status       = 'active',
      last_used_at = timezone('utc', now()),
      updated_at   = timezone('utc', now())
  where id = v_grant.id;

  -- If Parent Portal, ensure guardian_student_relationships has active verified link
  if v_grant.portal_type = 'parent' then
    insert into public.guardian_student_relationships (
      guardian_user_id,
      student_id,
      relationship_type,
      status,
      verified_at,
      verified_by,
      verification_method,
      created_via
    ) values (
      v_caller_id,
      v_grant.student_id,
      'guardian',
      'active',
      timezone('utc', now()),
      v_caller_id,
      'portal_grant',
      'portal_grant'
    )
    on conflict (guardian_user_id, student_id) do update
    set status = 'active',
        verified_at = coalesce(public.guardian_student_relationships.verified_at, timezone('utc', now())),
        verification_method = 'portal_grant',
        revoked_at = null,
        revoked_reason = null,
        updated_at = timezone('utc', now());
  end if;

  insert into public.portal_access_events (
    grant_id,
    user_id,
    student_id,
    portal_type,
    event
  ) values (
    v_grant.id,
    v_caller_id,
    v_grant.student_id,
    v_grant.portal_type,
    'ACTIVATED'
  );

  return jsonb_build_object(
    'ok', true,
    'grant_id', v_grant.id,
    'portal_type', v_grant.portal_type,
    'student_id', v_grant.student_id
  );
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Update can_access_student to include portal_access_grants
-- ────────────────────────────────────────────────────────────────────────────

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
        from public.portal_access_grants pag
        where pag.student_id = target_student_id
          and pag.user_id = auth.uid()
          and pag.status = 'active'
      )
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

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security
-- ────────────────────────────────────────────────────────────────────────────

alter table public.portal_access_grants enable row level security;
alter table public.portal_access_events enable row level security;

-- Grants policies
create policy portal_access_grants_staff_select
  on public.portal_access_grants
  for select
  to authenticated
  using (public.is_student_staff(student_id));

create policy portal_access_grants_staff_all
  on public.portal_access_grants
  for all
  to authenticated
  using (public.is_student_staff(student_id))
  with check (public.is_student_staff(student_id));

create policy portal_access_grants_user_select
  on public.portal_access_grants
  for select
  to authenticated
  using (user_id = auth.uid());

-- Events policies
create policy portal_access_events_staff_select
  on public.portal_access_events
  for select
  to authenticated
  using (student_id is not null and public.is_student_staff(student_id));

-- Permissions
grant execute on function public.create_or_regenerate_portal_grant(uuid, text, text) to authenticated;
grant execute on function public.revoke_portal_grant(uuid) to authenticated;
grant execute on function public.preview_portal_grant(text) to anon, authenticated;
grant execute on function public.redeem_portal_grant(text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Safe Backfill: Populate pending grants for existing students with emails
-- ────────────────────────────────────────────────────────────────────────────

do $$
declare
  s record;
  v_token text;
  v_hash  text;
begin
  for s in
    select id, teacher_id, org_id, parent_email, student_email
    from public.students
  loop
    -- Backfill parent grant if parent_email is present and no grant exists
    if s.parent_email is not null and trim(s.parent_email) <> '' then
      if not exists (
        select 1 from public.portal_access_grants
        where student_id = s.id and portal_type = 'parent'
      ) then
        v_token := translate(
          replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'),
          E'\n=', ''
        );
        v_hash  := encode(extensions.digest(v_token, 'sha256'), 'hex');
        insert into public.portal_access_grants (
          teacher_id, workspace_id, student_id, portal_type, status, token_hash, target_email
        ) values (
          s.teacher_id, s.org_id, s.id, 'parent', 'pending', v_hash, lower(trim(s.parent_email))
        );
      end if;
    end if;

    -- Backfill student grant if student_email is present and no grant exists
    if s.student_email is not null and trim(s.student_email) <> '' then
      if not exists (
        select 1 from public.portal_access_grants
        where student_id = s.id and portal_type = 'student'
      ) then
        v_token := translate(
          replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'),
          E'\n=', ''
        );
        v_hash  := encode(extensions.digest(v_token, 'sha256'), 'hex');
        insert into public.portal_access_grants (
          teacher_id, workspace_id, student_id, portal_type, status, token_hash, target_email
        ) values (
          s.teacher_id, s.org_id, s.id, 'student', 'pending', v_hash, lower(trim(s.student_email))
        );
      end if;
    end if;
  end loop;
end $$;
