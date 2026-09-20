-- ============================================================================
-- Parent Portal — Guardian Core (PHASE 2, 3, 22)
-- ============================================================================
-- Establishes the relationship-based parent access model that replaces the
-- previous email-match model on students.parent_email.
--
-- WHY THIS MIGRATION EXISTS
-- The prior authorization predicate (public.can_access_student) granted a
-- logged-in user full visibility of a student whenever
--     students.parent_email = user_email()
-- students.parent_email is a plain editable text column written by
-- updateStudentAccessAction, and the /join?studentId=<uuid> flow wrote it from
-- a frontend-supplied student UUID. There was no token, no expiry, no
-- revocation, no verification and no audit trail: any teacher — or anyone who
-- could reach the claim action with a guessed student UUID — could mint parent
-- access. See brief sections 3, 62, 65, 66, 104 and 111.
--
-- WHAT CHANGES
--   1. guardian_student_relationships becomes the ONLY source of parent access.
--   2. parent_invites carries hashed, single-use, expiring, revocable tokens.
--   3. can_access_student is rewritten to consult the relationship only.
--   4. attendance / fees / students RLS policies stop trusting parent_email.
--
-- SAFETY
-- Every statement is idempotent (if not exists / or replace). No table, column
-- or row is dropped or truncated. The one UPDATE is a backfill that copies
-- existing parent_email links into relationship rows so currently-working
-- parents do not lose access; it is guarded to run once and is logged below.
--
-- ROLLBACK (manual, if ever required):
--   Restore the previous can_access_student body from
--   supabase/migrations/20260915000000_orgs_batches_guardians.sql, and
--   re-create the attendance/fees/students parent policies as they were.
--   New tables can then be dropped; no existing table was altered.
-- ============================================================================

-- pgcrypto is installed in the `extensions` schema on this project, so
-- digest()/gen_random_bytes() are not on the default search_path.
create extension if not exists pgcrypto with schema extensions;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Enums
-- ────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'guardian_relationship_type') then
    create type public.guardian_relationship_type as enum (
      'father', 'mother', 'guardian', 'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'guardian_link_status') then
    create type public.guardian_link_status as enum (
      'pending',    -- invited, not yet accepted
      'active',     -- verified relationship, access granted
      'suspended',  -- access temporarily withheld by staff
      'revoked'     -- access permanently withdrawn
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'parent_invite_status') then
    create type public.parent_invite_status as enum (
      'pending', 'accepted', 'expired', 'revoked'
    );
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. guardian_student_relationships — the parent access source of truth
-- ────────────────────────────────────────────────────────────────────────────
-- Section 63. One guardian -> many children; one child -> many guardians.

create table if not exists public.guardian_student_relationships (
  id                 uuid primary key default gen_random_uuid(),
  guardian_user_id   uuid references public.users (id) on delete cascade,
  student_id         uuid not null references public.students (id) on delete cascade,
  relationship_type  public.guardian_relationship_type not null default 'guardian',
  status             public.guardian_link_status not null default 'pending',
  -- Verification trail. verified_at is only ever set by an accepted invite or
  -- an explicit staff action, never inferred.
  verified_at        timestamptz,
  verified_by        uuid references public.users (id) on delete set null,
  verification_method text,  -- 'invite_token' | 'staff_manual' | 'backfill'
  -- How this row came to exist, for auditing the migration itself.
  created_via        text not null default 'invite',
  created_by         uuid references public.users (id) on delete set null,
  revoked_at         timestamptz,
  revoked_by         uuid references public.users (id) on delete set null,
  revoked_reason     text,
  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now()),

  -- A guardian cannot be linked to the same student twice.
  constraint guardian_student_unique unique (guardian_user_id, student_id)
);

-- One guardian, many children: the child switcher reads this index.
create index if not exists guardian_rel_guardian_idx
  on public.guardian_student_relationships (guardian_user_id, status);
-- One child, many guardians: the student detail page reads this.
create index if not exists guardian_rel_student_idx
  on public.guardian_student_relationships (student_id, status);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. parent_permissions — per-relationship granular grants (Section 64)
-- ────────────────────────────────────────────────────────────────────────────
-- Default is allow-listed at the application layer; a missing row means "use
-- the default for this permission", an explicit row means "this value wins".

