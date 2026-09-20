-- Fee engine: staff read access for payment proofs.
--
-- GAP FOUND DURING IMPLEMENTATION
-- ------------------------------------------------------------------
-- Migration 20260921020000 created only `payment_proofs_guardian_select`
-- (`guardian_user_id = auth.uid() or can_access_student(student_id)`).
-- A teacher is neither, so a teacher opening the review queue would see an
-- EMPTY list — the entire verification workflow was unreachable through the
-- RLS-scoped server client.
--
-- Fix: additive SELECT policy scoped to staff who actually teach the student.
-- `is_student_staff()` is SECURITY DEFINER and reads `students` outside RLS,
-- so calling it from a policy on `payment_proofs` cannot recurse.
--
-- This is additive only. No existing policy is dropped or narrowed.

drop policy if exists payment_proofs_staff_select on public.payment_proofs;
create policy payment_proofs_staff_select
  on public.payment_proofs
  for select
  to authenticated
  using (
    public.is_app_staff()
    and public.is_student_staff(student_id)
  );

comment on policy payment_proofs_staff_select on public.payment_proofs is
  'Teachers can read payment proofs for students they teach. Read-only: approval still requires the is_app_staff()-guarded verify_payment_proof RPC.';

-- Receipts already have `payment_receipts_staff_write` (FOR ALL), which covers
-- SELECT for staff. No change needed there.
