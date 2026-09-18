# Technical Requirements Document (TRD)
## ExamPulse AI — Architecture, Data Model & AI Pipeline Design

**Companion to:** 01-PRD.md, 03-Tech-Stack.md
**Version:** 1.0

---

## 1. System Architecture Overview

```
                                ┌───────────────────────────────┐
                                │        Clients                │
                                │  Next.js PWA (students)        │
                                │  Next.js Tutor Dashboard        │
                                │  Capacitor/APK wrapper (mobile) │
                                │  WhatsApp (parent digests)      │
                                └───────────────┬─────────────────┘
                                                │ HTTPS / Realtime WS
                                ┌───────────────▼─────────────────┐
                                │        Vercel Edge / Next.js      │
                                │  - App Router pages/API routes    │
                                │  - Vercel AI SDK streaming layer  │
                                │  - Auth middleware (Supabase)     │
                                └───────────────┬─────────────────┘
                                                │
                  ┌─────────────────────────────┼─────────────────────────────┐
                  ▼                              ▼                              ▼
      ┌───────────────────┐      ┌───────────────────────────┐    ┌───────────────────────┐
      │     Supabase        │      │   AI Orchestration Layer    │    │  Background Jobs        │
      │ - Postgres (RLS)     │      │  (Edge Functions / Node)    │    │  (Inngest / pg_cron)     │
      │ - Auth               │◄────►│  - LangGraph agent graph    │◄──►│  - Streak/XP rollups     │
      │ - Storage (uploads)  │      │  - Doubt-solve pipeline     │    │  - FSRS review scheduler │
      │ - Realtime           │      │  - Adaptive test engine     │    │  - WhatsApp digest sender│
      │ - pgvector (RAG)     │      │  - Mastery/knowledge tracer │    │  - Predictive at-risk job │
      └─────────┬────────────┘      └─────────────┬───────────────┘    └───────────┬─────────────┘
                │  shared schema/roster                │ calls                       │
                ▼                                       ▼                             ▼
      ┌───────────────────┐              ┌───────────────────────┐        ┌───────────────────────┐
      │   TuitionTrack       │              │  LLM / AI Providers      │        │  WhatsApp Business API │
      │  (existing product)  │              │  - Gemini Flash (OCR/    │        │  (Gupshup/Meta Cloud)   │
      │  same Supabase project│              │    vision, cheap, fast) │        └───────────────────────┘
      │  or synced via API    │              │  - Claude/GPT-4o class  │
      └───────────────────┘              │    (Socratic tutor,      │
                                          │    subjective grading)  │
                                          │  - Whisper/Deepgram STT  │
                                          │  - TTS (Google/ElevenLabs)│
                                          └───────────────────────┘
```

**Key architectural decisions:**

1. **Single Supabase project shared with (or synced to) TuitionTrack.** A student, once enrolled in TuitionTrack, should not need a second signup. Reuse `students`, `parents`, `teachers` tables; add ExamPulse-specific tables alongside them. This is the single biggest scope-reduction available.
2. **Postgres + pgvector, not a separate vector database.** At this student volume (dozens to low thousands), a dedicated vector DB (Pinecone/Qdrant) is unnecessary infrastructure. pgvector inside the same Supabase instance benchmarks well past this scale and keeps one database to operate.
3. **Row Level Security (RLS) as the actual authorization boundary**, not just app-layer checks — critical since minors' data is involved and since AI-assisted code changes are more likely to introduce an app-layer authorization bug than to bypass a database-level policy.
4. **Two-tier LLM strategy**: a cheap, fast multimodal model handles OCR/first-pass doubt reading and simple question generation; a stronger reasoning model is reserved for Socratic tutoring dialogue, subjective-answer grading, and worksheet generation where quality matters more than latency/cost. This keeps unit economics sane at scale.
5. **Edge Functions for anything that touches student data + an LLM**, so API keys never reach the client and every AI call can be logged/rate-limited server-side.

---

## 2. Data Model (Core Tables)

> Tables prefixed conceptually to show what's new vs. shared with TuitionTrack. Actual prefixing/namespacing is an implementation choice.

### Shared with TuitionTrack (read/extend, don't duplicate)
- `students` (id, name, class, board, batch_id, parent_email, student_email, teacher_id)
- `teachers` (id, name, email, workspace_id)
- `parents` (id, email, linked_student_ids)

### New: Curriculum & Content
- `subjects` (id, name, board, class_level)
- `chapters` (id, subject_id, class_level, title, syllabus_order, ncert_ref)
- `topics` (id, chapter_id, title, prerequisite_topic_ids[])
- `questions` (id, topic_id, type[mcq|short|long|numeric], difficulty_score, body, options, correct_answer, explanation, source[pyq|generated|teacher_authored], year_if_pyq)
- `question_embeddings` (question_id, embedding vector) — pgvector, for similarity-based retrieval/duplicate detection and RAG-grounded generation

