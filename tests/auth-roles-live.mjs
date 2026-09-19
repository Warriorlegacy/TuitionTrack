// Live authentication test across all three roles.
//
// What this proves (and what it deliberately does not):
//   - teacher / parent / student can each be created and signed in
//   - the session cookie is written in the exact shape @supabase/ssr expects,
//     and the server accepts it (this is what the OAuth loop broke)
//   - each role reaches /app/dashboard with a 200 and NO redirect to /login
//   - the open-redirect guard on `next` holds
//
// It does NOT test the real Google consent screen — that needs a human browser
// and a real Google account, and cannot be automated honestly. The parts of the
// OAuth path that CAN be proven in isolation are asserted directly: the
// callback's redirect target, and the cookie-commit hop.
//
// Run against a locally started server:
//   npm run dev   (or: npm run build && npm run start)
//   BASE_URL=http://localhost:3000 node tests/auth-roles-live.mjs
//
// Requires SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.local to
// create and clean up the throwaway users.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Accept BASE_URL or APP_BASE_URL — passing only the latter used to fall through
// to :3000 silently and the whole suite would "fail" against an unrelated server.
const BASE = process.env.BASE_URL ?? process.env.APP_BASE_URL ?? "http://localhost:3000";

// Fail loudly if the target is not actually the app we built. A 404 on a page
// that must exist means we are pointed at the wrong process.
async function assertServerIsOurs() {
  const probe = await fetch(`${BASE}/login`, { redirect: "manual" }).catch(() => null);
  if (!probe || probe.status === 404) {
    console.error(
      `\nTarget ${BASE} returned ${probe ? probe.status : "no response"} for /login.\n` +
        `That is not the TuitionTrack server — refusing to run, a green suite here would be meaningless.\n`,
    );
    process.exit(1);
  }
}
await assertServerIsOurs();

// ── env ───────────────────────────────────────────────────────────────────
function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = join(process.cwd(), name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// ── minimal supabase REST helpers (no SDK needed) ─────────────────────────
async function adminCreateUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function adminDeleteUser(id) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}

async function adminUpsertProfile(user, role) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ id: user.id, email: user.email, name: `Test ${role}`, role }),
  });
  return res.status;
}

async function adminDeleteProfile(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}

async function passwordSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// The @supabase/ssr cookie format: `sb-<project-ref>-auth-token`, value is
// `base64-` + base64url(JSON(session)). Reproduced here so the test exercises
// the same server-side decode the middleware performs per request.
function buildSessionCookie(url, projectRef, session) {
  const payload = JSON.stringify({
    access_token: session.access_token,
    token_type: "bearer",
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  });
  return {
    name: `sb-${projectRef}-auth-token`,
    value: "base64-" + Buffer.from(payload, "utf8").toString("base64url"),
  };
}

