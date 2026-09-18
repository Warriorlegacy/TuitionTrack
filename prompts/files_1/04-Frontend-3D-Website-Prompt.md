# Frontend Build Prompt — ExamPulse AI Marketing Website
### (3D Immersive Scroll Experience — copy-paste this whole document into Claude Code, Lovable, Bolt.new, v0, or Cursor)

---

## How to use this file
This is a single, self-contained brief. Paste it wholesale as your first message to the coding agent. It is written so an autonomous agent can build the entire site without needing to ask you clarifying questions — every decision (palette, type, copy tone, section order, animation behavior) is already made. Where you want to change something, edit this file first, then paste it in — don't negotiate with the agent mid-build.

---

## 1. Project Brief

Build a single-page, scroll-driven, 3D-immersive marketing website for **ExamPulse AI** — an AI-powered exam-preparation companion for CBSE tuition students (Classes VII–X), built by a solo tutor/founder. The site's job is to make a parent or student instantly understand: *this is a personal AI tutor that studies your exact syllabus and shows you, node by node, exactly how ready you are for your next exam.*

This site is the marketing/landing experience — a separate concern from the actual product app (which is a conventional Next.js dashboard). This site can be as expressive and cinematic as the product app is calm and functional.

## 2. The Core Visual Idea (ground everything in this)

The through-line concept is **"the learning path."** A single glowing path winds through a dark, star-lit study space. Scattered along the path are **checkpoint nodes** — each one a chapter, a skill, a feature. As the visitor scrolls, the camera travels *along* this path (a spline-path-follow camera rig, not a static hero with things floating past it). Nodes are dim and disconnected at first (representing the disorganized, generic way most students currently study), and light up and connect with glowing threads as the visitor scrolls past them (representing mastery and structure). By the final section, the whole path behind the visitor is lit — a literal, earned constellation of what they now understand about the product.

This is the single "bold moment" of the site. Everything else is quiet and disciplined around it. Do not add extra floating 3D objects, particle explosions, or decorative shapes elsewhere just because 3D is available — the path *is* the concept; resist adding a second competing visual idea.

## 3. Design Tokens

