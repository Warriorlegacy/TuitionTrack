#!/usr/bin/env node
/**
 * Parent-portal security verification (brief §104).
 *
 * Proves, against the LIVE database, that the new authorization model behaves
 * as claimed. This is an assertions script, not a report generator: it exits
 * non-zero on the first failed claim.
 *
 * What it proves:
 *   1. students.parent_email no longer confers access (the old exploit is dead)
 *   2. access requires an active, verified relationship row
 *   3. an unverified (pending) relationship confers nothing
 *   4. a revoked relationship confers nothing
 *   5. an invite token is stored only as a hash
 *   6. redemption is single-use
 *   7. an expired invite cannot be redeemed
 *   8. a revoked invite cannot be redeemed
 *   9. a parent cannot SELECT parent_invites (no token hash exposure)
 *  10. permission defaults are closed for side-effecting actions
 *
 * Uses the service-role/admin connection for setup, then impersonates a
 * specific user by setting the JWT claims inside a transaction, so RLS and
 * auth.uid() are evaluated exactly as they would be in production.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local tests/parent-portal-security.mjs
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
 * Run `fn` as the given user: sets request.jwt.claims so auth.uid()/auth.jwt()
 * resolve, then restores the admin role and clears the claims afterwards.
 *
 * Deliberately does NOT open its own transaction. An earlier version wrapped
 * each call in begin/rollback, but the outer fixture transaction was already
 * open, so the inner rollback silently discarded all fixtures. Savepoints keep
 * the blast radius of a failing assertion small without touching the outer tx.
 */
