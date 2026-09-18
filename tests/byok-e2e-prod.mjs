#!/usr/bin/env node
// BYOK end-to-end verification on PRODUCTION.
// Flow: create test teacher + student -> password sign-in -> forge @supabase/ssr
// session cookie -> save OpenRouter key via /api/ai/keys -> verify encryption
// at rest + masked GET -> key test -> tutor (JSON + SSE) -> quiz -> flashcards
// -> prove the BYOK key was used (last_used_at advanced, model from OpenRouter
// free pool) -> clean up everything it created.
//
// Usage: node --env-file-if-exists=.env.local tests/byok-e2e-prod.mjs
// Env:   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
//        SUPABASE_SECRET_KEY (admin), OPENROUTER_API_KEY (the BYOK key to save)

const assert = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) process.exitCode = 1;
};

const BASE = process.env.E2E_BASE_URL ?? "https://tuitiontrack-app.vercel.app";
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const BYOK_KEY = process.env.OPENROUTER_API_KEY;

for (const [k, v] of Object.entries({ SUPA_URL, ANON, SECRET, BYOK_KEY })) {
  if (!v) { console.error(`Missing env: ${k}`); process.exit(1); }
}
const REF = new URL(SUPA_URL).hostname.split(".")[0];

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(SUPA_URL, SECRET, { auth: { autoRefreshToken: false, persistSession: false } });

const fetchT = (url, init = {}, ms = 90_000) =>
  fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(ms) });

const api = async (path, init = {}) => {
  const res = await fetchT(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie: COOKIE, ...(init.headers ?? {}) },
  });
  return res;
};

// Safe JSON: API routes may redirect (307) or return empty bodies.
const j = async (res) => { try { return await res.json(); } catch { return null; } };

// Retry wrapper for transient network errors (ECONNRESET etc.).
const withRetry = async (fn, tries = 3, delayMs = 2000) => {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
};

let COOKIE = ""; // set after sign-in

// ── 1. Create test teacher (idempotent) ────────────────────────────
const EMAIL = "byok-e2e@tuitiontrack-test.local";
const PASSWORD = "ByokE2e!2026-" + Math.random().toString(36).slice(2, 10);

console.log(`\n== Setup: test teacher + student (prod) ==`);
// A previous aborted run may have left this user with an unknown password —
// hard-delete first so we always create with a known credential.
const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const preExisting = existingList.users.find((u) => u.email === EMAIL);
if (preExisting) {
  const orphan = preExisting.id;
  for (const t of ["model_usage", "tool_calls", "messages", "conversations", "user_ai_keys", "user_ai_preferences"])
    await admin.from(t).delete().eq("user_id", orphan);
  await admin.from("students").delete().eq("teacher_id", orphan);
  await admin.from("users").delete().eq("id", orphan);
  const { error: delErr } = await admin.auth.admin.deleteUser(orphan);
  console.log(`${delErr ? "FAIL" : "ok  "} removed stale test user ${orphan}${delErr ? `: ${delErr.message}` : ""}`);
}

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { role: "teacher", name: "BYOK E2E" },
});
if (createErr) {
  console.error("createUser failed:", createErr.message); process.exit(1);
}
const finalUserId = created.user.id;
assert(!!finalUserId, "test teacher auth user created", finalUserId);

const { error: profErr } = await admin.from("users").upsert({
  id: finalUserId, name: "BYOK E2E Teacher", email: EMAIL, role: "teacher", plan: "free",
});
assert(!profErr, "users profile row", profErr?.message ?? "");

const STUDENT_NAME = "BYOK E2E Student " + Date.now();
const { data: student, error: stuErr } = await admin.from("students").insert({
  name: STUDENT_NAME, class: "10", parent_name: "E2E Parent",
  parent_phone: "9999999999", teacher_id: finalUserId,
}).select("id").single();
assert(!stuErr && !!student?.id, "student row created", student?.id ?? stuErr?.message);
const STUDENT_ID = student.id;

// ── 2. Sign in with anon key (password grant) ──────────────────────
console.log(`\n== Auth: password sign-in + forged @supabase/ssr cookie ==`);
const grant = await fetchT(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "content-type": "application/json", apikey: ANON, authorization: `Bearer ${ANON}` },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const gj = await grant.json();
assert(grant.ok && gj.access_token, "password grant", grant.ok ? `user ${gj.user.id}` : JSON.stringify(gj));

// @supabase/ssr encodes the session as `base64-` + base64url(JSON session).
// Base64url without padding (stringToBase64URL). Cookie name: sb-<ref>-auth-token.
const sessionPayload = {
  access_token: gj.access_token,
  token_type: "bearer",
  expires_in: gj.expires_in,
  expires_at: gj.expires_at,
  refresh_token: gj.refresh_token,
  user: gj.user,
};
const b64url = Buffer.from(JSON.stringify(sessionPayload)).toString("base64")
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
COOKIE = `sb-${REF}-auth-token=base64-${b64url}`;
assert(true, "session cookie forged", `sb-${REF}-auth-token (${COOKIE.length} bytes)`);

