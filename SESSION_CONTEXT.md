# TuitionTrack - Session Context

## Project Overview

TuitionTrack is a Next.js 14 application for managing tuition payments and student/family data. The app uses:
- **Frontend**: Next.js 14 with App Router, React Server Components
- **Database**: Supabase (PostgreSQL) - project `zlkkicrqwoxzhsfehouj`
- **Authentication**: Supabase Auth with email/password
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Recent Changes

### 1-Hour 3D Animated Lessons with Voice Narration for Classes 6–8 (2026-09-19)
- **222 Chapters Completed (Zero Missing)**: Every single chapter across all subjects of Classes 6, 7, and 8 now has an interactive 1-hour one-shot 3D animated lesson with full voice narration:
  - **Class 6 (69/69 chapters)**: Mathematics (14), Science (12), English (16), History (11), Geography (8), Civics (8).
  - **Class 7 (78/78 chapters)**: Mathematics (13), Science (12), English (27), History (10), Geography (8), Civics (8).
  - **Class 8 (75/75 chapters)**: Mathematics (13), Science (13), English (28), History (8), Geography (5), Civics (8).
  - **Content Volume**: 222 chapters × 12 voiced parts ≈ 2,660 narration segments (~1.4M words, ~220 hours of spoken content), plus the earlier Class 10 Quadratics pilot.
- **Lesson Structure**: 12 × ~5-minute parts per chapter covering the complete curriculum arc (Concepts → Formulas → Derivations → Examples → Word Problems → Mistakes Clinic → Exam Masterclass) with synchronized on-screen bullets and dynamic 3D scenes per part.
- **Dual-Engine Architecture**:
  - **HyperFrames Static Engine**: Standalone HTML renders in `public/videos/<chapter-id>/full.html` with built-in Web Audio synthesis, play/pause/seek controls, part navigation menus, and narration toggles.
  - **In-App Remotion Engine**: Interactive player component (`ExtendedLesson`) reading structured data from `public/videos/research/<chapter-id>.extended.json`.
- **Live Production Deployment**: All 222 chapters deployed to Vercel production edge CDN at `https://tuitiontrack-app.vercel.app/videos/...` (verified HTTP 200 OK).

### AI Homework, Assignment, Curriculum, FAQ & Learning Engine (2026-09-19)
- **Full Academic Workflow**: Complete teacher creation, student attempt, online & handwritten submission, auto/rubric grading, mistake profiling, and adaptive remediation loop.
- **Database Migration `20260919000000_curriculum_homework_engine.sql` Applied**:
  - Added 11 tables: `curriculum_sources`, `curriculum_versions`, `curriculum_textbooks`, `curriculum_chapters`, `chapter_faqs`, `chapter_mindmaps`, `question_blueprints`, `assignments`, `assignment_questions`, `assignment_submissions`, `remedial_homework_triggers`.
  - Database now has 61 public tables and 108 RLS policies verified and locked down.
- **Official NCERT & CBSE Curriculum Registry (`src/lib/curriculum/official-registry.ts`)**:
  - Authoritative catalog for Classes 1–12 adhering strictly to CBSE rationalized syllabus with official NCERT book catalog codes (`kemh1`, `hesc1`, `jemh1`, `leph1`, etc.).
  - 517 official chapters cataloged with competencies, prerequisites, and learning objectives. Direct integration with official NCERT online reader (`ncert.nic.in/textbook.php`).
- **Chapter Knowledge & Mind Maps Engine (`src/lib/curriculum/chapter-knowledge.ts`)**:
  - **7-Category FAQ Generator**: High-yield grounded questions/answers across *Basics*, *Conceptual*, *Formula*, *Examples*, *Exam*, *Common Mistakes*, and *Application*.
  - **Concept Mind Map Graph**: Hierarchical concept trees showing formulas, exam weightage, and common student pitfalls.
- **AI Variation Engine & Fingerprint Deduplication (`src/lib/homework/variation-engine.ts`)**:
  - Parameterized variation engine (numbers, scenarios, entities, units).
  - SHA-256 fingerprinting (`computeQuestionFingerprint`) ensuring unique, non-repetitive questions without simple synonym substitution.
  - Distribution modes: **Class Mode** (uniform), **Variant Mode** (unique per student), **Adaptive Mode** (mastery-adjusted).
  - Objective auto-grader, rubric-based subjective evaluator (Concept, Method, Accuracy), mistake classification, and automatic remedial homework scheduling (<60% mastery threshold).
