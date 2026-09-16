# Tech Stack — ExamPulse AI

**Design bias (per your standing preference):** free-tier first, autonomous/vibe-coding friendly, consistent with the TuitionTrack/EduPulse AI stack so infra and knowledge transfer between products.

---

## 1. Frontend

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15/16 (App Router)** | Same as TuitionTrack — one mental model, one deploy target, shared component/design patterns |
| UI library | **React 19** | Ships with Next.js; Server Components reduce client bundle for content-heavy pages (chapters, worksheets) |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, consistent, accessible-by-default primitives; easy for AI coding agents (Bolt/Lovable/Cursor) to extend predictably |
| State | **Zustand** (client UI state) + Supabase Realtime subscriptions (server state) | Lightweight; avoids Redux ceremony |
| AI streaming | **Vercel AI SDK** | First-class streaming for the doubt-chat UI; official React hooks (`useChat`) for the tutor conversation |
| 3D/marketing site | **React Three Fiber + drei, GSAP + ScrollTrigger, Lenis** | For the immersive scroll website (separate from the app itself — see 04-Frontend-3D-Website-Prompt.md) |
| Charts (dashboards) | **Recharts** or **Tremor** | Weak-topic heatmaps, readiness trend lines |
| PWA | **next-pwa** or manual service worker + manifest | Offline practice queue, installable on Android home screen |
| Native wrapper | **Capacitor** (wraps the same Next.js PWA) | Matches TuitionTrack's existing APK distribution pattern without maintaining a separate native codebase |

## 2. Backend & Data

| Layer | Choice | Why |
|---|---|---|
| BaaS/Database | **Supabase (Postgres)** | Same as TuitionTrack — shared or synced student roster, one less system to operate; generous free tier |
| Auth | **Supabase Auth** | Reuse existing student/parent/teacher accounts and RLS patterns already proven on TuitionTrack |
| Vector search | **pgvector (inside Supabase Postgres)** | Benchmarked to comfortably outperform a separate managed vector DB at this scale, and at lower cost — no second database to run |
| Storage | **Supabase Storage** | Doubt photos, answer-sheet scans, teacher-uploaded PDFs; private buckets + signed URLs |
| Realtime | **Supabase Realtime** | Live dashboard updates (e.g., teacher sees a doubt come in) |
| Edge/serverless functions | **Supabase Edge Functions (Deno)** or **Next.js Route Handlers on Vercel** | Server-side AI calls, keeps provider keys off the client |
| Background jobs / cron | **Inngest** (free tier) or **Supabase `pg_cron`** | Streak/XP rollups, FSRS due-queue computation, WhatsApp digest sending, at-risk alert scans |
| Row-level security | **Postgres RLS policies** | The actual authorization boundary — see TRD Section 6 |

## 3. AI / LLM Layer

| Purpose | Model tier | Example providers (pick per pricing/availability at build time) | Why this split |
|---|---|---|---|
| OCR / vision doubt-reading, first-pass classification, simple question generation | **Fast, cheap multimodal** | Gemini Flash-class, or equivalent low-cost multimodal API | High volume, latency-sensitive, doesn't need frontier reasoning |
| Socratic tutoring dialogue, subjective-answer grading, worksheet/test generation | **Stronger reasoning model** | Claude/GPT-4o class | Quality matters more than cost here; lower volume than the OCR path |
| Speech-to-text (voice doubts) | **Whisper (open-source) or a hosted STT API** | | Mature, cheap, good Indian-English accuracy |
| Text-to-speech (spoken explanations) | **Hosted TTS API** | | Needed for voice tutor + accessibility |
| Orchestration | **Vercel AI SDK** for streaming + simple tool calls; **LangGraph** if/when multi-step agent flows (e.g., "diagnose weak topic → generate worksheet → assign") need explicit state graphs | | Keep it simple until an actual multi-step agent need appears — don't over-engineer orchestration on day one |
| Embeddings | Provider-native embedding endpoint (matches whichever LLM provider is primary) stored via pgvector | | One less vendor relationship |