### New: Learning State (per student)
- `mastery_state` (student_id, topic_id, mastery_probability, last_updated) — Bayesian Knowledge Tracing state
- `flashcards` (id, student_id, source_topic_id, front, back, fsrs_stability, fsrs_difficulty, fsrs_due_at)
- `doubt_logs` (id, student_id, subject_id, topic_id_nullable, input_type[photo|text|voice], raw_input_ref, ai_response, resolved, escalated_to_teacher, created_at)
- `practice_attempts` (id, student_id, question_id, session_id, is_correct, time_taken_ms, hint_used, created_at)
- `test_sessions` (id, student_id, type[chapter|mock|surprise], subject_id, started_at, submitted_at, score, readiness_score_before, readiness_score_after)
- `readiness_scores` (student_id, subject_id, chapter_id, score, computed_at)

### New: Gamification
- `student_gamification` (student_id, xp, level, streak_count, streak_freeze_available, last_active_date)
- `badges` (id, code, title, criteria_description)
- `student_badges` (student_id, badge_id, earned_at)

### New: Tutor Tools
- `worksheets` (id, teacher_id, chapter_id, generated_from[ai|manual|imported_pdf], question_ids[], created_at)
- `assignments` (id, teacher_id, worksheet_id_or_test_id, assigned_to[student_id|batch_id], due_at) — mirrors TuitionTrack's homework assignment model
- `engagement_alerts` (id, student_id, alert_type[inactive|dropping_score|streak_risk], triggered_at, acknowledged_by_teacher)

### New: Parent Communication
- `whatsapp_digest_log` (id, parent_id, student_id, sent_at, payload_summary)

**RLS policy shape (illustrative):**
- Students: `select/update` only rows where `student_id = auth.uid()`.
- Parents: `select` only rows where `student_id in linked_student_ids`.
- Teachers: `select/update` only rows where `student.teacher_id = auth.uid()` (or workspace-scoped).

---

## 3. AI Pipeline Designs

### 3.1 Doubt-Solving Pipeline (photo/text/voice)

1. **Input capture** — client uploads image to Supabase Storage (or sends text/voice).
2. **Voice path only:** STT (Whisper/Deepgram) → text.
3. **OCR/vision pass** — cheap multimodal model (Gemini Flash-class) extracts the problem as clean text/LaTeX-ish notation; if confidence is low, client shows an editable "here's what I read" box before proceeding (this single UX step is what separates a good math-OCR product from a frustrating one, per 2026 competitor reviews — accuracy is ~90–98% for print, lower for messy handwriting, so always allow correction).
4. **Retrieval** — embed the cleaned problem text; pgvector similarity search against `questions`/`chapters` to find syllabus context (which topic/chapter this belongs to) and any teacher-authored explanation style to match tone.
5. **Reasoning pass** — stronger model generates a **Socratic-first** response: a guiding hint, not the final answer, unless the student explicitly asks for the full solution. Response is structured as discrete steps so the UI can reveal them one at a time.
6. **Logging** — write to `doubt_logs`, tag the topic (from retrieval step), update `mastery_state` input signal (a doubt on a topic is a weak-topic signal even before a formal test).
7. **Escalation** — if the model's self-reported confidence is low, or the student marks the explanation unhelpful, surface an "Ask Piyush" button that posts into the tutor dashboard/WhatsApp.

### 3.2 Adaptive Practice / Testing Engine

- Start simple and defensible: a **Bayesian Knowledge Tracing (BKT)**-style per-topic mastery probability, updated after each `practice_attempts` row (correct/incorrect, with a decay for time elapsed). This is well-understood, cheap to compute, and doesn't require ML infrastructure.
- Question selection policy: weighted sampling favoring topics where `mastery_probability` is between ~0.4–0.75 (the "productive struggle" zone) — not the topics already mastered, not topics so weak the student will just guess.
- **Difficulty adjustment** within a topic: simple Elo-style rating per question vs. per student, adjusted after each attempt (question "wins" if student answers wrong, "loses" if correct) — this is a well-known, implementable-in-a-weekend approach that gets ~80% of the benefit of a full IRT/deep-knowledge-tracing model.
- **Readiness score** = weighted rollup of topic mastery probabilities across a chapter/subject, surfaced as a single 0–100% number students and parents can read at a glance.
- Roadmap note: if/when data volume justifies it, this can evolve toward a reinforcement-learning/deep-knowledge-tracing approach (2026 research shows meaningful gains — RL-based knowledge tracing has been shown in published studies to cut required practice time and improve prediction accuracy over baseline approaches) — but that is not an MVP requirement.

### 3.3 Spaced-Repetition (Flashcards)

- Implement **FSRS** (Free Spaced Repetition Scheduler) rather than the older SM-2 — it's the current state of the art, open-source, and has mature TypeScript implementations (`ts-fsrs` and similar) that drop straight into a Node/Edge Function environment.
- Each flashcard stores `difficulty`, `stability`, and `due_at`. A daily job (or on-demand on app open) computes the due queue per student.
- Flashcards are auto-generated from: (a) chapter content + NCERT definitions, (b) a student's own doubt logs ("you asked about this — here's a flashcard"), (c) teacher-authored decks.

