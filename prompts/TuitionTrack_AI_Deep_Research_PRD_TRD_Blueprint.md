# TuitionTrack AI — Deep Research Product Blueprint
## AI-native exam preparation + tuition operating system

**Research date:** 14 September 2026  
**Starting product:** https://tuitiontrack-app.vercel.app/  
**Primary market:** Indian tuition tutors, coaching centres, parents, and school/competitive-exam students  
**Core thesis:** do not build “another AI chatbot for students.” Build a closed learning loop where the tutor, student, parent, syllabus, homework, tests, mistakes, revision schedule, and AI coach continuously reinforce one another.

---

# 1. Executive product vision

TuitionTrack should evolve from a tuition-management SaaS into an **AI-powered Learning & Exam OS**.

The product should answer five questions every day:

1. **What should this student study today?**
2. **What does this student actually understand?**
3. **Where are they losing marks and why?**
4. **What is the smallest high-impact intervention the student should do next?**
5. **How can the tutor and parent see the same truth without manual follow-up?**

The product loop:

> Diagnose → Learn → Practice → Retrieve → Test → Analyze → Repair → Re-test → Master → Maintain

The differentiator is that every object in the system is connected.

Example:

**“Quadratic Equations”**
→ syllabus node  
→ class notes  
→ teacher worksheet  
→ AI explanation  
→ practice questions  
→ student attempts  
→ mistake classification  
→ mastery score  
→ spaced-repetition cards  
→ remedial micro-lesson  
→ re-test  
→ teacher insight  
→ parent progress summary

That is much more defensible than a collection of disconnected AI tools.

---

# 2. What the current TuitionTrack already does

The existing public site positions TuitionTrack as a tutor/coaching-centre SaaS for homework, attendance, fees, announcements, marks and progress. The site says its core workflow includes adding students, assigning homework, recording attendance, recording test scores, managing fees, broadcasting announcements and giving parents/students portal visibility. It also identifies Next.js + Supabase + Vercel-friendly deployment as the existing foundation, with Row Level Security protecting tenant data.

This is valuable because the app already has the **operational layer** required for the next product.

### Existing foundations to preserve

- Teacher account/workspace
- Student records
- Parent linkage
- Homework
- Attendance
- Test results
- Fees
- Announcements
- Progress reports
- Mobile direction
- Supabase + PostgreSQL
- RLS
- Vercel deployment
- Google/email authentication

### The biggest product gap

The current experience primarily records **what happened**.

The new product must continuously recommend **what should happen next**.

That means transforming:

**record keeping → adaptive learning system**

---

# 3. Research synthesis

## 3.1 What serious exam platforms already optimize

### NTA National Test Abhyas

NTA positions Abhyas around real exam-level mocks, daily tests, immediate results, AI-driven analytics, question-wise solutions, speed/accuracy and time-management feedback.

### Embibe

Embibe is an important benchmark because it connects:

- huge test/question libraries
- custom test generation
- concept-level knowledge graphs
- deep diagnostic analysis
- personalized achievement journeys
- behavioral/test-taking analysis
- skill/Bloom-level analysis
- predicted improvement
- AI-driven adaptive learning

The key lesson is that **analytics must diagnose behaviors and concepts, not just produce a score**.

### ALLEN

The modern online test-series pattern includes:

- syllabus-aligned testing
- topic/unit/part/full-syllabus tests
- speed/accuracy/rank analysis
- strengths/weaknesses
- expert questions
- flexible online access
- exam simulation

### Quizlet

Quizlet demonstrates the value of multiple study modes connected to the same content:

- personalized Learn mode
- flashcards
- written questions
- multiple-choice
- tests
- games
- classroom collaborative modes
- increasing difficulty

### Khan Academy

Khan Academy’s mastery model makes a critical architectural point: track **skills/concepts**, not only course completion. Practice should cause a mastery state to rise or fall and can trigger recommended learning interventions.

### ChatGPT Study Mode

Current AI tutoring patterns increasingly emphasize:

- guiding questions
- Socratic interaction
- step-by-step solving
- calibrated difficulty
- concept explanations at multiple depths
- checking understanding
- use of uploaded notes/PDFs/images
- personalized learning context
- active participation instead of answer dumping

The lesson: the AI should behave like a **teacher/coach**, not a search box.

---

# 4. Learning science principles that should shape the product

The product should deliberately encode evidence-backed learning techniques.

## 4.1 Retrieval practice

Practice tests and active recall are core mechanics, not optional gamification.

Design implications:

- daily recall cards
- “answer before reveal”
- short-answer questions
- blank-page recall
- teach-back prompts
- oral/viva mode
- explain-it-in-your-own-words mode
- delayed re-testing
- mistake resurfacing

Research on the testing effect and later work continues to support retrieval-based learning, while also showing that outcomes depend on how testing is implemented.

## 4.2 Distributed/spaced practice

The system should schedule reviews rather than leave students with a static flashcard pile.

Every concept/question can have a review state:

- New
- Learning
- Due
- Relearning
- Stable
- Mastered
- At risk

Use FSRS or a similar modern scheduling algorithm behind the scenes.

## 4.3 Interleaving

Do not always give students ten identical questions.

A “smart practice” session should deliberately mix related problem families:

- algebra + geometry
- kinematics + NLM
- grammar + comprehension
- formula recall + application
- easy + medium + transfer items

## 4.4 Worked examples + fading

For novice students:

1. full worked example
2. guided step-by-step example
3. partially completed example
4. independent problem
5. transfer problem

The AI should detect when scaffolding can be removed.

## 4.5 Metacognition

Every important session should occasionally ask:

- How confident are you?
- Why did you choose this answer?
- Which step confused you?
- Could you explain the method without seeing the solution?
- What would you do differently next time?

Store confidence vs accuracy. This creates a **calibration score**.

---

# 5. What students actually need

Research and current student discussions converge around a common pain: students currently switch among ChatGPT, Quizlet/Anki, notes apps, calendars, PDFs, YouTube, test platforms and messaging tools.

The opportunity is not “add 100 more AI features.”

The opportunity is:

> **remove the need to assemble a study system manually.**

High-value student needs:

- clear daily plan
- instant doubt resolution
- reliable explanations
- exam-aligned questions
- PYQs
- timed mocks
- weak-topic detection
- mistake review
- automatic flashcards
- spaced revision
- notes/PDF ingestion
- handwritten/photographed question solving
- progress visibility
- exam countdown
- reminders
- motivation without childishness
- Hindi/Hinglish support
- low-bandwidth/offline support
- voice input
- less tab switching
- teacher accountability
- parent visibility
- personalization that improves with use

---

# 6. Product positioning

## Recommended positioning

### “Your AI-powered personal tutor, test lab, revision planner and tuition classroom — in one place.”

Alternative:

### “TuitionTrack: From tuition class to exam rank.”

Avoid positioning as only:

- AI tutor
- homework app
- test app
- tuition CRM

It is the **connected learning operating system**.

---

# 7. User personas

## Student

Needs:
- learn
- practice
- remember
- improve score
- understand mistakes
- reduce uncertainty
- prepare around actual exam date

Pain:
- procrastination
- too much content
- unclear priorities
- repetitive study
- weak topics discovered too late
- fear of exams

## Tutor

Needs:
- know who is falling behind
- create assignments quickly
- generate differentiated worksheets
- see concept mastery
- save prep time
- communicate with parents
- run tests
- intervene early

## Parent