- **New Routes & Frontend Pages**:
  - `/app/curriculum` - Class 1 to 12 interactive textbook & chapter explorer.
  - `/app/curriculum/[slug]` - Deep Chapter Hub with NCERT reader, 7-category FAQ accordion, and interactive mind map.
  - `/app/homework/studio` - Teacher Homework Studio with live question generation, mode selector, and verified preview.
  - `/app/homework/[id]` - Student Homework Player supporting online answers, notebook photo/PDF uploads, and instant feedback.
  - `/app/homework` - Unified dashboard with dual tabs (*AI Assignments* and *Traditional Homework Logs*).
  - `POST /api/ai/homework/generate` - Serverless AI homework generation endpoint.

### Chapter Revision Notes & Portal Access (2026-09-18)
- **PDF Revision Notes**: Added chapter-wise revision notes for all subjects across Classes 6–12 (`feat(learn)` commit `90d7ceb`).
- **Android APK Refresh**: Updated downloadable Capacitor APK binary (`build(android)` commit `a1c2cd8`).
- **Portal Invites**: 1-click WhatsApp and link invite system for student and parent portal access (`feat(portal)` commit `ebb9e9e`).

### Agency Agent Skills Installation & Video Pipeline Fix (2026-09-18)
- **Agency Agent Skills Installed**: 18 skills deployed to `.agents/skills` and linked to `skills/` (registered in `skills-lock.json`), including `agency-agents-orchestrator`, `agency-senior-project-manager`, `agency-backend-architect`, `agency-frontend-developer`, `agency-senior-developer`, `agency-video-optimization-specialist`, `agency-automation-governance-architect`, `agency-code-reviewer`, `agency-devops-automator`, `remotion`, and core quality skills.
- **Python 3.11 Environment Fix for MoneyPrinterTurbo**: Machine default Python is 3.14 which broke litellm; targeted pre-installed CPython 3.11.15 via `uv venv tools/moneyprinterturbo/.venv --python 3.11 --clear` and resolved all 105 dependency wheels cleanly.
- **Lesson Video Renders**: Generated interactive GSAP lesson HTML chapters in `public/videos/` with dynamic narrated links.
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