### Color (use these exact hex values — do not substitute a generic AI-default palette)
- `--bg-void: #0F1226` — the base background, a deep indigo-black night-sky, not pure black
- `--bg-void-soft: #171B36` — panel/card backgrounds, slightly lifted off the void
- `--ink: #F6F3EC` — primary text, warm off-white (not pure white, not the cliché cream #F4F1EA used as a *background* elsewhere — here it's text-only)
- `--ink-muted: #A8ACC4` — secondary text, muted lavender-grey
- `--accent-amber: #F2A340` — the "mastery / lit node" color; used for the path glow, CTAs, active states
- `--accent-jade: #3FA35E` — secondary accent for "correct answer / readiness" states — use sparingly, mostly inside product-screenshot mockups, not in the main UI chrome
- `--accent-signal: #7C6FF2` — a violet used only for AI/voice-related moments (the doubt-solving and voice-tutor sections) — gives the "AI" moments a distinct temperature from the "progress" moments

Do not introduce a warm-cream #F4F1EA *background* or a terracotta #D97757 accent anywhere — that combination is an overused AI-generated-site default and would undercut the night-sky/path concept.

### Typography
- **Display/headline face:** `General Sans` (geometric, confident, humanist grotesk) — weights 500/600/700. Load via Fontshare.
- **Body face:** `Newsreader` (a warm, academic serif with real texture, not a generic system serif) — weight 400/500, italic used only for the recurring "path" metaphor callouts (see Section 5).
- Do not use a monospace face for labels, do not use tracked-out all-caps eyebrow labels above headings, do not put a single word in the headline in a different color/italic just to "accent" it — these are the generic AI-site tells; avoid all three.
- Line length: body copy max ~70 characters per line. Headlines set large (clamp between 2.5rem and 5.5rem depending on section weight), tight leading.

### Layout
- Single column, center-weighted for hero and CTA moments; left-aligned text panels for feature/checkpoint sections, with the 3D canvas occupying the right ~55% of the viewport on desktop (stacks to canvas-behind-text on mobile — see Section 7).
- Generous vertical rhythm — each checkpoint section gets full-viewport-height breathing room; this is a slow, cinematic scroll, not a dense content dump.

## 4. Tech Requirements

- **Framework:** Next.js (App Router), single route, deployed as a standalone marketing site (can later link out to the actual app's `/signup`).
- **3D:** `@react-three/fiber` + `@react-three/drei` for the scene, path, and camera rig. Build the path as a `CatmullRomCurve3` or similar spline; move the camera along it via `curve.getPointAt(scrollProgress)` with a slightly offset look-ahead target for a natural fly-through feel — do not just move a static camera in a straight line.
- **Scroll orchestration:** `GSAP` + `ScrollTrigger`, driving a single normalized `scrollProgress` (0–1) value that both the camera-rig and the DOM text panels subscribe to. Use `Lenis` for smooth-scroll so the 3D motion doesn't feel janky against native scroll.
- **Node lighting:** each checkpoint node is a small emissive sphere/icosahedron; animate its emissive intensity and a connecting `Line`/`TubeGeometry` glow from 0 to full as `scrollProgress` crosses its section's range — driven by GSAP tweening a uniform/material property, not by React re-renders every frame.
- **Performance guardrails (non-negotiable):**
  - Cap the path/scene to a modest budget: no more than ~12–15 checkpoint nodes, low-poly geometry, baked/`MeshStandardMaterial` lighting rather than heavy real-time shadows.
  - Detect low-end devices / `prefers-reduced-motion` and fall back to a static, non-3D version of the same content (a simple vertical timeline with CSS fade-ins) — never ship a broken/laggy 3D scene as the only option.
  - Lazy-load the Three.js canvas below the fold on mobile if first-paint budget is tight; keep Lighthouse performance score as a build acceptance criterion, not an afterthought.
  - Respect `prefers-reduced-motion`: disable camera easing/parallax, keep content but drop motion.
- **Assets:** no external 3D model files needed — build the path, nodes, and starfield procedurally in Three.js (keeps the repo small and load time fast).

## 5. Section-by-Section Content & Behavior

Write actual copy for every section below (don't ship lorem ipsum or placeholder brackets) — the copy given here is ready to use as-is or lightly edited.

**1. Hero (path begins, single dim node visible)**
- Headline: "An AI tutor that studies your syllabus. Not a generic one."
- Subhead: "For CBSE students, Classes VII–X. Every question, flashcard, and mock test comes from your actual chapters — not a library of everything."
- CTA: "See how it works" (scrolls down) + secondary "For tutors" (links to tutor-focused anchor)
- Behavior: camera sits at the path's starting point; the single starting node pulses gently; a thin unlit path stretches away into the dark ahead — implying the journey, not yet traveled.

**2. The problem (path visibly frayed/disconnected)**
- Headline: "Studying alone at 9 PM shouldn't mean guessing."
- Body: short, three-line description of doubts piling up, generic worksheets, no way to know if you're ready — written from the student's felt experience, not a feature list.
- Behavior: path here is deliberately dim, nodes scattered off-axis, not yet connected — visually *before* the product's structure exists.

**3–8. Feature checkpoints — one per node, in this order:**
Each gets: a short headline, one sentence of plain-language description, and a small embedded UI mockup (a simplified, static screenshot-style card, not another 3D object) floating beside the node as it lights up.

3. **Doubt Solving** — "Photograph a doubt. Get a hint before an answer." *(use the violet `--accent-signal` glow for this node — it's the AI-conversation moment)*
4. **Adaptive Practice** — "Every test set adjusts to what you actually get wrong."
5. **Spaced-Repetition Flashcards** — "Review exactly when you're about to forget — not before, not after."
6. **Readiness Score** — "Walk into a test knowing your number, not hoping."
7. **Tutor Dashboard** — "Your tutor sees the whole class's weak spots in one glance." *(brief aside acknowledging this is built by a working tutor, for tutors)*
8. **Parent Digest** — "A WhatsApp message every week — plain language, no login required."
- Behavior: as each section's scroll range is entered, that node's emissive glow ramps up and a glowing tube-line extends from the previous node to this one — the "constellation filling in" effect described in Section 2.

**9. Trust/safety beat**
- Headline: "Built for students, not around them."
- Short copy on: hints before answers (not a copy-paste machine), parent visibility by default, no public profiles or open chat for minors.
- Behavior: path passes through a calmer, slightly brighter clearing — a deliberate pacing break before the closing sections.

**10. Testimonial(s)**
- One or two short, plain quotes (write these as placeholder-but-realistic until you have real ones) from a student and a parent. Keep each under 30 words. Present as simple text over a softly blurred, mostly-dark background — no floating 3D card needed here, this section should feel calm.

**11. Pricing / CTA**
- Simple two-tier layout (Free / Student Pro) echoing the PRD's pricing section. Primary CTA: "Start free."
- Behavior: this is the final lit stretch of path — full brightness, all nodes connected behind the visitor, camera settling rather than still moving, giving a sense of arrival.

**12. Footer**
- Minimal: logo, one-line tagline, links (Product, For Tutors, Login, Signup), and a small note "Part of the TuitionTrack family" linking to the existing TuitionTrack site — reuse of that cross-link is intentional, it borrows trust from the live product.

## 6. Voice & Copy Rules

- Plain, concrete, sentence case. No "Unlock your potential," no "Revolutionize your learning journey," no exclamation marks.
- Every claim should be checkable/specific ("adjusts to what you get wrong," not "personalized learning at scale").
- CTAs describe exactly what happens: "Start free," "See how it works" — not "Get started" or "Learn more."

## 7. Responsive Behavior

- **Desktop (≥1024px):** canvas + camera-path on the right/background, text panels on the left, as described.
- **Tablet/mobile (<1024px):** collapse to canvas-as-full-bleed-background with text panels overlaid on a scrim (`rgba(15,18,38,0.55)`) for legibility; reduce node count rendered simultaneously for performance; disable parallax offset, keep the core light-up behavior since it's cheap.
- Test and ship a `prefers-reduced-motion` fallback as a first-class path, not an edge case (Section 4).

## 8. Acceptance Checklist (the agent should self-verify before calling this done)

- [ ] Camera moves along a curved spline path tied to scroll position, not a static viewpoint
- [ ] Nodes light up progressively and stay lit once passed (state persists on scroll-back-up too)
- [ ] No lorem ipsum, no bracketed placeholder text anywhere in shipped copy
- [ ] Lighthouse performance score checked on a throttled mobile profile; 3D scene has a non-3D fallback for `prefers-reduced-motion` and low-end devices
- [ ] Color/type tokens from Section 3 used exactly — no default cream/terracotta or dark/neon-green AI-site palette introduced
- [ ] All CTAs link somewhere real (even if to a placeholder `/signup` route) rather than being dead buttons
- [ ] Mobile layout tested at 375px width minimum