Needs:
- know whether child is studying
- understand progress without academic jargon
- see attendance/homework/micro-goals
- get actionable updates
- avoid constant WhatsApp chasing

## Centre/Admin

Needs:
- multi-teacher coordination
- batches
- permissions
- billing
- reports
- content ownership
- analytics
- audit logs

---

# 8. Complete feature universe

## A. Student home

### “Today” command centre

Show:

- greeting
- exam countdown
- readiness score
- today’s target
- overdue work
- revision due
- next class
- weakest topic
- streak
- XP
- study time
- predicted score range
- recommended 20-minute session
- quick-start buttons

Primary CTA should always be:

**“Start your highest-impact session.”**

---

# 9. AI Tutor

## AI tutor modes

### 1. Socratic Tutor
Never immediately dumps the answer.

Flow:
- ask what student knows
- ask for next step
- provide hint
- identify misconception
- progressively scaffold
- reveal solution only when appropriate

### 2. Exam Coach
Focuses on:
- scoring
- speed
- strategy
- question selection
- time allocation
- common traps

### 3. Concept Teacher
Explains:
- from zero
- standard
- advanced
- topper depth

### 4. Doubt Solver
Inputs:
- text
- image
- handwritten photo
- screenshot
- PDF
- voice

### 5. Mistake Coach
Knows the student’s history and says:

> “You made this same sign error 3 times in 7 days. Let’s fix the pattern.”

### 6. Viva Coach
AI asks oral questions and evaluates spoken answers.

### 7. Revision Coach
Only reviews existing weak concepts.

### 8. Homework Coach
Guides but does not enable blind answer copying.

### 9. Teacher Clone
Optional tutor-configured persona:
- strict
- friendly
- concise
- detailed
- Hindi/Hinglish
- exam-focused

### 10. Parent-safe summary mode
Converts complex learning data into simple progress language.

---

# 10. AI content ingestion

Support:

- PDF
- DOCX
- PPTX
- images
- scanned notes
- handwritten notes
- teacher worksheets
- textbooks where rights allow
- syllabus
- chapter list
- previous-year papers
- class recordings
- copied text
- web sources where explicitly enabled

Pipeline:

1. upload
2. malware/file validation
3. OCR
4. layout reconstruction
5. page/section segmentation
6. metadata extraction
7. concept extraction
8. question extraction
9. answer/solution extraction
10. embeddings
11. citation/page mapping
12. curriculum mapping
13. quality scoring
14. approval/review if generated content will be distributed

---

# 11. AI study-material generator

One input should be able to produce:

- concise summary
- detailed notes
- formula sheet
- key definitions
- examples
- flashcards
- MCQs
- numerical questions
- assertion-reasoning
- true/false
- fill-in-the-blanks
- match-the-column
- one-word answers
- short answers
- long answers
- case-study questions
- HOTS questions
- oral questions
- diagram-label questions
- PYQ-style questions
- timed quiz
- full test
- revision checklist

Student controls:

- difficulty
- question count
- language
- marks
- duration
- negative marking
- Bloom level
- topic mix
- source restriction
- exam pattern
- weak-topic emphasis

---

# 12. Smart test engine

## Test types

- daily 5-minute quiz
- daily 15-minute drill
- topic test
- chapter test
- unit test
- subject test
- part syllabus
- full syllabus
- previous year paper
- adaptive test
- diagnostic test
- remedial test
- speed test
- accuracy test
- surprise test
- teacher assignment
- AI custom test
- oral test
- open-book test
- closed-book test
- classroom live test

## Exam simulator

Should reproduce:

- question palette
- sections
- marking rules
- negative marking
- navigation
- timer
- auto-submit
- review flags
- section restrictions
- answer status
- real exam density

---

# 13. Advanced test analytics

After every test:

### Score layer
- score
- percentage
- percentile where valid
- rank within permitted cohort
- predicted exam score

### Accuracy layer
- correct
- incorrect
- guessed
- unattempted
- careless errors
- concept errors
- calculation errors
- reading errors

### Time layer
- average time/question
- time/question distribution
- overtime questions
- too-fast incorrect
- slow correct
- slow incorrect
- time wasted revisiting

### Concept layer
- mastery by chapter
- mastery by concept
- prerequisite gaps
- recurring misconceptions

### Behavior layer
- question jumping
- early submission
- overthinking
- guessing
- changing correct answers to wrong answers
- weak start
- late-test fatigue

### Action layer

Do not end with charts.

Generate:

**“Do these 3 things next.”**

Example:

1. Review factorization prerequisite.
2. Complete 8 targeted quadratic problems.
3. Reattempt the 4 missed questions tomorrow.

---

# 14. Mistake Book 2.0

Every wrong answer automatically becomes a candidate mistake record.

Categories:

- Concept gap
- Formula forgotten
- Calculation
- Misread question
- Sign error
- Unit error
- Guess
- Time pressure
- Careless
- Strategy
- Vocabulary
- Memory
- Incomplete answer
- Presentation
- Exam technique

Each mistake has:

- original question
- student answer
- correct answer
- explanation
- root cause
- concept
- confidence
- recurrence count
- last seen
- next review
- fix exercise
- status

Statuses:

- Open
- Practicing
- Fixed
- Relapsed
- Mastered

---

# 15. Adaptive mastery engine

Create a knowledge graph:

**Exam → Subject → Unit → Chapter → Topic → Concept → Skill → Question**

Each concept gets a mastery probability.

Possible inputs:

- correct/incorrect
- confidence
- time
- hint usage
- number of attempts
- spacing
- question difficulty
- question discrimination
- recent decay
- transfer performance

Start simple:

`mastery_score = weighted Bayesian/IRT-inspired estimate`

Later move to:

- Bayesian Knowledge Tracing
- Deep Knowledge Tracing where justified
- IRT question calibration
- knowledge graph reasoning

Do not deploy a fancy model before you have enough behavioral data.

---

# 16. Exam readiness engine

Calculate:

- syllabus coverage
- mastery
- retention risk
- recent test trend
- mock performance
- accuracy
- speed
- consistency
- weak-topic severity
- exam difficulty calibration
- remaining study days

Return:

### Readiness: 78/100

Breakdown:
- Knowledge 82
- Retention 71
- Speed 76
- Accuracy 84
- Test strategy 69

Then:

**“Probability of reaching target score: 72–81%.”**

Always label predictions as estimates, not guarantees.

---

# 17. Score improvement simulator

Student chooses a target:

> “I want 90%.”

System estimates the highest-impact levers:

- fix 4 weak concepts
- reduce careless errors by 30%
- add 3 mocks
- revise 65 due cards
- practice 40 mixed problems

Then show a scenario chart:

**Current expected score → likely score after interventions**

Use confidence intervals, not fake certainty.

---

# 18. Personalized study planner

Inputs:

- exam date
- current mastery
- available hours
- class schedule
- homework
- school schedule
- preferred study times
- target score
- weak topics
- revision backlog

Output:

- daily plan
- weekly plan
- exam countdown plan
- micro-sessions
- buffer days
- catch-up days
- revision cycles
- mock-test schedule

### Dynamic replanning

If student misses two days:

Do not just mark tasks red.

Automatically:

1. preserve high-value concepts
2. drop low-priority work
3. reschedule review
4. recompute workload
5. notify student
6. optionally notify tutor

---

# 19. Spaced repetition

Use a modern scheduler such as FSRS-compatible scheduling.

Each item should track:

- stability
- difficulty
- due date
- lapse count
- review history
- confidence
- source
- associated concept

