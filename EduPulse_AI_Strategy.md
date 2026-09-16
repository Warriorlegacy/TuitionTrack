# EduPulse AI — Full Startup Strategy & PRD/TRD
### AI-Powered Parent Intelligence & Student Performance Engine for India's Private Tutors
**Prepared:** May 2026 | **Version:** 1.0 | **Confidential**

---

## ONE-PAGE EXECUTIVE SUMMARY

**The Idea:** EduPulse AI is a vertical B2B SaaS that gives India's 7–10 million private tutors and coaching centers an AI-powered parent communication and student performance intelligence layer — automated weekly parent reports, at-risk student alerts, AI-generated personalized feedback, WhatsApp digest automation, and predictive learning analytics — built on a zero-cost stack and designed to scale without capital.

**The Gap It Fills:** Operational tutor tools like TuitionTrack (attendance, fees, homework) handle *what happened today*. EduPulse AI handles *what it means, what will happen, and what to do about it* — the intelligence and trust layer that no India-focused tutor SaaS addresses.

**Market:** India's private tutoring market is worth $4.4B in 2025, growing at 6.9% CAGR to $8.2B by 2034. The coaching institutes segment alone is $7.2B. Zero dedicated AI-intelligence SaaS tools exist for individual tutors in this space.

**Revenue Model:** Freemium → ₹499/month (Solo) → ₹1,499/month (Pro) → ₹3,999/month (Center). Path to ₹10L+ MRR within 18 months with 700 paying users.

**Built For:** Solo developers and tutors. Zero-cost stack: Next.js + Supabase + Vercel + OpenAI API (free tier) + Resend (email) + Razorpay.

**Synergy:** EduPulse AI is the natural intelligence upgrade layer for TuitionTrack users. It can integrate with TuitionTrack's data model directly or be offered as TuitionTrack's "Pro AI Add-on" — doubling the product's revenue ceiling without rebuilding core infrastructure.

**Launch Timeline:** MVP in 8 weeks. First revenue by Week 12. 100 paying users by Month 6.

---

## SECTION 1: IDEA OUTLINE

### 1.1 Problem Statement

India has an estimated 7–10 million private tutors and over 3 million coaching centers. The vast majority manage their operations manually — paper registers, WhatsApp groups, phone calls to parents. The few who use digital tools use them for *operations* (attendance, fees, homework assignment). But operations are the easy part.

The hard, high-value, unsolved problems are:

**For Tutors:**
- They cannot quickly identify which students are falling behind *before* the exam
- Writing individual progress reports takes 3–5 hours per report cycle
- Parents trust tutors they *communicate* with — but consistent, professional communication is exhausting to maintain manually
- No tutor has time to send personalized weekly updates to 40 parents individually
- Tutors have no data-backed way to demonstrate their teaching impact to parents

**For Parents:**
- They pay ₹2,000–8,000/month per tutor but receive almost no structured feedback
- They can't tell if their child is improving until results arrive
- They rely on informal WhatsApp chats — which are easy to miss and hard to track
- They have no visibility into homework completion, attendance trends, or topic-wise gaps

**The Core Pain:** Private tutors are small business owners who deliver a high-trust service with zero business intelligence infrastructure. They lose students not because of bad teaching — but because parents *perceive* a lack of progress, communication, and professionalism.

EduPulse AI solves this with a single, focused product: **automated intelligence that turns raw tuition data into parent trust.**

---

### 1.2 Target Market and TAM

**Primary Target:** Solo private tutors, home tutors, and small coaching centers (1–5 teachers) in India

**Secondary Target:** Coaching centers (6–20 teachers), test-prep institutes

**Tertiary Target (Year 3+):** International tutoring markets — Southeast Asia, Middle East (large Indian diaspora + similar tutoring culture)

| Segment | Population | % Digitally Accessible | Serviceable |
|---|---|---|---|
| Solo Private Tutors (India) | ~7–10 million | ~15% = 1.05M | 500K |
| Small Coaching Centers | ~3 million | ~20% = 600K | 200K |
| Mid-size Centers (6–20 teachers) | ~500K | ~40% = 200K | 80K |

**TAM Calculation:**
- India private tutoring market: **$4.4B (2025)**, growing to $8.2B by 2034
- Coaching institutes market: **$7.2B (2025)**
- SaaS penetration at 5% of addressable tutors = **~75,000 paying users**
- Average ARPU of ₹800/month = **₹720M/year (~$8.6M) SAM**
- At 3% market share within 3 years = **₹21.6M/year (~$259K) initial SOM**

**SAM (Serviceable Addressable Market):** $86M+ if expanded to all digitally reachable tutors in India
**TAM (Total Addressable Market):** $11.6B (combined India tutoring + coaching institutes market)

---

### 1.3 Competitive Landscape

