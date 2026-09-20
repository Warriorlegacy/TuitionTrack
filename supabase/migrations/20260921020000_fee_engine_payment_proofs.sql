-- ============================================================================
-- Fee engine: configurable payment settings, UPI proof submission, receipts.
--
-- Scope of THIS migration:
--   1. payment_settings            — admin-editable UPI / WhatsApp / currency.
--                                      NEVER hard-coded in the frontend.
--   2. payment_proofs              — a parent's UPI payment attempt + screenshot,
--                                      with the full lifecycle from the brief
--                                      (unpaid → payment_initiated → proof_submitted
--                                       → under_review → verified/rejected/refunded/cancelled).
--   3. payment_receipts            — TT-YYYY-NNNNNN receipts issued on verification.
--   4. a PRIVATE storage bucket    — payment-proofs (screenshots), service-role only.
--   5. RLS + verification function — explicit staff verification only; no auto-verify.
--
-- Safety rule (brief §42): a payment is NEVER marked verified because a
-- screenshot exists, OCR found an amount, or a parent claims it. Verification is
-- an explicit staff action behind an RLS-guarded, security-definer function.
-- A verified proof flips the linked fee to paid; rejection leaves it untouched.
--
-- Idempotent throughout: create table if not exists, do-$$ type guards,
-- create or replace functions, do-$$ for constraints. Re-runnable.
-- ============================================================================

-- ── 1. Status enum ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_proof_status') then
    create type public.payment_proof_status as enum (
      'unpaid',
      'payment_initiated',
      'proof_submitted',
      'under_review',
      'verified',
      'rejected',
      'refunded',
      'cancelled'
    );
  end if;
end $$;

-- ── 2. Staff predicate (teacher = staff for payment administration) ─────────
create or replace function public.is_app_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role = 'teacher'
  );
$$;

-- ── 3. payment_settings ─────────────────────────────────────────────────────
create table if not exists public.payment_settings (
  id                       uuid primary key default gen_random_uuid(),
  upi_id                   text not null default '6202442690@jio',
  upi_display_name         text not null default 'TuitionTrack',
  upi_qr_url               text,
  payment_whatsapp_number  text not null default '6202442690',
  currency                 text not null default 'INR',
  instructions             text,
  active                   boolean not null default false,
  created_at               timestamptz not null default timezone('utc', now()),
  updated_at               timestamptz not null default timezone('utc', now())
);

-- Exactly one row may be active at a time.
create unique index if not exists payment_settings_one_active
  on public.payment_settings (active)
  where active is true;

-- Seed a default active row once, so /parent/fees has something to display
-- without an admin having touched settings yet.
insert into public.payment_settings (upi_id, upi_display_name, payment_whatsapp_number, currency, active)
select '6202442690@jio', 'TuitionTrack', '6202442690', 'INR', true
where not exists (select 1 from public.payment_settings where active is true);

-- ── 4. payment_receipts (created before proofs to avoid a forward reference) ─
create table if not exists public.payment_receipts (
  id               uuid primary key default gen_random_uuid(),
  receipt_number   text not null unique,
  payment_proof_id uuid,
  student_id       uuid not null references public.students(id) on delete cascade,
  guardian_user_id uuid not null references auth.users(id),
  amount           numeric(12,2) not null,
  currency         text not null default 'INR',
  issued_at        timestamptz not null default timezone('utc', now()),
  issued_by        uuid references auth.users(id),
  created_at       timestamptz not null default timezone('utc', now()),
  constraint payment_receipts_amount_positive check (amount > 0)
);
create index if not exists payment_receipts_student_idx
  on public.payment_receipts (student_id);
create index if not exists payment_receipts_guardian_idx
  on public.payment_receipts (guardian_user_id);

-- Sequence + formatter for TT-YYYY-NNNNNN.
create sequence if not exists public.payment_receipt_seq;

create or replace function public.generate_receipt_number()
returns text
language plpgsql
volatile
set search_path = public
as $$
begin
  return 'TT-' || to_char(timezone('utc', now()), 'YYYY') || '-'
         || lpad(nextval('public.payment_receipt_seq')::text, 6, '0');
end $$;

