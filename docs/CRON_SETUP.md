# TuitionTrack Cron Jobs

Vercel Cron keeps scheduled tasks running. This document covers the Supabase keepalive jobs and their independent backup scheduler.

## 3-Layer Keep-Alive System

The Supabase free-tier project (`zlkkicrqwoxzhsfehouj`) is kept from pausing by three independent layers. All layers are idempotent read-only pings (`SELECT id FROM users LIMIT 1`), so overlapping fires are safe — no double-write risk.

| Layer | Scheduler | Schedule (UTC) | What it pings |
|-------|-----------|----------------|---------------|
| 1. Vercel Cron | `vercel.json` | daily `keep-alive` + weekly `supabase-keepalive` | DB via anon / service key |
| 2. cron-job.org (external backup) | job IDs `8456998` / `8456999` | daily 03:00 + Mondays 04:00 | `GET /api/cron/keep-alive` + `GET /api/cron/supabase-keepalive` with `Bearer CRON_SECRET` |
| 3. GitHub Actions triple-ping | `supabase-keepalive.yml` | Mon/Wed/Fri 04:00 (`0 4 * * 1,3,5`) | direct Postgres → Supabase REST → app route |

Any single surviving layer is enough to prevent a pause.

## What They Do

Two routes keep the Supabase free-tier project (`zlkkicrqwoxzhsfehouj`) from being paused for inactivity:

| Route | Schedule | Client |
|-------|----------|--------|
| `/api/cron/keep-alive` | Daily (`0 0 * * *`) | anon key (RLS-scoped read) |
| `/api/cron/supabase-keepalive` | Every 7 days (`0 0 */7 * *`) | service key (admin read) |

Each hits the database with a lightweight `SELECT id FROM users LIMIT 1`. A paused project can take several minutes to resume, which would surface as cold-start latency or 503s in the app. The daily anon ping is the primary defense; the weekly service ping doubles as an admin-credential canary (it fails loudly if `SUPABASE_SECRET_KEY` goes stale).

## Authentication (both routes)

Both keep-alive routes are closed to the public and fail closed. They accept two forms of auth:

1. `Authorization: Bearer <CRON_SECRET>` — used by Vercel Cron when the secret is configured in the job definition.
2. `x-vercel-cron: 1` — Vercel's auto-injected header for cron-triggered requests.

If `CRON_SECRET` is not set in the environment, every cron route returns 500 and logs the misconfiguration so the problem is visible in Vercel logs. The header alone is spoofable, so an unconfigured secret must never open the route.

## Local Verification

```bash
# 1. Start the dev server
npm run dev

# 2. In another shell, load the secret and ping both routes
source .env.local
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/keep-alive
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/supabase-keepalive
# Expect {"success":true,...} from each.

# 3. Without the header both must 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cron/keep-alive   # 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cron/supabase-keepalive  # 401
```

## How to Verify It Works

1. **Check the Vercel dashboard:** Vercel → your project → Cron Jobs. You should see `supabase-keepalive` listed with its schedule and recent invocations.
2. **Hit the endpoint manually** with the secret:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" \
     -H "Authorization: Bearer $CRON_SECRET" \
     https://tuitiontrack-app.vercel.app/api/cron/supabase-keepalive
   ```
   Expected response: `200` with a JSON body containing `success: true`.
3. **Check Vercel function logs** after a run. Look for:
   ```
   [supabase-keepalive] ping at <ISO timestamp>
   ```
4. **Confirm Supabase dashboard activity:** Supabase → your project → Reports / Logs. You should see API requests around the scheduled time.

## How to Change the Schedule

Edit `vercel.json` and update the `schedule` field for the `supabase-keepalive` entry. Common cron expressions:

| Frequency | Cron expression |
|-----------|-----------------|
| Every 7 days (current) | `0 0 */7 * *` |
| Every 3 days | `0 0 */3 * *` |
| Weekly on Sunday | `0 0 * * 0` |
| Twice a week (Tue + Fri) | `0 0 * * 2,5` |

After editing, redeploy:
```bash
vercel --prod
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `500` — `CRON_SECRET is not configured` | Missing env var in Vercel | Add `CRON_SECRET` in Vercel → Settings → Environment Variables |
| `401` — `Unauthorized` | Wrong or missing secret in request | Ensure the Vercel cron job is using the same `CRON_SECRET` |
| `500` — `Database query failed` | Supabase outage or invalid credentials | Check Supabase status page and verify `NEXT_PUBLIC_SUPABASE_URL` / service key |
| No logs in Vercel | Cron job not firing | Check Vercel Cron Jobs page for failed invocations; ensure the path matches exactly |
| Supabase still pausing | Schedule too sparse | Reduce the cron interval (e.g., `*/3 * * *` for every 3 days) |

