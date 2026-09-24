# TuitionTrack - Session Context

## Project Overview

TuitionTrack is a Next.js 14 application for managing tuition payments and student/family data. The app uses:
- **Frontend**: Next.js 14 with App Router, React Server Components
- **Database**: Supabase (PostgreSQL) - project `zlkkicrqwoxzhsfehouj`
- **Authentication**: Supabase Auth with email/password
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Recent Changes

### AI Model Selection, Official Ollama Cloud Integration & PostgreSQL Enum Expansion (2026-09-25)
- **Interactive AI Model Selection & Real-Time Discovery**:
  - Added dynamic `ModelSelect` component in `/app/ai-settings` (`src/components/settings/ai-settings.tsx`) allowing teachers to choose from live provider models, curated free models, or input custom model slugs.
  - Implemented `/api/ai/models` route with live catalog fetching for Groq (`/openai/v1/models`), OpenAI (`/v1/models`), Google Gemini (`/v1beta/models`), and Ollama Cloud (`/v1/models`).
  - Stored `selected_model` per BYOK key in `user_ai_keys.metadata.selected_model` and wired it into key resolution and tier fallback engine.
  - Enhanced `/api/ai/keys/test` to test explicit models with fallback disabled so teachers can diagnose and verify specific models directly.
  - Switched default Groq model from reasoning `openai/gpt-oss-20b` (which was outputting tokens in `reasoning` and hitting token limits) to ultra-fast non-reasoning `qwen/qwen3.8-27b` (4ms response). Added fallback reasoning extraction for any remaining reasoning models.
- **Official Ollama Cloud (`ollama_cloud`) Integration**:
  - Integrated official Ollama Cloud service (`https://ollama.com/v1`) with free-tier model catalog:
    - `gemma4:31b` (default)
    - `gpt-oss:20b`
    - `gpt-oss:120b`
    - `nemotron-3-nano:30b`
    - `nemotron-3-super`
    - `nemotron-3-ultra`
  - Added direct link to `https://ollama.com/settings/keys` in settings UI for generating cloud API keys.
  - Differentiated local keyless Ollama (`http://localhost:11434/v1`) vs official Ollama Cloud which requires bearer authentication.
- **PostgreSQL Enum Expansion (`public.ai_provider`)**:
  - Resolved `invalid input value for enum ai_provider: "ollama_cloud"` error on key save.
  - Authored and applied idempotent migration `supabase/migrations/20260924000000_ai_provider_enum_expansion.sql` using `scripts/apply-migrations.mjs`:
    - Added `ollama`, `ollama_cloud`, `nvidia`, `deepseek`, `github`, `opencode` to `public.ai_provider`.
  - Updated `DbEnums.ai_provider` in `src/lib/db/types.ts` to reflect the expanded enum.
- **Quality Gates & Deployment**:
  - `npm run lint`: 0 warnings, 0 errors.
  - `npm run typecheck`: 0 errors.
  - `npx -y tsx tests/ai-fallback.ts`: 19/19 tests passed.
  - `npm run build`: 72/72 static & dynamic routes compiled clean.
  - Deployed to Vercel production: `https://tuitiontrack-app.vercel.app` (verified HTTP 200 OK).

### Universal Persistent Agent Memory System Integration (`agentmemory`) (2026-09-25)
- **Universal Coding Agent Memory**: Set up and configured `rohitg00/agentmemory` (v0.9.29) powered by the `iii-engine` (pinned v0.11.2) across the entire developer workstation.
- **Engine Infrastructure & Setup**:
  - Downloaded and verified the pinned Windows x86_64 `iii.exe` binary v0.11.2 into `C:\Users\Piyush\.local\bin\iii.exe` and `C:\Users\Piyush\.agentmemory\bin\iii.exe`.
  - Configured `agentmemory` local daemon exposing REST/MCP on port `3111`, WebSocket streams on port `3112`, and the real-time live memory viewer at `http://localhost:3113`.
  - Configured silent Windows login auto-start via `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\start-agentmemory.vbs`.
