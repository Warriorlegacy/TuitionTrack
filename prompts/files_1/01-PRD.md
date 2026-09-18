# Product Requirements Document (PRD)
## ExamPulse AI — AI-Powered Exam Preparation Companion for Tuition Students

**Owner:** Piyush (Signhify Studio)
**Product family:** TuitionTrack (ops layer, live) → EduPulse AI (intelligence layer, in progress) → **ExamPulse AI** (this document — the student-facing exam-prep & personalized-learning product)
**Version:** 1.0 — Draft for build
**Date:** September 2026

> Naming note: "ExamPulse AI" is a placeholder that keeps the EduPulse/TuitionTrack family naming convention. Rename freely — nothing in the architecture depends on the name.

---

## 1. Executive Summary

TuitionTrack currently solves the **operations problem** for tutors — homework, attendance, fees, announcements, parent visibility. It does not solve the **learning problem** — it doesn't help a Class VII–X CBSE student actually get better at Math, Science, or English, or walk into an exam confident.

ExamPulse AI is the missing half: a student-facing, AI-powered exam-preparation app that plugs into the same Supabase backend and student roster as TuitionTrack, and gives every one of your tuition students a personal AI tutor, adaptive practice engine, and exam simulator — the kind of experience students currently pay Physics Wallah, Vedantu, or Toppr for, but scoped tightly to *your* students, *your* curriculum, and CBSE Classes VII–X.

Because you are both the founder and the tutor, this product has a distribution advantage no VC-funded competitor has: a captive, trusting cohort of real students on day one.

---

## 2. Problem Statement

**For students:**
- Doubts pile up between tuition sessions with no one to ask at 9 PM before a test.
- Practice is generic (same worksheet for everyone) instead of targeted at each student's actual weak topics.
- Revision before exams is unstructured — re-reading notes, not active recall.
- No visibility into "am I actually ready for this test?" until the test happens.

**For Piyush (the tutor):**
- Manually creating differentiated practice for each student doesn't scale beyond a handful of students.
- No data-backed way to know which student is quietly falling behind until marks come in.
- Time spent generating worksheets, dictation sheets, and question banks (currently via ReportLab) could be partly automated and made adaptive per student.

**For parents:**
- Homework completion (visible in TuitionTrack) doesn't tell them whether their child actually *understands* the material or is exam-ready.

---

## 3. Goals & Success Metrics

| Goal | Metric | Target (6 months post-launch) |
|---|---|---|
| Students self-study more, better | Weekly active study sessions per student | ≥ 4/week |
| Doubts get resolved without waiting for class | AI doubt-resolution rate (no escalation to Piyush) | ≥ 70% |
| Practice becomes targeted, not generic | % of practice questions served that are "weak-topic" adaptive picks | ≥ 60% |
| Exam readiness becomes measurable | Correlation between in-app "readiness score" and actual test marks | Reported, directionally accurate |
| Retention/habit formation | Day-7 / Day-30 retention | ≥ 60% / ≥ 35% |
| Revenue (if monetized beyond your own students) | Paying households (outside your batch) | Defined once MVP validates with your own students |
| Tutor time saved | Hours/week saved on manual worksheet creation | ≥ 3 hrs/week |

---

## 4. Target Users & Personas

1. **Aditi, Class 9, CBSE, Math+Science student.** Motivated but anxious before tests. Needs: instant doubt help at night, practice that adapts to her actual gaps, a way to know she's "ready."
2. **Rohan, Class 8, English tutee.** Struggles with grammar and comprehension, disengaged by long text. Needs: bite-sized, gamified practice; audio support; low reading friction.
3. **Piyush, the tutor.** Needs: a dashboard of every student's weak topics, auto-generated tests/worksheets, and alerts when someone is falling behind — without extra manual work.
4. **A parent.** Wants a weekly WhatsApp digest: "Aditi is strong in Algebra, weak in Trigonometry, attempted 4 practice sets this week."

---

## 5. Product Positioning

