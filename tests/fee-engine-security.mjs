#!/usr/bin/env node
/**
 * Fee-engine security verification (brief §36–48, §42, §62, §65, §111).
 *
 * Proves against the LIVE database that:
 *   1. a parent sees only their own payment proofs (RLS)
 *   2. a parent cannot read another family's proof, even by id
 *   3. a parent cannot UPDATE or DELETE a proof (status changes are staff-only)
 *   4. a parent CANNOT self-verify — verify/reject RPCs refuse non-staff
 *   5. staff can read proofs for the students they teach (and only those)
 *   6. verification actually flips the fee to paid and issues a receipt
 *   7. a UTR already used on a verified payment cannot be reused
 *   8. a proof cannot be verified twice (no double receipt)
 *   9. invalid proofs are rejected at the schema level (amount > 0, UTR present)
 *  10. the screenshot bucket is private
 *  11. payment settings are configurable, single-active, and not hardcoded
 *
 * All fixtures live in one transaction that is always rolled back, so this
 * script never mutates real data. Impersonation sets request.jwt.claims inside
 * that transaction, so RLS and auth.uid() evaluate exactly as in production.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local tests/fee-engine-security.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

function loadEnv(file = ".env.local") {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k]) continue;
    process.env[k] = raw.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Run with --env-file-if-exists=.env.local");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/**
 * Impersonate `user`. `set_config(..., true)` is transaction-local, so this
 * must run inside the open fixture transaction — otherwise every subsequent
 * autocommit query loses the claims and auth.uid() returns null.
 */