Allow:

- flashcard review
- image occlusion
- cloze deletion
- formula recall
- diagram labeling
- vocabulary
- active recall
- “explain without looking”

Do not restrict core spaced repetition behind a paywall.

---

# 20. Notes system

Features:

- rich text
- markdown
- handwriting canvas
- PDF annotations
- highlights
- bookmarks
- tags
- backlinks
- concept linking
- AI summarize selection
- explain selection
- turn selection into flashcards
- turn selection into quiz
- ask AI about selection
- compare notes
- version history
- offline edits
- export PDF/Markdown

---

# 21. Notebook / source-grounded AI

Create a “My Sources” area.

Student can ask:

> “Explain only using my uploaded Chapter 5 notes.”

AI must return:

- answer
- source title
- page/section citation
- confidence
- “not found in your materials” when evidence is absent

This dramatically reduces hallucination risk.

---

# 22. AI question quality pipeline

Never trust raw AI question generation.

Every generated question passes:

1. schema validation
2. answer consistency check
3. duplicate detection
4. difficulty classifier
5. curriculum mapping
6. ambiguity detector
7. solution verification
8. numerical solver where applicable
9. source attribution
10. teacher review based on risk score

### For math/science

Use deterministic verification wherever possible:

- SymPy
- Python sandbox
- domain-specific calculators
- unit checking
- equation verification

The LLM should explain solutions; the deterministic layer should verify them.

---

# 23. Question bank

Metadata:

- subject
- chapter
- topic
- concept
- skill
- exam
- year
- source
- question type
- difficulty
- marks
- time estimate
- answer
- explanation
- distractor rationale
- language
- Bloom level
- prerequisite
- quality score

Features:

- search
- filters
- bookmarks
- favorites
- report issue
- similar questions
- harder/easier
- “practice my mistakes”
- “questions like this”
- teacher assignment

---

# 24. Previous-year papers

For legally usable/public-domain/licensed sources:

- exact paper
- year/session
- exam
- section
- answer key
- official solution where available
- topic mapping
- concept mapping
- difficulty
- time analysis
- trend analysis

Feature:

**“Show me the last 10 years of questions from this concept.”**

---

# 25. Homework engine

Teacher can:

- manually create
- upload worksheet
- generate with AI
- copy previous homework
- assign to batch
- assign to individual
- differentiate by level
- set due date
- set time limit
- require working
- allow hints
- allow AI tutor support
- block final-answer mode

### Student submission

- typed
- photo
- PDF
- drawing
- voice

AI can pre-check before teacher reviews.

---

# 26. Classroom mode

For live tuition:

- live quiz
- attendance
- poll
- Q&A
- anonymous doubt
- timer
- leaderboard
- team mode
- exit ticket
- misconception heatmap
- instant concept poll
- “everyone answer now”
- QR join
- projected classroom view

Teacher sees:

- who understands
- who guessed
- who is silent
- which question caused trouble

---

# 27. Teacher AI copilot

Teacher home should have:

### Morning briefing

> 6 students are at risk today.

Reasons:
- 3 missed homework
- 2 have declining accuracy
- 1 has not revised prerequisite concepts

### One-click actions

- generate remedial worksheet
- send reminder
- create test
- schedule revision
- message parent
- create lesson plan

### Lesson planner

Given:
- class
- duration
- chapter
- student levels

Generate:

- learning objectives
- warm-up
- explanation
- worked examples
- guided practice
- independent practice
- exit ticket
- homework
- differentiation

---

# 28. Tutor dashboard

Metrics:

- total students
- attendance
- pending work
- average score
- score trend
- mastery distribution
- at-risk students
- overdue revisions
- upcoming exams
- parent communication
- fees
- AI content usage

### Student risk table

Columns:

Student | Readiness | Trend | Attendance | Homework | Weak Topic | Recommended Action

---

# 29. Parent portal

Keep parent UX extremely simple.

Dashboard:

- child name
- attendance
- homework completion
- latest tests
- learning trend
- exam countdown
- upcoming goals
- tutor message

Weekly AI digest:

> “Your child improved in algebra accuracy from 71% to 83%. The current priority is word problems. Three 15-minute sessions are scheduled this week.”

Avoid shaming language.

---

# 30. Parent communication

Channels:

- in-app
- push
- email
- WhatsApp Business where legally/technically appropriate
- SMS as fallback

Templates:

- homework due
- missed class
- test result
- improvement
- concern
- fee reminder
- exam reminder
- attendance issue
- achievement

AI-generated messages must be reviewable before sending for important communications.

---

# 31. Gamification

Use motivation to reinforce learning behavior, not vanity.

### XP

Award for:

- studying
- retrieving
- fixing mistakes
- completing reviews
- improving accuracy
- helping peers
- consistency

Avoid giving huge rewards for passive video watching.

### Levels

Beginner → Learner → Builder → Solver → Expert → Master

### Streaks

Track:
- daily study
- revision streak
- test streak
- improvement streak

Support streak freeze only when it does not encourage unhealthy pressure.

### Badges

- 7-day consistency
- mistake fixer
- speed master
- accuracy master
- chapter mastered
- comeback
- mock marathon

### Class leaderboard

Optional and privacy-controlled.

Allow:

- public nickname
- private rank
- percentile only

---

# 32. Social learning

Optional:

- study rooms
- peer challenge
- group quiz
- team battle
- question discussion
- tutor-hosted challenge
- collaborative whiteboard

Strong moderation required.

---

# 33. Study focus system

Built-in:

- Pomodoro
- deep-work timer
- focus mode
- website/app distraction hints
- session goal
- ambient sounds
- break recommendations
- study-session reflection

Do not become a general productivity app; learning outcomes remain primary.

---

# 34. Voice + multimodal

Voice:

- ask doubt
- dictate answer
- verbal quiz
- reading practice
- pronunciation
- viva
- AI tutor voice

Vision:

- handwritten math
- diagrams
- maps
- graphs
- lab apparatus
- equations
- textbook photos
- answer sheets

Audio input should use push-to-talk by default.

---

# 35. Language strategy for India

Must support:

- English
- Hindi
- Hinglish
- configurable regional languages as the content base expands

Critical rule:

**Do not translate technical terminology blindly.**

Use bilingual terminology:

> Photosynthesis — प्रकाश संश्लेषण

Allow:

- English question + Hindi explanation
- Hindi question + English explanation
- Hinglish tutor

---

# 36. Accessibility

Support:

- keyboard navigation
- screen readers
- adjustable font sizes
- high contrast
- dyslexia-friendly options where appropriate
- captions
- transcript
- reduced motion
- voice control
- simple mode
- visual explanations

Because educational testing itself has accessibility implications, provide teacher/admin controls for accommodations.

---

# 37. Offline / low-bandwidth mode

Important for India.

Offline-capable:

- downloaded notes
- downloaded tests
- flashcards
- progress queue
- homework
- cached dashboard
- downloaded media
- draft submissions

Sync architecture:

`Local → mutation queue → conflict resolution → server → event reconciliation`

Do not promise AI offline unless an on-device model is actually shipped.

---

# 38. Notifications

Smart notifications only.

Examples:

> “You have 8 revision cards due today. 12 minutes is enough.”

> “Your physics accuracy has fallen for 3 sessions. Want a 10-question recovery drill?”

> “Exam in 14 days. Today's plan is 42 minutes.”

Allow:

- quiet hours
- digest mode
- exam-season mode
- parent controls
- tutor notification preferences

