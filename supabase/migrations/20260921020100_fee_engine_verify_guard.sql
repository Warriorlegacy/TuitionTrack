-- ============================================================================
-- Lock down fee verification: only staff may verify/reject, enforced in-SQL.
--
-- The verifier functions are security definer and, by Postgres default, EXECUTE
-- is granted to PUBLIC — which would let any authenticated parent verify their
-- own payment and self-issue a receipt. Two defenses:
--   1. An internal is_app_staff() guard inside each function.
--   2. Revoke EXECUTE from public/anon; grant only to authenticated. The
--      function still self-checks staff, so a non-staff caller is refused.
-- ============================================================================

-- 1. Internal staff guard (re-defines the bodies; create or replace).
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
  if not public.is_app_staff() then
    return jsonb_build_object('ok', false, 'error', 'not_permitted');
  end if;

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

  if v_proof.fee_id is not null then
    update public.fees
    set status = 'paid', updated_at = timezone('utc', now())
    where id = v_proof.fee_id;
  end if;

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
  if not public.is_app_staff() then
    return jsonb_build_object('ok', false, 'error', 'not_permitted');
  end if;

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

-- 2. Restrict EXECUTE to authenticated only; the function self-guards staff.
revoke execute on function public.verify_payment_proof(uuid, uuid, text) from public, anon;
grant execute on function public.verify_payment_proof(uuid, uuid, text) to authenticated;

revoke execute on function public.reject_payment_proof(uuid, uuid, text) from public, anon;
grant execute on function public.reject_payment_proof(uuid, uuid, text) to authenticated;
