// Signed-out smoke suite (blueprint #100 CoS gate). Zero deps: node --test.
// No sleeps, no browser, no session — every assertion is a status/body contract.
// Run: BASE_URL=http://localhost:3000 node --test tests/smoke.mjs  (npm run smoke)
// Server must be up (`npm run dev` locally; CI uses `next start` after build).
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const body = await res.text();
  return { res, body };
}

test("smoke: /login renders (signed out)", async () => {
  const { res, body } = await get("/login");
  assert.equal(res.status, 200, `GET /login → ${res.status}`);
  assert.match(body, /Create a teacher account|Login/i);
});

test("smoke: /app/dashboard signed out → login redirect (or setup alert unconfigured)", async () => {
  const { res, body } = await get("/app/dashboard");
  if (res.status === 307 || res.status === 308) {
    assert.match(res.headers.get("location") ?? "", /\/login/);
  } else {
    // Unconfigured env (no Supabase keys): layout renders SetupAlert with 200.
    assert.equal(res.status, 200, `GET /app/dashboard → ${res.status}`);
    assert.match(body, /Dashboard|not configured|Setup/i);
  }
});

test("smoke: /app/homework signed out → login redirect (or setup alert unconfigured)", async () => {
  const { res } = await get("/app/homework");
  if (res.status === 307 || res.status === 308) {
    assert.match(res.headers.get("location") ?? "", /\/login/);
  } else {
    assert.equal(res.status, 200, `GET /app/homework → ${res.status}`);
  }
});

test("smoke: /ai prerenders with JSON-LD", async () => {
  const { res, body } = await get("/ai");
  assert.equal(res.status, 200, `GET /ai → ${res.status}`);
  assert.ok(body.includes("application/ld+json"), "missing JSON-LD block");
  assert.ok(body.includes("TuitionTrack AI"), "missing product name");
  assert.ok(body.includes("/ai"), "missing canonical /ai");
});

test("smoke: /app/tutor signed out → login redirect (or setup alert unconfigured)", async () => {
  const { res, body } = await get("/app/tutor");
  if (res.status === 307 || res.status === 308) {
    assert.match(res.headers.get("location") ?? "", /\/login/);
  } else {
    assert.equal(res.status, 200, `GET /app/tutor → ${res.status}`);
    assert.match(body, /Tutor/i);
  }
});

test("smoke: /app/planner signed out → login redirect (or setup alert unconfigured)", async () => {
  const { res, body } = await get("/app/planner");
  if (res.status === 307 || res.status === 308) {
    assert.match(res.headers.get("location") ?? "", /\/login/);
  } else {
    assert.equal(res.status, 200, `GET /app/planner → ${res.status}`);
    assert.match(body, /Planner/i);
  }
});

for (const [name, method, path, payload] of [
  ["tutor", "POST", "/api/ai/tutor", { student_id: NIL_UUID, message: "hi", mode: "socratic" }],
  ["plans-read", "GET", `/api/plans?student_id=${NIL_UUID}`, null],
  ["plans-update", "PATCH", "/api/plans", { student_id: NIL_UUID, task_id: NIL_UUID, status: "done" }],
  ["quiz", "POST", "/api/ai/quiz", { student_id: NIL_UUID, count: 2 }],
  ["flashcards", "POST", "/api/ai/flashcards", { student_id: NIL_UUID, count: 2 }],
  ["mistakes", "GET", `/api/students/${NIL_UUID}/mistakes`, null],
]) {
  test(`smoke: API 401 guard signed out — ${name}`, async () => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    await res.text(); // drain
    assert.equal(res.status, 401, `${method} ${path} → ${res.status}, want 401`);
  });
}

// ── Parent Portal Smoke Assertions ───────────────────────────────────────────
for (const parentPath of [
  "/parent",
  "/parent/progress",
  "/parent/homework",
  "/parent/fees",
  "/parent/reports",
  "/parent/ask",
  "/parent/meetings",
  "/parent/portfolio",
  "/parent/documents",
  "/parent/syllabus",
  "/parent/tests",
  "/parent/attendance",
  "/parent/calendar",
  "/parent/messages",
  "/parent/notifications",
  "/parent/profile",
  "/parent/support",
]) {
  test(`smoke: Parent Portal signed out guard — ${parentPath}`, async () => {
    const { res } = await get(parentPath);
    if (res.status === 307 || res.status === 308) {
      assert.match(res.headers.get("location") ?? "", /\/login/);
    } else {
      // If mock/local rendering returns 200, must not throw 500
      assert.ok(res.status < 400, `GET ${parentPath} returned error status ${res.status}`);
    }
  });
}