---

# 39. Calendar

Connect:

- tuition classes
- school timetable
- exams
- tests
- homework
- personal study blocks

Avoid overloading students with calendar complexity.

---

# 40. Search

Global command palette:

`Ctrl/Cmd + K`

Search:

- students
- questions
- concepts
- notes
- homework
- tests
- conversations
- resources
- classes

AI semantic search + keyword search.

---

# 41. Notifications inbox

One place to see:

- assignments
- reminders
- test results
- tutor messages
- parent messages
- system alerts
- AI recommendations

---

# 42. Content marketplace / sharing

Future feature.

Tutors can share:

- worksheets
- tests
- lesson plans
- flashcard packs
- revision packs

Private by default.

Optional centre-wide library.

---

# 43. Centre / multi-tenant architecture

Hierarchy:

Organization
→ Campus
→ Batch
→ Class
→ Teacher
→ Student
→ Parent

A user can have multiple memberships.

Do not model everything as `user_id = teacher_id`.

Use:

`organizations`
`organization_members`
`roles`
`batches`
`batch_members`
`student_profiles`

This prepares the product for coaching-centre scale.

---

# 44. Recommended product roles

- Platform Admin
- Organization Owner
- Centre Admin
- Academic Coordinator
- Teacher
- Teaching Assistant
- Student
- Parent/Guardian
- Content Editor
- Reviewer
- Support Agent

Use RBAC + database RLS.

---

# 45. Complete technical architecture

## Recommended stack

### Web
- Next.js 16.3
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- GSAP
- React Three Fiber
- Drei
- Lenis
- Zod
- TanStack Query where needed

Next.js 16.3 is the current 2026 release line referenced by the official Next.js blog.

### Mobile
- Expo
- React Native
- Expo Router
- EAS Build
- EAS Update
- NativeWind or a shared design-token approach

Expo EAS supports cloud builds, submission, updates, CI/CD and hosting workflows.

### Backend
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Edge Functions where appropriate

### AI layer
- Vercel AI SDK
- provider abstraction
- model routing
- structured outputs
- streaming
- tool calling
- workflow/orchestration layer

The AI layer should never hard-code the entire app around one model vendor.

### Vector search
- PostgreSQL + pgvector initially
- hybrid keyword + semantic search

Supabase officially supports pgvector for embeddings and vector similarity and also documents hybrid/semantic search patterns.

### Cache / rate limits
- Redis-compatible service
- short-lived AI session cache
- rate limits
- dedupe keys
- queue state

### Jobs/workflows
- Vercel Workflow / equivalent durable workflow system
- cron for scheduled work
- background workers for heavy ingestion

### Files
- Supabase Storage
- immutable source files
- processed derivatives
- signed URLs

### Observability
- Sentry
- OpenTelemetry
- structured logs
- product analytics
- AI request tracing

### Testing
- Vitest
- Playwright
- React Testing Library
- SQL/RLS tests
- contract tests
- AI evaluation suites

---

# 46. High-level architecture

```text
                         ┌────────────────────┐
                         │   Web / Mobile     │
                         │ Next.js / Expo     │
                         └─────────┬──────────┘
                                   │
                         ┌─────────▼──────────┐
                         │ API / Server Layer │
                         │ Auth / RBAC / Zod  │
                         └──────┬─────┬───────┘
                                │     │
                ┌───────────────┘     └────────────────┐
                │                                      │
       ┌────────▼─────────┐                  ┌────────▼─────────┐
       │ Supabase/Postgres │                  │ AI Gateway/SDK  │
       │ RLS / Realtime    │                  │ Models + Tools  │
       └───────┬───────────┘                  └───────┬─────────┘
               │                                      │
       ┌───────▼───────────┐                ┌─────────▼─────────┐
       │ pgvector / Search │                │ AI Workflow Layer │
       │ Knowledge Graph   │                │ Tutor/Test/Plan   │
       └───────────────────┘                └───────┬───────────┘
                                                   │
                                   ┌───────────────▼───────────────┐
                                   │ Deterministic Tooling          │
                                   │ Math / OCR / Search / Graders │
                                   └───────────────────────────────┘
```

---

# 47. AI architecture

## Do not build one giant agent.

Use bounded agents/services.

### Tutor Agent
Purpose:
- teaching conversation
- Socratic questioning
- hints
- concept explanation

Tools:
- retrieve source
- fetch mastery
- fetch mistakes
- create micro-quiz
- fetch question
- schedule review

### Assessment Agent
Purpose:
- question generation
- adaptive selection
- grading assistance

### Planner Agent
Purpose:
- schedule
- replan
- prioritize

### Content Agent
Purpose:
- summarize
- generate cards
- extract concepts

### Analytics Agent
Purpose:
- explain patterns
- produce teacher summaries

### Safety/Quality Agent
Purpose:
- hallucination checks
- policy checks
- child-safety checks
- content validation

---

# 48. AI request pipeline

```text
Student prompt
    ↓
Auth + tenant context
    ↓
Age / role / exam context
    ↓
Intent classifier
    ↓
Retrieve relevant mastery + source content
    ↓
Tool selection
    ↓
Generate structured response
    ↓
Validate schema
    ↓
Citation / source validation
    ↓
Safety checks
    ↓
Stream response
    ↓
Log learning event
    ↓
Update student model
```

---

# 49. AI guardrails

## Never allow:

- fabricated citations
- fabricated marks
- hidden teacher communication
- access to another student's data
- cross-tenant retrieval
- unsafe personal-data exposure
- direct answer-only cheating behavior where school policy disallows it
- unverified numerical solutions
- private parent/tutor conversations visible to student
- service-role secrets in client code

## Require:

- source grounding for source-based questions
- deterministic verification for calculable answers
- structured outputs
- rate limits
- moderation where appropriate
- audit trails
- prompt-injection defense

---

# 50. RAG architecture

Use three retrieval modes.

### A. Source-grounded RAG

For uploaded notes/PDFs:

`query → semantic search + keyword search → rerank → cited chunks`

### B. Curriculum RAG

For syllabus/question-bank material:

`exam + grade + chapter + topic + concept → filtered retrieval`

### C. Student-memory retrieval

Only retrieve:

- student-owned notes
- student learning history
- teacher-authorized content
- relevant mastery records

Never mix tenant boundaries.

---

# 51. Knowledge graph

Tables/entities:

- exams
- syllabi
- subjects
- chapters
- topics
- concepts
- skills
- prerequisites
- questions
- content_items
- misconceptions

Edges:

- prerequisite_of
- related_to
- tested_by
- taught_by
- contained_in
- similar_to
- misconception_of

---

# 52. Core database design

### Identity

- users
- profiles
- organizations
- organization_members
- roles
- student_profiles
- parent_profiles
- teacher_profiles

### Academic structure

- exams
- curricula
- syllabus_nodes
- subjects
- chapters
- topics
- concepts
- concept_edges

### Classes

- batches
- batch_members
- class_sessions
- attendance

### Content

- sources
- documents
- document_pages
- document_chunks
- embeddings
- notes
- annotations
- media

### Questions

- questions
- question_options
- question_solutions
- question_tags
- question_sources
- question_quality_reviews

### Assessments

- assessments
- assessment_items
- attempts
- attempt_items
- responses
- response_events

### Learning

- concept_mastery
- spaced_items
- review_events
- mistakes
- study_sessions
- goals
- study_plans
- plan_tasks

### Assignments

- assignments
- assignment_items
- submissions
- submission_events