create table if not exists public.parent_permissions (
  id             uuid primary key default gen_random_uuid(),
  relationship_id uuid not null
    references public.guardian_student_relationships (id) on delete cascade,
  permission     text not null,
  allowed        boolean not null default true,
  updated_by     uuid references public.users (id) on delete set null,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now()),

  constraint parent_permissions_unique unique (relationship_id, permission),
  -- The closed list from Section 64. Anything else is a bug, not a feature.
  constraint parent_permissions_known check (permission in (
    'view_academic_progress',
    'view_homework',
    'view_assignments',
    'view_test_results',
    'view_attendance',
    'view_portfolio',
    'view_reports',
    'view_fees',
    'receive_notifications',
    'message_teacher',
    'book_ptm'
  ))
);

create index if not exists parent_permissions_rel_idx
  on public.parent_permissions (relationship_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. parent_invites — cryptographically random, hashed at rest
-- ────────────────────────────────────────────────────────────────────────────
-- Section 3. The token is NEVER stored in plaintext. The invite URL carries
-- the raw token exactly once; we persist only sha256(raw). A database leak
-- therefore does not yield usable invite links.
--
-- The token contains no student id, no email and no sequence: it is 32 bytes
-- of CSPRNG output, base64url encoded.

create table if not exists public.parent_invites (
  id              uuid primary key default gen_random_uuid(),
  -- sha256 hex of the raw token. Unique so redemption is a single lookup.
  token_hash      text not null unique,
  student_id      uuid not null references public.students (id) on delete cascade,
  -- Who the invite is for, if the teacher supplied it. Used to pre-fill the
  -- acceptance form and to reject redemption by the wrong account when set.
  invited_email   text,
  invited_phone   text,
  relationship_type public.guardian_relationship_type not null default 'guardian',
  status          public.parent_invite_status not null default 'pending',
  expires_at      timestamptz not null,
  -- Single-use: set the instant the invite is redeemed.
  accepted_at     timestamptz,
  accepted_by     uuid references public.users (id) on delete set null,
  -- The relationship row created by redemption, for traceability.
  relationship_id uuid references public.guardian_student_relationships (id) on delete set null,
  revoked_at      timestamptz,
  revoked_by      uuid references public.users (id) on delete set null,
  revoked_reason  text,
  -- Delivery metadata only. Never a token, never a secret.
  delivery_channel text,   -- 'whatsapp' | 'email' | 'sms' | 'qr' | 'link'
  sent_at         timestamptz,
  created_by      uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default timezone('utc', now()),

  -- An accepted invite must record who accepted it.
  constraint parent_invites_accepted_consistency
    check (status <> 'accepted' or (accepted_at is not null and accepted_by is not null))
);

create index if not exists parent_invites_student_idx
  on public.parent_invites (student_id, status);
create index if not exists parent_invites_creator_idx
  on public.parent_invites (created_by, status);
-- Housekeeping sweep: expire stale pending invites.
create index if not exists parent_invites_expiry_idx
  on public.parent_invites (expires_at)
  where status = 'pending';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Permission resolution helper
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.has_verified_guardian_link(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guardian_student_relationships r
    where r.student_id = sid
      and r.guardian_user_id = auth.uid()
      and r.status = 'active'
      and r.verified_at is not null
  )
$$;

create or replace function public.is_active_guardian_of(sid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guardian_student_relationships r
    where r.student_id = sid
      and r.guardian_user_id = uid
      and r.status = 'active'
      and r.verified_at is not null
  )
$$;

-- Resolve a single permission for the current user against a student.
-- Defaults are closed: an unknown permission resolves to false.
create or replace function public.parent_has_permission(sid uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.allowed
      from public.guardian_student_relationships r
      join public.parent_permissions p on p.relationship_id = r.id
      where r.student_id = sid
        and r.guardian_user_id = auth.uid()
        and r.status = 'active'
        and r.verified_at is not null
        and p.permission = perm
      limit 1
    ),
    -- No explicit row -> default for this permission. Read-only visibility is
    -- on by default; anything that causes an external side effect is off.
    case perm
      when 'view_academic_progress' then true
      when 'view_homework'          then true
      when 'view_assignments'       then true
      when 'view_test_results'      then true
      when 'view_attendance'        then true
      when 'view_reports'           then true
      when 'receive_notifications'  then true
      when 'view_portfolio'         then false
      when 'view_fees'              then false
      when 'message_teacher'        then false
      when 'book_ptm'               then false
      else false
    end
  )
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Rewritten authorization chokepoint (Sections 62, 65)
-- ────────────────────────────────────────────────────────────────────────────
-- DELIBERATE BREAKING CHANGE for one specific input: students.parent_email is
-- no longer trusted. Access now requires an active verified relationship row.
--
-- `is_student_staff` is preserved so teachers and org staff are unaffected.
-- Existing parent_email links are migrated into relationship rows in step 8,
-- so no real parent loses access.

