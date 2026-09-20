# Database schema — how this project is actually defined

## Source of truth

**`supabase/migrations/*.sql` is authoritative.** Period.

Apply them with:

```bash
node --env-file-if-exists=.env.local scripts/apply-migrations.mjs
```

That script runs each file in filename order, inside one transaction per file,
and records what it applied in `public.schema_migrations`. Already-applied files
are skipped, so re-running is safe.

## Correction: `schema.sql` is not the schema

Earlier versions of this document said *"This project's database schema is
defined in `supabase/schema.sql`"* and instructed you to paste that file into the
SQL Editor.

**That was wrong, and the file has been deleted.** It was a Module-A/B snapshot
that predated the migrations directory, and it did not contain:

- `guardian_links`, `guardian_student_relationships`, `parent_permissions`, `parent_invites`
- `assignments`, `assignment_questions`, `assignment_submissions`, `remedial_homework_triggers`
- the entire curriculum engine (`curriculum_versions`, `curriculum_textbooks`, `curriculum_chapters`, `chapter_faqs`, `chapter_mindmaps`, `question_blueprints`)
- `orgs`, `batches`, `batch_enrollments`, `org_members`
- the AI learning loop (`syllabus_nodes`, `questions`, `attempts`, `attempt_responses`, `learning_events`, `concept_mastery`, `mistakes`, `spaced_items`, `study_plans`, `plan_tasks`, `conversations`, `messages`, `tool_calls`, `model_usage`, `ai_evaluations`)
- the automation control plane (`agent_runs`, `automation_rules`, `approvals`, `tasks`, `message_templates`, `message_outbox`, `inbound_messages`)
- `audit_logs`, `consent_records`, `documents`, `document_chunks`
- `user_ai_keys`, `user_ai_preferences`, `ai_budgets`

Running it against a live project built from the migrations would have appeared
to succeed while changing almost nothing, because every statement was guarded by
`if not exists`. Anyone following the old instructions would have concluded their
schema was current. It was not.

If you need a single-file snapshot for review, generate it from the live
database rather than hand-maintaining a second copy:

```bash
pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > supabase/schema.snapshot.sql
```

Treat any such snapshot as a *read-only artefact*. Never paste it over a live
database — that is how the drift started.

## Verifying the real state

Prefer asking the database over reading a file. Both scripts are read-only:

```bash
# Table counts, RLS coverage, applied migration ledger, extensions
node --env-file-if-exists=.env.local scripts/db-status.mjs

# Which tables exist per migration, and which API credential PostgREST accepts
node --env-file-if-exists=.env.local scripts/check-schema.mjs
```

At the time of writing, the live project (`zlkkicrqwoxzhsfehouj`) reports
**64 public tables, 64 of 64 with RLS enabled**, and 11 applied migrations.

## Conventions for new migrations

Follow what the existing files do:

1. **One concern per file**, named `YYYYMMDDHHMMSS_short_description.sql`.
2. **Idempotent.** `create table if not exists`, `create index if not exists`,
   `create or replace function`, and for enums:
   ```sql
   do $$
   begin
     if not exists (select 1 from pg_type where typname = 'my_enum') then
       create type public.my_enum as enum ('a', 'b');
     end if;
   end $$;
   ```
3. **Never destructive.** No `drop table`, no `drop column`, no `truncate` on
   tables holding student, teacher or assignment data. Add columns and backfill.
4. **RLS on every new table**, plus at least one policy. A table without a policy
   is inaccessible, not "open" — both are bugs. `scripts/verify-rls.mjs` checks
   this and fails the build on a gap.
5. **`security definer` helpers need an explicit `search_path`.** `pgcrypto` is
   installed in the `extensions` schema on this project, not `public`, so any
   function calling `digest()` or `gen_random_bytes()` must declare
   `set search_path = public, extensions`.
6. **Beware recursive policy evaluation.** If a policy on table `X` calls a
   helper that reads `X`, and that helper is not `security definer`, Postgres
   recurses until it hits `stack depth limit exceeded`. This bit us once already.
7. **Record an audit row** for anything that changes access or money.

## Verifying a security change

A migration that alters authorization must be proven, not assumed:

```bash
npm run test:parent-security
```

`tests/parent-portal-security.mjs` impersonates specific users by setting JWT
claims inside a transaction, then asserts that access is granted and denied as
claimed — including cross-family isolation. It rolls back, so it leaves no
fixtures behind.

## Prerequisites

1. Your Supabase project is linked to this Vercel project via Vercel's Supabase integration.
2. Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are set in Vercel.
3. `DATABASE_URL` is set locally in `.env.local` for the CLI scripts.