### AI

- conversations
- messages
- tool_calls
- ai_feedback
- ai_evaluations

### Communication

- announcements
- notifications
- notification_preferences
- parent_messages

### Billing

- plans
- subscriptions
- invoices
- payments
- fee_records

### Governance

- audit_logs
- consent_records
- data_requests
- moderation_events
- model_usage

---

# 53. Example key tables

```sql
student_profiles
----------------
id
user_id
organization_id
grade_level
preferred_language
timezone
target_exam_id
target_score
exam_date
date_of_birth_encrypted
created_at
updated_at

concept_mastery
---------------
student_id
concept_id
mastery_probability
confidence_calibration
stability
last_practiced_at
next_review_at
attempt_count
correct_count
incorrect_count
updated_at

mistakes
--------
id
student_id
attempt_item_id
concept_id
category
severity
root_cause
student_answer
correct_answer
explanation
status
recurrence_count
next_review_at
created_at

study_plans
-----------
id
student_id
exam_id
start_date
end_date
target_score
status
version
generated_by
created_at

plan_tasks
----------
id
study_plan_id
date
concept_id
task_type
estimated_minutes
priority
status
source_attempt_id
```

---

# 54. RLS strategy

Every sensitive table should be protected.

Core principle:

`organization membership + role + student relationship`

Examples:

Student can read:
- own profile
- own attempts
- own mastery
- own homework
- own notes

Parent can read:
- linked child summary
- permitted academic records

Teacher can read/write:
- students in their organization/batches

Centre admin:
- organization data according to role

No client gets service-role access.

Supabase's current guidance explicitly recommends RLS on exposed tables, correct grants, and server-side handling of service-role keys.

---

# 55. API design

Prefer typed, resource-oriented endpoints.

```text
POST   /api/ai/tutor
POST   /api/ai/solve
POST   /api/ai/quiz
POST   /api/ai/flashcards
POST   /api/ai/plan

GET    /api/students/:id/mastery
GET    /api/students/:id/readiness
GET    /api/students/:id/mistakes

POST   /api/tests
POST   /api/tests/:id/start
POST   /api/tests/:id/submit
GET    /api/attempts/:id/analysis

POST   /api/documents
POST   /api/documents/:id/process

POST   /api/homework
POST   /api/homework/:id/submit

POST   /api/reviews/next
POST   /api/reviews/:id/answer
```

Use server-side authorization for all privileged operations.

---

# 56. Event-driven learning analytics

Capture immutable learning events.

Example:

```json
{
  "event": "question_answered",
  "student_id": "...",
  "question_id": "...",
  "attempt_id": "...",
  "concept_ids": ["..."],
  "correct": false,
  "response_time_ms": 48200,
  "confidence": 3,
  "hints_used": 1,
  "source": "smart_practice",
  "timestamp": "..."
}
```

Other events:

- lesson_started
- lesson_completed
- card_reviewed
- test_started
- test_submitted
- mistake_fixed
- question_bookmarked
- ai_doubt_asked
- homework_submitted
- study_session_completed

Use events to power the student model rather than constantly reading raw transactional tables.

---

# 57. Metrics

## North Star Metric

### Weekly Meaningful Learning Sessions

A meaningful session should require active student behavior and produce measurable learning evidence.

Example:

- ≥10 minutes
- ≥5 retrieval interactions
- or ≥1 complete test/assignment
- or mistake repair
- or concept mastery movement

## Secondary metrics

- 7-day retention
- test score improvement
- mastery growth
- revision adherence
- homework completion
- attendance
- average response time
- careless error rate
- confidence calibration
- readiness score improvement
- parent engagement
- teacher time saved
- AI resolution rate
- AI answer correction rate

---

# 58. Product KPIs

### Student
- +X% test performance
- lower repeated mistakes
- higher retention
- more consistent practice

### Tutor
- hours saved
- assignment creation time
- grading time
- follow-up reduction
- intervention detection time

### Parent
- fewer manual follow-ups
- weekly engagement
- clarity score

### Business
- activation
- paid conversion
- retention
- ARPU
- organization expansion
- student-to-teacher ratio
- AI cost/student

---

# 59. PRD

## Problem

Students use fragmented tools and often receive score reports without clear next actions.

Tutors track data manually and struggle to personalize at scale.

Parents see fragmented updates and cannot easily understand whether their child is improving.

## Goal

Build one learning system that connects tuition operations with personalized exam preparation.

## Non-goals

- replace school
- replace tutors
- become a generic social network
- become a generic LMS with thousands of unrelated features
- guarantee exam ranks
- automate high-stakes teacher judgment

## Success criteria

Within an initial pilot:

- students understand the daily recommendation without training
- teachers can create a differentiated assignment in under 2 minutes
- post-test analysis gives at least 3 actionable interventions
- parent can understand weekly progress in under 60 seconds
- repeat mistakes measurably decrease

---

# 60. MVP

Do not build everything at once.

### MVP-1: Student learning loop

- authentication
- student profile
- exam setup
- syllabus tree
- dashboard
- AI tutor
- upload PDF/image
- source-grounded Q&A
- AI quiz
- flashcards
- smart practice
- test engine
- test analytics
- mistake book
- basic planner
- basic spaced repetition
- teacher dashboard
- homework
- parent portal
- notifications

### MVP-2: Adaptation

- mastery engine
- weakness heatmap
- readiness score
- auto-replanning
- custom tests
- question quality pipeline
- class analytics

### MVP-3: premium intelligence

- voice
- viva
- advanced vision
- multimodal notes
- score simulator
- advanced knowledge graph
- classroom live mode
- predictive intervention

---

# 61. What should NOT be MVP

Defer:

- public social network
- creator marketplace
- elaborate 3D dashboard
- complex peer chat
- huge native video library
- on-device LLM
- AI avatar with expensive realtime graphics
- automated proctoring
- institutional SSO unless customers request it

---

# 62. Product roadmap

## Phase 0 — foundation
Weeks 1–2

- repo cleanup
- design system
- schema redesign
- organization model
- RLS tests
- observability
- analytics events
- CI/CD

## Phase 1 — learning core
Weeks 3–7

- student dashboard
- syllabus
- tutor
- documents
- quiz
- tests
- mastery
- mistakes

## Phase 2 — teacher/parent
Weeks 8–11

- teacher copilot
- homework
- reports
- parent dashboard
- notifications
- class management

## Phase 3 — adaptive intelligence
Weeks 12–16

- planner
- spaced repetition
- score simulator
- readiness
- adaptive tests
- knowledge graph

## Phase 4 — multimodal
Weeks 17–20

- voice
- vision
- handwritten solving
- viva
- classroom live mode

## Phase 5 — scale
Weeks 21+

- multi-centre
- billing
- content sharing
- content marketplace
- mobile hardening
- advanced analytics

---

# 63. Technical non-functional requirements

## Performance

Target:

- dashboard LCP < 2.5s on good mobile
- fast TTI
- AI first-token target < 2.5–4s where model/provider permits
- cached dashboard data < 500ms server response goal
- background ingestion should never block UI

## Reliability

- 99.9% target for core application
- idempotent submissions
- resumable uploads
- retryable jobs
- offline mutation queue

## Security

- RLS
- secure cookies
- rotating sessions
- server-side secrets
- rate limits
- CSP
- CSRF protection where relevant
- input validation
- signed media URLs
- audit logs
- dependency scanning
- security headers
- AI prompt injection defenses