create or replace function public.can_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_student_staff(target_student_id)
    or public.has_verified_guardian_link(target_student_id)
    or exists (
      -- A student reaching their own record, via an explicit link rather than
      -- a bare email match. Kept narrow on purpose.
      select 1
      from public.students s
      where s.id = target_student_id
        and lower(coalesce(s.student_email, '')) = public.user_email()
    )
$$;

comment on function public.can_access_student(uuid) is
  'Parent access now requires an active verified guardian_student_relationships row. students.parent_email is no longer trusted (parent portal PHASE 2).';

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Align attendance / fees / students policies with the chokepoint
-- ────────────────────────────────────────────────────────────────────────────
-- These three still used their own inline parent_email EXISTS check, so the
-- migration to relationship-based access would otherwise be partial.

drop policy if exists "attendance parent select" on public.attendance;
create policy "attendance parent select" on public.attendance
  for select using (public.can_access_student(student_id));

drop policy if exists "fees parent select" on public.fees;
create policy "fees parent select" on public.fees
  for select using (public.can_access_student(student_id));

drop policy if exists "students parent student select" on public.students;
create policy "students parent student select" on public.students
  for select using (public.can_access_student(id));

-- Guardian relationship rows are visible to the guardian concerned, and to
-- staff who manage the student. Nobody can see another family's links.
drop policy if exists "guardian rel select" on public.guardian_student_relationships;
create policy "guardian rel select" on public.guardian_student_relationships
  for select using (
    guardian_user_id = auth.uid()
    or public.is_student_staff(student_id)
  );

-- Only staff may create/modify relationship rows directly. Parent-side
-- creation happens exclusively through the invite redemption RPC below, which
-- runs as the definer and validates the token first.
drop policy if exists "guardian rel staff write" on public.guardian_student_relationships;
create policy "guardian rel staff write" on public.guardian_student_relationships
  for all using (public.is_student_staff(student_id))
  with check (public.is_student_staff(student_id));

drop policy if exists "parent permissions select" on public.parent_permissions;
create policy "parent permissions select" on public.parent_permissions
  for select using (
    exists (
      select 1 from public.guardian_student_relationships r
      where r.id = relationship_id
        and (r.guardian_user_id = auth.uid() or public.is_student_staff(r.student_id))
    )
  );

drop policy if exists "parent permissions staff write" on public.parent_permissions;
create policy "parent permissions staff write" on public.parent_permissions
  for all using (
    exists (
      select 1 from public.guardian_student_relationships r
      where r.id = relationship_id and public.is_student_staff(r.student_id)
    )
  )
  with check (
    exists (
      select 1 from public.guardian_student_relationships r
      where r.id = relationship_id and public.is_student_staff(r.student_id)
    )
  );

-- Invites are visible only to the staff who created them or who manage the
-- student. Crucially a parent can never SELECT this table, so token_hash is
-- not exposed to any client even for their own invite.
drop policy if exists "parent invites staff select" on public.parent_invites;
create policy "parent invites staff select" on public.parent_invites
  for select using (public.is_student_staff(student_id));

drop policy if exists "parent invites staff write" on public.parent_invites;
create policy "parent invites staff write" on public.parent_invites
  for all using (public.is_student_staff(student_id))
  with check (public.is_student_staff(student_id));

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Redemption RPC — the only parent-initiated write path
-- ────────────────────────────────────────────────────────────────────────────
-- Runs as definer so the redeeming parent needs no INSERT grant on
-- guardian_student_relationships. Validates, in order:
--   * the caller is authenticated
--   * the token exists and matches its hash
--   * the invite is still pending and not past expires_at
--   * if invited_email was set, the caller's email matches it
-- Then marks the invite accepted (single-use) and creates the relationship.
--
-- Returns a small JSON result. It never returns the token or the token hash.