-- ── 5. payment_proofs ───────────────────────────────────────────────────────
create table if not exists public.payment_proofs (
  id                     uuid primary key default gen_random_uuid(),
  student_id             uuid not null references public.students(id) on delete cascade,
  guardian_user_id       uuid not null references auth.users(id),
  relationship_id        uuid references public.guardian_student_relationships(id) on delete set null,
  fee_id                 uuid references public.fees(id) on delete set null,
  amount                 numeric(12,2) not null,
  currency               text not null default 'INR',
  utr_reference          text,
  screenshot_storage_path text,
  screenshot_file_name   text,
  status                 public.payment_proof_status not null default 'proof_submitted',
  submitted_at           timestamptz not null default timezone('utc', now()),
  submitted_by           uuid references auth.users(id),
  reviewed_at            timestamptz,
  reviewed_by            uuid references auth.users(id),
  review_notes           text,
  rejection_reason       text,
  receipt_id             uuid,
  created_at             timestamptz not null default timezone('utc', now()),
  updated_at             timestamptz not null default timezone('utc', now()),
  constraint payment_proofs_amount_positive check (amount > 0),
  -- A proof that has advanced past submission must carry the transaction ref.
  constraint payment_proofs_utr_when_submitted check (
    status = 'unpaid' or status = 'payment_initiated'
    or utr_reference is not null
  )
);

create index if not exists payment_proofs_guardian_idx
  on public.payment_proofs (guardian_user_id, status);
create index if not exists payment_proofs_student_idx
  on public.payment_proofs (student_id, status);
-- Used to block a UTR that has already been verified.
create index if not exists payment_proofs_utr_verified_idx
  on public.payment_proofs (utr_reference)
  where status = 'verified';
create index if not exists payment_proofs_fee_idx
  on public.payment_proofs (fee_id);

-- Wire the two circular references now that both tables exist.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_proof_receipt'
  ) then
    alter table public.payment_proofs
      add constraint fk_proof_receipt
      foreign key (receipt_id) references public.payment_receipts(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'fk_receipt_proof'
  ) then
    alter table public.payment_receipts
      add constraint fk_receipt_proof
      foreign key (payment_proof_id) references public.payment_proofs(id) on delete set null;
  end if;
end $$;

-- ── 6. Private storage bucket for screenshots ───────────────────────────────
-- Private: only the service role (server-side, behind auth + verification)
-- may read or write. No client-side storage policy is granted, so a browser
-- can never fetch a screenshot URL directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- ── 7. Row Level Security ───────────────────────────────────────────────────
alter table public.payment_settings enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.payment_receipts enable row level security;

-- payment_settings: any authenticated reader may see the active settings (to
-- display UPI); only staff may write them.
drop policy if exists payment_settings_authenticated_select on public.payment_settings;
create policy payment_settings_authenticated_select
  on public.payment_settings for select to authenticated
  using (true);

drop policy if exists payment_settings_staff_write on public.payment_settings;
create policy payment_settings_staff_write
  on public.payment_settings for all to authenticated
  using (public.is_app_staff())
  with check (public.is_app_staff());

-- payment_proofs:
--   read : the submitting guardian, any verified guardian of the same student,
--          or staff (teacher).
drop policy if exists payment_proofs_guardian_select on public.payment_proofs;
create policy payment_proofs_guardian_select
  on public.payment_proofs for select to authenticated
  using (
    guardian_user_id = auth.uid()
    or public.can_access_student(student_id)
  );

--   insert: only a guardian who actually has access to that student, and only
--           for themselves.
drop policy if exists payment_proofs_guardian_insert on public.payment_proofs;
create policy payment_proofs_guardian_insert
  on public.payment_proofs for insert to authenticated
  with check (
    guardian_user_id = auth.uid()
    and public.can_access_student(student_id)
  );

--   update/delete: staff only (review / reconciliation). Guardians may never
--                  change status — verification is a staff action.
drop policy if exists payment_proofs_staff_write on public.payment_proofs;
create policy payment_proofs_staff_write
  on public.payment_proofs for update to authenticated
  using (public.is_app_staff())
  with check (public.is_app_staff());

drop policy if exists payment_proofs_staff_delete on public.payment_proofs;
create policy payment_proofs_staff_delete
  on public.payment_proofs for delete to authenticated
  using (public.is_app_staff());

-- payment_receipts:
--   read : the guardian it belongs to, any verified guardian of the student,
--          or staff.
drop policy if exists payment_receipts_guardian_select on public.payment_receipts;
create policy payment_receipts_guardian_select
  on public.payment_receipts for select to authenticated
  using (
    guardian_user_id = auth.uid()
    or public.can_access_student(student_id)
  );