OWASP's current LLM/GenAI guidance highlights prompt injection, sensitive information disclosure, supply-chain/model risks and improper output handling, while the current OWASP web Top 10 still places broken access control and security misconfiguration among the highest-priority risks.

---

# 64. Privacy / child safety

This is important because tuition students may be minors.

Design around:

- parental consent where legally required
- purpose limitation
- data minimization
- clear privacy notice
- retention policy
- deletion/export workflows
- consent records
- guardian relationship verification
- no targeted advertising to children
- privacy-preserving analytics
- age-appropriate defaults
- moderation and reporting
- human escalation for sensitive situations

India's DPDP framework and 2025 Rules require careful treatment of children's personal data, including verifiable parental consent mechanisms for applicable processing. Build the consent architecture before collecting more student data than the product needs.

Do not treat “we have a privacy policy” as compliance. The data model and workflows must enforce privacy.

---

# 65. AI cost-control architecture

AI can become the largest variable cost.

Use model tiers:

### Tier A
Tiny/cheap model:
- classification
- tagging
- routing
- simple summaries

### Tier B
General model:
- standard tutor
- question generation
- explanations

### Tier C
Advanced model:
- difficult reasoning
- complex multimodal problems
- teacher copilot

### Deterministic
- math verification
- scoring
- analytics
- scheduling
- search filters

Cache:

- common explanations
- document summaries
- embeddings
- question solutions
- generated cards

Set per-user and per-plan budgets.

---

# 66. AI evaluation system

Every model release should be evaluated against fixed benchmark sets.

### Categories

- factual accuracy
- mathematical accuracy
- source fidelity
- citation correctness
- pedagogy
- age appropriateness
- explanation quality
- refusal behavior
- language quality
- cheating resistance
- privacy leakage
- prompt injection resistance

### Golden tests

Create real student questions from your tuition classes.

A model update must not silently degrade them.

---

# 67. Teacher review workflow

AI should assign confidence/risk.

### Low-risk
- obvious flashcards
- simple summary

Auto-publish.

### Medium-risk
- normal question
- generated explanation

Batch review or sample review.

### High-risk
- answer key
- difficult numerical
- high-stakes exam content
- medical/science factual claims

Require teacher/content-reviewer verification.

---

# 68. Content provenance

Every learning artifact should know where it came from.

Example:

```text
question
 ├── generated_by = ai
 ├── source_document_id
 ├── source_pages
 ├── model
 ├── prompt_version
 ├── evaluator_version
 ├── reviewer_id
 └── published_at
```

This makes the system debuggable.

---

# 69. Frontend information architecture

## Student

```text
Home
├── Today
├── Study
│   ├── Smart Practice
│   ├── Flashcards
│   ├── Notes
│   └── AI Tutor
├── Tests
│   ├── Upcoming
│   ├── Mocks
│   ├── PYQs
│   └── Results
├── Progress
│   ├── Mastery
│   ├── Mistakes
│   ├── Readiness
│   └── Trends
├── Planner
├── Resources
├── Messages
└── Profile
```

## Teacher

```text
Dashboard
Students
Batches
Assignments
Tests
Question Bank
AI Copilot
Classroom
Analytics
Content
Messages
Fees
Settings
```

## Parent

```text
Overview
Attendance
Homework
Tests
Progress
Upcoming
Messages
```

---

# 70. UX principles

1. **One dominant action per screen.**
2. **Reduce cognitive overload.**
3. **Show why a recommendation exists.**
4. **Never bury the next step under analytics.**
5. **Make every result actionable.**
6. **Use visual hierarchy, not decoration.**
7. **Reward learning behavior, not app usage.**
8. **Preserve teacher authority.**
9. **Keep parent UX simple.**
10. **Mobile-first for students; desktop-first for tutors.**

---

# 71. 3D immersive marketing website direction

This should be separate from the functional dashboard.

The public website should feel like a premium AI education product, not a school ERP.

Visual reference class:

- Apple-like product storytelling
- Linear-style precision
- Raycast-like polish
- modern WebGL product landing pages
- cinematic educational atmosphere
- premium dark/light adaptive UI
- glass and depth used carefully

Do not copy any competitor.

---

# 72. MASTER FRONTEND 3D WEBSITE PROMPT

Use the following prompt directly with your coding agent:

---

## COPY-PASTE BUILD PROMPT

You are the lead product designer, creative director and senior frontend engineer building the next-generation TuitionTrack AI website.

Build a production-quality, extremely polished, responsive and accessible marketing website for:

**TuitionTrack AI — From tuition class to exam readiness.**

### Existing product

The product is an AI-powered exam preparation platform connected to a tuition management system.

Core story:

A tutor teaches.
A student practices.
AI understands the student.
The system identifies weaknesses.
The student repairs them.
Tests measure improvement.
Parents see progress.
The cycle repeats until the student is ready.

### Tech

- Next.js 16+
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- Framer Motion
- GSAP ScrollTrigger
- React Three Fiber
- Drei
- Lenis
- Lucide
- Zod where useful
- next/image
- proper metadata/SEO
- reduced-motion support

Do not use unnecessary libraries.

---

## Creative direction

Create a premium cinematic immersive website.

Mood:

**intelligent + futuristic + academic + human + calm confidence**

Avoid:

- generic edtech purple gradients
- childish cartoon design
- excessive glassmorphism
- template-looking SaaS cards
- fake “AI magic” buzzwords
- noisy animations
- inaccessible low contrast

Use depth, light, typography, controlled gradients and 3D only where they communicate product meaning.

---

## Global visual system

Background:

- near-black/navy in hero
- soft ivory/light surfaces in product sections
- carefully controlled gradient transitions

Typography:

- very strong display headline
- highly readable body
- tabular numerals for metrics
- mono labels for data/technical moments

Corners:

- 16–28px depending on component

Shadows:

- large soft ambient shadows
- avoid harsh black drop shadows

Borders:

- very subtle
- depth should come from lighting, not outlines

---

# 73. Website scene sequence

## Scene 1 — cinematic hero

Headline:

**Your next exam is not a deadline.  
It is a system we can prepare for.**

Subheadline:

**TuitionTrack turns tuition, AI tutoring, practice, revision, testing and progress into one adaptive learning loop.**

CTAs:

**Start preparing**
**See how it works**

3D scene:

A floating translucent “knowledge sphere.”

Inside the sphere:

- concepts
- question cards
- student mastery nodes
- exam countdown
- small particles

As the user scrolls, the nodes connect and resolve into a clean student dashboard.

Add subtle parallax.

---

## Scene 2 — “Know what to do next”

Big statement:

**Stop asking “What should I study?”**

Interactive dashboard mockup.

Animate:

Weak topic detected
→ recommendation generated
→ 15-minute practice
→ mistake fixed
→ mastery rises

Use real-looking data.

---

## Scene 3 — “AI that teaches, not answers”

Show split screen:

Student uploads handwritten question.

AI asks:

> “What do you think the first step should be?”

Student answers.

AI provides hint.

Then solution.

Animate the tutor conversation using speech bubbles and subtle typing.

---

## Scene 4 — knowledge graph

Full-screen dark section.

Show:

Exam
→ Physics
→ Mechanics
→ Kinematics
→ Relative Motion

Some nodes glow.

A weak prerequisite turns amber.

AI travels backward to repair the prerequisite.

Headline:

**Every mistake has a root.**

---

## Scene 5 — adaptive tests

Show an interactive exam simulator.

Metrics animate:

Accuracy
Speed
Confidence
Concept mastery