| Competitor | Type | What They Do | Gap EduPulse Fills |
|---|---|---|---|
| **TuitionTrack** (tuitiontrack-app.vercel.app) | Direct/Adjacent | Operational SaaS — homework, fees, attendance, parent portal | No AI, no predictive analytics, no automated parent reports, no WhatsApp automation |
| **ClassPlus** | Indirect | Full coaching center LMS — live classes, course sales, payments | Expensive (₹3,000–10,000/month), built for institutes, no AI intelligence layer, overwhelming for solo tutors |
| **Teachmint** | Indirect | Digital classroom + school/tutor management | Not tutor-focused, no parent communication AI, requires full platform migration |
| **MyOperator / Interakt** | Indirect | WhatsApp Business API tools | Not education-specific, no student data context, generic broadcast tool |
| **Google Classroom** | Indirect | Free homework + assignment tool | No fees, no parent communication, no analytics, no Indian tutor workflow |
| **Zoho + Mailchimp combos** | Indirect | Generic CRM + email | Not education-specific, requires technical setup, no AI insights |

**Key Competitive Insight:** No product in India exists that takes *existing tuition data* (attendance, marks, homework) and automatically converts it into *AI-written, personalized parent reports + predictive at-risk alerts*. This is the white space.

---

### 1.4 Unique Value Proposition and Defensibility

**UVP (One Line):** *EduPulse AI turns your attendance register and marks sheet into parent trust — automatically.*

**Expanded UVP:**
> EduPulse AI is the only tool that takes the data tutors already have — attendance, test scores, homework completion — and automatically generates personalized, professional parent reports, flags at-risk students before exams, and sends weekly WhatsApp digests to parents. Zero manual effort. Maximum parent trust.

**Why It's Hard to Replicate (Defensibility Moats):**

1. **Data Compounding:** Every report generated, every student flagged, every parent interaction creates training data specific to Indian CBSE/ICSE tutoring contexts. The model gets better over time. A new entrant starts from scratch.

2. **Community Lock-in:** If 500 parents of a coaching center's students are receiving weekly EduPulse reports, switching to another tool means parents lose their report history. High switching cost.

3. **Tutor Trust:** Tutors who trust an AI to *write professional communications to parents on their behalf* are deeply locked in. This is not a utility — it's a reputation tool. Churn is structurally low.

4. **India-specific AI Fine-tuning:** Reports written in Indian-English, referencing CBSE chapters, board exam context, and Indian academic calendar create differentiation that a generic AI tool can't replicate without deliberate training.

5. **Integration Moat:** Deep integration with TuitionTrack's data model (or any data source) creates a two-product ecosystem where both tools become stickier together.

---

## SECTION 2: FEASIBILITY ASSESSMENT

### 2.1 No-Code / Low-Code Tech Stack (Zero Upfront Cost)

| Layer | Tool | Plan | Cost |
|---|---|---|---|
| **Frontend + Backend** | Next.js (App Router) | Open source | ₹0 |
| **Database + Auth** | Supabase | Free (500MB, 50K MAU) | ₹0 |
| **Hosting** | Vercel | Hobby (free) | ₹0 |
| **AI Engine (Reports)** | OpenAI API (GPT-4o-mini) | Pay-per-use (~$0.00015/1K tokens) | ~₹0.01 per report |
| **WhatsApp Automation** | WATI.io or Interakt | Free trial / ₹1,499/mo after | ₹0 initially |
| **Email Reports** | Resend | Free (3,000 emails/month) | ₹0 |
| **Payments** | Razorpay | Free setup, 2% per txn | ₹0 upfront |
| **Landing Page** | Framer or Vercel (same repo) | Free | ₹0 |
| **Analytics** | PostHog | Free (1M events/mo) | ₹0 |
| **Error Monitoring** | Sentry | Free tier | ₹0 |
| **CRM / User Comms** | Brevo (formerly Sendinblue) | Free (300 emails/day) | ₹0 |
| **No-Code Prototyping** | Bolt.new or Lovable | Free tier for MVP | ₹0 |

**Total Month 1 Infrastructure Cost: ₹0**

**Cost at 100 users (estimate):**
- OpenAI API: ~₹500–800/month (100 tutors × 40 students × 4 reports/month × ~₹0.05/report)
- Vercel Pro (if needed): $20/month
- Supabase Pro: $25/month
- **Total: ~₹4,500–5,500/month at 100 users** — covered by first 10–15 paying customers

---

### 2.2 Core MVP Features (Minimum 5)

**Feature 1: AI Parent Report Generator**
- Input: Student's attendance %, last 3 test scores, homework completion rate, tutor's notes
- Output: A 150–200 word professional parent report in Indian-English
- Delivery: Email + optional WhatsApp message
- AI Model: GPT-4o-mini with a fine-tuned prompt template
- Time to generate: < 10 seconds per report