## Related Routes

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/keep-alive` | Daily | Generic keepalive (anon client) |
| `/api/cron/supabase-keepalive` | Every 7 days | Supabase-specific inactivity prevention (service client) |
| `/api/cron/monday-sync` | Weekly Monday 08:00 | Tutor alerts + parent digests |

## Backup Scheduler (cron-job.org)

Vercel Cron only fires while the deployment is active; a paused/unbilled Vercel
project would silently stop the keep-alives — exactly when they're needed most.
An independent external scheduler (cron-job.org, free tier) fires the same
two endpoints as a second line of defense.

| Job (title prefix `TuitionTrack`) | cron-job.org ID | Schedule (UTC) | Target |
|-------|----------|----------------|--------|
| keep-alive (daily backup) | `8456998` | Daily 03:00 | `/api/cron/keep-alive` |
| supabase-keepalive (weekly backup) | `8456999` | Mondays 04:00 | `/api/cron/supabase-keepalive` |

Both jobs send `Authorization: Bearer $CRON_SECRET` via `extendedData.headers`
(the same secret stored in Vercel — rotate it in both places if it ever leaks).
Responses are saved (`saveResponses: true`) so the last payload is visible in
the cron-job.org dashboard.

### Verify the backup jobs

```bash
# List jobs and check nextExecution (jobIds above)
node --env-file-if-exists=.env.local -e "
(async () => {
  const h = { Authorization: 'Bearer ' + process.env.CRON_JOB_ORG_API_KEY };
  const list = await (await fetch('https://api.cron-job.org/jobs', { headers: h })).json();
  for (const j of list.jobs.filter(x => x.title.startsWith('TuitionTrack')))
    console.log(j.jobId, j.title, 'enabled=' + j.enabled, 'next=' + new Date(j.nextExecution * 1000).toISOString());
})();"

# The API has no run-now trigger — to fire manually, run the same request the
# job sends:
source .env.local
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://tuitiontrack-app.vercel.app/api/cron/keep-alive
# Expect {"success":true,...}
```

Failures are visible in cron-job.org → Jobs → history (last status + saved
response). If both schedulers ever fire in the same minute the routes are
idempotent read-only pings — no double-write risk.

## GitHub Actions keep-alive (3rd layer — triple-ping)

Independent cron (`supabase-keepalive.yml`): Mon/Wed/Fri 04:00 UTC
(`0 4 * * 1,3,5`), plus manual fire via Actions → supabase-keepalive →
Run workflow (`workflow_dispatch`). Up to 3 attempts per run (30s apart).
Runs zero-dep `scripts/supabase-keepalive.mjs`, which triple-pings in one run:

1. **direct Postgres** — `SELECT id FROM users LIMIT 1` via `DATABASE_URL`
   (uses `pg` when installed, otherwise skips gracefully; bonus layer, never
   gates success),
2. **Supabase REST** — `GET /rest/v1/users?select=id&limit=1`,
3. **app route** — `GET /api/cron/supabase-keepalive` with `Bearer CRON_SECRET`.

Exit 0 only if REST + app both return 200. No `npm ci` — run finishes in
<30s when `pg` is absent. Logs show statuses and key lengths only, never values.
The workflow never commits or pushes — secrets exist only as step env vars.

Required GitHub Secrets (repo → Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Service-role / secret key |
| `CRON_SECRET` | Same value as Vercel `CRON_SECRET` |
| `APP_URL` | `https://tuitiontrack-app.vercel.app` |
| `DATABASE_URL` | Postgres connection string (direct connection, for layer-1 ping; optional — layer skips without it) |

All three layers (Vercel Cron, cron-job.org, GitHub Actions) are
idempotent read-only pings (`SELECT id ... LIMIT 1`), so overlapping
fires are safe — no double-write risk.