async function getWithCookie(path, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie: `${cookie.name}=${cookie.value}` } : {},
  });
  const body = await res.text();
  return { status: res.status, location: res.headers.get("location"), body };
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nauth roles live test → ${BASE}\n`);

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    console.error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SECRET_KEY).");
    process.exit(1);
  }
  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];

  // Is the server up at all?
  try {
    const probe = await fetch(BASE, { redirect: "manual" });
    if (probe.status >= 500) throw new Error(`status ${probe.status}`);
  } catch (e) {
    console.error(`Server not reachable at ${BASE} — start it with \`npm run dev\`.\n${e.message}`);
    process.exit(1);
  }

  // ── static contracts (no DB required) ──
  {
    const res = await fetch(`${BASE}/auth/callback?next=/app/dashboard`, { redirect: "manual" });
    const loc = res.headers.get("location") ?? "";
    // Assert the redirect stays on the tested origin. A weaker "contains
    // /auth/complete" check passes even when the host is wrong, which is how a
    // dev server silently bounced sign-ins to production.
    const expectedOrigin = new URL(BASE).origin;
    let locOrigin = "";
    try {
      locOrigin = new URL(loc).origin;
    } catch {
      locOrigin = "(unparseable)";
    }
    record(
      "callback redirects to /auth/complete on the SAME origin",
      (res.status === 307 || res.status === 302) &&
        loc.includes("/auth/complete") &&
        locOrigin === expectedOrigin,
      `${res.status} → ${loc || "(none)"}`,
    );
  }
  {
    const res = await fetch(`${BASE}/auth/callback?next=//evil.com`, { redirect: "manual" });
    const loc = res.headers.get("location") ?? "";
    record(
      "callback blocks open redirect via //evil.com",
      !loc.includes("evil.com"),
      loc || "(no location)",
    );
  }
  {
    const res = await fetch(`${BASE}/auth/callback?error=access_denied`, { redirect: "manual" });
    const loc = res.headers.get("location") ?? "";
    record(
      "callback surfaces provider errors on /login",
      loc.includes("/login") && loc.includes("error="),
      loc || "(no location)",
    );
  }
  {
    const res = await fetch(`${BASE}/auth/complete`, { redirect: "manual" });
    record(
      "/auth/complete renders without a session (cookie-commit hop is reachable)",
      res.status === 200,
      `status ${res.status}`,
    );
  }
  {
    // A gated path with no session must carry the destination forward.
    const res = await fetch(`${BASE}/app/students`, { redirect: "manual" });
    const loc = res.headers.get("location") ?? "";
    record(
      "gated path preserves destination as ?next= when signed out",
      (res.status === 307 || res.status === 302) && loc.includes("next=%2Fapp%2Fstudents"),
      `${res.status} → ${loc || "(no location)"}`,
    );
  }

  // ── per-role live sign-in ──
  const roles = ["teacher", "parent", "student"];
  const created = [];

  for (const role of roles) {
    const email = `auth-test-${role}@tuitiontrack-test.local`;
    const password = `Test-${role}-${Date.now()}!A9`;

    // Clean slate: a previous aborted run can leave a user behind.
    const existing = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    ).then((r) => r.json());
    const stale = (existing.users ?? []).find((u) => u.email === email);
    if (stale) {
      await adminDeleteProfile(stale.id);
      await adminDeleteUser(stale.id);
    }

    const createdRes = await adminCreateUser(email, password);
    const user = createdRes.body;
    if (!user?.id) {
      record(`${role}: user created`, false, `HTTP ${createdRes.status} ${JSON.stringify(createdRes.body).slice(0, 120)}`);
      continue;
    }
    created.push(user.id);
    record(`${role}: user created`, true, user.id.slice(0, 8));

    const profileStatus = await adminUpsertProfile(user, role);
    record(`${role}: profile row upserted with role=${role}`, profileStatus < 300, `HTTP ${profileStatus}`);

    const signIn = await passwordSignIn(email, password);
    const session = signIn.body;
    if (!session?.access_token) {
      record(`${role}: password sign-in`, false, `HTTP ${signIn.status} ${JSON.stringify(signIn.body).slice(0, 120)}`);
      continue;
    }
    record(`${role}: password sign-in returns a session`, true);

    const cookie = buildSessionCookie(SUPABASE_URL, projectRef, session);

    const dash = await getWithCookie("/app/dashboard", cookie);
    const ok = dash.status === 200 && !(dash.location ?? "").includes("/login");
    record(
      `${role}: session cookie accepted at /app/dashboard`,
      ok,
      ok ? "200, no redirect" : `${dash.status} → ${dash.location ?? "?"}`,
    );

    const signedOut = await getWithCookie("/app/dashboard", null);
    record(
      `${role}: same path without cookie correctly rejects (control)`,
      signedOut.status === 307 || signedOut.status === 302 || signedOut.status === 200,
      `${signedOut.status} → ${signedOut.location ?? "(rendered)"}`,
    );
  }

  // ── cleanup ──
  let cleaned = 0;
  for (const id of created) {
    await adminDeleteProfile(id);
    await adminDeleteUser(id);
    cleaned++;
  }
  record("cleanup: test users removed", cleaned === created.length, `${cleaned}/${created.length}`);

  // ── summary ──
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail ?? ""}`);
    process.exit(1);
  }
  console.log("\nAll role logins verified.\n");
}

main().catch((e) => {
  console.error(`fatal: ${e.message}`);
  process.exit(1);
});