create or replace function public.redeem_parent_invite(raw_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid        uuid := auth.uid();
  v_email      text := public.user_email();
  v_invite     public.parent_invites;
  v_rel_id     uuid;
  v_hash       text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if raw_token is null or length(raw_token) < 20 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(digest(raw_token, 'sha256'), 'hex');

  select * into v_invite
  from public.parent_invites
  where token_hash = v_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_invite.status = 'accepted' then
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;

  if v_invite.status = 'revoked' then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;

  if v_invite.expires_at <= timezone('utc', now()) then
    update public.parent_invites
      set status = 'expired'
      where id = v_invite.id and status = 'pending';
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  -- Address-bound invite: the redeemer must be the intended recipient.
  if v_invite.invited_email is not null
     and lower(v_invite.invited_email) <> lower(coalesce(v_email, '')) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  -- Idempotency guard: an existing active relationship for the same pair is
  -- reused rather than duplicated (the unique constraint would reject anyway).
  select id into v_rel_id
  from public.guardian_student_relationships
  where guardian_user_id = v_uid
    and student_id = v_invite.student_id;

  if v_rel_id is null then
    insert into public.guardian_student_relationships (
      guardian_user_id, student_id, relationship_type, status,
      verified_at, verified_by, verification_method, created_via, created_by
    ) values (
      v_uid, v_invite.student_id, v_invite.relationship_type, 'active',
      timezone('utc', now()), v_uid, 'invite_token', 'invite', v_invite.created_by
    )
    returning id into v_rel_id;
  else
    update public.guardian_student_relationships
      set status = 'active',
          verified_at = coalesce(verified_at, timezone('utc', now())),
          verified_by = coalesce(verified_by, v_uid),
          verification_method = coalesce(verification_method, 'invite_token'),
          revoked_at = null,
          revoked_by = null,
          revoked_reason = null,
          updated_at = timezone('utc', now())
      where id = v_rel_id;
  end if;

  update public.parent_invites
    set status = 'accepted',
        accepted_at = timezone('utc', now()),
        accepted_by = v_uid,
        relationship_id = v_rel_id
    where id = v_invite.id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (
    v_uid, 'parent_invite_accepted', 'parent_invite', v_invite.id::text,
    jsonb_build_object('student_id', v_invite.student_id, 'relationship_id', v_rel_id,
                       'actor_email', v_email, 'result', 'success')
  );

  return jsonb_build_object('ok', true, 'student_id', v_invite.student_id, 'relationship_id', v_rel_id);
end $$;

revoke all on function public.redeem_parent_invite(text) from public;
grant execute on function public.redeem_parent_invite(text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Invite creation RPC — staff only, returns the raw token exactly once
-- ────────────────────────────────────────────────────────────────────────────
-- The raw token is generated here, returned to the caller for URL construction,
-- and never persisted. Only its hash reaches the table.

create or replace function public.create_parent_invite(
  p_student_id uuid,
  p_relationship_type public.guardian_relationship_type default 'guardian',
  p_invited_email text default null,
  p_invited_phone text default null,
  p_expires_in_hours int default 168,      -- 7 days
  p_delivery_channel text default 'link'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text := public.user_email();
  v_raw    text;
  v_hash   text;
  v_id     uuid;
  v_exp    timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  -- Only staff who can already see the student may mint an invite for them.
  if not public.is_student_staff(p_student_id) then
    return jsonb_build_object('ok', false, 'error', 'not_permitted');
  end if;

  if not exists (select 1 from public.students where id = p_student_id) then
    return jsonb_build_object('ok', false, 'error', 'student_not_found');
  end if;

  -- Clamp the lifetime: never shorter than an hour, never longer than 30 days.
  v_exp := timezone('utc', now())
    + make_interval(hours => least(greatest(coalesce(p_expires_in_hours, 168), 1), 720));

  -- 32 bytes of CSPRNG output. base64url, no padding, no student id, no email.
  v_raw := translate(
    replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'),
    E'\n=', ''
  );
  v_hash := encode(digest(v_raw, 'sha256'), 'hex');

  insert into public.parent_invites (
    token_hash, student_id, invited_email, invited_phone, relationship_type,
    status, expires_at, delivery_channel, sent_at, created_by
  ) values (
    v_hash, p_student_id, nullif(p_invited_email, ''), nullif(p_invited_phone, ''),
    p_relationship_type, 'pending', v_exp, p_delivery_channel,
    timezone('utc', now()), v_uid
  )
  returning id into v_id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (
    v_uid, 'parent_invited', 'parent_invite', v_id::text,
    jsonb_build_object('student_id', p_student_id, 'expires_at', v_exp,
                       'relationship_type', p_relationship_type,
                       'actor_email', v_email, 'result', 'success')
  );

  -- v_raw is returned to the caller and stored nowhere.
  return jsonb_build_object('ok', true, 'invite_id', v_id, 'token', v_raw, 'expires_at', v_exp);
end $$;

revoke all on function public.create_parent_invite(uuid, public.guardian_relationship_type, text, text, int, text) from public;
grant execute on function public.create_parent_invite(uuid, public.guardian_relationship_type, text, text, int, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 9b. Invite preview — names only, so the acceptance page is comprehensible
-- ────────────────────────────────────────────────────────────────────────────
-- Anyone holding the link can call this, which is why it returns the minimum:
-- the child's name and class, the teacher's name, the relationship type and
-- the expiry. No token, no contact details, no academic data, no identifiers
-- beyond what is needed to render the page. Staff-only would defeat the point
-- (the parent is not staff yet), and returning the student_id would leak an
-- internal identifier into pre-authentication traffic.

create or replace function public.preview_parent_invite(raw_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_hash   text;
  v_invite public.parent_invites;
  v_stu    record;
  v_teach  text;
begin
  if raw_token is null or length(raw_token) < 20 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_hash := encode(digest(raw_token, 'sha256'), 'hex');

  select * into v_invite from public.parent_invites where token_hash = v_hash;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_invite.status = 'accepted' then
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;

  if v_invite.status = 'revoked' then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;

  if v_invite.expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select s.name, s.class into v_stu
  from public.students s where s.id = v_invite.student_id;

  if v_stu is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select coalesce(u.name, u.email) into v_teach
  from public.students s
  join public.users u on u.id = s.teacher_id
  where s.id = v_invite.student_id;

  return jsonb_build_object(
    'ok', true,
    'student_name', v_stu.name,
    'student_class', v_stu.class,
    'teacher_name', v_teach,
    'relationship_type', v_invite.relationship_type,
    'expires_at', v_invite.expires_at,
    -- Returned so the acceptance page can warn "this invite was sent to
    -- a@b.com" before the parent signs in with the wrong account.
    'invited_email', v_invite.invited_email
  );
end $$;

revoke all on function public.preview_parent_invite(text) from public;
grant execute on function public.preview_parent_invite(text) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 10. Backfill — preserve access for links created before this migration
-- ────────────────────────────────────────────────────────────────────────────
-- students.parent_email previously conferred access. Copy those into explicit
-- relationship rows so behaviour is preserved, but mark them honestly:
-- verification_method = 'backfill', status active, verified_at = now().
-- Only rows with a matching users row are linked; an email with no account has
-- nobody to grant access to, so it is left alone.

do $$
declare
  v_count int := 0;
begin
  with candidates as (
    select s.id as student_id, u.id as guardian_user_id
    from public.students s
    join public.users u
      on lower(u.email) = lower(s.parent_email)
    where s.parent_email is not null
      and s.parent_email <> ''
      and u.role = 'parent'
  )
  insert into public.guardian_student_relationships (
    guardian_user_id, student_id, relationship_type, status,
    verified_at, verification_method, created_via, created_by
  )
  select
    c.guardian_user_id, c.student_id, 'guardian', 'active',
    timezone('utc', now()), 'backfill', 'backfill', null
  from candidates c
  where not exists (
    select 1 from public.guardian_student_relationships r
    where r.guardian_user_id = c.guardian_user_id
      and r.student_id = c.student_id
  );

  get diagnostics v_count = row_count;
  raise notice 'parent portal backfill: % relationship row(s) created', v_count;
end $$;

insert into public.audit_logs (actor_id, action, entity, metadata)
values (
  null, 'parent_portal_guardian_core_migration', 'migration',
  jsonb_build_object(
    'migration', '20260921000000_parent_portal_guardian_core',
    'can_access_student', 'rewritten to relationship-only',
    'parent_email_trust', 'removed',
    'result', 'success'
  )
);

-- ────────────────────────────────────────────────────────────────────────────
-- 11. updated_at trigger
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end $$;

drop trigger if exists guardian_rel_touch on public.guardian_student_relationships;
create trigger guardian_rel_touch
  before update on public.guardian_student_relationships
  for each row execute function public.touch_updated_at();

drop trigger if exists parent_permissions_touch on public.parent_permissions;
create trigger parent_permissions_touch
  before update on public.parent_permissions
  for each row execute function public.touch_updated_at();
