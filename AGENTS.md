# AGENTS.md — TuitionTrack

Next.js 14 (App Router, `src/app`) + Supabase (Postgres/Auth/RLS) multi-tenant SaaS. Path alias `@/*` → `src/*`. Package manager: **npm** (lockfile is `package-lock.json`).

## Commands

```bash
npm run dev                      # next dev (localhost:3000)
npm run lint                     # next lint (next/core-web-vitals + next/typescript)
npm run typecheck                # tsc --noEmit
npm run build                    # next build — runs clean before considering work done
npm run smoke                    # signed-out HTTP contract tests; server must be UP first
npm run test:parent-security     # live-DB RLS/authorization proofs (needs DATABASE_URL)
npm run test:fee-security        # live-DB fee-engine security proofs
npm run ai:eval                  # golden AI eval (tsx, needs .env.local keys)
```

Verification order that matters: `lint → typecheck → build → smoke`. Most scripts take `--env-file-if-exists=.env.local`; Node ≥ 20 required for that flag.

Single test: `node --test tests/smoke.mjs`, or `node --env-file-if-exists=.env.local tests/<name>.mjs` for the live-DB assertion scripts. `tests/*e2e*.mjs` hit the real database — they are assertions, not reports; non-zero exit on first failure. They are not run by `npm test` (there is no aggregate test script).

## Architecture (the parts that bite)

- **Three portals, one dispatcher**: teacher app at `src/app/(portal)/app/*`, student at `src/app/student/(portal)/*`, parent at `src/app/parent/(portal)/*`. Authenticated users hitting `/login`/`/signup` are bounced to `/portal`, which queries `getWorkspaceContextForUser(userId)` and dispatches by workspace role. Do not add role logic in pages that belongs in that dispatcher or in server actions.
- **Authorization is layered, and the DB layer is not optional**: middleware (`src/middleware.ts` → `src/lib/supabase/middleware.ts`) only gates routes; every mutation in `src/actions/*` must re-check `getAuthContext()` + workspace membership; Postgres RLS (`is_workspace_teacher` / `is_workspace_member` helpers) is the final boundary. Never trust client state. See `AUTHORIZATION.md` for the pattern.
- **Soft deletes**: `assignments` and `homework` use `deleted_at`, never hard deletes. Audit rows required for anything touching access or money (`workspace_audit_logs` / `audit_logs`).

## Database

- **`supabase/migrations/*.sql` is the only source of truth.** `supabase/schema.sql` was deleted for cause — never recreate a snapshot file or paste one into the SQL Editor. Full rules in `supabase/MIGRATION.md`; follow them.
- Apply: `node --env-file-if-exists=.env.local scripts/apply-migrations.mjs` (idempotent, one transaction per file, ledger in `public.schema_migrations`).
- Check state: `scripts/db-status.mjs`, `scripts/check-schema.mjs` (read-only). Prove RLS: `node --env-file-if-exists=.env.local scripts/verify-rls.mjs`.
- Migration rules that already caused incidents: idempotent (`if not exists` / `create or replace`), **never destructive**, RLS + ≥1 policy on every new table, `security definer` functions need `set search_path = public, extensions` (pgcrypto lives in `extensions`, not `public`), and a policy calling a non-`security definer` helper that reads the same table recurses until stack overflow.

## Environment gotchas

- `.env.local` from `.env.example`. `SUPABASE_SECRET_KEY` (`sb_secret_…`) is preferred; `SUPABASE_SERVICE_ROLE_KEY` is a legacy fallback read second — a stale shell-exported legacy value has previously shadowed `.env.local` and 401'd every privileged call.
- The service/secret key **bypasses RLS**. Never prefix it with `NEXT_PUBLIC_` and never add it to `next.config.mjs` `env:` — Next inlines that into the client bundle (deliberately absent, see comment in `next.config.mjs`).
- `DATABASE_URL` is only for the CLI scripts (`apply-migrations`, `db-status`, live-DB tests, `verify-rls`), not the app.
- `CRON_SECRET` is required in production: `/api/cron/*` fails closed (500) without it because the `x-vercel-cron` header is spoofable. Crons are listed in `vercel.json`.
- AI providers: free-first chain (Groq → Gemini → … → OpenAI), per-tier models via `AI_MODEL_TIER_A/B/C`, `AI_KILL_SWITCH=1` disables all AI calls.

## Conventions

- Server actions live in `src/actions/*` and return `{ success, message }` — match that shape.
- Workspace join codes: `TT-XXXXXX` from charset `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (no `0/O/1/I`); input is uppercased and auto-prefixed with `TT-` (`WORKSPACE_MODEL.md`).
- ESLint config is the stock Next one (`.eslintrc.json`) — no custom rules to guess.
- `tsconfig.json` excludes `skills`, `.agents`, `tools` from typecheck.
- Capacitor (`capacitor.config.ts`, `ios/`, `android/`) wraps the deployed web app — it is not a separate codebase; don't edit it for web changes.
- Root clutter (`bake*.log`, `vercel-deploy*.log`, `*.tsbuildinfo`) is generated noise; don't read or commit-new versions of it.

## Reference docs (trust executables over prose if they conflict)

- `ARCHITECTURE.md` — portal map, entities, request lifecycle
- `AUTHORIZATION.md` — role hierarchy, action guards, RLS policy examples
- `supabase/MIGRATION.md` — migration rules and the schema.sql history
- `WORKSPACE_MODEL.md` — join-code spec and join/rotate flows
- `TEST_PLAN.md` — what each e2e suite proves
- `.env.example` — every env var, annotated with which script consumes it