**Feature 2: At-Risk Student Detector**
- Algorithm: Score-weighted risk index (attendance < 70% + marks trend declining + homework < 50% = HIGH RISK)
- Dashboard alert: Red/yellow/green per student
- Auto-trigger: Sends tutor a daily digest of students needing attention
- No AI required for MVP — pure logic rules work

**Feature 3: Weekly Parent Digest (WhatsApp/Email)**
- Automated weekly summary for each parent: "Rahul attended 4/5 classes this week. Completed 3 of 4 assignments. Average score: 72%. Topic this week: Quadratic Equations."
- Tutor reviews and clicks "Send All" — or sets to fully automatic
- Integrates with WhatsApp Business API (WATI free tier for first 1,000 messages)

**Feature 4: Performance Analytics Dashboard**
- Per-student trend charts: marks over time, attendance over time, homework streak
- Batch-level view: class average, top performers, at-risk count
- Visual progress summary (shareable with parents as PDF or link)
- Built with Recharts (free, open source)

**Feature 5: Tutor Report Card Generator**
- Monthly/quarterly visual report card per student
- Auto-populated from data: subject-wise marks, attendance percentage, teacher comment (AI-generated or manually edited)
- Downloadable as PDF or shareable via link
- Replaces the "parent-teacher meeting note" that tutors currently write manually

**Feature 6 (Nice-to-Have for MVP+):**
- Fee reminder sequences (automated WhatsApp/SMS if fees not paid by date)
- Multi-batch report generation (generate all 40 reports in one click)
- Parent acknowledgment tracking (did parent open/read the report?)

---

### 2.3 Non-Technical Requirements

- **Onboarding under 10 minutes:** Tutor can upload a CSV of students or manually add them
- **Mobile-first UI:** Most tutors in India use smartphones as primary device
- **Hindi/English bilingual UI:** Option to generate reports in Hindi for Tier-2/3 city tutors
- **Offline tolerance:** Dashboard must load even on slow 4G — no heavy JS bundles
- **WhatsApp-native feel:** Parents are used to WhatsApp — report digests must feel natural there
- **GDPR/DPDP compliance:** India's Digital Personal Data Protection Act 2023 requires consent for student data processing; consent flow must be built into onboarding

---

### 2.4 Success Metrics

| Metric | Week 4 Target | Month 3 Target | Month 6 Target |
|---|---|---|---|
| Waitlist signups | 50 | 200 | — |
| Active free users | 10 | 80 | 200 |
| Paying users | 0 | 20 | 100 |
| MRR | ₹0 | ₹15,000 | ₹75,000 |
| Reports generated | 100 | 3,000 | 15,000 |
| Avg. reports/user/month | 10 | 38 | 50+ |
| Churn rate | — | < 15% | < 8% |
| NPS Score | — | > 50 | > 65 |

---

### 2.5 Privacy and Data Considerations

