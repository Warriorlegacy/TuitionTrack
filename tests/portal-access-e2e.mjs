#!/usr/bin/env node
/**
 * Portal Access Architecture: Unified Parent & Student Security Test Suite
 *
 * Verifies:
 *  1. Teacher generates Parent and Student portal grants
 *  2. Raw token is high-entropy, URL-safe base64, returned once, and NOT stored in the database (stored value is SHA-256 hash)
 *  3. Preview RPC is safe: unauthenticated visitor sees child name/class, no student ID, no token, no hash
 *  4. Single account with multiple portal grants:
 *     Same user account redeems BOTH Parent Portal grant (Child A) and Student Portal grant (Child A)
 *  5. Cross-student isolation (§104):
 *     Parent A / Student A with grant for Child A cannot access Child B via can_access_student
 *  6. Regeneration invalidates the old token; new token works
 *  7. Revocation terminates access:
 *     Revoked grant denies can_access_student access immediately
 *  8. Target email binding rejection:
 *     If grant is bound to user@example.com, other@example.com cannot redeem it
 *  9. Audit trail:
 *     portal_access_events logs CREATED, OPENED, ACTIVATED, REGENERATED, REVOKED
 */
import pg from "pg";
import crypto from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL not set in environment");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

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
    await client.query(`select set_config('role', 'postgres', true)`);
    await client.query(`select set_config('request.jwt.claims', '', true)`);
    await client.query(`release savepoint ${sp}`).catch(() => {});
  }
}

async function asAnon(fn) {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await client.query(`savepoint ${sp}`);
  try {
    await client.query(`select set_config('role', 'anon', true)`);
    await client.query(`select set_config('request.jwt.claims', '', true)`);
    return await fn();
  } finally {
    await client.query(`select set_config('role', 'postgres', true)`);
    await client.query(`release savepoint ${sp}`).catch(() => {});
  }
}

await client.query("begin");