// The app's updateSession middleware may rotate the cookie set — server reads
// whatever we send, so a static forged cookie is fine for API calls.

// ── 3. Prove authed API access ─────────────────────────────────────
console.log(`\n== Access: authenticated API call ==`);
let res = await api("/api/ai/keys");
let body = await j(res);
assert(res.status === 200 && body && !body.error, "GET /api/ai/keys with forged cookie", `status ${res.status} body=${JSON.stringify(body).slice(0, 100)}`);

// Negative control: no cookie -> fail-closed (401/403 JSON or 307 -> /login)
res = await withRetry(() => fetchT(`${BASE}/api/ai/keys`));
assert([401, 403].includes(res.status) || (res.status === 307 && (res.headers.get("location") ?? "").includes("/login")),
  "negative control: unauthenticated -> fail-closed", `status ${res.status}`);

// ── 4. BYOK key lifecycle ──────────────────────────────────────────
console.log(`\n== BYOK: save OpenRouter key + verify storage ==`);
res = await api("/api/ai/keys", {
  method: "POST",
  body: JSON.stringify({ provider: "openrouter", api_key: BYOK_KEY, label: "Default" }),
});
body = await j(res);
assert(res.status === 200 && body.ok, "POST /api/ai/keys (save key)", JSON.stringify(body));

// Key-test route: validates a key WITHOUT saving it
res = await api("/api/ai/keys/test", {
  method: "POST",
  body: JSON.stringify({ provider: "openrouter", api_key: BYOK_KEY }),
});
body = await j(res);
assert(res.status === 200 && body?.ok === true, "POST /api/ai/keys/test (validates key)", `model=${body?.model} latency=${body?.latencyMs}ms err=${body?.error ?? "-"}`);
assert(String(body?.text ?? "").includes("OK"), "key-test completion returned", JSON.stringify(body?.text ?? "").slice(0, 60));

// Encryption at rest + masked GET: ciphertext must not contain the key
const { data: keyRows } = await admin.from("user_ai_keys").select("*").eq("user_id", finalUserId);
const kr = keyRows?.find((r) => r.provider === "openrouter");
assert(!!kr, "user_ai_keys row exists (via admin)");
assert(kr && !kr.encrypted_key.includes(BYOK_KEY.slice(0, 12)), "ciphertext does not contain plaintext", `enc=${String(kr?.encrypted_key).slice(0, 24)}…`);
assert(kr && kr.key_fingerprint && !kr.key_fingerprint.includes("sk-or"), "fingerprint stored (not raw prefix)", kr?.key_fingerprint);
assert(kr && kr.status === "active", "key status active", kr?.status);

res = await api("/api/ai/keys");
body = await j(res);
const listed = body?.keys?.find((k) => k.provider === "openrouter");
assert(!!listed, "GET returns the key (masked)");
assert(listed && !JSON.stringify(body).includes(BYOK_KEY.slice(0, 16)), "GET response has no plaintext key");

// Prefs were set with a free-first model
const { data: prefs } = await admin.from("user_ai_preferences").select("*").eq("user_id", finalUserId).maybeSingle();
assert(prefs?.default_provider === "openrouter", "preferences: default_provider=openrouter", prefs?.default_model ?? "");
console.log(`     prefs: default_model=${prefs?.default_model} prefer_free=${prefs?.prefer_free_tiers}`);

// ── 5. AI feature calls (must use BYOK key) ────────────────────────
console.log(`\n== E2E: tutor JSON + SSE, quiz, flashcards via BYOK key ==`);
const usedBefore = kr?.last_used_at ?? null;

res = await api("/api/ai/tutor", {
  method: "POST",
  body: JSON.stringify({ student_id: STUDENT_ID, message: "What is the Pythagorean theorem?", mode: "socratic" }),
});
body = await j(res);
assert(res.status === 200, "tutor JSON 200", `status ${res.status}`);
assert(typeof body?.reply === "string" && body.reply.length > 40, "tutor reply non-stub (real model)", `${(body?.reply ?? "").slice(0, 70)}…`);
assert(body?.model && !/stub/i.test(body?.model ?? ""), "tutor reports a real model", body?.model);
console.log(`     tutor meta: model=${body?.model} conv=${body?.conversation_id ?? "(none)"}`);

