#!/usr/bin/env node
/**
 * Apply Supabase migrations in filename order via the Postgres connection.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
 *     node --env-file-if-exists=.env.local scripts/apply-migrations.mjs
 *
 * - Tracks applied files in public.schema_migrations (created on first run)
 * - Idempotent: already-applied files are skipped, re-runs are safe
 * - Runs inside a single transaction per migration file
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = "supabase/migrations";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "✗ DATABASE_URL not set.\n" +
      "  Get it from: Supabase Dashboard → Project Settings → Database → Connection string (URI)\n" +
      "  Example: postgresql://postgres:[PASSWORD]@db.zlkkicxxxx.supabase.co:5432/postgres"
  );
  process.exit(1);
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

// Ledger table (idempotent)
await client.query(`
  create table if not exists public.schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  );
`);

const { rows } = await client.query("select version from public.schema_migrations");
const applied = new Set(rows.map((r) => r.version));

let dirty = false;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`↷ skip (already applied): ${file}`);
    continue;
  }
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  process.stdout.write(`▶ applying ${file} ... `);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into public.schema_migrations (version) values ($1)", [file]);
    await client.query("commit");
    console.log("✅");
    dirty = true;
  } catch (err) {
    await client.query("rollback");
    console.log("❌");
    console.error(`\nMigration failed: ${file}`);
    console.error(err.message);
    // Show the offending statement context if pg includes position info
    if (err.position) {
      const around = sql.slice(Math.max(0, err.position - 120), err.position + 120);
      console.error(`\n...near: ${around.replace(/\s+/g, " ")}...`);
    }
    process.exitCode = 1;
    break;
  }
}

if (!dirty && process.exitCode !== 1) console.log("Nothing to apply — database is up to date.");

// Summary
const { rows: tables } = await client.query(
  "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"
);
console.log(`\nPublic tables now: ${tables[0].n}`);
await client.end();
