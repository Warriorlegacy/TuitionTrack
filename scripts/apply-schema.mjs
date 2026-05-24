// Apply schema.sql to Supabase project using service_role key from environment variables.
// Reads both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment.
// Never hardcodes secrets in source code.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = join(__dirname, "..");

// Read configuration from environment variables — no hardcoded secrets
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!SUPABASE_URL) {
  console.error("❌ SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set in your environment.");
  process.exit(1);
}

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY must be set in your environment.");
  console.error("   Add it to .env.local or export it before running this script.");
  process.exit(1);
}

async function main() {
  console.log("📖 Reading schema.sql...");
  const schemaPath = join(projectDir, "supabase", "schema.sql");
  const schema = readFileSync(schemaPath, "utf8");
  console.log(`  Schema size: ${schema.length} characters`);

  // Approach 1: Supabase Management API
  console.log("\n🔌 Attempting to apply schema via Supabase Management API...");
  try {
    const projectRef = SUPABASE_URL.replace("https://", "").split(".")[0];

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "X-Client-Info": "tuitiontrack-migration-script",
        },
        body: JSON.stringify({ query: schema }),
      },
    );

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Schema applied successfully via Management API!");
      console.log("  Result:", JSON.stringify(result).slice(0, 200));
      return;
    } else {
      const errorText = await response.text();
      console.log(`  ❌ Management API failed (${response.status}): ${errorText.slice(0, 200)}`);
    }
  } catch (err) {
    console.log(`  ❌ Management API error: ${err.message}`);
  }

  // Approach 2: Direct Postgres connection using pg
  console.log("\n🔌 Attempting direct Postgres connection...");
  try {
    const { default: pg } = await import("pg");
    const { Pool } = pg;

    const projectRef = SUPABASE_URL.replace("https://", "").split(".")[0];

    const configs = [
      `postgresql://postgres.${projectRef}:${encodeURIComponent(SERVICE_ROLE_KEY)}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres:${encodeURIComponent(SERVICE_ROLE_KEY)}@db.${projectRef}.supabase.co:5432/postgres`,
      `postgresql://postgres.${projectRef}:${encodeURIComponent(SERVICE_ROLE_KEY)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
    ];

    let connected = false;
    for (const connectionString of configs) {
      if (connected) break;
      try {
        console.log(`  Trying: ${connectionString.replace(SERVICE_ROLE_KEY, "***")}`);
        const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 15000 });
        const client = await pool.connect();

        const testResult = await client.query("SELECT 1 as connected");
        console.log(`  ✅ Connected! Test: ${JSON.stringify(testResult.rows)}`);

        console.log("  📝 Applying schema...");
        await client.query(schema);
        console.log("  ✅ Schema applied successfully!");

        client.release();
        await pool.end();
        connected = true;
        return;
      } catch (err2) {
        console.log(`  ❌ Connection failed: ${err2.message.slice(0, 150)}`);
      }
    }

    if (!connected) {
      console.log("\n⚠️  Could not connect directly.");
      console.log("   Run the SQL manually in: https://supabase.com/dashboard/project/" + projectRef + "/editor");
    }
  } catch (err2) {
    console.log(`  ❌ pg import failed: ${err2.message}`);
    console.log("\n⚠️  Could not connect directly.");
    console.log("   Run the SQL manually in: https://supabase.com/dashboard/project/" + projectRef + "/editor");
  }
}

main().catch(console.error);