Then transform into:

**Your next test has changed because of your last test.**

---

## Scene 6 — mistake book

Animate wrong answers entering a “Mistake Vault.”

Categories:

Careless
Concept
Formula
Time
Misread

Then each mistake gets a repair action.

---

## Scene 7 — spaced revision

Use orbital 3D cards.

Cards appear over time.

Some return because memory is at risk.

Headline:

**Review before you forget.**

Show a visually elegant spaced-repetition timeline.

---

## Scene 8 — teacher cockpit

Transition from student interface to tutor interface.

Teacher sees:

- 124 students
- 11 at risk
- 27 assignments
- 82% class mastery

AI recommendation:

**“Run a 12-question remedial drill for Batch 9A.”**

---

## Scene 9 — parent window

Use calm warm design.

Show weekly progress:

Algebra
71 → 83%

Attendance
96%

Homework
91%

Readiness
78%

Headline:

**Parents do not need more data.  
They need clarity.**

---

## Scene 10 — exam countdown

A massive 3D countdown.

Example:

**14 DAYS**

Then the system decomposes the remaining preparation:

9 priority topics
4 mock tests
65 revision items
3 recovery sessions

---

## Scene 11 — trust/security

Show a visual data architecture:

Student
↔ Tutor
↔ Parent

with protected boundaries.

Explain:

- private data
- role-based access
- secure tenancy
- source-grounded AI
- auditability

Do not make exaggerated security claims.

---

## Scene 12 — final CTA

Headline:

**Build confidence one mastered concept at a time.**

CTA:

**Start TuitionTrack AI**

Secondary:

**Book a tutor demo**

End with a calm animated knowledge constellation.

---

# 74. Frontend interaction requirements

Implement:

- buttery scroll
- scroll-linked animations
- hover physics
- subtle magnetic buttons
- section transitions
- depth layers
- animated metric counters
- 3D camera movements
- pointer parallax
- smooth section snapping only when appropriate
- keyboard navigation
- reduced motion fallback
- touch-safe behavior
- mobile-specific simplified 3D

Never let animations block interaction.

---

# 75. 3D engineering rules

Use React Three Fiber.

Keep the 3D scene lightweight.

Use:

- InstancedMesh for repeated nodes
- low-poly geometry
- compressed textures
- lazy loading
- Suspense
- frame throttling when offscreen

Use IntersectionObserver to activate expensive scenes only when near viewport.

Fallback:

When WebGL is unavailable, render a beautiful CSS/SVG equivalent.

---

# 76. Marketing site performance requirements

- semantic HTML
- SEO
- OpenGraph
- sitemap
- robots
- JSON-LD
- optimized images
- responsive font loading
- lazy 3D
- lazy below-fold components
- route-level code splitting
- avoid blocking JS
- Lighthouse-friendly implementation
- keyboard navigable
- WCAG-aware color contrast

---

# 77. Design tokens

Create one source of truth:

```ts
const tokens = {
  radius: {
    sm: '12px',
    md: '18px',
    lg: '28px',
    xl: '40px',
  },
  spacing: {
    section: 'clamp(80px, 12vw, 180px)',
  },
}
```

Use CSS variables.

Do not scatter magic numbers across the codebase.

---

# 78. Components

Build reusable components:

- Navbar
- Button
- MagneticButton
- Metric
- MetricTicker
- GlassPanel
- BentoCard
- SectionHeading
- ScrollScene
- KnowledgeGraph
- ExamSimulator
- TutorConversation
- MasteryRing
- MistakeVault
- Timeline
- FeatureSpotlight
- DashboardMockup
- TestAnalyticsMockup
- ParentReport
- CTA
- Footer

---

# 79. Student dashboard design prompt

For the authenticated application, use a very different design language from the marketing page.

Dashboard:

- calm
- dense but readable
- task-focused
- responsive
- accessible
- minimal unnecessary animation

Top:

**Good morning, Piyush.**

Subheadline:

**You have 42 minutes of high-impact prep today.**

Hero card:

**Exam readiness 78%**

Then:

**Today's highest-impact action**

“Repair quadratic-equation factoring.”

CTA:

**Start 12-min recovery**

---

# 80. Student dashboard layout

Desktop:

```text
┌──────────────┬──────────────────────────────────────┐
│ Sidebar      │ Header                               │
│              ├──────────────────────────────────────┤
│ Home         │ Readiness / Exam Countdown           │
│ Study        ├──────────────────────────────────────┤
│ Tests        │ Today's Plan                         │
│ Progress     ├──────────────────┬───────────────────┤
│ Planner      │ Weak Topics       │ Revision          │
│ Tutor        ├──────────────────┴───────────────────┤
│ Notes        │ Recent Tests / Mistakes              │
│              └──────────────────────────────────────┘
└──────────────┴──────────────────────────────────────┘
```

Mobile:

Bottom navigation:

Home
Study
Tests
Progress
Tutor

---

# 81. AI tutor UX prompt

The AI tutor should feel like a premium human tutor.

UI:

- conversation
- equation rendering
- diagram cards
- inline hints
- source citations
- “show simpler”
- “give example”
- “quiz me”
- “make flashcards”
- “save to notes”
- “add to mistake book”

Response modes:

Explain
Hint
Quiz
Check my answer
Challenge me
Summarize

---

# 82. Test UX prompt

Important:

Do not overwhelm.

Header:

- section
- timer
- progress
- submit

Question area:

- question
- media
- options
- solution working field
- confidence
- mark for review

After submission:

First screen:

**Score + 3 actions**

Then deeper analytics.

---

# 83. Design system rules

Every feature must have:

- loading state
- empty state
- error state
- success state
- offline state where relevant
- skeleton state

No blank screens.

No “something went wrong” without action.

---

# 84. Onboarding flow

Ask only what is needed.

### Step 1
Who are you?

Student
Parent
Tutor
Centre

### Step 2
Exam / Grade

### Step 3
Subjects

### Step 4
Exam date

### Step 5
Goal

### Step 6
Diagnostic mini-test

Then immediately create:

**Your first personalized plan.**

---

# 85. Diagnostic test

The first diagnostic should:

- cover prerequisite skills
- sample broad syllabus
- measure confidence
- measure timing
- identify misconceptions

Output:

**Initial Learning Profile**

Example:

Strong:
- Linear equations
- Graphs

At risk:
- Factorization
- Word problems

Critical:
- Quadratic roots

Then generate a starter plan.

---

# 86. Personalization rules

The recommendation engine should prioritize:

`impact × weakness × urgency × prerequisite value ÷ time cost`

A simple explainable score is better than an opaque black box at first.

Example:

```text
Priority =
0.35 * weakness
+ 0.25 * exam_urgency
+ 0.20 * prerequisite_impact
+ 0.10 * retention_risk
+ 0.10 * score_impact
```

Tune using outcome data later.

---

# 87. Feature flagging

Everything large should be behind flags.

Examples:

- ai_tutor_v2
- voice_tutor
- knowledge_graph
- readiness_score
- live_classroom
- parent_ai_digest
- advanced_test_analysis
- 3d_home_dashboard

Use gradual rollout.

---

# 88. Deployment

## Environments

- local
- preview
- staging
- production

## CI

On PR:

- typecheck
- lint
- unit tests
- RLS tests
- build
- Playwright smoke tests

Production:

- migration validation
- canary/feature rollout
- monitoring

---

# 89. Backup / disaster recovery