### 3.4 Subjective-Answer & Handwriting Evaluation (Phase 2)

- Rubric-grounded grading: never let the model free-grade; always pass it a structured rubric (marking scheme, keywords/concepts expected, mark allocation) alongside the student's answer, and require it to cite which rubric line each mark came from.
- For handwritten answer sheets: vision-model transcription first (with student/teacher review of the transcription), then the rubric-grounded grading pass on the transcribed text — never grade directly off a raw handwriting image, since transcription errors compound into grading errors.

### 3.5 Predictive Engagement / At-Risk Detection (Phase 2)

- Signals: login recency, practice-session frequency trend, score trend, doubt-frequency spike (frustration signal), streak breaks.
- Start with simple rule-based thresholds ("no activity in 5 days" OR "score trending down 2 sessions in a row") before investing in an ML classifier — 2026 industry commentary consistently notes that even simple behavioral-threshold rules deliver most of the retention value that more sophisticated predictive models add on top of.

---

## 4. API Surface (representative, not exhaustive)

```
POST /api/doubt/solve            { input_type, payload }         → step-by-step response + doubt_log_id
POST /api/doubt/:id/feedback      { helpful: bool }
GET  /api/practice/session/next  ?subject_id=&chapter_id=        → adaptive next question
POST /api/practice/attempt        { question_id, answer, time_ms } → correctness + updated mastery
POST /api/test/start              { type, subject_id }            → test_session_id, question set
POST /api/test/:id/submit         { answers[] }                   → score, readiness delta
GET  /api/flashcards/due
POST /api/flashcards/:id/review    { grade }                       → next due_at (FSRS)
GET  /api/dashboard/student
GET  /api/dashboard/teacher/heatmap
POST /api/worksheet/generate       { chapter_id, count, difficulty_mix }
POST /api/assignment/create        { target, worksheet_id, due_at }
GET  /api/readiness/:student_id/:subject_id
```

All routes: Supabase JWT required; RLS enforces row-level access; AI-calling routes run as Edge Functions, never client-side, so provider API keys stay server-side.

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Doubt-solve first response < 4s for text, < 8s for photo/OCR path; practice-question fetch < 500ms |
| Availability | Target 99.5% (Vercel + Supabase managed infra); graceful degradation to cached/offline practice sets if AI provider is down |
| Offline | PWA caches the day's practice queue + flashcards for offline attempt; syncs `practice_attempts`/`flashcard reviews` on reconnect |
| Scalability | Architecture must comfortably serve low-thousands of students without infra changes; pgvector on Postgres scales well past that before a dedicated vector DB is needed |
| Data privacy | RLS on every table touching student data; minors' data minimization (Section 9 of PRD); DPDP-Act-aware consent capture |
| Accessibility | WCAG AA color contrast; text-to-speech on explanations; reduced-motion respected in UI animation |
| Localization | English-first; Hinglish explanation toggle in Phase 2; UI copy written to be simple enough for Class 7 reading level |
| Cost control | Two-tier LLM routing (Section 1.4); response caching for repeated/common doubts; rate-limit per student per day on free tier |
| Observability | All AI calls logged with latency, token count, model used, and a "flag as wrong" feedback hook — this becomes your evaluation dataset over time |

---

## 6. Security Checklist

- [ ] RLS enabled and tested on every new table (default-deny, then explicit allow policies)
- [ ] No AI provider API key ever shipped to the client bundle
- [ ] File uploads (doubt photos, answer-sheet scans) virus/type-scanned and size-limited; stored in a private Supabase Storage bucket with signed URLs, not public
- [ ] Parent consent captured at signup for a minor's data processing
- [ ] Student-to-student chat is out of scope entirely (AI chat is 1:1 with the system only) — removes an entire category of moderation risk
- [ ] Rate limiting on doubt-solve and test endpoints to control both cost and abuse
- [ ] Audit log on any teacher action that touches a student's data (assignment creation, grade override)

---

## 7. Testing Strategy

- Unit tests on the FSRS scheduler, BKT mastery updater, and Elo difficulty adjuster (these are pure functions — high leverage to test well).
- Golden-set evaluation for the doubt-solving pipeline: a curated set of ~50–100 known Class VII–X problems with known-good explanations, re-run whenever the prompt or model changes, scored for correctness and step quality.
- RLS policy tests: attempt cross-student/cross-parent reads and assert they fail.
- Load-test the adaptive-question endpoint and doubt-solve endpoint before any public (non-own-student) launch.

---

## 8. Rollout Plan

1. **Internal alpha** — Piyush's own current tuition batch only, Math + Science, MVP feature set.
2. **Instrument everything** from day one (Section 5, Observability) — this alpha is also the evaluation dataset.
3. **Iterate on the doubt-solving quality bar** before adding more subjects or students — this is the trust-critical feature.
4. **Add English + gamification + parent WhatsApp digest** once doubt-solving and adaptive practice are solid.
5. **Only then** consider opening to students outside Piyush's own roster / monetization (Section 10 of PRD, Phase 3 of scope).
