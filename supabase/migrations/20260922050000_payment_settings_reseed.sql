-- Reseed the default active payment_settings row.
--
-- The fee-engine migration (20260921020000) seeds exactly one active row, but
-- the live database currently has zero active rows (the seed row was deleted
-- or deactivated after the fact). tests/fee-engine-security.mjs requires
-- exactly one active row, and /parent/fees needs it to display UPI details.
--
-- Idempotent: inserts only when no active row exists. Never destructive.

insert into public.payment_settings (upi_id, upi_display_name, payment_whatsapp_number, currency, active)
select '6202442690@jio', 'TuitionTrack', '6202442690', 'INR', true
where not exists (select 1 from public.payment_settings where active is true);