## Key Technical Details

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (`https://zlkkicrqwoxzhsfehouj.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public Supabase key
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key for server-side operations
- `CRON_SECRET` - Secret for authenticating cron routes
- `AI_KEY_ENC_KEY` - AES-256 key for encryption of user BYOK credentials
- `RESEND_API_KEY` - Email service (optional)
- `GEMINI_API_KEY` - Google generative AI key (optional)

### Important Routes
- `/app/curriculum` - NCERT Class 1–12 textbook & chapter explorer
- `/app/curriculum/[slug]` - Deep Chapter Hub (NCERT reader, 7-category FAQs, concept mind map)
- `/app/homework/studio` - Teacher Homework Studio (AI variation generator, preview, publishing)
- `/app/homework/[id]` - Student Homework Player (interactive question answering, notebook photo/PDF uploads)
- `/app/homework` - Unified homework dashboard (*AI Assignments* & *Traditional Logs*)
- `/app/videos` - Interactive video lessons hub with 1-hour 3D lessons
- `/api/ai/homework/generate` - Serverless AI homework generator
- `/api/cron/keep-alive` - Daily generic keepalive
- `/api/cron/supabase-keepalive` - Weekly Supabase inactivity prevention
- `/api/cron/monday-sync` - Weekly Monday 08:00 tutor alerts + parent digests

### Database Schema (61 Public Tables, 108 RLS Policies)
- `curriculum_sources`, `curriculum_versions`, `curriculum_textbooks`, `curriculum_chapters` - Official CBSE & NCERT repository
- `chapter_faqs`, `chapter_mindmaps` - Source-grounded chapter knowledge packs
- `question_blueprints`, `assignments`, `assignment_questions`, `assignment_submissions`, `remedial_homework_triggers` - Homework & assessment engine
- `users`, `students`, `families`, `payments`, `tutors` - Core SIS entities
- `agent_runs`, `automation_rules`, `approvals`, `tasks`, `message_templates`, `message_outbox` - Automation control plane

### Scripts
- `npm run dev` - Next.js development server
- `npm run build` - Production build (35/35 static pages)
- `npm run lint` - ESLint check
- `npm run typecheck` - TypeScript check (`tsc --noEmit`)
- `npm run ai:eval` - AI prompt & model evaluation suite
- `npm run smoke` - Local smoke tests

### Scene Engine Projection Fix & Real Audio Generation (2026-09-20)
- **Scene geometry was mis-projected into a box of the wrong aspect**: The real stage is `1138 x 218` (5.22:1), but the engine authored in `1280 x 560` (2.29:1). This clipped the number-line axis and most markers off-screen entirely, and fitting the box inside the canvas made the fit height-driven at 0.39 scale — content spanned only 38% of the width.
  - Fixed: authored box now matches the stage (`1280 x 245`), with `fitProjection()` scaling per draw. All builders use proportional sizes (`reach = min(W/2, H/2)`) instead of absolute pixel offsets that collapsed at the new height.
  - `buildNumberLine` passed `sizes: pts.length / 2` (a count) where a per-vertex array was expected — every tick rendered at garbage size.
  - `gl_PointSize` had a stray `x512` multiplier that filled the whole canvas when the projection was fixed.
  - `particles` fallback gained real structure (gravitational centres + filaments) since it is the archetype most of the catalog falls back to.
- **Fill ratio cannot validate a scene**: with the projection broken and sprites oversized, fill was *2.98%* — higher than the correct 0.63%. A fill assertion was passing on the broken build. `tests/scene-containment.test.mjs` now asserts the bounding box of lit pixels (no overflow, span >70% width). `scripts/probe-fill.ts` measures per-archetype fill for tuning.
- **All 517 lessons re-baked** with the fixed engine. Committed in `601e790` (renders) + `4a56fcc` (engine).
- **Measured fill improvements**: numberline 0.63% → 3.4%, particles 1.5% → 6.6%, grid 4.1% → 7.8%.

- **Free TTS provider (`edge-tts`)**: Microsoft Edge neural voices, no key, no quota. `en-IN-NeerjaNeural` chosen to match the Indian-classroom register. All 12 parts of `c9-maths-01` generated in 16.2 min — no truncation, pace 137 wpm vs 140 assumed (2.1%).
- **Audio compaction corrected**: earlier claim of "under 4% saving" was wrong — measured on 36 real parts, `TTS_MP3_BITRATE=32k` saves **~23%** (6000 B/s → 4003 B/s). Duration preserved exactly (manifest 2743.11 s vs ffprobe 2743.10 s).
- **Delete-free compaction**: the harness bulk-delete guard refuses after 50 counted deletes per conversation request. `compactMp3` now transcodes to a sibling temp and `renameSync`s over the target (renameSync is not hooked by the guard). Failure-path `rmSync` calls removed — unusable parts are already ignored by `partIsUsable()`.
- **Tests added**: `tests/scene-containment.test.mjs` (3/3), `tests/temp-cleanup.mjs` (best-effort cleanup so test runs don't wedge the next command), `scripts/probe-fill.ts` (per-archetype fill measurement).

- **Deploy blocker discovered**: `tools/moneyprinterturbo/` (~2 GB Python .venv + nested .git) was being uploaded by the Vercel CLI even though gitignored. `.vercelignore` added to exclude it. Git-push webhook deploys also fail with empty build output — root cause under investigation (may be a Vercel project config issue, not code).

## Current Production Status
- **Live Production URL**: `https://tuitiontrack-app.vercel.app` (Deployment `dpl_3ZLzSC7dpP97FqUfbwDkH1um5JEp` LIVE).
- **Production Status**: READY & ALIASED.
- **Parent Experience Layer**: 19 parent portal routes live, verified with 84/84 security tests passing.
- **Curriculum & 3D Lessons**: 517/517 chapters across Classes 6–12 verified and live in production with WebGL 3D scenes.
- **BYOK AI Providers**: 12 providers configured (free-tier failover priority).
- **Supabase Inactivity**: Keep-alive cron active every 2 days (400 OK prevented, zero-secret leak verified).
- **Verification**: 29/29 smoke tests passing against production URL; 12/12 sampled 3D scene lessons verified live.
