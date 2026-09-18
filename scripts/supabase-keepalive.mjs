// Triple-ping keep-alive: direct Postgres + Supabase REST + app cron route.
// Run: node --env-file-if-exists=.env.local scripts/supabase-keepalive.mjs
// Exit 0 only if REST + app both 200; direct-postgres is a bonus layer.
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;
const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://tuitiontrack-app.vercel.app";
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !secretKey || !cronSecret) {
  console.error("missing env: need SUPABASE_URL, SUPABASE_SECRET_KEY, CRON_SECRET");
  process.exit(1);
}

async function ping(name, url, headers) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    console.log(`${name}: ${res.status}`);
    return res.status;
  } catch (err) {
    console.log(`${name}: fetch failed (${err.message})`);
    return 0;
  }
}

// ponytail: key lengths only, never values
console.log(
  `secretKey len=${secretKey.length} cronSecret len=${cronSecret.length} databaseUrl len=${databaseUrl ? databaseUrl.length : 0}`
);

// Layer 1: direct Postgres via DATABASE_URL. Bonus layer — skips gracefully
// when DATABASE_URL or pg is unavailable (e.g. zero-dep CI checkout).
async function pingPostgres() {
  if (!databaseUrl) {
    console.log("direct-postgres: skipped (no DATABASE_URL)");
    return null;
  }
  let Client;
  try {
    const pg = await import("pg");
    Client = pg.default?.Client ?? pg.Client;
  } catch {
    console.log("direct-postgres: skipped (pg not installed)");
    return null;
  }
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query("SELECT id FROM users LIMIT 1");
    console.log("direct-postgres: 200");
    return 200;
  } catch (err) {
    console.log(`direct-postgres: failed (${err.message})`);
    return 0;
  } finally {
    await client.end().catch(() => {});
  }
}

const s0 = await pingPostgres();
const s1 = await ping("supabase-rest", `${supabaseUrl}/rest/v1/users?select=id&limit=1`, {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
});
const s2 = await ping("app-cron", `${appUrl}/api/cron/supabase-keepalive`, {
  Authorization: `Bearer ${cronSecret}`,
});

const pgStatus = s0 === null ? "skipped" : s0;
if (s1 === 200 && s2 === 200) {
  console.log(`keep-alive ok: rest=200 app=200 postgres=${pgStatus}`);
} else {
  console.error(`keep-alive failed: supabase=${s1} app=${s2} postgres=${pgStatus}`);
  process.exit(1);
}