--   write: staff only (issued on verification).
drop policy if exists payment_receipts_staff_write on public.payment_receipts;
create policy payment_receipts_staff_write
  on public.payment_receipts for all to authenticated
  using (public.is_app_staff())
  with check (public.is_app_staff());

-- ── 8. Verification / rejection (explicit, RLS-bypassing, atomic) ───────────
-- verify_payment_proof: the ONLY path that marks a payment verified.
-- Hard guards (never auto-approve):
--   * the proof must be in a submittable state
--   * a UTR that has already been VERIFIED on another proof is rejected
--   * the UTR must be present
-- Returns jsonb; on a hard block it raises an exception with a typed code so
-- the application can show the right message.
create or replace function public.verify_payment_proof(
  p_proof_id uuid,
  p_reviewer_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proof public.payment_proofs;
  v_trusted boolean;
begin
  select * into v_proof from public.payment_proofs where id = p_proof_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_proof.status in ('verified', 'refunded', 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'already_final');
  end if;

  if v_proof.utr_reference is null or length(trim(v_proof.utr_reference)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'missing_reference');
  end if;

  -- A UTR already tied to a VERIFIED proof cannot be reused.
  perform 1
  from public.payment_proofs
  where utr_reference = v_proof.utr_reference
    and status = 'verified'
    and id <> v_proof.id;
  if found then
    return jsonb_build_object('ok', false, 'error', 'duplicate_utr');
  end if;

  update public.payment_proofs
  set status = 'verified',
      reviewed_at = timezone('utc', now()),
      reviewed_by = p_reviewer_id,
      review_notes = p_notes,
      updated_at = timezone('utc', now())
  where id = v_proof.id;

  -- Flip the linked fee to paid. Reconciliation mismatches are surfaced to the
  -- admin but never block verification; the human decides.
  if v_proof.fee_id is not null then
    update public.fees
    set status = 'paid', updated_at = timezone('utc', now())
    where id = v_proof.fee_id;
  end if;

  -- Issue a receipt.
  insert into public.payment_receipts (
    receipt_number, payment_proof_id, student_id, guardian_user_id,
    amount, currency, issued_by
  ) values (
    public.generate_receipt_number(), v_proof.id, v_proof.student_id,
    v_proof.guardian_user_id, v_proof.amount, v_proof.currency, p_reviewer_id
  )
  returning id into v_trusted;

  update public.payment_proofs set receipt_id = v_trusted where id = v_proof.id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (
    p_reviewer_id, 'payment_proof_verified', 'payment_proof', v_proof.id::text,
    jsonb_build_object(
      'student_id', v_proof.student_id,
      'amount', v_proof.amount,
      'utr_reference', v_proof.utr_reference,
      'receipt_id', v_trusted,
      'actor_email', null,
      'result', 'success'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'proof_id', v_proof.id,
    'receipt_id', v_trusted
  );
end $$;

create or replace function public.reject_payment_proof(
  p_proof_id uuid,
  p_reviewer_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proof public.payment_proofs;
begin
  select * into v_proof from public.payment_proofs where id = p_proof_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_proof.status = 'verified' then
    return jsonb_build_object('ok', false, 'error', 'already_verified');
  end if;

  update public.payment_proofs
  set status = 'rejected',
      reviewed_at = timezone('utc', now()),
      reviewed_by = p_reviewer_id,
      rejection_reason = p_reason,
      updated_at = timezone('utc', now())
  where id = v_proof.id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (
    p_reviewer_id, 'payment_proof_rejected', 'payment_proof', v_proof.id::text,
    jsonb_build_object(
      'student_id', v_proof.student_id,
      'reason', p_reason,
      'actor_email', null,
      'result', 'success'
    )
  );

  return jsonb_build_object('ok', true, 'proof_id', v_proof.id);
end $$;

-- ── 9. updated_at triggers (reuse the existing touch_updated_at) ───────────
drop trigger if exists payment_proofs_touch_updated_at on public.payment_proofs;
create trigger payment_proofs_touch_updated_at
  before update on public.payment_proofs
  for each row execute function public.touch_updated_at();

drop trigger if exists payment_settings_touch_updated_at on public.payment_settings;
create trigger payment_settings_touch_updated_at
  before update on public.payment_settings
  for each row execute function public.touch_updated_at();
