#!/usr/bin/env node
/**
 * Read-only schema + REST credential probe (blueprint #62 Phase 0, #89).
 *
 * Answers two questions without DDL:
 *   1. Which migrations are actually applied? (asks one row per table)
 *   2. Which API credential does PostgREST currently accept?
 *
 * Safe: GET only, limit=1. No writes, no DDL.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local scripts/check-schema.mjs
 */
import { readFileSync, existsSync } from "node:fs";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
if (!url) {
  console.error("✗ Need NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}

// Authoritative table ownership, derived from the migrations themselves.
const GROUPS = {
  "20240101000000_init": [
    "users", "students", "homework", "attendance", "fees", "tests", "announcements",
  ],
  "20260524000000_edupulse_ai": [
    "performance_records", "reports", "subscriptions",
  ],
  "20260914000000_ai_learning_loop": [
    "syllabus_nodes", "concept_mastery", "mistakes", "spaced_items", "review_events",
    "study_plans", "plan_tasks", "conversations", "messages", "tool_calls",
    "documents", "document_chunks", "learning_events", "model_usage", "ai_evaluations",
    "audit_logs", "consent_records", "questions", "question_options",
    "question_solutions", "assessments", "assessment_items", "attempts", "attempt_responses",
  ],
  "20260915000000_orgs_batches_guardians": [
    "orgs", "org_members", "batches", "batch_enrollments", "guardian_links", "ai_budgets",
  ],
};

// ── 1. Which credential works? ────────────────────────────────────────────
const CANDIDATES = [
  ["SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY],
  ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
];

async function tryKey(key) {
  const res = await fetch(`${url}/rest/v1/users?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 160) };
}

console.log(`project: ${url.replace(/^https?:\/\//, "")}\n`);
console.log("REST credential check (GET /rest/v1/users):");
let workingKey = null;
for (const [name, key] of CANDIDATES) {
  if (!key) {
    console.log(`   – ${name}: not set`);
    continue;
  }
  const r = await tryKey(key);
  const len = String(key).length;
  if (r.ok) {
    console.log(`   ✅ ${name} (${len} chars): accepted`);
    workingKey ??= key;
  } else {
    console.log(`   ❌ ${name} (${len} chars): HTTP ${r.status} — ${r.body}`);
  }
}

if (!workingKey) {
  console.log(
    "\nNo REST credential is accepted. Postgres itself may still be reachable via\n" +
      "`node --env-file-if-exists=.env.local scripts/db-status.mjs`.\n" +
      "If Postgres works but REST 401s, the project needs legacy JWT `anon`/`service_role`\n" +
      "keys (Project Settings → API) or the new API keys must be enabled.\n",
  );
  process.exit(2);
}

// ── 2. Schema presence ────────────────────────────────────────────────────
async function probe(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: workingKey, Authorization: `Bearer ${workingKey}` },
  });
  await res.text();
  return res.ok;
}

console.log("\nSchema state:");
let missingTotal = 0;
for (const [migration, tables] of Object.entries(GROUPS)) {
  const results = await Promise.all(tables.map(async (t) => [t, await probe(t)]));
  const missing = results.filter(([, ok]) => !ok).map(([t]) => t);
  missingTotal += missing.length;
  const mark = missing.length === 0 ? "✅" : "⚠️";
  console.log(`${mark} ${migration} — ${results.length - missing.length}/${results.length} tables present`);
  if (missing.length) console.log(`     missing: ${missing.join(", ")}`);
}

console.log(
  missingTotal === 0
    ? "\nAll expected tables present — migrations applied."
    : `\n${missingTotal} table(s) missing — that migration has NOT been applied.`,
);
process.exitCode = missingTotal === 0 ? 0 : 3;