// SSE stream
res = await api("/api/ai/tutor?stream=1", {
  method: "POST",
  body: JSON.stringify({ student_id: STUDENT_ID, message: "Give me one hint about linear equations.", mode: "socratic" }),
});
const ct = res.headers.get("content-type") ?? "";
assert(ct.includes("text/event-stream"), "tutor SSE content-type", ct);
const raw = await res.text();
// SSE frames: "event: <name>\ndata: <json>\n\n" — pair them before parsing.
const frames = raw.split("\n\n").filter((b) => b.trim()).map((b) => {
  const ev = b.match(/^event: (.+)$/m)?.[1] ?? "";
  const dataLine = b.match(/^data: (.+)$/m)?.[1] ?? "";
  try { return { event: ev, data: JSON.parse(dataLine) }; } catch { return { event: ev, data: null }; }
});
const deltas = frames.filter((f) => f.event === "delta" && f.data);
const doneFrame = frames.find((f) => f.event === "done")?.data ?? null;
const metaFrame = frames.find((f) => f.event === "meta")?.data ?? null;
assert(deltas.length >= 3, "SSE deltas streamed", `${deltas.length} delta frames`);
assert(!!doneFrame, "SSE done frame", `model=${doneFrame?.model} cost=${doneFrame?.cost_usd ?? "?"}`);
console.log(`     SSE meta model: ${metaFrame?.model} | done model: ${doneFrame?.model} | confidence: ${doneFrame?.confidence ?? "?"}`);

// Quiz
res = await api("/api/ai/quiz", {
  method: "POST",
  body: JSON.stringify({ student_id: STUDENT_ID, count: 2, difficulty: 2, qtype: "mcq" }),
});
body = await j(res);
const qItems = body?.questions ?? body?.items ?? [];
assert(res.status === 200 || res.status === 201, "quiz 200/201", `status ${res.status}`);
assert(Array.isArray(qItems) && qItems.length >= 1, "quiz returned questions", `${qItems.length} items`);
console.log(`     quiz model: ${body?.model ?? "?"}`);

// Flashcards
res = await api("/api/ai/flashcards", {
  method: "POST",
  body: JSON.stringify({ student_id: STUDENT_ID, count: 3 }),
});
body = await j(res);
const fcItems = body?.cards ?? body?.flashcards ?? body?.items ?? [];
assert(res.status === 200 || res.status === 201, "flashcards 200/201", `status ${res.status}`);
assert(Array.isArray(fcItems) && fcItems.length >= 1, "flashcards returned cards", `${fcItems.length} cards`);
console.log(`     flashcards model: ${body?.model ?? "?"}`);

// ── 6. Prove the BYOK key was actually used ────────────────────────
console.log(`\n== Proof: BYOK key used (last_used_at advanced) ==`);
await new Promise((r) => setTimeout(r, 1500));
const { data: keyAfter } = await admin.from("user_ai_keys").select("*").eq("user_id", finalUserId);
const krAfter = keyAfter?.find((r) => r.provider === "openrouter");
assert(
  krAfter?.last_used_at && (!usedBefore || new Date(krAfter.last_used_at) > new Date(usedBefore)),
  "last_used_at advanced on user_ai_keys",
  `${usedBefore ?? "null"} -> ${krAfter?.last_used_at ?? "null"}`,
);
assert(!krAfter?.last_error, "no last_error on key", krAfter?.last_error ?? "clean");

// model_usage rows recorded (learning loop telemetry)
const { data: usage } = await admin.from("model_usage").select("*").eq("user_id", finalUserId).order("created_at", { ascending: false }).limit(5);
assert(!!usage && usage.length >= 1, "model_usage telemetry rows exist", `${usage?.length ?? 0} recent rows`);

process.on("unhandledRejection", (e) => { console.error("UNHANDLED:", e?.message ?? e); process.exit(2); });
setTimeout(() => { console.error("GLOBAL TIMEOUT after 8min"); process.exit(3); }, 8 * 60_000).unref();

// ── 7. Cleanup ─────────────────────────────────────────────────────
console.log(`\n== Cleanup ==`);
const tables = ["model_usage", "user_ai_keys", "user_ai_preferences"];
for (const t of tables) {
  const q = admin.from(t).delete().eq("user_id", finalUserId);
  const { error } = await q;
  console.log(`${error ? "FAIL" : "ok  "} deleted ${t}${error ? `: ${error.message}` : ""}`);
  if (error) process.exitCode = 1;
}
const { error: stuDel } = await admin.from("students").delete().eq("id", STUDENT_ID);
console.log(`${stuDel ? "FAIL" : "ok  "} deleted student${stuDel ? `: ${stuDel.message}` : ""}`);
// conversations cascade-deletes messages, which cascade-deletes tool_calls
const { error: convDel } = await admin.from("conversations").delete().eq("student_id", STUDENT_ID);
console.log(`${convDel ? "FAIL" : "ok  "} deleted conversations (+cascade messages/tool_calls)${convDel ? `: ${convDel.message}` : ""}`);
if (stuDel || convDel) process.exitCode = 1;
const { error: profDel } = await admin.from("users").delete().eq("id", finalUserId);
console.log(`${profDel ? "FAIL" : "ok  "} deleted users profile${profDel ? `: ${profDel.message}` : ""}`);
const { error: authDel } = await admin.auth.admin.deleteUser(finalUserId);
console.log(`${authDel ? "FAIL" : "ok  "} deleted auth user${authDel ? `: ${authDel.message}` : ""}`);
if (stuDel || profDel || authDel) process.exitCode = 1;

console.log(`\nDone. exit=${process.exitCode ?? 0}`);