async function asUser(userId, email, fn) {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await client.query(`savepoint ${sp}`);
  try {
    await client.query(`select set_config('role', 'authenticated', true)`);
    await client.query(
      `select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: userId, email, role: "authenticated" })],
    );
    return await fn();
  } finally {
    // Back to admin so fixture writes below are not subject to RLS.
    await client.query(`select set_config('role', 'postgres', true)`);
    await client.query(`select set_config('request.jwt.claims', '', true)`);
    await client.query(`release savepoint ${sp}`).catch(() => {});
  }
}

const id = () => crypto.randomUUID();

// ── Fixtures: created inside the script, removed in `finally` ────────────────
const IN_TX = true; // fixtures live in a long transaction rolled back at the end

await client.query("begin");

let teacherId, parentAId, parentBId, studentAId, studentBId;

try {
  teacherId = id();
  parentAId = id();
  parentBId = id();
  studentAId = id();
  studentBId = id();

  // Real auth.users rows are needed for the FKs on public.users.
  for (const [uid, email, role, name] of [
    [teacherId, `teacher-${uid_short(teacherId)}@tt-test.local`, "teacher", "Test Teacher"],
    [parentAId, `parentA-${uid_short(parentAId)}@tt-test.local`, "parent", "Parent A"],
    [parentBId, `parentB-${uid_short(parentBId)}@tt-test.local`, "parent", "Parent B"],
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

  const parentAEmail = `parentA-${uid_short(parentAId)}@tt-test.local`;

  await client.query(
    `insert into public.students (id, name, class, parent_name, parent_phone, parent_email, teacher_id)
     values ($1, 'Student A', '8', 'Parent A', '0000000000', $2, $3),
            ($4, 'Student B', '8', 'Parent B', '0000000000', null, $3)`,
    [studentAId, parentAEmail, teacherId, studentBId],
  );

  // ── Claim 1: the old exploit is dead ──────────────────────────────────────
  console.log("\n1. students.parent_email no longer confers access");
  const exploit = await asUser(parentAId, parentAEmail, async () => {
    // A row exists with parent_email = this user's email, but NO relationship.
    return client.query(`select public.can_access_student($1) as allowed`, [studentAId]);
  });
  check(
    "email-only match is denied by can_access_student",
    exploit.rows[0].allowed === false,
    `got ${exploit.rows[0].allowed}`,
  );

  const rowsVisible = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select id from public.students where id = $1`, [studentAId]),
  );
  check(
    "email-only match cannot SELECT the student row through RLS",
    rowsVisible.rowCount === 0,
    `got ${rowsVisible.rowCount} row(s)`,
  );

  const homeworkVisible = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select id from public.homework where student_id = $1`, [studentAId]),
  );
  check(
    "email-only match sees no homework",
    homeworkVisible.rowCount === 0,
    `got ${homeworkVisible.rowCount} row(s)`,
  );

  const feesVisible = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select id from public.fees where student_id = $1`, [studentAId]),
  );
  check(
    "email-only match sees no fees (previously an inline parent_email policy)",
    feesVisible.rowCount === 0,
    `got ${feesVisible.rowCount} row(s)`,
  );

  const attendanceVisible = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select id from public.attendance where student_id = $1`, [studentAId]),
  );
  check(
    "email-only match sees no attendance",
    attendanceVisible.rowCount === 0,
    `got ${attendanceVisible.rowCount} row(s)`,
  );

  // ── Claim 2: an invite produces a working, verifiable token ───────────────
  console.log("\n2. invite creation stores only a hash");
  const inviteResult = await asUser(teacherId, `teacher-${uid_short(teacherId)}@tt-test.local`, async () =>
    client.query(
      `select public.create_parent_invite($1, 'father', $2, null, 168, 'link') as r`,
      [studentAId, parentAEmail],
    ),
  );
  const inv = inviteResult.rows[0].r;
  check("create_parent_invite returned ok", inv.ok === true, JSON.stringify(inv));
  check("a raw token was returned once", typeof inv.token === "string" && inv.token.length > 30);

  const stored = await client.query(
    `select token_hash, status, invited_email, expires_at from public.parent_invites where id = $1`,
    [inv.invite_id],
  );
  check("exactly one invite row persisted", stored.rowCount === 1);
  check(
    "the raw token is NOT stored anywhere",
    stored.rows[0].token_hash !== inv.token,
  );
  check(
    "the stored value is the sha256 of the raw token",
    stored.rows[0].token_hash ===
      (await client.query(`select encode(digest($1,'sha256'),'hex') as h`, [inv.token])).rows[0].h,
    "hash mismatch",
  );
  check("invite starts pending", stored.rows[0].status === "pending");
  check(
    "invite carries no student id or personal data inside the token itself",
    !inv.token.includes(studentAId) && !inv.token.includes(parentAEmail),
  );

  // ── Claim 3: a parent cannot read the invite table ────────────────────────
  console.log("\n3. token hashes are not exposed to parents");
  const parentInviteRead = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select id, token_hash from public.parent_invites`),
  );
  check(
    "parent cannot SELECT parent_invites",
    parentInviteRead.rowCount === 0,
    `got ${parentInviteRead.rowCount} row(s)`,
  );

  // ── Claim 4: an unverified relationship grants nothing ────────────────────
  console.log("\n4. a pending relationship confers no access");
  await client.query(
    `insert into public.guardian_student_relationships
       (guardian_user_id, student_id, relationship_type, status, verified_at)
     values ($1, $2, 'guardian', 'pending', null)`,
    [parentBId, studentBId],
  );
  const pendingAccess = await asUser(parentBId, `parentB-${uid_short(parentBId)}@tt-test.local`, async () =>
    client.query(`select public.can_access_student($1) as allowed`, [studentBId]),
  );
  check(
    "pending relationship is denied",
    pendingAccess.rows[0].allowed === false,
    `got ${pendingAccess.rows[0].allowed}`,
  );

  // ── Claim 5: redemption works and is single-use ───────────────────────────
  console.log("\n5. redemption is single-use and verifies the guardian");
  const redeem1 = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select public.redeem_parent_invite($1) as r`, [inv.token]),
  );
  check("first redemption succeeds", redeem1.rows[0].r.ok === true, JSON.stringify(redeem1.rows[0].r));

  const afterRedeem = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select public.can_access_student($1) as allowed`, [studentAId]),
  );
  check(
    "after redemption, access is granted",
    afterRedeem.rows[0].allowed === true,
    `got ${afterRedeem.rows[0].allowed}`,
  );

  const redeem2 = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select public.redeem_parent_invite($1) as r`, [inv.token]),
  );
  check(
    "second redemption is rejected as already_used",
    redeem2.rows[0].r.ok === false && redeem2.rows[0].r.error === "already_used",
    JSON.stringify(redeem2.rows[0].r),
  );

  // ── Claim 6: Parent A cannot reach Student B ──────────────────────────────
  console.log("\n6. cross-family isolation (§104)");
  const crossAccess = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select public.can_access_student($1) as allowed`, [studentBId]),
  );
  check(
    "Parent A cannot access Student B",
    crossAccess.rows[0].allowed === false,
    `got ${crossAccess.rows[0].allowed}`,
  );

  const crossRows = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select id from public.students where id = $1`, [studentBId]),
  );
  check("Parent A cannot even SELECT Student B's row", crossRows.rowCount === 0);

  const crossRel = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select id from public.guardian_student_relationships where student_id = $1`, [studentBId]),
  );
  check(
    "Parent A cannot see Parent B's relationship row",
    crossRel.rowCount === 0,
    `got ${crossRel.rowCount}`,
  );

  // ── Claim 7: a parent cannot mint or forge relationships ──────────────────
  console.log("\n7. parents cannot escalate their own access");
  const forge = await asUser(parentAId, parentAEmail, async () => {
    // The insert is expected to raise, which poisons the transaction; a
    // savepoint lets us roll back just this statement and carry on.
    await client.query("savepoint forge_sp");
    try {
      await client.query(
        `insert into public.guardian_student_relationships
           (guardian_user_id, student_id, relationship_type, status, verified_at)
         values ($1, $2, 'father', 'active', now()) returning id`,
        [parentAId, studentBId],
      );
      await client.query("release savepoint forge_sp");
      return "inserted";
    } catch (e) {
      await client.query("rollback to savepoint forge_sp");
      return e.message;
    }
  });
  check("parent cannot INSERT a relationship row directly", forge !== "inserted", forge);

  const mint = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select public.create_parent_invite($1) as r`, [studentBId]),
  );
  check(
    "parent cannot mint an invite for another family's student",
    mint.rows[0].r.ok === false && mint.rows[0].r.error === "not_permitted",
    JSON.stringify(mint.rows[0].r),
  );

  // ── Claim 8: expired and revoked invites fail ─────────────────────────────
  console.log("\n8. expired and revoked invites are unusable");
  const expiredInv = await asUser(teacherId, `teacher-${uid_short(teacherId)}@tt-test.local`, async () =>
    client.query(
      `select public.create_parent_invite($1, 'mother', null, null, 1, 'link') as r`,
      [studentBId],
    ),
  );
  await client.query(
    `update public.parent_invites set expires_at = now() - interval '1 hour' where id = $1`,
    [expiredInv.rows[0].r.invite_id],
  );
  const redeemExpired = await asUser(parentBId, `parentB-${uid_short(parentBId)}@tt-test.local`, async () =>
    client.query(`select public.redeem_parent_invite($1) as r`, [expiredInv.rows[0].r.token]),
  );
  check(
    "expired invite is rejected",
    redeemExpired.rows[0].r.ok === false && redeemExpired.rows[0].r.error === "expired",
    JSON.stringify(redeemExpired.rows[0].r),
  );

  const revInv = await asUser(teacherId, `teacher-${uid_short(teacherId)}@tt-test.local`, async () =>
    client.query(`select public.create_parent_invite($1, 'guardian', null, null, 168, 'link') as r`, [
      studentBId,
    ]),
  );
  await client.query(`update public.parent_invites set status = 'revoked' where id = $1`, [
    revInv.rows[0].r.invite_id,
  ]);
  const redeemRevoked = await asUser(parentBId, `parentB-${uid_short(parentBId)}@tt-test.local`, async () =>
    client.query(`select public.redeem_parent_invite($1) as r`, [revInv.rows[0].r.token]),
  );
  check(
    "revoked invite is rejected",
    redeemRevoked.rows[0].r.ok === false && redeemRevoked.rows[0].r.error === "revoked",
    JSON.stringify(redeemRevoked.rows[0].r),
  );

  // ── Claim 9: an address-bound invite rejects the wrong account ────────────
  console.log("\n9. address-bound invites reject the wrong account");
  const bound = await asUser(teacherId, `teacher-${uid_short(teacherId)}@tt-test.local`, async () =>
    client.query(`select public.create_parent_invite($1, 'mother', $2, null, 168, 'link') as r`, [
      studentBId,
      parentAEmail,
    ]),
  );
  const wrongUser = await asUser(parentBId, `parentB-${uid_short(parentBId)}@tt-test.local`, async () =>
    client.query(`select public.redeem_parent_invite($1) as r`, [bound.rows[0].r.token]),
  );
  check(
    "wrong email cannot redeem an address-bound invite",
    wrongUser.rows[0].r.ok === false && wrongUser.rows[0].r.error === "email_mismatch",
    JSON.stringify(wrongUser.rows[0].r),
  );

  // ── Claim 10: garbage tokens fail ─────────────────────────────────────────
  console.log("\n10. malformed and unknown tokens are rejected");
  const junk = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select public.redeem_parent_invite($1) as r`, ["not-a-real-token-but-long-enough"]),
  );
  check(
    "unknown token is rejected",
    junk.rows[0].r.ok === false && junk.rows[0].r.error === "invalid_token",
    JSON.stringify(junk.rows[0].r),
  );
  const short = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select public.redeem_parent_invite($1) as r`, ["abc"]),
  );
  check(
    "too-short token is rejected",
    short.rows[0].r.ok === false,
    JSON.stringify(short.rows[0].r),
  );

  // ── Claim 11: permission defaults are closed for side effects ────────────
  console.log("\n11. permission defaults");
  const perms = await asUser(parentAId, parentAEmail, async () =>
    client.query(
      `select public.parent_has_permission($1,'view_test_results') as view_tests,
              public.parent_has_permission($1,'view_academic_progress') as view_progress,
              public.parent_has_permission($1,'message_teacher') as msg_teacher,
              public.parent_has_permission($1,'book_ptm') as book_ptm,
              public.parent_has_permission($1,'view_fees') as view_fees,
              public.parent_has_permission($1,'nonsense_permission') as unknown`,
      [studentAId],
    ),
  );
  const p = perms.rows[0];
  check("read-only visibility defaults on (test results)", p.view_tests === true);
  check("read-only visibility defaults on (academic progress)", p.view_progress === true);
  check("side-effecting action defaults off (message teacher)", p.msg_teacher === false);
  check("side-effecting action defaults off (book PTM)", p.book_ptm === false);
  check("financial visibility defaults off (view fees)", p.view_fees === false);
  check("unknown permission resolves to false", p.unknown === false);

  // ── Claim 12: explicit permission override wins ───────────────────────────
  console.log("\n12. explicit permission grants override the default");
  const rel = await client.query(
    `select id from public.guardian_student_relationships
     where guardian_user_id = $1 and student_id = $2`,
    [parentAId, studentAId],
  );
  await client.query(
    `insert into public.parent_permissions (relationship_id, permission, allowed)
     values ($1, 'view_fees', true), ($1, 'view_test_results', false)`,
    [rel.rows[0].id],
  );
  const overridden = await asUser(parentAId, parentAEmail, async () =>
    client.query(
      `select public.parent_has_permission($1,'view_fees') as fees,
              public.parent_has_permission($1,'view_test_results') as tests`,
      [studentAId],
    ),
  );
  check("explicit view_fees=true is honoured", overridden.rows[0].fees === true);
  check("explicit view_test_results=false revokes a default-on permission",
    overridden.rows[0].tests === false);

  // ── Claim 13: revocation actually removes access ──────────────────────────
  console.log("\n13. revoking a relationship removes access");
  await client.query(
    `update public.guardian_student_relationships
     set status = 'revoked', revoked_at = now()
     where guardian_user_id = $1 and student_id = $2`,
    [parentAId, studentAId],
  );
  const afterRevoke = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select public.can_access_student($1) as allowed`, [studentAId]),
  );
  check(
    "revoked relationship is denied",
    afterRevoke.rows[0].allowed === false,
    `got ${afterRevoke.rows[0].allowed}`,
  );

  // ── Claim 15: the preview endpoint is narrow and honest ───────────────────
  console.log("\n15. invite preview exposes names only");
  const previewInv = await asUser(teacherId, `teacher-${uid_short(teacherId)}@tt-test.local`, async () =>
    client.query(`select public.create_parent_invite($1, 'mother', null, null, 168, 'link') as r`, [
      studentBId,
    ]),
  );
  const pvToken = previewInv.rows[0].r.token;

  // Preview must work even with no session at all — the parent has not signed
  // in yet when they land on the acceptance page.
  const prevAnon = await (async () => {
    await client.query("savepoint prev_sp");
    try {
      await client.query(`select set_config('role', 'anon', true)`);
      await client.query(`select set_config('request.jwt.claims', '', true)`);
      return await client.query(`select public.preview_parent_invite($1) as r`, [pvToken]);
    } finally {
      await client.query(`select set_config('role', 'postgres', true)`);
      await client.query("release savepoint prev_sp").catch(() => {});
    }
  })();
  const pv = prevAnon.rows[0].r;
  check("anonymous caller can preview a valid invite", pv.ok === true, JSON.stringify(pv));
  check("preview returns the child's name", typeof pv.student_name === "string" && pv.student_name.length > 0);
  check("preview does NOT return the student id", pv.student_id === undefined);
  check("preview does NOT return the token", pv.token === undefined);
  check("preview does NOT return the token hash", pv.token_hash === undefined);
  check("preview does NOT leak parent contact details", pv.invited_phone === undefined);

  const prevBad = await (async () => {
    await client.query("savepoint prevbad_sp");
    try {
      await client.query(`select set_config('role', 'anon', true)`);
      return await client.query(`select public.preview_parent_invite($1) as r`, ["nonsense-token-value-here"]);
    } finally {
      await client.query(`select set_config('role', 'postgres', true)`);
      await client.query("release savepoint prevbad_sp").catch(() => {});
    }
  })();
  check(
    "preview of an unknown token fails closed",
    prevBad.rows[0].r.ok === false,
    JSON.stringify(prevBad.rows[0].r),
  );

  // A preview must not consume the invite.
  const redeemAfterPreview = await asUser(parentBId, `parentB-${uid_short(parentBId)}@tt-test.local`, async () =>
    client.query(`select public.redeem_parent_invite($1) as r`, [pvToken]),
  );
  check(
    "previewing an invite does not consume it",
    redeemAfterPreview.rows[0].r.ok === true,
    JSON.stringify(redeemAfterPreview.rows[0].r),
  );

  // ── Claim 16: teachers are unaffected ─────────────────────────────────────
  console.log("\n16. staff access is preserved");
  const teacherAccess = await asUser(teacherId, `teacher-${uid_short(teacherId)}@tt-test.local`, async () =>
    client.query(`select public.can_access_student($1) as allowed`, [studentAId]),
  );
  check(
    "assigned teacher still has access after the rewrite",
    teacherAccess.rows[0].allowed === true,
    `got ${teacherAccess.rows[0].allowed}`,
  );

  // ── Claim 17: assignments are gated by relationship, not by email ─────────
  // The old `assignments_student_parent_read` policy matched on
  // students.parent_email / student_email + class, which both locked out
  // legitimately invited guardians and over-granted by class.
  console.log("\n17. assignment access follows the guardian relationship");

  // Dedicated fixtures: parentA's link to student A was revoked in claim 13,
  // so this claim needs its own verified relationship.
  const assignForA = id();
  const assignForOther = id();
  const linkedStudentId = id();
  const unlinkedStudentId = id();
  await client.query(
    `insert into public.students (id, name, class, parent_name, parent_phone, teacher_id)
     values ($1, 'Linked Classmate', '8', 'Parent A', '0000000000', $2),
            ($3, 'Unlinked Classmate', '8', 'Someone Else', '0000000000', $2)`,
    [linkedStudentId, teacherId, unlinkedStudentId],
  );
  await client.query(
    `insert into public.guardian_student_relationships
       (guardian_user_id, student_id, relationship_type, status, verified_at)
     values ($1, $2, 'father', 'active', now())`,
    [parentAId, linkedStudentId],
  );
  await client.query(
    `insert into public.assignments
       (id, teacher_id, title, class_level, subject, chapter_slug, lifecycle,
        target_student_ids, total_marks, due_date)
     values ($1, $2, 'Coverage Linked', 8, 'Maths', 'c8-maths-01', 'published',
             $3::jsonb, 10, now() + interval '7 days'),
            ($4, $2, 'Coverage Unlinked', 8, 'Maths', 'c8-maths-02', 'published',
             $5::jsonb, 10, now() + interval '7 days')`,
    [
      assignForA,
      teacherId,
      JSON.stringify([linkedStudentId]),
      assignForOther,
      JSON.stringify([unlinkedStudentId]),
    ],
  );

  // A guardian with a VERIFIED relationship to student A (set up in claim 2/3).
  const parentAssignments = await asUser(parentAId, parentAEmail, async () =>
    client.query(`select id from public.assignments where id = any($1::uuid[])`, [
      [assignForA, assignForOther],
    ]),
  );
  const seenIds = parentAssignments.rows.map((r) => r.id);
  check(
    "the guardian sees the assignment targeting their own child",
    seenIds.includes(assignForA),
    `saw ${parentAssignments.rowCount}`,
  );
  check(
    "the guardian does NOT see a class-8 assignment targeting another child",
    !seenIds.includes(assignForOther),
    `saw ${parentAssignments.rowCount} row(s)`,
  );

  // A parent with NO relationship at all sees neither, even in the same class.
  const parentBAssignments = await asUser(
    parentBId,
    `parentB-${uid_short(parentBId)}@tt-test.local`,
    async () =>
      client.query(`select id from public.assignments where id = any($1::uuid[])`, [
        [assignForA, assignForOther],
      ]),
  );
  check(
    "an unlinked parent sees neither class-8 assignment",
    parentBAssignments.rowCount === 0,
    `saw ${parentBAssignments.rowCount} row(s)`,
  );

  // The owning teacher still sees both.
  const teacherAssignments = await asUser(
    teacherId,
    `teacher-${uid_short(teacherId)}@tt-test.local`,
    async () =>
      client.query(`select id from public.assignments where id = any($1::uuid[])`, [
        [assignForA, assignForOther],
      ]),
  );
  check(
    "the owning teacher still sees both assignments",
    teacherAssignments.rowCount === 2,
    `saw ${teacherAssignments.rowCount} row(s)`,
  );
} catch (err) {
  console.error("\nFATAL:", err.message);
  failed++;
  failures.push(`fatal: ${err.message}`);
} finally {
  await client.query("rollback");
  await client.end();
}

function uid_short(u) {
  return u.slice(0, 8);
}

console.log(`\n${"─".repeat(60)}`);
console.log(`parent portal security: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nfailed claims:");
  failures.forEach((f) => console.log(`  ✗ ${f}`));
}
console.log("─".repeat(60));
process.exit(failed === 0 ? 0 : 1);