- **Global Skill Library (17 Skills)**:
  - Installed all 17 agentmemory skills (`recall`, `remember`, `forget`, `recap`, `lesson`, `session-history`, `handoff`, `commit-context`, `commit-history`, `memory-discipline`, `agentmemory-mcp-tools`, etc.) into:
    - Global IDE directory: `C:\Users\Piyush\.gemini\config\skills\`
    - Global OpenCode directory: `C:\Users\Piyush\.config\opencode\skills\`
    - Workspace directory: `d:\TuitionTrack\.agents\skills\`
- **Wired MCP Client Integrations (7 Agent Environments)**:
  - **Antigravity IDE**: Global `C:\Users\Piyush\.gemini\config\mcp_config.json` and App `C:\Users\Piyush\.gemini\antigravity-ide\mcp_config.json`.
  - **OpenCode**: `C:\Users\Piyush\.config\opencode\opencode.json`.
  - **Cursor**: `C:\Users\Piyush\.cursor\mcp.json`.
  - **Claude Code**: `C:\Users\Piyush\.claude\.mcp.json`.
  - **Codex CLI**: `C:\Users\Piyush\.codex\config.toml`.
  - **GitHub Copilot CLI**: `C:\Users\Piyush\.copilot\mcp.json`.
  - **OpenClaw**: `C:\Users\Piyush\.openclaw\openclaw.json`.
- **Tool Protocol & Fallback Architecture**:
  - Standardized all agents on `node C:/Users/Piyush/AppData/Roaming/npm/node_modules/@agentmemory/mcp/bin.mjs` with `AGENTMEMORY_URL="http://localhost:3111"`.
  - Tested & verified: Exposes all 54 MCP tools when daemon is active; gracefully falls back to 7 core local tools (`memory_recall`, `memory_save`, `memory_sessions`, `memory_smart_search`, `memory_export`, `memory_audit`, `memory_governance_delete`) if the server is unreachable.
- **Verification & Probes**:
  - Ran `agentmemory demo`: Seeded 3 test sessions with 6 observations; verified 100% hybrid search recall across keyword and semantic queries ("jwt auth middleware", "database performance optimization", "rate limiting").
  - Live memory viewer active and responding at `http://localhost:3113` (HTTP 200).