- automated Postgres backups
- separate object storage lifecycle
- point-in-time recovery if available
- restore drills
- export capability
- audit trail

---

# 90. Data retention

Define retention by data class.

Examples:

Learning events:
longer retention for educational analytics, subject to policy.

AI conversation:
configurable retention.

Uploaded files:
user-controlled deletion.

Deleted student:
soft delete → retention window → hard delete/anonymization as applicable.

---

# 91. Admin console

Platform admin needs:

- organizations
- users
- AI spend
- AI errors
- flagged content
- failed jobs
- document processing failures
- model performance
- usage
- subscriptions
- audit logs
- support tools
- feature flags

---

# 92. AI spend dashboard

Track:

- tokens
- model
- request type
- user
- organization
- estimated cost
- latency
- cached vs uncached
- tool usage

Dashboard:

`AI cost / active student / week`

Set alerts.

---

# 93. Anti-cheating philosophy

The system should support learning rather than make cheating easier.

For assignments:

- tutor mode can give hints
- solution reveal can be delayed
- teacher chooses AI availability
- record when AI hints are used
- student can submit reasoning

For exams:

- teacher can disable AI
- locked/fullscreen modes where appropriate
- tab-switch flags only when legally and ethically appropriate
- avoid invasive surveillance by default

---

# 94. Accessibility for exams

Support teacher-defined accommodations:

- extra time
- larger text
- screen reader
- contrast
- language support
- breaks

Do not automatically infer or label disabilities.

---

# 95. Business model

Potential tiers:

### Free student
- limited AI
- limited tests
- core revision
- basic progress

### Student Pro
- higher AI
- advanced analytics
- unlimited generated practice within fair-use limits
- advanced planner
- voice
- deep reports

### Tutor
- student management
- homework
- tests
- analytics
- AI teacher copilot

### Centre
- multi-teacher
- batches
- permissions
- advanced reports
- branding
- administration

### Enterprise
- SSO
- custom retention
- custom AI policies
- dedicated support
- compliance features

Do not paywall basic evidence-based study functions like core practice testing.

---

# 96. Strongest differentiation

Do not try to win by having:

“more AI features.”

Win on:

### 1. Closed-loop personalization
Every interaction improves tomorrow's recommendation.

### 2. Tutor + AI collaboration
AI enhances the tutor instead of replacing the tutor.

### 3. Exam-specific intelligence
Syllabus, blueprint, PYQs, difficulty and timing actually matter.

### 4. Parent trust
Clear, non-judgmental progress.

### 5. Indian context
Hindi/Hinglish, mobile-first, low bandwidth, tuition workflows.

### 6. Actionable analytics
Every chart ends in a next action.

### 7. Source-grounded learning
AI can work from the student's actual notes and teacher material.

---

# 97. Anti-feature bloat rule

Because this plan includes a very large feature universe, every feature must satisfy at least one:

- improves learning outcome
- saves teacher time
- improves parent clarity
- increases retention
- increases accessibility
- materially improves exam readiness

Otherwise do not ship it.

---

# 98. Build order

The correct dependency chain is:

```text
Multi-tenant identity
      ↓
Curriculum + content model
      ↓
Question engine
      ↓
Attempt/event tracking
      ↓
Mastery model
      ↓
Mistake engine
      ↓
Revision scheduler
      ↓
AI tutor
      ↓
Adaptive planner
      ↓
Teacher analytics
      ↓
Parent reports
      ↓
Advanced AI
```

Do not start with the 3D UI.

The 3D UI sells the product.
The learning data model makes the product valuable.

---

# 99. “God mode” coding-agent instruction

When implementing this system, the coding agent must:

1. inspect the existing repo before changing anything
2. preserve working functionality
3. identify current routes, components, schema and auth flows
4. create a migration plan
5. create typed domain models
6. implement RLS before adding sensitive features
7. create test fixtures
8. add telemetry
9. implement one vertical slice end-to-end
10. then expand horizontally

Never generate hundreds of fake pages before the backend data flow works.

---

# 100. Definition of done for every feature

A feature is not complete until it has:

- database schema
- authorization/RLS
- API
- validation
- UI
- loading
- empty state
- error state
- mobile state
- analytics event
- tests
- accessibility review
- security review
- documentation

For AI:

- prompt versioning
- structured output
- evaluation
- cost tracking
- fallback
- abuse/rate limiting
- source grounding where relevant

---

# 101. Research references

Primary/current product references:

- TuitionTrack current site: https://tuitiontrack-app.vercel.app/
- NTA National Test Abhyas: https://nta.ac.in/Abhyas
- Embibe Test platform: https://www.embibe.com/in-en/best-education-content/tests-that-not-just-evaluate-but-also-diagnose/
- Embibe personalized learning: https://www.embibe.com/in-en/best-education-content/deep-knowledge-tracing-to-help-students-achieve/
- ALLEN online test series: https://news.allen.in/allen-online-test-series-smart-online-test-practice-for-jee-neet-exams/
- Quizlet study modes: https://quizlet.com/features/study-modes
- Khan Academy mastery: https://support.khanacademy.org/hc/en-us/articles/360007253831-Using-self-paced-practice-and-Mastery-in-the-classroom
- OpenAI Study Mode: https://help.openai.com/en/articles/11780217
- OpenAI Study Mode announcement: https://openai.com/index/chatgpt-study-mode/
- Expo EAS: https://docs.expo.dev/eas/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase pgvector: https://supabase.com/docs/guides/database/extensions/pgvector
- Supabase AI/vector docs: https://supabase.com/docs/guides/ai
- Vercel AI SDK: https://vercel.com/ai-sdk
- Next.js: https://nextjs.org/blog
- OWASP GenAI/LLM Top 10: https://genai.owasp.org/
- OWASP Web Top 10 2025: https://top10.owasp.org/2025/
- MeitY DPDP Rules 2025: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa
- APAAR privacy policy: https://apaar.education.gov.in/privacy-policy
- Ministry of Education material on education/data/privacy: https://www.education.gov.in/

Learning-science references:

- Dunlosky et al. / APS summary of effective learning techniques:
  https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html
- Meta-analysis of learning techniques:
  https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2021.581216/full
- Testing-effect research:
  https://www.sciencedirect.com/science/article/pii/S0959475217301810
- Retrieval practice / testing effect:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC4513285/
- Stepwise retrieval in worked examples:
  https://www.sciencedirect.com/science/article/pii/S0959475225001203
- Adaptive fading of worked examples:
  https://onlinelibrary.wiley.com/doi/10.1111/j.1755-8765.2008.01011.x

Community signal references:

- A 2026 student discussion described the desire for AI tutoring, PDF-to-summary, flashcards, quizzes, progress tracking, past papers and an AI study coach:
  https://www.reddit.com/r/Edexcel/comments/1varxqw/study_app_idea/
- Students have also described “tab switching” between ChatGPT, Quizlet, notes, schedules and search as a problem, reinforcing the value of a connected workflow:
  https://www.reddit.com/r/Student/comments/1s6ik1w/i_built_an_ai_study_assistant_after_watching/

---

# 102. Final product definition

The final TuitionTrack should feel like:

**Notion + Quizlet + Anki + Khan Academy mastery + NTA/ALLEN test engine + AI tutor + tuition CRM + parent portal**

but architected as one connected system.

The killer loop is:

**Tutor assigns → Student learns → AI coaches → Student practices → System diagnoses → Planner adapts → Student revises → Test measures → AI repairs → Tutor intervenes → Parent understands.**

That is the product moat.