async function asUser(userId, email, fn) {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await client.query(`savepoint ${sp}`);
  let result;
  let thrown = null;
  try {
    await client.query(`select set_config('role', 'authenticated', true)`);
    await client.query(
      `select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: userId, email, role: "authenticated" })],
    );
    result = await fn();
  } catch (e) {
    thrown = e;
  }

  // Roll back FIRST when fn() failed: the transaction is aborted at this point,
  // so any other statement (including the restore below) would raise 25P02 and
  // replace the real error, hiding why the assertion actually failed.
  if (thrown) {
    await client.query(`rollback to savepoint ${sp}`).catch(() => {});
  }
  await client.query(`select set_config('role', 'postgres', true)`).catch(() => {});
  await client.query(`select set_config('request.jwt.claims', '', true)`).catch(() => {});
  await client.query(`release savepoint ${sp}`).catch(() => {});
  if (thrown) throw thrown;
  return result;
}

/**
 * Run `fn` expecting it to fail, and roll back to a savepoint so the aborted
 * statement does not poison the surrounding fixture transaction.
 * Returns true when the statement failed with a message matching `pattern`.
 */
async function expectFail(fn, pattern) {
  const sp = `sp_x_${Math.random().toString(36).slice(2, 10)}`;
  await client.query(`savepoint ${sp}`);
  try {
    await fn();
    await client.query(`release savepoint ${sp}`).catch(() => {});
    return false;
  } catch (e) {
    await client.query(`rollback to savepoint ${sp}`).catch(() => {});
    await client.query(`release savepoint ${sp}`).catch(() => {});
    if (pattern && !pattern.test(e.message)) return false;
    return true;
  }
}

const id = () => crypto.randomUUID();
const uid_short = (u) => u.replace(/-/g, "").slice(0, 8);

await client.query("begin");

try {
  const teacherId = id();
  const otherTeacherId = id();
  const parentAId = id();
  const parentBId = id();
  const studentAId = id();
  const studentBId = id();

  const mkEmail = (prefix, uid) => `${prefix}-${uid_short(uid)}@tt-test.local`;
  const teacherEmail = mkEmail("teacher", teacherId);
  const otherTeacherEmail = mkEmail("teacher2", otherTeacherId);
  const parentAEmail = mkEmail("parentA", parentAId);
  const parentBEmail = mkEmail("parentB", parentBId);

  for (const [uid, email, role, name] of [
    [teacherId, teacherEmail, "teacher", "Fee Teacher"],
    [otherTeacherId, otherTeacherEmail, "teacher", "Unrelated Teacher"],
    [parentAId, parentAEmail, "parent", "Parent A"],
    [parentBId, parentBEmail, "parent", "Parent B"],
  ]) {
    await client.query(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        $2, '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
       on conflict (id) do nothing`,
      [uid, email],
    );
    await client.query(
      `insert into public.users (id, name, email, role) values ($1, $2, $3, $4)
       on conflict (id) do update set role = excluded.role`,
      [uid, name, email, role],
    );
  }

  await client.query(
    `insert into public.students (id, name, class, parent_name, parent_phone, teacher_id)
     values ($1, 'Fee Student A', '8', 'Parent A', '0000000000', $2),
            ($3, 'Fee Student B', '8', 'Parent B', '0000000000', $2)`,
    [studentAId, teacherId, studentBId],
  );

  await client.query(
    `insert into public.guardian_student_relationships
       (guardian_user_id, student_id, relationship_type, status, verified_at)
     values ($1, $2, 'father', 'active', now()),
            ($3, $4, 'mother', 'active', now())`,
    [parentAId, studentAId, parentBId, studentBId],
  );

  const feeAId = id();
  const feeBId = id();
  await client.query(
    `insert into public.fees (id, student_id, teacher_id, amount, status, due_date)
     values ($1, $2, $3, 1500, 'unpaid', current_date + 10),
            ($4, $5, $3, 900, 'unpaid', current_date + 10)`,
    [feeAId, studentAId, teacherId, feeBId, studentBId],
  );

  const proofAId = id();
  const proofBId = id();
  await client.query(
    `insert into public.payment_proofs
       (id, student_id, guardian_user_id, fee_id, amount, currency, utr_reference,
        screenshot_storage_path, screenshot_file_name, status, submitted_at, submitted_by)
     values ($1, $2, $3, $4, 1500, 'INR', 'UTRFEE0001', 'proofs/a/a.png', 'a.png',
             'proof_submitted', now(), $3),
            ($5, $6, $7, $8, 900, 'INR', 'UTRFEE0002', 'proofs/b/b.png', 'b.png',
             'proof_submitted', now(), $7)`,
    [proofAId, studentAId, parentAId, feeAId, proofBId, studentBId, parentBId, feeBId],
  );

  // ── 1. Parent scoping ─────────────────────────────────────────────────────
  console.log("\n1. a parent sees only their own family's proofs");
  const aList = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select id from public.payment_proofs order by id`),
  );
  check(
    "parent A sees exactly one proof (their own)",
    aList.rowCount === 1 && aList.rows[0].id === proofAId,
    `saw ${aList.rowCount}`,
  );

  const bProofAsA = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select id from public.payment_proofs where id = $1`, [proofBId]),
  );
  check(
    "parent A cannot read parent B's proof even by exact id",
    bProofAsA.rowCount === 0,
    `saw ${bProofAsA.rowCount} row(s)`,
  );

  // ── 2. Parents cannot mutate status ───────────────────────────────────────
  console.log("\n2. status changes are staff-only");
  const updateAttempt = await asUser(parentAId, parentAEmail, async () =>
    client.query(
      `update public.payment_proofs set status = 'verified' where id = $1`,
      [proofAId],
    ),
  );
  check(
    "parent A cannot UPDATE their own proof to verified",
    updateAttempt.rowCount === 0,
    `updated ${updateAttempt.rowCount} row(s)`,
  );

  const deleteAttempt = await asUser(parentAId, parentAEmail, async () =>
    client.query(`delete from public.payment_proofs where id = $1`, [proofAId]),
  );
  check(
    "parent A cannot DELETE their own proof",
    deleteAttempt.rowCount === 0,
    `deleted ${deleteAttempt.rowCount} row(s)`,
  );

  // ── 3. No self-verification (the §42 hole) ─────────────────────────────────
  console.log("\n3. a parent cannot approve their own payment");
  const selfVerify = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select public.verify_payment_proof($1, $2, 'self approval') as r`, [
      proofAId,
      parentAId,
    ]),
  );
  check(
    "verify_payment_proof refuses a non-staff caller",
    selfVerify.rows[0].r.ok === false && selfVerify.rows[0].r.error === "not_permitted",
    JSON.stringify(selfVerify.rows[0].r),
  );

  const selfReject = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select public.reject_payment_proof($1, $2, 'nope') as r`, [
      proofAId,
      parentAId,
    ]),
  );
  check(
    "reject_payment_proof refuses a non-staff caller",
    selfReject.rows[0].r.ok === false && selfReject.rows[0].r.error === "not_permitted",
    JSON.stringify(selfReject.rows[0].r),
  );

  const stillPending = await client.query(
    `select status from public.payment_proofs where id = $1`,
    [proofAId],
  );
  check(
    "the proof is untouched after the rejected self-approval attempts",
    stillPending.rows[0].status === "proof_submitted",
    `status=${stillPending.rows[0].status}`,
  );

  const feeUntouched = await client.query(
    `select status from public.fees where id = $1`,
    [feeAId],
  );
  check(
    "the fee is still unpaid — a screenshot never marks it paid",
    feeUntouched.rows[0].status === "unpaid",
    `fee status=${feeUntouched.rows[0].status}`,
  );

  // ── 4. Staff read scoping ─────────────────────────────────────────────────
  console.log("\n4. staff see the proofs of the students they teach");
  const staffList = await asUser(teacherId, teacherEmail, async () =>
    client.query(`select id from public.payment_proofs`),
  );
  check(
    "the teaching teacher sees both proofs",
    staffList.rowCount === 2,
    `saw ${staffList.rowCount}`,
  );

  const otherStaffList = await asUser(otherTeacherId, otherTeacherEmail, async () =>
    client.query(`select id from public.payment_proofs`),
  );
  check(
    "an unrelated teacher sees none of them",
    otherStaffList.rowCount === 0,
    `saw ${otherStaffList.rowCount}`,
  );

  // ── 5. Staff verification ─────────────────────────────────────────────────
  console.log("\n5. verification flips the fee and issues a receipt");
  const verify = await asUser(teacherId, teacherEmail, async () =>
    client.query(`select public.verify_payment_proof($1, $2, 'confirmed in bank') as r`, [
      proofAId,
      teacherId,
    ]),
  );
  check("staff verification succeeds", verify.rows[0].r.ok === true, JSON.stringify(verify.rows[0].r));

  const afterVerify = await client.query(
    `select status, reviewed_by, review_notes from public.payment_proofs where id = $1`,
    [proofAId],
  );
  check("proof status is verified", afterVerify.rows[0].status === "verified");
  check(
    "the reviewer is recorded",
    afterVerify.rows[0].reviewed_by === teacherId,
    `reviewed_by=${afterVerify.rows[0].reviewed_by}`,
  );

  const feeAfter = await client.query(`select status from public.fees where id = $1`, [feeAId]);
  check(
    "the linked fee is now paid",
    feeAfter.rows[0].status === "paid",
    `fee status=${feeAfter.rows[0].status}`,
  );

  const receipt = await client.query(
    `select id, receipt_number, amount, payment_proof_id from public.payment_receipts
     where payment_proof_id = $1`,
    [proofAId],
  );
  check("exactly one receipt was issued", receipt.rowCount === 1, `got ${receipt.rowCount}`);
  check(
    "the receipt number is a real generated sequence value",
    /^TT-\d{4}-\d{6}$/.test(receipt.rows[0]?.receipt_number ?? ""),
    `got ${receipt.rows[0]?.receipt_number}`,
  );
  check(
    "the receipt carries the verified amount",
    Number(receipt.rows[0]?.amount) === 1500,
    `got ${receipt.rows[0]?.amount}`,
  );

  // ── 6. Double verification ────────────────────────────────────────────────
  console.log("\n6. no double verification, no duplicate receipts");
  const reVerify = await asUser(teacherId, teacherEmail, async () =>
    client.query(`select public.verify_payment_proof($1, $2, null) as r`, [proofAId, teacherId]),
  );
  check(
    "re-verifying a verified proof is refused",
    reVerify.rows[0].r.ok === false,
    JSON.stringify(reVerify.rows[0].r),
  );
  const receiptCount = await client.query(
    `select count(*)::int as n from public.payment_receipts where payment_proof_id = $1`,
    [proofAId],
  );
  check("still exactly one receipt", receiptCount.rows[0].n === 1, `got ${receiptCount.rows[0].n}`);

  // ── 7. UTR reuse ──────────────────────────────────────────────────────────
  console.log("\n7. a UTR already used on a verified payment cannot be reused");
  const proofCId = id();
  await client.query(
    `insert into public.payment_proofs
       (id, student_id, guardian_user_id, fee_id, amount, currency, utr_reference, status,
        submitted_at, submitted_by)
     values ($1, $2, $3, $4, 1500, 'INR', 'UTRFEE0001', 'proof_submitted', now(), $3)`,
    [proofCId, studentBId, parentBId, feeBId],
  );
  const reuse = await asUser(teacherId, teacherEmail, async () =>
    client.query(`select public.verify_payment_proof($1, $2, null) as r`, [proofCId, teacherId]),
  );
  check(
    "verification rejects the reused UTR",
    reuse.rows[0].r.ok === false && reuse.rows[0].r.error === "duplicate_utr",
    JSON.stringify(reuse.rows[0].r),
  );
  const feeBStill = await client.query(`select status from public.fees where id = $1`, [feeBId]);
  check(
    "fee B stayed unpaid after the duplicate-UTR rejection",
    feeBStill.rows[0].status === "unpaid",
    `fee status=${feeBStill.rows[0].status}`,
  );

  // ── 8. Missing reference is refused ───────────────────────────────────────
  // A proof still at `payment_initiated` legitimately has no UTR yet — that is
  // the only status where a null reference is legal (CHECK constraint).
  console.log("\n8. a proof with no reference cannot be verified");
  const proofDId = id();
  await client.query(
    `insert into public.payment_proofs
       (id, student_id, guardian_user_id, fee_id, amount, currency, status, submitted_at,
        submitted_by)
     values ($1, $2, $3, $4, 900, 'INR', 'payment_initiated', now(), $3)`,
    [proofDId, studentBId, parentBId, feeBId],
  );
  const noRef = await asUser(teacherId, teacherEmail, async () =>
    client.query(`select public.verify_payment_proof($1, $2, null) as r`, [proofDId, teacherId]),
  );
  check(
    "verification rejects a proof with no UTR",
    noRef.rows[0].r.ok === false && noRef.rows[0].r.error === "missing_reference",
    JSON.stringify(noRef.rows[0].r),
  );

  // ── 9. Rejection ──────────────────────────────────────────────────────────
  console.log("\n9. rejection records a reason and leaves the fee unpaid");
  await client.query(
    `update public.payment_proofs set utr_reference = 'UTRFEE0003' where id = $1`,
    [proofCId],
  );
  const reject = await asUser(teacherId, teacherEmail, async () =>
    client.query(`select public.reject_payment_proof($1, $2, 'not found in statement') as r`, [
      proofCId,
      teacherId,
    ]),
  );
  check("staff rejection succeeds", reject.rows[0].r.ok === true, JSON.stringify(reject.rows[0].r));
  const rejectedRow = await client.query(
    `select status, rejection_reason from public.payment_proofs where id = $1`,
    [proofCId],
  );
  check("status is rejected", rejectedRow.rows[0].status === "rejected");
  check(
    "the reason is stored for the parent to read",
    rejectedRow.rows[0].rejection_reason === "not found in statement",
  );

  // ── 10. Schema-level guards ───────────────────────────────────────────────
  console.log("\n10. invalid proofs are rejected by the schema");
  const zeroAmountBlocked = await expectFail(
    () =>
      client.query(
        `insert into public.payment_proofs
           (id, student_id, guardian_user_id, amount, currency, utr_reference, status,
            submitted_at, submitted_by)
         values ($1, $2, $3, 0, 'INR', 'X', 'proof_submitted', now(), $3)`,
        [id(), studentAId, parentAId],
      ),
    /payment_proofs_amount_positive/,
  );
  check("a zero-amount proof cannot be inserted", zeroAmountBlocked);

  const nullUtrBlocked = await expectFail(
    () =>
      client.query(
        `insert into public.payment_proofs
           (id, student_id, guardian_user_id, amount, currency, status, submitted_at, submitted_by)
         values ($1, $2, $3, 100, 'INR', 'proof_submitted', now(), $3)`,
        [id(), studentAId, parentAId],
      ),
    /payment_proofs_utr_when_submitted/,
  );
  check("a submitted proof with no UTR cannot be inserted", nullUtrBlocked);

  // ── 11. Guardian insert scoping ───────────────────────────────────────────
  console.log("\n11. a guardian may only submit proofs for their own child");
  const ownChildInsert = await expectFail(
    () =>
      asUser(parentAId, parentAEmail, async () =>
        client.query(
          `insert into public.payment_proofs
             (id, student_id, guardian_user_id, amount, currency, utr_reference, status,
              submitted_at, submitted_by)
           values ($1, $2, $3, 500, 'INR', 'UTROWN1', 'proof_submitted', now(), $3)`,
          [id(), studentAId, parentAId],
        ),
      ),
    null,
  );
  check("a guardian CAN submit a proof for their own child", ownChildInsert === false);

  const otherChildBlocked = await expectFail(
    () =>
      asUser(parentAId, parentAEmail, async () =>
        client.query(
          `insert into public.payment_proofs
             (id, student_id, guardian_user_id, amount, currency, utr_reference, status,
              submitted_at, submitted_by)
           values ($1, $2, $3, 500, 'INR', 'UTRFORGE1', 'proof_submitted', now(), $3)`,
          [id(), studentBId, parentAId],
        ),
      ),
    /row-level security/,
  );
  check("a guardian CANNOT submit a proof for another family's child", otherChildBlocked);

  // ── 12. Storage privacy ───────────────────────────────────────────────────
  console.log("\n12. screenshots are stored privately");
  const bucket = await client.query(
    `select public from storage.buckets where id = 'payment-proofs'`,
  );
  check("the payment-proofs bucket exists", bucket.rowCount === 1);
  check(
    "the payment-proofs bucket is NOT public",
    bucket.rows[0]?.public === false,
    `public=${bucket.rows[0]?.public}`,
  );

  // ── 13. Payment settings ──────────────────────────────────────────────────
  console.log("\n13. payment settings are configurable, not hardcoded");
  const activeSettings = await client.query(
    `select count(*)::int as n from public.payment_settings where active is true`,
  );
  check(
    "exactly one active payment settings row",
    activeSettings.rows[0].n === 1,
    `got ${activeSettings.rows[0].n}`,
  );

  const settings = await client.query(
    `select upi_id, currency, payment_whatsapp_number from public.payment_settings
     where active is true`,
  );
  check(
    "the configured UPI ID is present in the database",
    typeof settings.rows[0]?.upi_id === "string" && settings.rows[0].upi_id.length > 0,
  );
  check(
    "the configured WhatsApp number is present in the database",
    typeof settings.rows[0]?.payment_whatsapp_number === "string" &&
      settings.rows[0].payment_whatsapp_number.length > 0,
  );

  let settingsForgeBlocked = false;
  try {
    await asUser(parentAId, parentAEmail, async () =>
      client.query(
        `update public.payment_settings set upi_id = 'attacker@bank' where active is true`,
      ),
    );
    const forged = await client.query(
      `select upi_id from public.payment_settings where active is true`,
    );
    settingsForgeBlocked = forged.rows[0].upi_id !== "attacker@bank";
  } catch {
    settingsForgeBlocked = true;
  }
  check("a parent cannot rewrite the receiving UPI ID", settingsForgeBlocked);
} finally {
  await client.query("rollback");
  await client.end();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailed claims:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