### Teacher Submission Access Fix + Fully AI-Powered Homework Studio (2026-09-23)
- **Root cause — teachers saw ≤1 submission**: `/app/homework/[id]` only loaded `accessibleStudents[0]`'s submission (RLS was fine; the page query was the bug). The teacher branch now ownership-checks (`assignment.teacher_id === user.id`, mirroring RLS — no checks weakened) and loads ALL submissions with a student join. New `TeacherSubmissionsView` (`src/components/homework/teacher-submissions-view.tsx`): student/status filters, late/missing roster, per-question answers vs keys, marks, AI notes, feedback, question bank.
- **Class 5 + English Grammar**: Class 5 band added to `video-chapters.ts` (Maths/Math-Magic, English/Marigold, EVS/Looking Around — real NCERT chapters) plus an `English Grammar` subject for classes 5–12 with class-graded topics (nouns/articles → clauses/integrated grammar). Studio selector is now 5–12; stale subject/chapter selection bug fixed (derived effective values).
- **No mocks, ever**: deleted the ~160-line deterministic template bank in `variation-engine.ts`. AI failure or invalid output now THROWS an actionable error — never fake success. Live-proofed with real keys: Class 5 "Nouns and Their Kinds" via Google/`gemini-2.5-flash`, 3/3 valid first attempt; a second run produced a fully different set (freshness proven).
- **Provider/model visibility**: `CompleteResult.provider` threaded through `provider.ts` (+ `providerDisplayName`); generate API returns the REAL serving provider/model/validation stats; studio shows a pipeline checklist and a `provider · model` badge — nothing hardcoded.
- **Validation + anti-repetition**: schema, chapter-relevance backstop (prefix matching absorbs inflections like noun/nouns), fingerprint + normalized-stem dedupe within batch and against the teacher's last-5 same-chapter assignments, 3-attempt retry with shortfall error. Debug fixes along the way: token budget raised to `max(3000, count×800)` (was truncating JSON mid-array), BYOK threaded server-side via `AiKeyOverride`.
- **Notifications**: new `notifyHomeworkSubmitted` (`src/lib/notifications.ts`) fires on every real submit — student confirmation + teacher row + verified guardians of that student only. Student/parent feeds render score/late details. Prior-session WIP in the same family (shared helper, portal.ts hooks, student notifications page + nav) committed together.
- **Daily universal assignments**: new cron `GET /api/cron/daily-assignments` (vercel.json `30 0 * * *`), per-(teacher, class 5–12) groups, rotating GK / Moral Science / GS / Current Affairs (date-grounded prompt, no hardcoded news), idempotent per (teacher, class, category, date), capped 15 groups/run, reuses the assign fan-out.
- **Reports**: new `GET /api/reports/homework` — deterministic real-data analytics (submission rates, missing, late, averages, per-chapter performance), teacher-scoped, no fabricated metrics.
- **API auth fix (`c07836d`)**: `require*` helpers throw NEXT_REDIRECT, which route handlers surface as 500 (caught live on prod: signed-out calls 500'd). Generate + report routes now use `getAuthContext` with explicit 401/403 JSON.
- **Deploys**: `2e72401` (feature, 18 files) + `c07836d` (auth fix); git-push auto-deploy to `tuitiontrack-app.vercel.app`. Prod verified: login 200, homework 307, new routes 401 signed-out.
- **Gates**: typecheck 0, lint 0, `next build` clean, smoke 29/29 on the prod build. Direct-DB `verify-rls` unrunnable from sandbox (no DB route); no migrations were changed. Port 3000 in sandbox is taken by an unrelated MCP server — smoke runs on 3100+ via `BASE_URL`.
- **codebase-memory-mcp**: project `D-TuitionTrack` re-indexed post-changes — 3,971 nodes / 8,910 edges, `TeacherSubmissionsView` + `notifyHomeworkSubmitted` confirmed in graph.
- **ECC plugin**: `ecc-universal` added to global `~/.config/opencode` plugins (needs an OpenCode restart to load). Note: `opencode-ecc` on npm is a security placeholder — wrong package, avoid it.

### Multi-Tenant Teacher Workspace & Role-Based Access Control Overhaul + Fresh Database Reset (2026-09-21)
- **Multi-Tenant Workspace Core**:
  - Transformed TuitionTrack into a true multi-tenant education platform centered on **Teacher Workspaces**.
  - Database migration `20260922020000_multi_tenant_workspace_core.sql` created `public.workspaces`, `public.workspace_members`, and `public.workspace_audit_logs`, with `workspace_id` foreign keys and soft-delete `deleted_at` timestamps on `homework` and `assignments`.
  - Stored procedure `public.generate_workspace_code()` automatically assigns every teacher workspace a human-readable join code (`TT-[A-Z0-9]{6}`, globally unique, case-insensitive, indexed).
- **Redesigned Role-Selection Authentication Flow**:
  - First screen on `/login` and `/signup` presents: **"How are you using TuitionTrack?"** with 3 options: 👨‍🏫 **Teacher**, 🎓 **Student**, 👨‍👩‍👧 **Parent / Guardian**.
  - Teacher signup automatically provisions the workspace and generates a unique join code.
  - Student and Parent signups prompt for and validate the teacher workspace code in real-time before authentication, auto-joining upon registration.
  - Centralized role-based dispatcher at `/portal` routes users to their authoritative portal (`/app/dashboard`, `/student/dashboard`, or `/parent/dashboard`).
- **Teacher Member & Role Management**:
  - Teacher member directory at `/app/workspace/members` allowing teachers to view members and reassign roles (`student` ↔ `parent` ↔ `teacher`).
  - Comprehensive privilege escalation guards: students and parents cannot elevate themselves; workspace owners cannot be altered or stripped; database `CHECK` constraint prevents arbitrary roles.
  - Workspace code management card at `/app/workspace` and `/app/settings` with copy-to-clipboard, share message, and rotation confirmation modal.
- **Teacher-Only Homework Deletion & Unified Visibility**:
  - Unified student homework query in `src/lib/student/homework.ts` and homework player at `/student/homework/[id]` supporting both AI assignments and quick homework tasks.
  - Teacher-only deletion with confirmation dialogs in `AiAssignmentsList` and `HomeworkTable`. Soft-deleted items (`deleted_at is not null`) are strictly filtered from student, parent, and teacher views.
  - Non-teachers attempting deletion are blocked at UI, Server Action, and Supabase Row Level Security (`Assignments teacher delete policy`) levels.
- **Simplified Student & Parent Portals**:
  - Student Portal: Minimal, learning-focused navigation (**Dashboard, Homework, Assignments, Tests, 3D Lessons, Progress, Profile**). Completely stripped of teacher/admin controls.
  - Parent Portal: Focused on child monitoring (**Overview, Child Progress, Homework, Assignments, Tests, Attendance, Reports, Profile**). Child-switcher with strict `guardian_student_relationships` scoping.
- **Automated Verification Suites (28/28 Passing)**:
  - `tests/workspace-rbac-e2e.mjs`: 13/13 passing (workspace codes, joining, duplicate join prevention, teacher role changes, RLS delete block, audit logging).
  - `tests/student-homework-e2e.mjs`: 15/15 passing (portal access authorization, homework question visibility under RLS, cross-student submission isolation).
- **Fresh Database Reset**:
  - Executed complete database purge (`scratch/clean-database.mjs`): 0 rows in `auth.users`, `public.users`, `public.workspaces`, `public.workspace_members`, `public.students`, `public.homework`, `public.assignments`, `public.fees`, `public.payment_settings`. Ready for fresh production launch!
- **Deliverable Architecture Documentation**:
  - Generated `IMPLEMENTATION_GAP.md`, `ARCHITECTURE.md`, `AUTHORIZATION.md`, `WORKSPACE_MODEL.md`, `MIGRATION_NOTES.md`, `SECURITY_AUDIT.md`, and `TEST_PLAN.md`.
- **Quality Gates**:
  - `npm run typecheck`: 0 errors.
  - `npm run lint`: 0 warnings, 0 errors.
  - `npm run build`: 71/71 static and dynamic pages generated with 0 errors.
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

### Teacher-Controlled Parent & Student Portal Access Architecture (2026-09-21)
- **Problem Solved**: Eliminated missing portal controls by establishing an explicit Teacher Access Control Center with dedicated, cryptographically secure parent and student portal link distribution.
- **Single Authentication + Portal-Scoped Grants Model**:
  - Replaced naive `role` enums with `portal_access_grants` (`portal_type: 'parent' | 'student'`).
  - Supports unified identity: single user account (Google OAuth or email/password) simultaneously manages multiple portal grants (e.g. parent of Child A + Child B, or shared account with student grant).
  - Opaque 256-bit random tokens (`crypto.randomBytes(32)`): raw tokens are **never stored in the database**; only SHA-256 hashes (`token_hash`) are persisted.
  - Regeneration immediately revokes previous tokens and issues a fresh link; revocation terminates access immediately server-side and in Supabase RLS.
  - Safe public preview (`preview_portal_grant`): reveals student first name and class grade only; zero private IDs, emails, or phone numbers leaked to unauthenticated visitors.
- **Teacher Control Center (`/app/portal-access`)**:
  - Added `🔗 Portal Access` navigation in the teacher sidebar (`AppSidebar`).
  - Overview cards with one-click quick link generators.
  - Filter tabs (`All`, `Parent`, `Student`, `Active`, `Pending`, `Revoked`) and live search by student name or parent/student email.
  - Copy link with toast feedback, native WhatsApp share (`wa.me` formatted intent), QR code modal generator (`qrcode`), regenerate link, and revoke access actions.
- **Per-Student Portal Access (`/app/students/[studentId]`) & Quick Actions**:
  - Dedicated `StudentPortalAccessCard` on student profile pages.
  - Quick action portal shortcut from the main Students directory table (`/app/students`).
  - Teacher dashboard card and quick action badge for portal management.
- **Gateway Routes & Login Redirection**:
  - `/portal/parent/[token]` and `/portal/student/[token]` gateway routes with safe preview and single-click authentication.
  - `/portal/login` with validated `next`/`returnTo` path preservation preventing open redirects.
- **Student Learning Portal (`/student/*`)**:
  - `/student/dashboard` - Daily homework, test scores, announcements, 3D lesson shortcuts, AI tutor launcher.
  - `/student/homework` - Assigned tasks, deadlines, and completion statuses.
  - `/student/assignments` - Worksheets and teacher feedback viewer.
  - `/student/tests` - Subject marks, totals, and percentage breakdown.
  - `/student/lessons` - 3D curriculum video lessons by subject.
  - `/student/progress` - Concept mastery breakdown matrix.
  - `/student/announcements` - Class bulletins from tuition teacher.
  - `/student/profile` - Account settings and unified authentication details.
- **Database Schema Migration (`20260922000000_portal_access_grants_architecture.sql`)**:
  - Added `portal_access_grants` and `portal_access_events` audit logging.
  - Augmented `public.can_access_student(uuid)` to enforce active portal grants in RLS.
  - Backfilled existing students with `parent_email` and `student_email` into pending grants.
  - Database state: **69 public tables, 127 RLS policies** (verified with zero anonymous leaks).
- **Automated Test Verification**:
  - `tests/portal-access-e2e.mjs`: **34/34 passing** (token entropy, SHA-256 hash storage, safe preview, multi-grant accounts, cross-student isolation, link regeneration, revocation, audit trail).
  - `tests/parent-portal-security.mjs`: **49/49 passing** (RLS protection, cross-family denial, staff access).
  - `tests/fee-engine-security.mjs`: **35/35 passing** (Proof verification, UTR deduplication, receipts).
  - `npm run typecheck` & `npm run lint`: **0 errors, 0 warnings**.
  - `npm run build`: Production build cleanly compiles all 68 routes.
- **Production Deployment**:
  - Deployed to Vercel production: deployment `dpl_Go5z7jMDy7RaMaY5y1dxw5ie9Wrs`.
  - Aliased live at `https://tuitiontrack-app.vercel.app`.
  - Git commit `9975deb` pushed to `Warriorlegacy/TuitionTrack` `main`.
- **Go-To-Market (GTM) Strategy & SEO Master Guide (2026-09-21)**:
  - Comprehensive GTM playbook, 517-chapter Programmatic SEO (pSEO) engine, JSON-LD Schema markup, Generative Engine Optimization (GEO/AEO), B2B pricing model, and 90-day tactical roadmap generated as a publication-ready document: `TuitionTrack_GTM_and_SEO_Master_Strategy_Guide.pdf`.
  - Generator script maintained at `scripts/generate_gtm_seo_pdf.py`.

## Current Production Status
- **Live Production URL**: `https://tuitiontrack-app.vercel.app` (deployments `dpl_HYN1Hrbpqsg7njimnnZTkY1p4fjE` + auth-fix follow-up, both READY & ALIASED; commits `2e72401`, `c07836d` on `main`).
- **Production Status**: READY & ALIASED.
- **Teacher Homework Submissions**: full roster view live (all students, filters, missing list, answers vs keys, AI notes) — the #1 teacher complaint fixed.
- **AI Homework Studio**: Classes 5–12 + English Grammar (5–12), live-AI-only generation with real provider/model display and validation.
- **Notifications**: homework-assigned + homework-submitted fan-out live for student/teacher/guardian feeds.
- **Automation**: daily universal assignment cron (`30 0 * * *`) + homework analytics API live; all prod env keys present (Groq/Gemini/OpenRouter/NVIDIA/HF, CRON_SECRET, Supabase).
- **Portal Access System**: Teacher-controlled Parent & Student portal links with QR codes, WhatsApp sharing, and single-auth redemption.
- **Parent Experience Layer**: 19 parent portal routes live, verified with 84/84 security tests passing.
- **Student Learning Portal**: 8 dedicated student routes live with homework, tests, 3D lessons, and AI tutor.
- **Curriculum & 3D Lessons**: 517/517 chapters across Classes 6–12 verified and live in production with WebGL 3D scenes.
- **BYOK AI Providers**: 12 providers configured (free-tier failover priority).
- **Supabase Inactivity**: Keep-alive cron active every 2 days (400 OK prevented, zero-secret leak verified).
- **Database**: 69 public tables, 127 RLS policies, 0 anonymous leaks.
- **Verification**: 34/34 portal E2E, 49/49 parent security, 35/35 fee security, and 29/29 smoke tests passing (latest: against the 2026-09-23 prod build).
- **Known follow-ups**: teacher feedback/override editing on submissions is view-only; student-portal provider/model receipt not yet shown; daily cron not yet observed firing on schedule.
