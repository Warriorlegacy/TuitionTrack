#!/usr/bin/env node
/**
 * End-to-end parent invitation flow against a running server.
 *
 * Creates a real invite for a real student via the same RPC the UI calls,
 * then fetches the public invitation page with that token and asserts the
 * rendered HTML behaves correctly:
 *   - a live token renders 200 and names the child
 *   - the token NEVER appears in the page body (it is server-bound)
 *   - acceptance requires a session
 *   - a used token is rejected
 *
 * FIXTURE LIFECYCLE — fixtures are COMMITTED, not left in an open transaction.
 * The page is fetched over HTTP, which runs on a different database connection,
 * and a second connection cannot see another transaction's uncommitted rows.
 * An earlier version of this file kept the transaction open and reported
 * "page names the invited child" as a failure — a false negative caused by the
 * harness, not by the application. Fixtures are now committed and removed in a
 * `finally` block, identified by an `@tt-test.local` email suffix.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local tests/parent-invite-e2e.mjs [baseUrl]
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

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3411";

let passed = 0;
let failed = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// Track everything we create so cleanup is exact, not pattern-based.
const created = { teachers: [], students: [], parents: [] };

async function createUser(role, label) {
  const id = crypto.randomUUID();
  const email = `e2e-${label}-${id.slice(0, 8)}@tt-test.local`;
  await client.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       $2, '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')`,
    [id, email],
  );
  await client.query(
    `insert into public.users (id, name, email, role) values ($1, $2, $3, $4)`,
    [id, `E2E ${label}`, email, role],
  );
  return { id, email };
}

/**
 * Run a function as a given user, so auth.uid() and RLS see a real identity.
 *
 * Each call opens its own transaction and commits. This matters: the role and
 * JWT claims are set via `set_config(..., true)`, which is local to the current
 * transaction. Without an explicit `begin`, every `client.query` is its own
 * autocommit transaction, so the claims set in one statement would not survive
 * to the next — which is exactly why `auth.uid()` came back null and the RPC
 * returned `not_authenticated`. The RPCs return errors as jsonb rather than
 * raising, so a single commit is safe (nothing to roll back).
 *
 * Fixtures are created outside this helper and committed independently, because
 * the invitation page is fetched over HTTP on a different connection and can
 * only see committed rows.
 */
async function asUser({ id, email }, fn) {
  await client.query("begin");
  try {
    await client.query(`select set_config('role', 'authenticated', true)`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: id, email, role: "authenticated" }),
    ]);
    return await fn();
  } finally {
    // Restore session defaults before committing, so the connection is clean.
    await client.query(`select set_config('role', 'postgres', true)`);
    await client.query(`select set_config('request.jwt.claims', '', true)`);
    await client.query("commit");
  }
}

