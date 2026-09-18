# TuitionTrack - Session Context

## Project Overview

TuitionTrack is a Next.js 14 application for managing tuition payments and student/family data. The app uses:
- **Frontend**: Next.js 14 with App Router, React Server Components
- **Database**: Supabase (PostgreSQL) - project `zlkkicrqwoxzhsfehouj`
- **Authentication**: Supabase Auth with email/password
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Recent Changes

### Agency Agent Skills Installation & Video Pipeline Fix (2026-09-18)
- **Agency Agent Skills Installed**: 18 skills deployed to `.agents/skills` and linked to `skills/` (registered in `skills-lock.json`), including `agency-agents-orchestrator`, `agency-senior-project-manager`, `agency-backend-architect`, `agency-frontend-developer`, `agency-senior-developer`, `agency-video-optimization-specialist`, `agency-automation-governance-architect`, `agency-code-reviewer`, `agency-devops-automator`, `remotion`, and core quality skills.
- **Python 3.11 Environment Fix for MoneyPrinterTurbo**: Machine default Python is 3.14 which broke litellm; targeted pre-installed CPython 3.11.15 via `uv venv tools/moneyprinterturbo/.venv --python 3.11 --clear` and resolved all 105 dependency wheels cleanly.
- **Lesson Video Renders**: Ran `scripts/make-lesson-videos.ts` to generate 518 interactive GSAP lesson HTML chapters in `public/videos/` with dynamic narrated links.
- **TypeScript config hardened**: Excluded `skills`, `.agents`, and `tools` directories from `tsconfig.json` so skill asset/example files are not picked up during app typechecks.

### Full AI-power + automation implementation (2026-09-17)
- **@supabase/server ^1.6.1 installed** (`npm install @supabase/server`). Note: per Supabase docs it is for header-based auth (Edge Functions/stateless APIs); the Next.js app correctly stays on `@supabase/ssr` for cookie sessions. No SSR client rewrite needed.
- **Env already configured** — `.env.local` holds SUPABASE_URL/PUBLISHABLE/SECRET/JWKS + DATABASE_URL; REST ping returns 200. Pasted chat keys were never written to disk or logs.
- **BYOK now covers 12 providers**: added DeepSeek, GitHub Models (`GITHUB_MODELS_TOKEN`, not `GITHUB_TOKEN`), Ollama local (`OLLAMA_BASE_URL`, key optional, 100% free/offline) alongside Groq/Gemini/OpenRouter/NVIDIA/HF/OpenAI/Anthropic/Together/custom. Free-first failover order kept; deepseek→github→ollama appended last. Stale key-route default fixed to `google/gemma-4-26b-a4b-it:free`. Probe script covers all (Ollama refused-connection → SKIP).
- **AI Settings UI**: NVIDIA/DeepSeek/GitHub/Ollama cards, 100% FREE / FREE TIER / PAID badges, Ollama blank-key UX, updated free-stack guidance. Typecheck + lint clean.
- **Keep-alive 3rd layer**: `scripts/supabase-keepalive.mjs` (zero-dep dual ping) + `.github/workflows/supabase-keepalive.yml` (Mon/Wed/Fri 04:00 UTC + manual dispatch). Verified prod 200/200. NOTE: `.gitignore` `.*` ignores `.github/` — file is staged via `git add -f`; keep it force-added. Still needs 4 GitHub Secrets (see docs/CRON_SETUP.md).
- **Automation control plane LIVE**: migration `20260917000000` applied to prod (7 tables: agent_runs, automation_rules, approvals, tasks, message_templates, message_outbox, inbound_messages; 50 public tables). Fee-dunning agent (ladder day+3/+7/+12, L3 drafts + escalate-task, never sends) + `/api/cron/fee-dunning` (daily 07:00 added to vercel.json) + parent-digest agent (deterministic 6-line template, no LLM in MVP) + outbox dispatcher (kill-switch → quiet hours 21:00–07:30 IST → cap 3/day → dedupe, `wa.me-link` provider) + approvals UI (`/app/approvals` + PATCH API). Deferred: money/consent/KB tables, real WhatsApp provider, LLM digest rewrite.
- **Verify**: `npm run typecheck` ✅, `npm run lint` ✅, keepalive prod 200/200 ✅.

