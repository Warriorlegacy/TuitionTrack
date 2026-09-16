#!/usr/bin/env node
/**
 * Read-only RLS verification against the live database.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local scripts/verify-rls.mjs
 *
 * Requires (already in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   — used to prove RLS actually blocks
 *   SUPABASE_SERVICE_ROLE_KEY       — used for introspection (bypasses RLS)
 *
 * Checks:
 *   1. Every public BASE TABLE has rowsecurity = true
 *   2. Every RLS-enabled table has at least one policy
 *   3. Anon client gets 0 rows / permission error on protected tables (proof of enforcement)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !svc) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, svc, { auth: { persistSession: false } });
const anonClient = createClient(url, anon, { auth: { persistSession: false } });

// 1) Introspect tables + policies
const { data: tables, error: tErr } = await admin
  .from("pg_catalog.pg_tables")
  .select("tablename, rowsecurity")
  .eq("schemaname", "public");
if (tErr) {
  console.error("✗ Table introspection failed:", tErr.message);
  process.exit(1);
}

const { data: policies, error: pErr } = await admin
  .from("pg_catalog.pg_policies")
  .select("tablename, policyname")
  .eq("schemaname", "public");
if (pErr) {
  console.error("✗ Policy introspection failed:", pErr.message);
  process.exit(1);
}

const policyByTable = {};
for (const p of policies ?? []) {
  (policyByTable[p.tablename] ??= []).push(p.policyname);
}

// Internal tables that legitimately carry no custom policies
const ALLOW_NO_POLICY = new Set(["schema_migrations"]);

let failures = 0;
console.log(`\nPublic tables: ${tables.length} | Policies: ${(policies ?? []).length}\n`);
console.log("table".padEnd(30) + "RLS".padEnd(9) + "policies");
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

console.log(`\n${failures === 0 ? "✅ ALL RLS CHECKS PASSED" : `❌ ${failures} failure(s) — fix before shipping`}`);
process.exit(failures === 0 ? 0 : 1);