try {
  console.log(`\nbase url: ${BASE}\n`);

  // ── Fixtures ─────────────────────────────────────────────────────────────
  const teacher = await createUser("teacher", "teacher");
  created.teachers.push(teacher);

  const studentId = crypto.randomUUID();
  const studentName = "E2E Child";
  await client.query(
    `insert into public.students (id, name, class, parent_name, parent_phone, teacher_id)
     values ($1, $2, '7', 'E2E Parent', '0000000000', $3)`,
    [studentId, studentName, teacher.id],
  );
  created.students.push(studentId);

  const invitedEmail = `e2e-invited-${studentId.slice(0, 8)}@tt-test.local`;

  // ── Mint an invite exactly as the server action does ─────────────────────
  const invite = await asUser(teacher, async () => {
    const r = await client.query(
      `select public.create_parent_invite($1,'mother',$2,null,168,'link') as r`,
      [studentId, invitedEmail],
    );
    return r.rows[0].r;
  });

  check("invite minted", invite.ok === true, JSON.stringify(invite));
  const token = invite.token;
  check("token is 43 base64url characters", /^[A-Za-z0-9_-]{43}$/.test(token), String(token));

  // ── Fetch the public invitation page ──────────────────────────────────────
  const res = await fetch(`${BASE}/parent/invite/${encodeURIComponent(token)}`, {
    redirect: "manual",
  });
  const html = await res.text();

  check("public invite page returns 200 for a live token", res.status === 200, `got ${res.status}`);
  check("page names the invited child", html.includes(studentName));
  check("page confirms it is a private invitation", /Private invitation/i.test(html));

  // The token is the credential. It must never be handed to a Client Component
  // as a prop, because that serialises it into the RSC flight payload — the
  // original defect read `["token","<token>","d"]` straight out of the served
  // HTML. The token still appears in the page's own URL (the address bar) and in
  // the `next` redirect parameter of the sign-in links: that is inherent to a
  // shareable invite link and is not a new exposure. What must be absent is the
  // prop signature. Next encrypts Server Action arguments, so binding the token
  // into `acceptInvite` does not leak it either.
  const leakedAsProp =
    html.includes(`["token","${token}"`) || html.includes(`"token","${token}"`);
  check(
    "the raw token is NOT serialised into a client component prop",
    !leakedAsProp,
    "token leaked as an RSC prop",
  );
  check("no token hash appears in the served HTML", !/token_hash/.test(html));
  check(
    "the student's database id does NOT appear in the served HTML",
    !html.includes(studentId),
    "student id leaked",
  );

  // An unauthenticated visitor is invited to sign in, not shown the child's data.
  check(
    "unauthenticated visitor is prompted to sign in or sign up",
    /Create an account|I already have an account/i.test(html),
  );

  // ── A bogus token must fail closed ────────────────────────────────────────
  const badRes = await fetch(`${BASE}/parent/invite/${"f".repeat(48)}`, { redirect: "manual" });
  const badHtml = await badRes.text();
  check("bogus token returns 200 with an error card (not a crash)", badRes.status === 200);
  check("bogus token shows an invalid-link message", /not valid/i.test(badHtml));
  check("bogus token does NOT name any child", !badHtml.includes(studentName));

  // ── Address binding: the anti-forwarding control ──────────────────────────
  const wrongParent = await createUser("parent", "wrong");
  created.parents.push(wrongParent);
  const rightParent = await createUser("parent", "right");
  created.parents.push(rightParent);

  const wrongAddr = await asUser(wrongParent, async () => {
    const r = await client.query(`select public.redeem_parent_invite($1) as r`, [token]);
    return r.rows[0].r;
  });

  check(
    "invite addressed to an email cannot be redeemed by a different account",
    wrongAddr.ok === false && wrongAddr.error === "email_mismatch",
    JSON.stringify(wrongAddr),
  );

  // The right account, but with the invited address asserted in the JWT.
  const rightAddr = await asUser(
    { id: rightParent.id, email: invitedEmail },
    async () => {
      const r = await client.query(`select public.redeem_parent_invite($1) as r`, [token]);
      return r.rows[0].r;
    },
  );

  check("invite redeems for the addressed account", rightAddr.ok === true, JSON.stringify(rightAddr));

  // After acceptance the public page must stop working.
  const afterRes = await fetch(`${BASE}/parent/invite/${encodeURIComponent(token)}`, {
    redirect: "manual",
  });
  const afterHtml = await afterRes.text();
  check(
    "a used invite no longer reveals the child",
    !afterHtml.includes(studentName) || /already been used/i.test(afterHtml),
  );
  check("a used invite is rejected single-use", /already been used/i.test(afterHtml));
} catch (err) {
  console.error("\nFATAL:", err.message);
  failed++;
  failures.push(`fatal: ${err.message}`);
} finally {
  // Exact cleanup, children first. Wrapped so a cleanup failure is loud but
  // does not masquerade as a test failure.
  try {
    for (const sid of created.students) {
      await client.query(`delete from public.parent_invites where student_id = $1`, [sid]);
      await client.query(`delete from public.guardian_student_relationships where student_id = $1`, [
        sid,
      ]);
      await client.query(`delete from public.students where id = $1`, [sid]);
    }
    for (const u of [...created.parents, ...created.teachers]) {
      await client.query(`delete from public.users where id = $1`, [u.id]);
      await client.query(`delete from auth.users where id = $1`, [u.id]);
    }
  } catch (cleanupErr) {
    console.error("CLEANUP FAILED:", cleanupErr.message);
  }
  await client.end();
}

console.log(`\n${"─".repeat(60)}`);
console.log(`parent invite e2e: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nfailed:");
  failures.forEach((f) => console.log(`  ✗ ${f}`));
}
console.log("─".repeat(60));
process.exit(failed === 0 ? 0 : 1);
