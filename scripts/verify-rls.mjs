#!/usr/bin/env node
/**
 * Read-only RLS verification against the live database.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local scripts/verify-rls.mjs
 *
 * Requires (already in .env.local):
 *   DATABASE_URL                    — introspection of tables/policies (pg_catalog
 *                                     is NOT exposed via PostgREST on Supabase)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   — used to prove RLS actually blocks
 *   SUPABASE_SECRET_KEY             — admin REST fallback checks
 *                                     (legacy fallback: SUPABASE_SERVICE_ROLE_KEY)
 *
 * Checks:
 *   1. Every public BASE TABLE has rowsecurity = true
 *   2. Every RLS-enabled table has at least one policy
 *   3. Anon client gets 0 rows / permission error on protected tables (proof of enforcement)
 */
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const dbUrl = process.env.DATABASE_URL;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Prefer the current sb_secret_ key; fall back to the legacy service_role JWT.
// Mirrors src/lib/supabase/env.ts — a stale legacy value must not shadow the
// working key (this exact shadowing previously made every REST call 401).
const svc = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dbUrl) {
  console.error("✗ Missing DATABASE_URL (Postgres connection string, used for introspection)");
  process.exit(1);
}
if (!url || !anon) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const anonClient = createClient(url, anon, { auth: { persistSession: false } });

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows: tables } = await client.query(
  `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`,
);
const { rows: policies } = await client.query(
  `select tablename, policyname from pg_policies where schemaname = 'public' order by tablename, policyname`,
);
await client.end();

const policyByTable = {};
for (const p of policies) {
  (policyByTable[p.tablename] ??= []).push(p.policyname);
}

// Internal tables that legitimately carry no custom policies
const ALLOW_NO_POLICY = new Set(["schema_migrations"]);

let failures = 0;
console.log(`\nPublic tables: ${tables.length} | Policies: ${policies.length}\n`);
console.log("table".padEnd(30) + "RLS".padEnd(9) + "policies".padEnd(9) + "status");
console.log("-".repeat(60));

for (const t of tables) {
  const name = t.tablename;
  const pols = policyByTable[name] ?? [];
  const rlsOk = t.rowsecurity === true;
  const polOk = pols.length > 0 || ALLOW_NO_POLICY.has(name);
  const ok = rlsOk && polOk;
  if (!ok) failures++;
  const status = ok ? "✅" : rlsOk ? "⚠ no policy" : "❌ RLS off";
  console.log(name.padEnd(30) + String(t.rowsecurity).padEnd(9) + `${pols.length}`.padEnd(9) + status);
}

// 2) Prove enforcement: anon must NOT read protected tables
console.log("\n--- Anon enforcement probe (expect blocked / 0 rows) ---");
const protectedSamples = ["users", "students", "orgs", "org_members", "attempts", "conversations", "messages"];
for (const name of protectedSamples) {
  if (!tables.some((t) => t.tablename === name)) continue;
  const { data, error } = await anonClient.from(name).select("*").limit(1);
  const blocked = !!error || (Array.isArray(data) && data.length === 0);
  const detail = error ? error.message.slice(0, 60) : `${data?.length ?? 0} rows`;
  console.log(`${blocked ? "✅ blocked" : "❌ LEAKED"}  anon→${name} (${detail})`);
  if (!blocked) failures++;
}

console.log(
  failures === 0
    ? "\n✅ RLS verification passed — every table locked down, anon blocked."
    : `\n❌ RLS verification FAILED — ${failures} issue(s) above.`,
);
process.exit(failures === 0 ? 0 : 1);