- **Student data is sensitive** — names, marks, attendance, parent contact details fall under India's DPDP Act 2023
- **Required actions:**
  - Consent checkbox at signup (tutor consents on behalf of their institution)
  - Privacy policy explaining data use, storage, and AI processing
  - Data stored in Supabase with Row Level Security (RLS) — each tutor only sees their own data
  - Option for data export and account deletion (DPDP requirement)
  - AI reports: data sent to OpenAI API is not retained for training (per OpenAI's API terms) — disclose this
- **VPN considerations:** Supabase and Vercel are globally accessible. No geo-restrictions for Indian tutors
- **WhatsApp data:** WATI processes messages through Meta — disclose in privacy policy

---

## SECTION 3: GROWTH AND MONETIZATION PLAN

### 3.1 Revenue Model and Pricing Tiers

**Model Type:** Freemium SaaS (free tier hooks users, paid tiers unlock AI features)

| Plan | Price | Limits | Key Unlock |
|---|---|---|---|
| **Free** | ₹0/month | Up to 15 students, 5 AI reports/month, no WhatsApp | Good enough to feel the value |
| **Solo AI** | ₹499/month | Up to 60 students, unlimited reports, email delivery | Core AI report generation |
| **Pro Tutor** | ₹1,499/month | Up to 150 students, WhatsApp automation, PDF report cards, risk alerts | Full automation stack |
| **Center** | ₹3,999/month | Unlimited students, multi-teacher, center-wide dashboard, priority support | Scale to coaching institute |
| **White Label** | ₹9,999/month | Custom branding, custom domain, resell as own product | For large centers and edtech startups |

**Annual Pricing:** 2 months free on annual plans (reduces churn, improves cash flow)

---

### 3.2 Unit Economics

| Scenario | Users | ARPU | MRR | Infrastructure Cost | Gross Margin |
|---|---|---|---|---|---|
| Month 3 | 20 paying | ₹800 avg | ₹16,000 | ₹3,000 | ~81% |
| Month 6 | 100 paying | ₹900 avg | ₹90,000 | ₹8,000 | ~91% |
| Month 12 | 400 paying | ₹1,100 avg | ₹4,40,000 | ₹25,000 | ~94% |
| Month 18 | 1,000 paying | ₹1,200 avg | ₹12,00,000 | ₹55,000 | ~95% |

**CAC (Customer Acquisition Cost):** ₹0 initially (community + organic), rising to ₹200–400 as you add paid channels
**LTV at 18-month avg retention:** ₹1,200 × 18 = ₹21,600 per user
**LTV:CAC Ratio:** > 50:1 early stage — exceptional for SaaS

---

### 3.3 Go-to-Market Strategy

**Phase 1 — Founder-Led (Months 1–3):**
- You are a tutor. Use it yourself, generate reports for your own students
- Share before/after screenshots in tutor WhatsApp groups: "I used to spend 3 hours writing parent reports. Now it's 3 minutes."
- Post on LinkedIn weekly: build-in-public series "Building an AI tool for tutors as a tutor"
- Target Facebook Groups: "Private Tutors India", "CBSE Teachers Network India", "Home Tutors - Delhi/Mumbai/Bangalore"
- Offer first 20 beta users free Pro access for life in exchange for testimonials and feedback

**Phase 2 — Community Distribution (Months 3–6):**
- YouTube Shorts: 60-second demos ("Watch AI write a parent report in 8 seconds")
- Instagram Reels targeting tutor community
- Collaboration with edu-influencers on YouTube (Hindi-language channels about teaching have 100K–2M subscribers)
- SEO: Target "parent progress report for students template", "how to write student progress report", "tuition management app India"
- Product Hunt launch (global visibility)
- Indie Hackers "Build in Public" thread

**Phase 3 — Paid + Partner (Months 6–12):**
- Google Ads: ₹5,000–10,000/month targeting "tuition management software", "parent communication for tutors"
- TuitionTrack integration partnership: offer EduPulse as the AI upgrade layer (cross-promotion to TuitionTrack's user base)
- Tie-ups with educational supply stores and coaching center consultant networks
- Referral program: ₹200 credit per successful referral

**Early Adopter Channels (Priority Order):**
1. Your own tuition students (use it, prove it works)
2. Your personal network of tutors
3. WhatsApp/Facebook tutor groups
4. LinkedIn build-in-public content
5. YouTube demos

---

### 3.4 12-Month Phased Roadmap

#### Phase 1: Validation + MVP (Months 1–3)
- **Month 1:** Landing page live, waitlist open, 10 tutor interviews, begin Bolt.new/Lovable MVP build
- **Month 2:** MVP with 3 core features (AI report generator + at-risk detector + analytics dashboard), 10 beta users
- **Month 3:** Collect feedback, ship 5 fixes, activate free tier publicly, 50 signups

#### Phase 2: Product-Market Fit (Months 4–6)
- **Month 4:** Launch paid tiers (Solo AI + Pro Tutor), first revenue
- **Month 5:** Add WhatsApp digest feature, add PDF report cards
- **Month 6:** 100 paying users target, NPS > 50, launch referral program

#### Phase 3: Growth Engine (Months 7–12)
- **Month 7–8:** Launch YouTube/Instagram marketing, SEO content strategy begins
- **Month 9–10:** Build TuitionTrack integration / API, launch Center plan
- **Month 11:** White Label offering beta, target 400 paying users
- **Month 12:** ₹4–5L MRR target, team expansion consideration (1 part-time support), evaluate Tier-2 city expansion

---

## SECTION 4: LAUNCH AND OPERATIONS

### 4.1 Step-by-Step Launch Playbook (Free Tools Only)

**Week 1: Validate Before You Build**
1. Open Google Forms → create a 5-question survey about tutor pain points around parent communication
2. Share in 5 tutor WhatsApp groups and 3 Facebook groups
3. Target: 30 responses within 7 days
4. DM the 5 most engaged respondents for a 15-minute Zoom call
5. If survey confirms problem (>70% say parent communication is painful) → proceed

**Week 2: Build the Landing Page**
1. Use Framer (free) or build in your existing Next.js repo (like TuitionTrack)
2. Headline: "Your AI-Powered Parent Communication Engine for Tutors"
3. Include: Problem statement, 3 core features, 1 demo GIF or screenshot, email waitlist form
4. Embed: Tally.so form (free) for waitlist collection
5. Share landing page link everywhere you shared the survey

**Week 3–4: MVP Build Sprint (Using Bolt.new or Lovable)**
Prompt structure for Bolt.new:
```
Build a Next.js SaaS app for private tutors.
Features needed:
1. Auth (Supabase)
2. Add students with: name, class, subject, parent email, parent phone
3. Input form: attendance %, last 3 test scores, homework completion %
4. AI report generator: calls OpenAI API to generate a 150-word parent progress report
5. Dashboard showing all students with color-coded risk status
Stack: Next.js, Supabase, Tailwind CSS, OpenAI API, Vercel deployment
```

**Week 5–6: Beta Testing**
1. Give access to 10 tutors from your waitlist (free)
2. Ask them to generate at least 5 reports each
3. Collect feedback via a simple WhatsApp message ("What's the 1 thing that would make this 10x better?")
4. Fix the top 3 reported issues

**Week 7–8: Pre-Launch Preparation**
1. Set up Razorpay payment links (free, 2% per transaction)
2. Set up Brevo email sequences: welcome email, Day 3 tips, Day 7 feature highlight, Day 14 upgrade nudge
3. Write 3 LinkedIn posts and schedule them for launch week
4. Record a 90-second demo video (use Loom, free)
5. Set up PostHog for analytics (free, takes 10 minutes to install)

**Week 8: Public Launch**
1. Post on LinkedIn, Twitter/X, and in all tutor communities simultaneously
2. Submit to Product Hunt (schedule for Tuesday morning for maximum visibility)
3. Email your waitlist with the launch + early-bird pricing offer (20% off for first 30 days)
4. Message personally: each person who responded to your original survey

---

### 4.2 Key Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Tutors don't trust AI-written parent reports | Medium | High | Offer "review before send" mode — AI drafts, tutor approves. Builds trust before full automation |
| OpenAI API costs scale unexpectedly | Low | Medium | Set usage limits per free user, cache common report templates, switch to cheaper models (GPT-4o-mini) |
| WhatsApp Business API approval takes long | Medium | Medium | Launch without WhatsApp first (email only), add WhatsApp as Phase 2 feature |
| Low conversion from free to paid | Medium | High | Limit free tier to 5 AI reports/month — tutors with 30+ students will hit the limit fast |
| Competition from ClassPlus adding AI | Medium | Medium | Speed moat — be the first to market, build community loyalty before they react |
| India DPDP compliance complexity | Low | High | Build consent flow from Day 1, consult a CA/lawyer for ₹2,000–5,000 legal review |
| Users expect multilingual (Hindi) support | Medium | Medium | Add Hindi prompt option in Phase 2, not MVP — validate in English first |
| TuitionTrack users don't want another tool | Low | Medium | Build native TuitionTrack integration — one-click "connect to EduPulse" |

---

### 4.3 Metrics Dashboard Blueprint

**Daily Metrics (Check Every Morning):**
- New signups (last 24 hours)
- Reports generated (last 24 hours)
- Active users (logged in last 7 days)
- Any payment events (new subscriptions, upgrades, cancellations)

**Weekly Metrics (Every Monday):**
- Weekly Active Users (WAU)
- Reports generated this week vs last week
- Free-to-paid conversion rate this week
- Top feature used
- New support requests and their category

**Monthly Metrics:**
- MRR (Monthly Recurring Revenue)
- MRR growth rate (%)
- Churn rate (cancelled / total paying)
- ARPU (Average Revenue Per User)
- NPS Score (send survey to users who've been active 30+ days)
- CAC (what did you spend to acquire new paying users this month)
- LTV estimate (ARPU × average months retained so far)

**Tracking Tools (All Free):**
- PostHog: user behavior, funnels, feature usage
- Supabase dashboard: database activity, API calls
- Razorpay dashboard: revenue, subscriptions
- Google Search Console: organic traffic, keyword rankings
- Brevo: email open rates, click rates

---

## SECTION 5: PRD / TRD OUTLINE

### 5.1 Product Requirements Document (PRD) — Phase 1 MVP

**Product Name:** EduPulse AI
**Version:** 1.0 (MVP)
**Target Release:** 8 weeks from start date
**Owner:** Piyush (Solo Founder)

---

#### 5.1.1 Goals and Objectives
- Prove that tutors will use AI-generated parent reports
- Validate willingness to pay for the AI features layer
- Achieve 50 free users and 10 paying users by end of Phase 1

#### 5.1.2 User Personas

**Persona 1 — "Solo Priya" (Primary)**
- Private CBSE tutor, 25–40 students, Classes VI–X
- Uses WhatsApp daily, has a smartphone but limited laptop time
- Sends parent updates manually, feels overwhelmed at report time
- Would pay ₹300–600/month to eliminate this overhead

**Persona 2 — "Center Rajesh" (Secondary)**
- Owns a 3-teacher coaching center, 80–150 students
- Wants to look professional to compete with bigger institutes
- Would pay ₹1,500–4,000/month for a tool that elevates his brand

---

#### 5.1.3 User Stories (MVP Scope)

| ID | As a... | I want to... | So that... | Priority |
|---|---|---|---|---|
| US-01 | Tutor | Add students with name, class, parent email | My student roster is in the system | P0 |
| US-02 | Tutor | Input attendance %, last 3 scores, homework % | The system has data to generate reports | P0 |
| US-03 | Tutor | Click "Generate Report" for one student | I get an AI-written parent update in 10 seconds | P0 |
| US-04 | Tutor | Review the AI report before sending | I can edit or approve before it reaches parents | P0 |
| US-05 | Tutor | Send the report to parent via email | Parents receive professional updates | P0 |
| US-06 | Tutor | See a dashboard of all students color-coded by risk | I can spot who needs attention at a glance | P0 |
| US-07 | Tutor | Generate reports for all students in one click | I save hours at report time | P1 |
| US-08 | Tutor | See how each student's marks trend over time | I can have data-backed conversations with parents | P1 |
| US-09 | Parent | Log in and see my child's latest report | I stay informed without texting the tutor | P2 |
| US-10 | Tutor | Upgrade to a paid plan via Razorpay | I can access unlimited AI reports | P1 |

---

#### 5.1.4 Feature Specifications

**Feature: AI Report Generator**
- Trigger: Tutor clicks "Generate Report" button on student card
- Input payload: `{student_name, class, subject, attendance_pct, scores_array[3], homework_pct, tutor_notes_optional}`
- AI prompt template:
  ```
  You are a professional academic progress report writer for Indian CBSE private tutors.
  Write a 150-word parent progress update for the following student:
  - Name: {student_name}, Class: {class}, Subject: {subject}
  - Attendance this period: {attendance_pct}%
  - Recent test scores: {scores}
  - Homework completion: {homework_pct}%
  - Tutor's notes: {tutor_notes}
  
  Write in warm, professional Indian-English. Be specific and encouraging.
  Mention one area of strength and one area for improvement.
  Do not use generic filler phrases. Sound like a real teacher, not a form letter.
  ```
- Output: 150-200 word text shown in an editable textarea
- Actions: Edit → Approve → Send (email) or Copy (WhatsApp paste)

**Feature: At-Risk Alert System**
- Risk Score Formula: `(100 - attendance_pct) * 0.4 + (100 - avg_score) * 0.4 + (100 - homework_pct) * 0.2`
- Thresholds: Score > 60 = HIGH RISK (red), 40–60 = MEDIUM (yellow), < 40 = SAFE (green)
- Display: Color badge on each student card in dashboard
- Alert: Email to tutor on Monday morning listing all HIGH RISK students

**Feature: Analytics Dashboard**
- Per-student mini-chart: sparkline of last 5 test scores (Recharts)
- Batch summary: average score, average attendance, count by risk level
- Global view: all students in a sortable table

---

#### 5.1.5 Out of Scope for MVP
- WhatsApp Business API integration (Phase 2)
- PDF report card download (Phase 2)
- Multi-teacher / coaching center mode (Phase 2)
- Hindi language reports (Phase 2)
- Mobile app (Phase 3)
- Parent login portal (Phase 2)

---

#### 5.1.6 Acceptance Criteria (Definition of Done)

| Feature | Acceptance Criteria |
|---|---|
| AI Report Generator | Report generated in < 15 seconds, > 140 words, passes manual readability check |
| At-Risk Alert | Correct color assigned for test cases covering all 3 risk bands |
| Dashboard | Loads in < 3 seconds on mobile 4G |
| Email Delivery | Report email delivered within 2 minutes, passes spam filters |
| Auth | Tutor can signup, login, and see only their own students |
| Payment | Razorpay checkout completes and unlocks paid features within 60 seconds |

---

### 5.2 Technical Requirements Document (TRD) — Phase 1 MVP

**Architecture Overview:**
```
[Next.js App (Vercel)]
       |
  [Supabase]           [OpenAI API]
  - Users              - /v1/chat/completions
  - Students           - Model: gpt-4o-mini
  - Reports
  - Subscriptions
       |
  [Resend API]         [Razorpay API]
  - Email delivery     - Subscription billing
```

**Database Schema (Supabase / PostgreSQL):**

```sql
-- Users (Tutors)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  plan TEXT DEFAULT 'free', -- free | solo | pro | center
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class TEXT,
  subject TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Records (one per reporting period)
CREATE TABLE performance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  period_label TEXT, -- e.g., "March 2026"
  attendance_pct NUMERIC(5,2),
  score_1 NUMERIC(5,2),
  score_2 NUMERIC(5,2),
  score_3 NUMERIC(5,2),
  homework_pct NUMERIC(5,2),
  tutor_notes TEXT,
  risk_score NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_record_id UUID REFERENCES performance_records(id),
  student_id UUID REFERENCES students(id),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft | approved | sent
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  razorpay_subscription_id TEXT,
  plan TEXT,
  status TEXT, -- active | cancelled | past_due
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Row Level Security (RLS) Policies:**
```sql
-- Enable RLS on all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Tutors only see their own students
CREATE POLICY "Tutors see own students" ON students
  FOR ALL USING (auth.uid() = tutor_id);

-- Cascade via student ownership for performance records and reports
CREATE POLICY "Own performance records" ON performance_records
  FOR ALL USING (
    student_id IN (
      SELECT id FROM students WHERE tutor_id = auth.uid()
    )
  );
```

**API Routes (Next.js App Router):**

```
POST /api/reports/generate      → Calls OpenAI, saves draft report
POST /api/reports/send          → Sends via Resend, updates status to 'sent'
GET  /api/students              → List tutor's students with latest risk scores
POST /api/students              → Add new student
PUT  /api/students/[id]         → Update student record
POST /api/performance           → Add performance record for student
POST /api/webhooks/razorpay     → Handle subscription events
GET  /api/dashboard/summary     → Aggregate stats for dashboard
```

**OpenAI Integration:**
```javascript
// /api/reports/generate
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01"
  },
  body: JSON.stringify({
    model: "claude-haiku-4-5-20251001", // Fast and cheap for report generation
    max_tokens: 400,
    messages: [{
      role: "user",
      content: buildReportPrompt(student, performanceRecord)
    }]
  })
});
```

**Environment Variables Required:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=        # or OPENAI_API_KEY
RESEND_API_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

**Performance Requirements:**
- Report generation API: < 15 seconds response
- Dashboard load: < 3 seconds on 4G
- Email delivery: < 2 minutes
- Uptime target: 99.5% (Vercel + Supabase give this for free)

**Security Checklist:**
- [ ] RLS enabled on all Supabase tables
- [ ] API routes validate auth session before processing
- [ ] Razorpay webhook signature verified
- [ ] Input sanitization on all user-facing fields
- [ ] Rate limiting on `/api/reports/generate` (max 10 calls/minute per user)
- [ ] CORS configured for production domain only
- [ ] Environment variables never exposed to client

---

## SECTION 6: REFERENCE PROJECT ALIGNMENT — TUITIONTRACK

**TuitionTrack URL:** https://tuitiontrack-app.vercel.app/
**Built on:** Next.js + Supabase + Vercel
**Current Features:** Homework assignment, attendance tracking, fee management, test score recording, announcements, parent portal

### 6.1 What TuitionTrack Is (Operations Layer)

TuitionTrack is an excellent, production-ready **operations layer** for tutors:
- It answers: *"Did Rahul attend class today? Did he submit homework? Has the March fee been paid?"*
- It delivers: Teacher dashboard, parent read-only portal, student portal, real-time activity feed
- Pricing: ₹999/month (Solo) and ₹2,999/month (Coaching Center)
- Stack: Identical to what EduPulse AI would use — perfect for integration

### 6.2 What EduPulse AI Is (Intelligence Layer)

EduPulse AI is the **intelligence layer** that sits on top of operations:
- It answers: *"Is Rahul at risk of failing this term? What should I tell his parents? When should I intervene?"*
- It delivers: AI-generated reports, predictive risk scores, automated parent digests, performance trends
- Neither tool duplicates the other — they are architectural complements

### 6.3 Integration Path (3 Options)

**Option A — Direct TuitionTrack Integration (Recommended)**
- Build an "EduPulse Integration" button in TuitionTrack settings
- When connected, EduPulse reads TuitionTrack's Supabase tables (with user permission)
- Pre-fills the performance input form automatically — tutor just clicks "Generate Reports"
- Benefit: TuitionTrack users get 10x more value; EduPulse gets distribution from TuitionTrack's user base
- Technical requirement: Share Supabase project OR build a read-only API endpoint in TuitionTrack

**Option B — EduPulse as TuitionTrack "Pro AI Add-on"**
- Keep same codebase, add an "AI Intelligence" module to TuitionTrack
- Charge separately: ₹499–999/month add-on to existing TuitionTrack plan
- This is the fastest path to revenue if you already have TuitionTrack users
- Benefit: No user acquisition needed — upsell to existing base

**Option C — Separate Product, Parallel Growth**
- EduPulse targets the same audience independently
- Serves users who don't use TuitionTrack (the majority of the market)
- Gives you two revenue streams and two products to sell
- Can still integrate with TuitionTrack in future

**Recommendation:** Start with Option B (fastest revenue, leverages existing TuitionTrack users), then expand to Option C (standalone product for the broader market) by Month 4.

### 6.4 Differentiation from TuitionTrack

| Dimension | TuitionTrack | EduPulse AI |
|---|---|---|
| Core job | Manage tuition operations | Generate parent trust + predict student outcomes |
| AI features | None currently | Core product feature |
| Parent communication | Static portal (parents log in) | Proactive (AI pushes updates to parents) |
| Reports | Manual, no generation | Auto-generated in 10 seconds |
| At-risk alerts | Not present | Core feature |
| WhatsApp automation | Not present | Phase 2 core feature |
| Data model | Operations-first | Intelligence-first |
| Price positioning | ₹999–2,999/month | ₹499–3,999/month (different tiers) |

---

## SECTION 7: 30/60/90-DAY ACTION PLAN

### Days 1–30: Validate and Build Foundation

| Day | Action | Tool | Outcome |
|---|---|---|---|
| 1 | Write 10 tutor interview questions | Google Docs | Ready to research |
| 2–3 | Share survey in 5 tutor communities | Google Forms + WhatsApp | 30+ responses |
| 4–5 | Conduct 5 tutor interviews (Zoom/phone) | Zoom (free) | Validated pain points |
| 6 | Analyze survey + interview findings | Notion (free) | Confirmed problem statement |
| 7 | Build landing page with waitlist | Framer / Next.js | Collecting leads |
| 8–10 | Share landing page everywhere | WhatsApp, Facebook, LinkedIn | 50+ waitlist signups |
| 11 | Set up Supabase project, design schema | Supabase | Database ready |
| 12–20 | Build MVP using Bolt.new / Lovable / Cursor | Bolt.new | Core 3 features working |
| 21–25 | Test MVP yourself with your own students | Manual | Bugs identified and fixed |
| 26–28 | Invite 10 beta users from waitlist | Email via Brevo | Beta feedback collected |
| 29–30 | Fix top 5 reported issues | Cursor/Bolt | MVP stable |

**Day 30 Checkpoint:** 10 beta users, 50+ waitlist, product generates real reports ✓

---

### Days 31–60: Launch and First Revenue

| Day | Action | Tool | Outcome |
|---|---|---|---|
| 31 | Set up Razorpay subscription plans | Razorpay Dashboard | Payment ready |
| 32 | Set up PostHog tracking | PostHog | Analytics live |
| 33–35 | Set up Brevo email sequences (welcome, nurture, upgrade) | Brevo | Automated onboarding |
| 36–40 | Public launch: LinkedIn + Facebook + Twitter | Social media | 200+ signups |
| 41 | Product Hunt submission | Product Hunt | Global visibility |
| 42–45 | Personal DM to every beta user asking for testimonial | WhatsApp/Email | 5+ testimonials collected |
| 46–50 | Start LinkedIn build-in-public content series (weekly) | LinkedIn | Community building |
| 51–55 | Reach out to 20 coaching centers in your city personally | WhatsApp/Phone | 5 demos booked |
| 56–58 | Convert first 5 demos to paid | Razorpay | First revenue |
| 59–60 | Launch referral program (₹200 credit for referrals) | Brevo + manual | Organic growth begins |

**Day 60 Checkpoint:** 100+ signups, 10–15 paying users, ₹6,000–10,000 MRR ✓

---

### Days 61–90: Scale and Solidify

| Day | Action | Tool | Outcome |
|---|---|---|---|
| 61–65 | Ship WhatsApp digest feature (WATI integration) | WATI + Supabase | Paid feature unlocked |
| 66–70 | Record YouTube demo video + 3 YouTube Shorts | Loom + phone | Video content live |
| 71–75 | Write and publish 5 SEO blog posts | Next.js blog / Hashnode | Organic traffic starts |
| 76–78 | Launch "Center" pricing tier | Razorpay + app | Higher ARPU tier |
| 79–82 | Personal outreach to 50 coaching centers via LinkedIn | LinkedIn | 10+ demos |
| 83–85 | Integrate TuitionTrack API (if Option A chosen) | Supabase + API | Two products connected |
| 86–88 | Send NPS survey to all users active > 30 days | Tally.so | NPS baseline score |
| 89–90 | Review metrics dashboard, plan Month 4–6 sprint | Notion | Q2 roadmap ready |

**Day 90 Checkpoint:** 30–50 paying users, ₹20,000–35,000 MRR, NPS > 45 ✓

---

## APPENDIX: TOOLS QUICK REFERENCE

| Need | Tool | URL | Cost |
|---|---|---|---|
| Build MVP | Bolt.new | bolt.new | Free |
| Build MVP (alternative) | Lovable | lovable.dev | Free |
| Code editor (vibe coding) | Cursor | cursor.sh | Free tier |
| Database + Auth | Supabase | supabase.com | Free |
| Hosting | Vercel | vercel.com | Free |
| AI Engine | Anthropic API | api.anthropic.com | Pay-per-use |
| Email | Resend | resend.com | Free (3K/mo) |
| Email marketing | Brevo | brevo.com | Free (300/day) |
| Payments | Razorpay | razorpay.com | Free + 2% |
| WhatsApp automation | WATI | wati.io | Free trial |
| Analytics | PostHog | posthog.com | Free (1M events) |
| Landing page | Framer | framer.com | Free |
| Waitlist/Forms | Tally.so | tally.so | Free |
| Video demos | Loom | loom.com | Free (5 min) |
| User research | Google Forms | forms.google.com | Free |
| Project tracking | Notion | notion.so | Free |

---

*Document Version 1.0 — EduPulse AI Startup Strategy*
*Prepared May 2026 | For Internal Use*
*Next Review: August 2026*
