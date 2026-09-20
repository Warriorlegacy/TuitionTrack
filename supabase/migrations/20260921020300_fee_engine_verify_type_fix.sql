-- Fee engine: fix a fatal type bug in verify_payment_proof.
--
-- DEFECT FOUND BY tests/fee-engine-security.mjs
-- ------------------------------------------------------------------
-- `verify_payment_proof` declared:
--
--     v_trusted boolean;
--     ...
--     insert into public.payment_receipts (...) returning id into v_trusted;
--
-- `payment_receipts.id` is uuid, so the assignment raised
-- "column v_trusted is of type boolean but expression is of type uuid".
-- Because plpgsql aborts the whole function, EVERY verification attempt
-- failed — no fee was ever marked paid and no receipt was ever issued.
-- The four guards that ran before the insert (not_permitted, not_found,
-- already_final, missing_reference, duplicate_utr) worked, which is why
-- the negative tests passed while the positive path blew up.
--
-- Fix: declare the variable as uuid. The function body is otherwise
-- unchanged. Re-declared in full so the migration is idempotent and the
-- is_app_staff() guard from 20260921020100 is preserved.

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
  v_receipt_id uuid;
begin
  -- Staff-only. SECURITY DEFINER functions are executable by PUBLIC unless
  -- revoked, so this re-check is load-bearing, not decorative.
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

  -- Flip the linked fee to paid. A reconciliation mismatch is surfaced to the
  -- reviewer as a flag but never blocks verification — the human decides.
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
  returning id into v_receipt_id;

  update public.payment_proofs set receipt_id = v_receipt_id where id = v_proof.id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (
    p_reviewer_id, 'payment_proof_verified', 'payment_proof', v_proof.id::text,
    jsonb_build_object(
      'student_id', v_proof.student_id,
      'amount', v_proof.amount,
      'utr_reference', v_proof.utr_reference,
      'receipt_id', v_receipt_id,
      'actor_email', null,
      'result', 'success'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'proof_id', v_proof.id,
    'receipt_id', v_receipt_id
  );
end $$;

-- SECURITY DEFINER defaults to granting EXECUTE to PUBLIC. Keep it closed.
revoke execute on function public.verify_payment_proof(uuid, uuid, text) from public, anon;
grant execute on function public.verify_payment_proof(uuid, uuid, text) to authenticated;