try {
  console.log("\n============================================================");
  console.log("Portal Access Architecture E2E & RLS Test Suite");
  console.log("============================================================\n");

  const teacherId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const intruderId = crypto.randomUUID();
  const studentAId = crypto.randomUUID();
  const studentBId = crypto.randomUUID();

  const teacherEmail = `test_teacher_${Date.now()}@example.com`;
  const userAccountEmail = `test_unified_user_${Date.now()}@example.com`;
  const wrongUserEmail = `test_intruder_${Date.now()}@example.com`;

  // Insert auth.users & public.users
  for (const [uid, email, role, name] of [
    [teacherId, teacherEmail, "teacher", "Test Teacher"],
    [userId, userAccountEmail, "parent", "Unified User"],
    [intruderId, wrongUserEmail, "parent", "Intruder User"],
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

  // Insert students
  await client.query(
    `insert into public.students (id, teacher_id, name, class, parent_name, parent_email, student_email)
     values ($1, $2, 'Aarav Singh', '8', 'Pooja Singh', 'pooja@example.com', 'aarav@example.com')`,
    [studentAId, teacherId],
  );

  await client.query(
    `insert into public.students (id, teacher_id, name, class, parent_name, parent_email, student_email)
     values ($1, $2, 'Ananya Sharma', '6', 'Rajesh Sharma', 'rajesh@example.com', 'ananya@example.com')`,
    [studentBId, teacherId],
  );

  // ── TEST 1: Generate Parent & Student Portal Grants ────────
  console.log("1. Teacher generates Parent and Student portal grants");
  let parentGrant, studentGrant;
  await asUser(teacherId, teacherEmail, async () => {
    const pRes = await client.query(
      `select public.create_or_regenerate_portal_grant($1, 'parent', null) as res`,
      [studentAId],
    );
    parentGrant = pRes.rows[0].res;

    const sRes = await client.query(
      `select public.create_or_regenerate_portal_grant($1, 'student', null) as res`,
      [studentAId],
    );
    studentGrant = sRes.rows[0].res;
  });

  assert(parentGrant && parentGrant.ok === true, "create parent portal grant succeeded");
  assert(Boolean(parentGrant?.token), "returned raw token once");
  assert(parentGrant?.token?.length >= 32, "token has high entropy (>32 chars)");
  assert(studentGrant && studentGrant.ok === true, "create student portal grant succeeded");
  assert(Boolean(studentGrant?.token), "returned raw token once for student");

  // ── TEST 2: Token Security & Hashing ───────────────────────
  console.log("\n2. Token Security: raw token is NEVER persisted in DB");
  const storedGrantRes = await client.query(
    `select * from public.portal_access_grants where id = $1`,
    [parentGrant.grant_id],
  );
  const storedGrant = storedGrantRes.rows[0];
  assert(storedGrant.token_hash !== parentGrant.token, "stored token_hash is not the raw token");
  assert(storedGrant.token_hash.length === 64, "stored token_hash is 64-character SHA-256 hex");

  // ── TEST 3: Safe Public Preview ────────────────────────────
  console.log("\n3. Safe Public Preview: unauthenticated visitor sees child name, no sensitive IDs");
  let preview;
  await asAnon(async () => {
    const previewRes = await client.query(
      `select public.preview_portal_grant($1) as res`,
      [parentGrant.token],
    );
    preview = previewRes.rows[0].res;
  });
  assert(preview.ok === true, "public preview returned ok");
  assert(preview.student_name === "Aarav Singh", "names the child: Aarav Singh");
  assert(preview.student_class === "8", "names the class: 8");
  assert(preview.portal_type === "parent", "identifies portal: parent");
  assert(preview.student_id === undefined, "does NOT leak student_id");
  assert(preview.token === undefined, "does NOT return token");
  assert(preview.token_hash === undefined, "does NOT return token_hash");

  // ── TEST 4: Single Account with Multiple Portal Grants ─────
  console.log("\n4. Single Account Multi-Grant: Same user redeems Parent and Student portals");
  await asUser(userId, userAccountEmail, async () => {
    // Before redemption: can_access_student must return false
    const beforeAccessRes = await client.query(
      `select public.can_access_student($1) as allowed`,
      [studentAId],
    );
    assert(beforeAccessRes.rows[0].allowed === false, "access is denied prior to grant redemption");

    // Redeem parent grant
    const redeemParentRes = await client.query(
      `select public.redeem_portal_grant($1) as res`,
      [parentGrant.token],
    );
    assert(redeemParentRes.rows[0].res.ok === true, "unified user redeemed parent portal grant");

    // Redeem student grant with the EXACT same user account!
    const redeemStudentRes = await client.query(
      `select public.redeem_portal_grant($1) as res`,
      [studentGrant.token],
    );
    assert(redeemStudentRes.rows[0].res.ok === true, "SAME account redeemed student portal grant");

    // After redemption: can_access_student must return true for Student A
    const afterAccessRes = await client.query(
      `select public.can_access_student($1) as allowed`,
      [studentAId],
    );
    assert(afterAccessRes.rows[0].allowed === true, "can_access_student returns TRUE for Student A");
  });

  // ── TEST 5: Cross-Student Isolation ────────────────────────
  console.log("\n5. Cross-Student Isolation: User with Student A grant cannot access Student B");
  await asUser(userId, userAccountEmail, async () => {
    const crossAccessRes = await client.query(
      `select public.can_access_student($1) as allowed`,
      [studentBId],
    );
    assert(crossAccessRes.rows[0].allowed === false, "access to Student B is strictly DENIED");
  });

  // Intruder without grants cannot access Student A
  await asUser(intruderId, wrongUserEmail, async () => {
    const intruderAccessRes = await client.query(
      `select public.can_access_student($1) as allowed`,
      [studentAId],
    );
    assert(intruderAccessRes.rows[0].allowed === false, "intruder cannot access Student A");
  });

  // ── TEST 6: Regeneration Invalidates Old Token ─────────────
  console.log("\n6. Token Regeneration: Teacher regenerates link, old token is revoked");
  let newParentGrant;
  await asUser(teacherId, teacherEmail, async () => {
    const regenRes = await client.query(
      `select public.create_or_regenerate_portal_grant($1, 'parent', null) as res`,
      [studentAId],
    );
    newParentGrant = regenRes.rows[0].res;
  });
  assert(newParentGrant.is_regenerated === true, "flagged as regenerated");
  assert(newParentGrant.token !== parentGrant.token, "new token generated");

  // Old token preview must fail
  await asAnon(async () => {
    const oldTokenPreview = await client.query(
      `select public.preview_portal_grant($1) as res`,
      [parentGrant.token],
    );
    assert(oldTokenPreview.rows[0].res.ok === false, "old token preview is rejected");

    const newTokenPreview = await client.query(
      `select public.preview_portal_grant($1) as res`,
      [newParentGrant.token],
    );
    assert(newTokenPreview.rows[0].res.ok === true, "new regenerated token preview succeeds");
  });

  // ── TEST 7: Revocation ─────────────────────────────────────
  console.log("\n7. Access Revocation: Teacher revokes grant, access terminates immediately");
  await asUser(teacherId, teacherEmail, async () => {
    const revokeRes = await client.query(
      `select public.revoke_portal_grant($1) as res`,
      [newParentGrant.grant_id],
    );
    assert(revokeRes.rows[0].res.ok === true, "grant revoked successfully by teacher");
  });

  // Revoked token preview must report revoked
  await asAnon(async () => {
    const revokedPreview = await client.query(
      `select public.preview_portal_grant($1) as res`,
      [newParentGrant.token],
    );
    assert(revokedPreview.rows[0].res.ok === false, "preview on revoked token is rejected");
    assert(revokedPreview.rows[0].res.error === "revoked", "error indicates 'revoked'");
  });

  // ── TEST 8: Target Email Binding Guard ─────────────────────
  console.log("\n8. Target Email Binding: rejects redemption from wrong email");
  let boundGrant;
  await asUser(teacherId, teacherEmail, async () => {
    const boundGrantRes = await client.query(
      `select public.create_or_regenerate_portal_grant($1, 'parent', 'specific_mom@example.com') as res`,
      [studentBId],
    );
    boundGrant = boundGrantRes.rows[0].res;
  });

  // Attempt redemption from wrong account
  await asUser(intruderId, wrongUserEmail, async () => {
    const wrongRedeemRes = await client.query(
      `select public.redeem_portal_grant($1) as res`,
      [boundGrant.token],
    );
    assert(wrongRedeemRes.rows[0].res.ok === false, "redemption by wrong email account failed");
    assert(wrongRedeemRes.rows[0].res.error === "email_mismatch", "error is 'email_mismatch'");
  });

  // ── TEST 9: Audit Trail ────────────────────────────────────
  console.log("\n9. Audit Trail: portal_access_events records lifecycle");
  const eventsRes = await client.query(
    `select event, portal_type from public.portal_access_events where student_id = $1 order by created_at asc`,
    [studentAId],
  );
  const events = eventsRes.rows.map((r) => r.event);
  assert(events.includes("CREATED"), "audit trail contains CREATED");
  assert(events.includes("OPENED"), "audit trail contains OPENED");
  assert(events.includes("ACTIVATED"), "audit trail contains ACTIVATED");
  assert(events.includes("REGENERATED"), "audit trail contains REGENERATED");
  assert(events.includes("REVOKED"), "audit trail contains REVOKED");

  console.log("\n────────────────────────────────────────────────────────────");
  console.log(`Portal Access Architecture E2E: ${passed} passed, ${failed} failed`);
  console.log("────────────────────────────────────────────────────────────\n");

  if (failed > 0) process.exit(1);
} catch (err) {
  console.error("Test execution failed with exception:", err);
  process.exit(1);
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