- **TuitionTrack** = the system of record (who's enrolled, attendance, fees, homework assigned).
- **EduPulse AI** = the intelligence layer already scoped (analytics, insights).
- **ExamPulse AI** = the *engagement surface* students open every day — the AI tutor + adaptive practice + exam simulator. It reads/writes the same student roster (via shared Supabase project or a synced schema) so a student assigned "Chapter 6 Algebra" homework in TuitionTrack sees it appear as a practice set in ExamPulse AI automatically.
- Positioning line: **"The AI tutor that studies your syllabus, not a generic one."** Every question, flashcard, and mock test is generated from CBSE Class VII–X NCERT content and Piyush's own teaching material — not a broad, unfocused content library.

---

## 6. Scope

### MVP (Phase 1 — build first, validate on your own students)
- Student auth + profile (class, subjects, board = CBSE)
- AI Doubt Solver: photo/text doubt → step-by-step explanation (Math/Science first)
- Chapter-wise adaptive quiz engine (Math, Science, English — Classes VII–X)
- Flashcards with spaced repetition (FSRS) for formulas, vocabulary, definitions
- Mock test mode (timed, exam-pattern, auto-graded MCQ/short answer)
- Student dashboard: weak topics, streak, XP, readiness score
- Tutor (Piyush) dashboard: class-wide weak-topic heatmap, auto-generated worksheets
- WhatsApp weekly parent digest (reuse ExamAstra's WhatsApp integration pattern)
- Basic gamification: streaks, XP, badges

### Phase 2
- Voice AI tutor (ask doubts by speaking, get spoken + written explanation)
- AI-generated study planner / countdown-to-exam timetable
- Subjective/long-answer evaluation (English essays, SST answers) with rubric-based AI feedback
- Handwritten answer-sheet scan & evaluation (photograph a written answer, get feedback like a board examiner)
- Auto-generated mind maps and one-page revision sheets per chapter
- Peer leaderboard within Piyush's own batches (opt-in, non-toxic design)
- Predictive at-risk alerts to Piyush ("Rohan's engagement dropped 40% this week")

### Phase 3 (only if opening beyond your own students / monetizing broadly)
- Multi-tutor/coaching-center mode (mirrors TuitionTrack's multi-teacher workspace model)
- Marketplace of question banks across tutors
- Competitive-exam tracks (NTSE, Olympiads) as an upsell
- Native app store presence (Play Store/App Store, not just APK)
- Regional language / Hinglish explanations

### Explicit non-goals (for now)
- Replacing live tuition — this is a *companion*, not a replacement for Piyush teaching.
- Building a full LMS with video-course authoring (Piyush isn't producing video lectures at scale).
- Supporting boards other than CBSE at launch.
- Proctored, high-stakes certification exams — mock tests are for self-assessment, not invigilated testing.

---

## 7. Master Feature List

Every feature below was checked against what students and competitors (Physics Wallah, Vedantu, Toppr, Doubtnut, BYJU'S, Unacademy, SATHEE/IIT‑Kanpur, and 2026-generation AI study tools like NotesXP/StudyFetch/YouLearn) actually ship, then filtered to what's realistic for a solo-founder MVP. Priority: **P0** = MVP, **P1** = Phase 2, **P2** = Phase 3/stretch.

### 7.1 AI Doubt Resolution
| Feature | Priority | Notes |
|---|---|---|
| Photo/scan-based doubt solving (OCR + step-by-step solution) | P0 | Core differentiator; multimodal LLM reads handwritten or printed problems |
| Typed-text doubt chat with Socratic follow-ups (not just the answer) | P0 | Encourages understanding over copy-paste |
| Multi-subject auto-detection (Math vs Science vs English) | P0 | One entry point, not per-subject tools |
| In-app math keyboard to correct OCR misreads before solving | P1 | OCR accuracy on handwriting is ~90–95%, not 100% |
| Voice-based doubt asking + spoken explanation | P1 | Conversational AI tutor, hands-free revision |
| "Explain again, simpler" / "explain like I'm in Class 6" re-explanation control | P1 | Adjustable explanation depth |
| Doubt history log per student (searchable) | P0 | So a doubt isn't lost after the chat closes |
| Escalate-to-Piyush button when AI confidence is low | P0 | Keeps the human tutor as the safety net |

### 7.2 Adaptive Practice & Testing
| Feature | Priority | Notes |
|---|---|---|
| Chapter-wise practice sets aligned to NCERT/CBSE syllabus | P0 | |
| Adaptive difficulty engine (question gets harder/easier based on performance) | P0 | Start with a simple mastery/Elo-style model, evolve later |
| Full-length mock tests matching CBSE exam pattern (marks weightage, time) | P0 | |
| Previous Year Question (PYQ) bank, chapter-tagged | P0 | Directly requested by students in every competitor review |
| Instant scoring + explanation on every question | P0 | |
| Weak-topic detection ("You get Trigonometry wrong 60% of the time") | P0 | Feeds the dashboard and the tutor heatmap |
| Timed test mode with auto-submit, simulating exam pressure | P0 | |
| Mixed-topic "surprise test" mode | P1 | Simulates real unpredictability |
| Answer-review mode: revisit only wrong/skipped questions | P0 | |
| Subjective-answer AI evaluation (English, SST, long Science answers) with rubric feedback | P1 | High demand, technically harder (needs careful prompting + rubric grounding) |
| Handwritten answer-sheet photo evaluation | P2 | Vision LLM grading against a marking scheme |

### 7.3 Memory & Revision
| Feature | Priority | Notes |
|---|---|---|
| Auto-generated flashcards from notes/chapters | P0 | |
| Spaced-repetition scheduling (FSRS algorithm) | P0 | Modern standard, ~20–30% fewer reviews needed than old SM-2 for the same retention |
| Formula sheets / cheat-sheets per chapter | P0 | Frequently requested, low effort to generate |
| One-page auto-generated revision summaries | P1 | |
| Auto-generated mind maps per chapter | P1 | |
| "Exam eve" rapid-revision mode (last 24-hour condensed review) | P1 | |
| Audio revision — chapter turned into a short spoken summary ("study podcast") | P2 | Emerging 2026 trend (NotebookLM/NotesXP-style) |

### 7.4 Personalization & Learning Path
| Feature | Priority | Notes |
|---|---|---|
| Diagnostic test on first use to place the student's baseline | P0 | |
| Per-student mastery map (topic-by-topic knowledge state) | P0 | Simple Bayesian/knowledge-tracing model to start |
| Personalized daily study queue ("today's 20 minutes") | P0 | Reduces decision fatigue |
| Readiness score per subject/chapter | P0 | Directly answers "am I ready for this test?" |
| AI-generated study planner counting down to exam date | P1 | |
| Recommended next topic based on prerequisite gaps | P1 | |

### 7.5 Gamification & Motivation
| Feature | Priority | Notes |
|---|---|---|
| Daily streaks with streak-freeze | P0 | Strongest habit-loop mechanic in every top app (Duolingo-proven) |
| XP and levels | P0 | |
| Badges/achievements tied to real learning behaviors, not just logins | P0 | Avoid "points for points' sake" — tie to mastery |
| Batch-scoped leaderboard (opt-in) | P1 | Scoped to Piyush's own students only — avoid toxic global competition |
| Avatar/profile customization unlocked by XP | P2 | Nice-to-have polish |

### 7.6 Tutor (Piyush) Tools
| Feature | Priority | Notes |
|---|---|---|
| Class-wide weak-topic heatmap across all students | P0 | The single highest-leverage feature for you personally |
| One-click auto-generated worksheet/test from a chapter (replaces manual ReportLab work) | P0 | |
| Assign a practice set/mock test to one student or a batch | P0 | Mirrors TuitionTrack's homework model |
| Student risk/engagement alerts ("hasn't practiced in 5 days") | P1 | Predictive-analytics trend across 2026 edtech |
| Bulk question-bank import from existing PDFs/notes | P1 | Feeds your existing dictation/question-bank materials into the system |
| Answer-key and rubric authoring for subjective questions | P1 | |

### 7.7 Parent Engagement
| Feature | Priority | Notes |
|---|---|---|
| Weekly WhatsApp digest (readiness score, weak topics, practice count) | P0 | Reuses your ExamAstra WhatsApp integration know-how |
| Read-only parent portal view (shared login pattern with TuitionTrack) | P1 | |
| Pre-exam alert to parents ("Test in 3 days, readiness: 62%") | P1 | |

### 7.8 Accessibility, Language & Access
| Feature | Priority | Notes |
|---|---|---|
| Hinglish explanation toggle (English + Hindi mixed, matches how PadhAI/Doubtnut win Indian users) | P1 | |
| Text-to-speech on any explanation | P1 | |
| Dyslexia-friendly font / high-contrast mode | P2 | |
| Offline-capable practice (download a set, sync results later) | P1 | Matches TuitionTrack's own "offline-capable" mobile claim; important on patchy Indian mobile data |
| Low-bandwidth mode (text-first, images optional) | P1 | |

### 7.9 Trust, Integrity & Safety
| Feature | Priority | Notes |
|---|---|---|
| Clear "this is a study aid, not a copy-paste machine" framing + step-reveal (steps shown before final answer) | P0 | Mirrors how legitimate competitors avoid becoming a cheating tool |
| Soft anti-cheat on mock tests (tab-switch/blur detection, shown as a self-discipline nudge, not punitive lockdown) | P1 | This is self-assessment, not invigilated exams — keep it light-touch |
| Minor-safe data handling (no public profile fields beyond first name + avatar; parental visibility by default) | P0 | Students are minors — see Section 9 |

### 7.10 Platform
| Feature | Priority | Notes |
|---|---|---|
| Responsive web app (mobile-first) | P0 | |
| Installable PWA | P0 | |
| Native Android APK (matches TuitionTrack's existing distribution) | P1 | |
| iOS via Capacitor/Expo wrapper | P2 | |
| Shared login/roster with TuitionTrack | P0 | Avoids double data-entry for you and parents |

---

## 8. Core User Journeys

**Journey A — Nightly doubt.**
Student photographs a Trigonometry problem → AI reads it, asks "Do you want the answer or a hint first?" → gives a Socratic hint → student tries → AI confirms/corrects → doubt is logged and auto-tagged to "Trigonometry: Heights & Distances" → feeds the mastery map.

**Journey B — Before a test.**
Student opens app 3 days before a scheduled Science test → sees a "readiness score: 58%" → app recommends a 20-minute adaptive practice set targeting the two weakest sub-topics → student completes it → readiness recalculates → exam-eve rapid-revision flashcards trigger automatically.

**Journey C — Piyush's Sunday planning.**
Piyush opens the tutor dashboard → sees a heatmap: Class 9 batch is collectively weak in "Algebraic Identities" → clicks "Generate worksheet" → AI drafts a 15-question worksheet from the syllabus → Piyush reviews/edits → assigns to the batch → it appears in both TuitionTrack (as homework) and ExamPulse AI (as an adaptive practice set).

**Journey D — Parent's Sunday evening.**
Parent gets a WhatsApp message: "This week, Aditi practiced 5 times, improved in Algebra (62%→78%), still needs work in Trigonometry. Next test: Friday."

---

## 9. Trust, Privacy & Safety Considerations

- All users in this app are minors (Class VII–X, roughly ages 12–16). Design accordingly:
  - No public-facing profile data beyond a first name/nickname and an avatar.
  - Leaderboards scoped only to a tutor's own batch, never global/public.
  - No open chat between students; AI chat is 1:1 between student and AI tutor.
  - Parent/guardian visibility into activity is default-on, not opt-in.
  - Data collected is limited to what's needed for learning (answers, time-on-task) — no unnecessary personal data.
- Comply with India's Digital Personal Data Protection (DPDP) Act expectations for processing children's data: clear parental consent at signup (captured via the parent email already used in TuitionTrack), data minimization, and a straightforward deletion path.
- AI outputs must be reviewable/correctable — never present an AI explanation as unquestionable; always show "flag this if it seems wrong."

---

## 10. Monetization (once validated beyond your own students)

- **Free tier:** limited daily doubt-solves, limited practice sets, ads-free (ed-tech buyers hate ads).
- **Student Pro (₹99–₹199/month):** unlimited doubt-solving, full mock tests, flashcards, readiness score.
- **Tutor/Coaching plan:** per-tutor pricing bundled with TuitionTrack, since the two products are natively linked — a tutor subscribing gets both the ops layer and the AI layer for their students at a bundled rate. This mirrors how PW and Toppr bundle content + practice + analytics into one paid tier.
- Keep your own students free/subsidized indefinitely — they are the product's proof and testimonial engine (TuitionTrack's own landing page already leans on tutor testimonials; do the same with student outcomes here).

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| AI gives a wrong step-by-step solution (OCR/LLM error) | Show confidence, allow manual correction of OCR text before solving, "flag as wrong" feedback loop, escalate-to-tutor path |
| Students use it purely to copy answers, not learn | Default to hint-first/step-reveal flow rather than instant final answers; track "steps viewed before final answer" as an engagement-quality metric, not just usage |
| Low engagement after novelty wears off | Gamification tied to real mastery gain (not just logins), tutor-driven assignment keeps a human accountability loop |
| Solo-founder bandwidth to build AI + ops + content | Phase ruthlessly (Section 6); reuse EduPulse AI/TuitionTrack infra instead of rebuilding; lean on free-tier AI APIs during validation |
| Data privacy for minors | See Section 9; do this correctly from day one, it's non-negotiable and also a trust selling point to parents |
| LLM API costs scale with usage | Cache repeated doubt patterns, use cheaper multimodal models (Gemini Flash-class) for OCR/first-pass, reserve larger models for complex reasoning only |

---

## 12. Sources Consulted (Research Grounding)

Feature and market research for this PRD drew on 2026 coverage of: AI exam-prep tool landscapes (Questgen.ai, Knowt, SceneSnap, NotesXP, YouLearn), Indian CBSE/competitive-exam apps (Physics Wallah, Vedantu, Toppr, Doubtnut, Unacademy, BYJU'S, SATHEE by IIT Kanpur, PadhAI.ai), spaced-repetition algorithm research (FSRS vs SM-2), gamification-in-education research (Octalysis framework, Duolingo/Khan Academy case studies), and 2026 AI-in-edtech trend reporting on predictive analytics and knowledge tracing (RL-DKT). No content, text, or code was copied from any source — all features were re-derived and written independently for this product.
