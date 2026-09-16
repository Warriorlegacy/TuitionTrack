#!/usr/bin/env node
/**
 * Read-only database status (blueprint #62 Phase 0 verification, #89).
 *
 * Unlike scripts/check-schema.mjs (PostgREST + API key), this talks straight to
 * Postgres, so it works even when the REST API keys are misconfigured and it can
 * also report the migration ledger, RLS coverage and extensions.
 *
 * Strictly read-only: SELECT / catalog lookups only. No DDL, no writes.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local scripts/db-status.mjs
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

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL not set (Supabase → Project Settings → Database → Connection string).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  const host = url.replace(/^.*@([^/:]+).*$/, "$1");
  console.log(`connected → ${host}\n`);
} catch (err) {
  console.error(`✗ connection failed: ${err.message}`);
  process.exit(1);
}

async function q(label, sql, fmt = (rows) => `${rows.length}`) {
  try {
    const { rows } = await client.query(sql);
    console.log(`${label}: ${fmt(rows)}`);
    return rows;
  } catch (err) {
    console.log(`${label}: (query failed — ${err.message})`);
    return [];
  }
}

// Migration ledger (created by scripts/apply-migrations.mjs on first run).
const tableCount = await q(
  "public base tables",
  `select count(*)::int as n from information_schema.tables
   where table_schema='public' and table_type='BASE TABLE'`,
  (r) => String(r[0].n),
);

const ledgerExists = await q(
  "schema_migrations ledger",
  `select count(*)::int as n from information_schema.tables
   where table_schema='public' and table_name='schema_migrations'`,
  (r) => (r[0].n ? "present" : "ABSENT (never ran apply-migrations)"),
);

if (ledgerExists[0]?.n) {
  const applied = await q("applied migrations", `select version, applied_at from public.schema_migrations order by version`);
  for (const r of applied) console.log(`   • ${r.version}`);
  await q(
    "core bucket (users/students)",
    `select count(*)::int as n from information_schema.tables
     where table_schema='public' and table_name in ('users','students')`,
    (r) => (r[0].n === 2 ? "present" : "PARTIAL"),
  );
}

await q(
  "RLS-enabled tables",
  `select count(*)::int as n from pg_tables where schemaname='public' and rowsecurity`,
  (r) => `${r[0].n} of ${tableCount[0]?.n ?? "?"}`,
);

await q(
  "extensions",
  `select string_agg(extname, ', ' order by extname) as list from pg_extension`,
  (r) => r[0].list ?? "(none)",
);

// Group tables so it's obvious which migration owns what.
const tables = await q(
  "table list",
  `select table_name from information_schema.tables
   where table_schema='public' and table_type='BASE TABLE' order by table_name`,
  () => "",
);
if (tables.length) {
  console.log("\ntables:");
  console.log(`   ${tables.map((t) => t.table_name).join(", ")}`);
}

await client.end();