> Cost-control principle carried over from the TRD: route the high-volume, low-complexity calls (OCR, simple grading of MCQs) to the cheap tier; reserve the expensive tier for the handful of calls per session that actually need deep reasoning (a Socratic hint, a subjective-answer rubric grade, worksheet generation).

## 4. Spaced Repetition & Adaptive Logic

| Component | Choice | Why |
|---|---|---|
| Flashcard scheduling | **FSRS algorithm** (TypeScript implementation, e.g. `ts-fsrs`-style library, runs in an Edge Function) | Current state of the art, meaningfully more efficient than legacy SM-2, mature open-source implementations exist |
| Topic mastery tracking | **Bayesian Knowledge Tracing (custom, small)** | Simple enough to implement and reason about without an ML platform |
| Question difficulty adaptation | **Elo-style per-question/per-student rating (custom, small)** | Cheap, explainable, no training pipeline required |
| (Future/optional) | Deep knowledge tracing / RL-based sequencing | Only revisit if data volume and team bandwidth justify the jump — not an MVP dependency |

## 5. Payments, Comms & Analytics

| Purpose | Choice | Why |
|---|---|---|
| Payments (India) | **Razorpay** | UPI-native, standard for Indian SaaS/edtech, easy Next.js integration |
| Email | **Resend** | Free tier, simple API, used widely in the same stack family as Supabase/Vercel |
| WhatsApp (parent digests, reminders) | **WhatsApp Business Cloud API (Meta) or Gupshup** | Reuse the integration pattern already explored in ExamAstra |
| Product analytics | **PostHog** | Generous free tier, self-hostable later if needed, session/funnel analytics for feature usage |
| Error tracking | **Sentry** | Free tier sufficient at this stage |

## 6. Hosting & DevOps

| Layer | Choice | Why |
|---|---|---|
| App hosting | **Vercel** | Same as TuitionTrack; native Next.js support, generous free tier, edge network |
| Database/Auth/Storage hosting | **Supabase Cloud** | Free tier sufficient for MVP scale; predictable upgrade path |
| CI/CD | **GitHub Actions** (or Vercel's built-in git integration) | Free for public/small private repos |
| Environments | `main` (prod) / `staging` / local dev with Supabase local CLI | Standard three-tier flow |
| Secrets | Vercel + Supabase environment variable stores | Never in client bundle, never committed |

## 7. Approximate Cost Envelope (MVP, own-student scale)

| Item | Expected tier | Notes |
|---|---|---|
| Vercel | Free/Hobby | Fine at this traffic level |
| Supabase | Free → Pro ($25/mo) once storage/DB size grows | Still cheap relative to a dedicated vector DB + separate Postgres |
| LLM API usage | Usage-based, dominated by the OCR/doubt-solve path | Mitigate with the two-tier routing strategy above; set a per-student daily cap on the free tier |
| WhatsApp Business API | Free tier covers low conversation volume; scales with parent count | |
| Razorpay | Transaction-fee based, no fixed cost | Only relevant once monetized |
| Total to validate MVP on your own students | **Close to ₹0–₹2,000/month**, dominated by LLM usage | Matches your stated free-tier-first build philosophy |

## 8. Why this stack fits *this* build specifically

- It is **the same stack as TuitionTrack**, so the two products can share auth, RLS patterns, and even a database — the single biggest unlock for a solo founder building a second product.
- It matches the **2026 default recommendation for AI-native SaaS** (Next.js + Supabase + pgvector + RLS + Vercel) that shows up consistently across current tech-stack guidance for AI MVPs — not a niche or risky choice.
- Every layer has a **usable free tier**, matching your build philosophy across GigMind, DXFVec, and ExamAstra.
- It is **friendly to vibe-coding tools** (Bolt.new, Lovable, Cursor, v0.dev, Claude Code) — Next.js + Supabase + Tailwind + shadcn is the most heavily represented stack in those tools' training/templates, so autonomous agents will produce higher-quality code with fewer corrections than on an exotic stack.