### BYOK E2E verification on prod + fast-model fix (2026-09-16)
- **E2E verified the full BYOK flow on production** (`tests/byok-e2e-prod.mjs`): creates a test teacher via the admin API, password-grant sign-in, forges the `@supabase/ssr` session cookie (`sb-<ref>-auth-token` = `base64-` + base64url(JSON session); ssr 0.10.3), then: GET keys (200 + negative control 307→/login) → save OpenRouter key → key-test route → **tutor JSON, tutor SSE stream, quiz (201), flashcards (201)** → proves the BYOK key was used (`last_used_at` advanced, `model_usage` rows) → full cleanup. All PASS.
- **Free default model fixed — reasoning-model trap**: `nvidia/nemotron-3.5-lightning:free` is a *reasoning* model — burned 10-token budgets on a thinking trace ("Here's a thinking process: 1. **"), key-test took 20–34s and the tutor leaked the trace into replies. New OpenRouter defaults (latency-measured live): A/B `google/gemma-4-26b-a4b-it:free` (1.6s, non-reasoning), C `inclusionai/ling-3.0-flash-vl:free` (1.25s). Key-test route maxTokens 10 → 300 (reasoning models need headroom). Added `stripReasoningTrace()` (strips `<think>…</think>` + unclosed traces) applied in `complete()`; UI copy/defaults updated.
- **Real bug fixed — `last_used_at` never set**: `getBestKeyForTier()` now fire-and-forget updates `user_ai_keys.last_used_at` on every BYOK key resolution (visible in the settings UI; previously always null).
- Quiz/flashcards return **201 Created** (REST-correct, not a bug). SSE frames are `event:`/`data:` pairs — client parsers must pair them (test script did it wrong initially).
- **Cleanup gotchas (for future E2E scripts)**: `messages`/`tool_calls` have no `user_id`/`student_id` columns — they hang off `conversations` (`conversation_id` → cascade `on delete cascade`), so deleting `conversations` cleans everything. `user_ai_keys`/`user_ai_preferences`/`model_usage` delete by `user_id`. Auth users: `admin.auth.admin.deleteUser`.
- Prod note: unauthenticated API GETs return **307 → /login** (middleware) — fetch follows redirects silently, so use `redirect: "manual"` in tests. Free-model 429s and ECONNRESET are intermittent; the E2E script has a retry wrapper.
- Old E2E runs left a stale `byok-e2e@tuitiontrack-test.local` auth user twice (aborted scripts) — the script now hard-deletes any pre-existing test user before creating one.
- **Redeployed to prod twice** after the model fix + `last_used_at` fix (latest alias: https://tuitiontrack-app.vercel.app).

### Backup scheduler (cron-job.org) (2026-09-16)
- Two cron-job.org jobs (IDs `8456998` daily 03:00 UTC keep-alive, `8456999` Monday 04:00 UTC supabase-keepalive) fire the same endpoints as independent backups to Vercel Cron — created via their API (note: job creation is `PUT /jobs`, custom headers live in `extendedData.headers`, weekdays are `wdays`).
- Both send `Authorization: Bearer $CRON_SECRET`; responses saved for dashboard inspection. Verified live end-to-end (the exact Bearer request returns 200 from prod). `CRON_JOB_ORG_API_KEY` stored in `.env.local`. Details in `docs/CRON_SETUP.md`.

### Production deploy (2026-09-16) — LIVE at https://tuitiontrack-app.vercel.app
- **Deployed to Vercel production** (project `tuitiontrack-app`, linked via `.vercel/project.json`) after final build passed.
- **Hybrid pgvector retrieval fixed + live-verified**: `match_document_chunks` RPC kept failing with "structure of query does not match function result type" — ts_rank returns real, cosine math returns float8; the plpgsql CTE returned those raw instead of `::numeric`. Cast at source and table-qualify every ref so OUT-param names can't be substituted. Verified in-database: semantic leg, keyword leg, hybrid fusion, dimension guard (3-dim vec → clean error).
- **Provider failover chain**: `complete()`/`streamComplete()` now try every configured platform key free-first (Groq → Gemini → OpenRouter → NVIDIA → HF → OpenAI) and move to the next on error; BYOK override deliberately does NOT failover (bad keys must surface to the user). Helpers: `resolveChain`, `resolveAttemptProvider`, `requestCompletion` (shared request body for stream + non-stream).
- **Key prefixes**: `AQ.` now detected as Google (2025+ API keys), `nvapi-` as NVIDIA NIM (`integrate.api.nvidia.com/v1`, OpenAI-compatible). `ProviderKind` includes `nvidia`.
- **Model landscape refresh (verified live 2026-09-16)**: Google `gemini-2.0-*` retired (404) → `gemini-2.5-flash-lite/flash/pro`; Groq `llama-3.1-8b-instant` retired → `openai/gpt-oss-20b` (C: `openai/gpt-oss-120b`); NVIDIA `meta/llama-3.1-8b-instruct` EOL (410) → `nvidia/nemotron-3.5-lightning-30b-a3b` (C: `nvidia/nemotron-3-super-120b-a12b`); HF router base is `router.huggingface.co/v1` (not `/hf-inference-api/v1`). All reasoning models — `content` stays clean (reasoning arrives in a separate field our parsers ignore).
- **Embeddings**: `embedTexts`/`getEmbeddingKey` platform fallback now walks the chain but only OpenAI-compatible surfaces (Google embeddings are 768-dim → would fail the 1536-dim RPC guard).
- **Env**: `.env.local` now holds GROQ/GEMINI/OPENROUTER/NVIDIA_NIM/HUGGINGFACE/CRON_JOB_ORG keys. All 9 server secrets pushed to Vercel production (SUPABASE_SECRET_KEY, CRON_SECRET, AI_KEY_ENC_KEY, NEXT_PUBLIC_APP_URL, 5 AI keys). `RESEND_API_KEY` intentionally absent (monday-sync degrades gracefully). `scripts/probe-ai-providers.mjs` re-probes all keys with 1-token completions.
- **Post-deploy checks**: root/login 200; tutor API auth works; both keep-alive crons 401 unauth / 200 with Bearer, `users` table reachable in prod.
- Probe results: OpenRouter ✓, NVIDIA ✓, HF ✓; Gemini 429 (free-tier quota exhausted — recovers on its own); Groq intermittent 401 (key worked on manual recheck — the failover chain absorbs it).
- ⚠️ These keys were pasted into chat — rotate Groq/Gemini/OpenRouter/NVIDIA/HF keys when convenient.

### SSE streaming tutor (2026-09-16)
- Added `streamComplete()` in `src/lib/ai/provider.ts`: streaming mirror of `complete()` — same key/model resolution and stub degradation, parses all three provider SSE dialects (OpenAI-compatible `choices[].delta`, Anthropic `content_block_delta`/`message_start`/`message_delta`, Google `alt=sse` candidates), pushes deltas to a callback, returns full `CompleteResult` with usage for billing. Handles `[DONE]`, partial frames across chunk boundaries, and client-disconnect abort (`signal`).
- `/api/ai/tutor` now supports `?stream=1`: SSE frames `meta` (conversation_id, citations, model) → `delta` (text) → `done` (citations, confidence, cost) or `error`. Auth/RLS/rate-limit/RAG pipeline runs before the stream opens; persistence (`messages`, `tool_calls`, `model_usage`, `learning_events`) runs after it closes — partial replies are saved if a stream dies mid-flight. JSON path unchanged for backward compat.
- `TutorView` consumes SSE and renders tokens progressively with an optimistic assistant bubble; falls back to JSON parsing when the response isn't `text/event-stream` (e.g. 401/429 JSON bodies).
- Verified with mock SSE servers for all three dialects + a live OpenRouter stream (44 deltas, E2E).
- Fixed stale OpenRouter free default: `google/gemini-2.0-flash-exp:free` was retired (404). Free A/B default is now `nvidia/nemotron-3.5-lightning:free` (1M ctx), C is `nvidia/nemotron-3-ultra-550b-a55b:free` — verified against OpenRouter's live model list 2026-09-16; UI copy updated to match.
- Temp verification script `tests/stream-provider-check.ts` was run and removed.

### AI gateway + BYOK repair (2026-09-16)
- **Fixed `src/lib/ai/provider.ts`**: `kind`/`provider` were referenced out of scope in `complete()` — every AI call (tutor, quiz, flashcards) threw ReferenceError. Rewrote with proper scoping, added stub-mode degradation (returns actionable text instead of throwing when no key configured), `AI_BASE_URL` support, and explicit-override model priority (`modelOverride` > env > free pool).
- **Fixed `src/lib/ai/byok.ts`**: missing `ResolvedProvider` import; per-tier model map typed correctly for `deterministic` tier.
- **Fixed `src/lib/ai/crypto.ts`**: `fingerprintKey` now SHA-256 of the raw key (was base64 of raw bytes); uses `node:crypto`.
- **Fixed key-corruption bug in `POST /api/ai/keys`**: saving preferences with no key in the form used to upsert the masked preview (`xxx••••••••`) over `encrypted_key`. Route now supports `prefs_only` mode that never touches the encrypted key; `GET` no longer returns `encrypted_key` at all.
- **Fixed `src/app/api/ai/keys/test`**: model was hardcoded `gpt-4o-mini` for every provider — Groq/Together/HF tests failed with model_not_found. Now uses provider-correct `pickModel("A", …)` free default.
- **Fixed UI**: `/app/ai-settings` page passed a non-existent `userId` prop; `AiSettings.savePrefs` now posts `prefs_only` payload; tutor page modes use `blurb` field (matches `TutorView`'s `Mode` type).
- Default free model guidance is now `google/gemini-2.0-flash-exp:free` (OpenRouter) / `llama-3.1-8b-instant` (Groq).

### Keep-alive cron hardening (2026-09-16)
- `/api/cron/keep-alive` now fails closed like the other cron routes: 500 when `CRON_SECRET` unset (the `x-vercel-cron` header alone is spoofable), 401 otherwise.
- Both keep-alive routes verified live against Supabase project `zlkkicrqwoxzhsfehouj`: 401 unauthenticated, 200 with Bearer secret.
- `docs/CRON_SETUP.md` documents both routes, auth policy, and local curl verification steps.
- Generated `CRON_SECRET` + `AI_KEY_ENC_KEY` (AES-256 for BYOK at-rest encryption) into `.env.local`.

### Supabase Keep-Alive Cron (2026-09-16)
- Created `/api/cron/supabase-keepalive` route to prevent Supabase free-tier inactivity pauses
- Configured Vercel cron job to run every 7 days
- Added `docs/CRON_SETUP.md` with verification and troubleshooting steps
- Route authorizes via `CRON_SECRET` or Vercel's `x-vercel-cron` header
- Executes lightweight `SELECT id FROM users LIMIT 1` query

## Key Technical Details

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public Supabase key
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key for server-side operations
- `CRON_SECRET` - Secret for authenticating cron routes
- `RESEND_API_KEY` - Email service (if applicable)

### Important Routes
- `/api/cron/keep-alive` - Daily generic keepalive
- `/api/cron/supabase-keepalive` - Weekly Supabase inactivity prevention
- `/api/cron/monday-sync` - Weekly Monday 08:00 tutor alerts + parent digests

### Database Schema
- `users` - Core user table
- `students` - Student profiles
- `families` - Family/parent information
- `payments` - Payment records
- `tutors` - Tutor data

### Scripts
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run lint` - ESLint check
- `npm run typecheck` - TypeScript check

## Current Sprint Focus
- Blueprint MVP-1 learning loop is wired: tutor/quiz/flashcards routes, mastery, mistakes, FSRS reviews, planner, documents/RAG.
- BYOK works with free-first providers: OpenRouter (Gemini free), Google Gemini, Groq — user adds key in /app/ai-settings.
- Next: pgvector semantic retrieval (keyword prefilter today), streaming tutor replies, question quality pipeline depth.

## Notes
- Supabase free tier pauses after ~1-2 weeks of inactivity
- Vercel cron jobs run on serverless functions
- All cron routes require authentication (Bearer token or Vercel header)
- Lint passes clean with no warnings or errors
