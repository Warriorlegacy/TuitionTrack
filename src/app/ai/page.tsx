import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { tokens } from "@/lib/tokens";
import { HeroScene } from "@/components/marketing/HeroScene";
import { ScrollScene } from "@/components/marketing/ScrollScene";
import { Footer, GlassPanel, MetricTicker, Navbar, SectionHeading } from "@/components/marketing/ui";
import { Skeleton } from "@/components/ui/skeleton";

// Below-fold route splitting: every Scene ships in its own chunk, hero stays lean (LCP<2.5s).
// Scene bodies are SSR (SEO-readable mocks); only their R3F canvases are ssr:false inside.
const Scene2NextStep = dynamic(
  () => import("@/components/marketing/Scene2NextStep").then((m) => m.Scene2NextStep),
  { loading: () => <Skeleton className="min-h-[320px] w-full rounded-tt-lg" /> },
);
const Scene3TutorConversation = dynamic(
  () => import("@/components/marketing/Scene3TutorConversation").then((m) => m.Scene3TutorConversation),
  { loading: () => <Skeleton className="min-h-[280px] w-full rounded-tt-lg" /> },
);
const Scene4KnowledgeGraph = dynamic(
  () => import("@/components/marketing/Scene4KnowledgeGraph").then((m) => m.Scene4KnowledgeGraph),
  { loading: () => <Skeleton className="min-h-[280px] w-full rounded-tt-lg" /> },
);
const Scene5ExamSimulator = dynamic(
  () => import("@/components/marketing/Scene5ExamSimulator").then((m) => m.Scene5ExamSimulator),
  { loading: () => <Skeleton className="min-h-[300px] w-full rounded-tt-lg" /> },
);
const Scene6MistakeVault = dynamic(
  () => import("@/components/marketing/Scene6MistakeVault").then((m) => m.Scene6MistakeVault),
  { loading: () => <Skeleton className="min-h-[220px] w-full rounded-tt-lg" /> },
);
const Scene7RevisionTimeline = dynamic(
  () => import("@/components/marketing/Scene7RevisionTimeline").then((m) => m.Scene7RevisionTimeline),
  { loading: () => <Skeleton className="min-h-[280px] w-full rounded-tt-lg" /> },
);
const Scene8TeacherCockpit = dynamic(
  () => import("@/components/marketing/Scene8TeacherCockpit").then((m) => m.Scene8TeacherCockpit),
  { loading: () => <Skeleton className="min-h-[260px] w-full rounded-tt-lg" /> },
);
const Scene9ParentReport = dynamic(
  () => import("@/components/marketing/Scene9ParentReport").then((m) => m.Scene9ParentReport),
  { loading: () => <Skeleton className="min-h-[280px] w-full rounded-tt-lg" /> },
);
const Scene10Countdown = dynamic(
  () => import("@/components/marketing/Scene10Countdown").then((m) => m.Scene10Countdown),
  { loading: () => <Skeleton className="min-h-[260px] w-full rounded-tt-lg" /> },
);
const Scene11TrustBoundaries = dynamic(
  () => import("@/components/marketing/Scene11TrustBoundaries").then((m) => m.Scene11TrustBoundaries),
  { loading: () => <Skeleton className="min-h-[180px] w-full rounded-tt-lg" /> },
);
const Scene12FinalCTA = dynamic(
  () => import("@/components/marketing/Scene12FinalCTA").then((m) => m.Scene12FinalCTA),
  { loading: () => <div className="bg-tt-hero px-4 py-24" aria-hidden><Skeleton className="mx-auto max-w-4xl bg-white/5 p-14" /></div> },
);

const SITE = "https://tuitiontrack-app.vercel.app";

export const metadata: Metadata = {
  title: "TuitionTrack AI — From Tuition Class to Exam Readiness",
  description:
    "TuitionTrack turns tuition, AI tutoring, practice, revision, testing and progress into one adaptive learning loop for CBSE, ICSE, State boards, JEE and NEET.",
  keywords: ["exam readiness", "AI tutor India", "CBSE preparation", "JEE NEET practice", "tuition management", "adaptive learning"],
  alternates: { canonical: `${SITE}/ai` },
  openGraph: {
    type: "website",
    url: `${SITE}/ai`,
    siteName: "TuitionTrack AI",
    title: "Your next exam is not a deadline. It is a system we can prepare for.",
    description:
      "Diagnose → Learn → Practice → Retrieve → Test → Analyze → Repair → Re-test → Master → Maintain. One adaptive loop.",
    images: [{ url: `${SITE}/og-ai.svg`, width: 1200, height: 630, alt: "TuitionTrack AI knowledge sphere" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TuitionTrack AI — From tuition class to exam readiness",
    description: "One adaptive learning loop: tuition, AI tutoring, practice, revision, testing and progress.",
    images: [`${SITE}/og-ai.svg`],
  },
};

function Slice({
  id,
  eyebrow,
  title,
  sub,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="tt-ivory-bg scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div data-reveal>
          {/* SectionHeading renders h2; wire its id via wrapper span for aria-labelledby */}
          <span id={`${id}-title`} className="sr-only">{title}</span>
          <SectionHeading eyebrow={eyebrow} title={title} sub={sub} align="left" />
        </div>
        <div className="mt-10" data-reveal>{children}</div>
      </div>
    </section>
  );
}

export default function AiMarketingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TuitionTrack AI",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web, iOS, Android",
    audience: { "@type": "Audience", geographicArea: "IN" },
    description:
      "Adaptive exam-readiness loop connecting tuition, AI tutoring, practice, revision, testing and progress.",
    url: `${SITE}/ai`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };

  return (
    <ScrollScene>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-tt-sm focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-slate-950">
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <HeroScene />

        {/* Learning loop strip */}
        <section id="loop" aria-labelledby="loop-title" className="tt-ivory-bg tt-section scroll-mt-20 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div data-reveal>
              <span id="loop-title" className="sr-only">Diagnose to master. Then maintain.</span>
              <SectionHeading
                align="left"
                eyebrow="The closed loop"
                title="Diagnose to master. Then maintain."
                sub="Every object is connected — syllabus node, class notes, practice, mistake, mastery score, revision card, re-test, parent summary."
              />
            </div>
            <ol className="mt-10 flex flex-wrap gap-2.5" aria-label="Learning loop stages" data-reveal>
              {tokens.loop.map((stage, i) => (
                <li
                  key={stage}
                  className="tt-mono-label rounded-full border border-slate-300 bg-white px-4 py-2 text-[11px] text-slate-700 shadow-sm"
                >
                  <span className="tt-tnum mr-2 text-primary">{String(i + 1).padStart(2, "0")}</span>
                  {stage}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Slice id="how" eyebrow="Scene 02 · Know what to do next" title="Stop asking “What should I study?”" sub="A live-looking plan from real signals: weak topic, recommendation, practice, repair, rising mastery.">
          <Scene2NextStep />
        </Slice>

        <Slice id="tutor" eyebrow="Scene 03 · Socratic tutor" title="AI that teaches, not answers" sub="Hints before solutions. The AI asks the next question instead of dumping the answer.">
          <Scene3TutorConversation />
        </Slice>

        <Slice id="graph" eyebrow="Scene 04 · Root-cause graph" title="Every mistake has a root" sub="Exam → Physics → Mechanics → Kinematics → Relative Motion. Amber marks the weak prerequisite — the AI backtracks there first.">
          <Scene4KnowledgeGraph />
        </Slice>

        <Slice id="exam" eyebrow="Scene 05 · Adaptive tests" title="Your next test changes because of your last test" sub="Miss Q6, Q7 adapts down and the slip lands in the Vault. Ace it, difficulty steps up.">
          <Scene5ExamSimulator />
        </Slice>

        <Slice id="vault" eyebrow="Scene 06 · Mistake Vault" title="Every slip gets a repair" sub="Careless · Concept · Formula · Time · Misread — 35 slips catalogued, each with a concrete repair ritual.">
          <Scene6MistakeVault />
        </Slice>

        <Slice id="revision" eyebrow="Scene 07 · Spaced revision" title="Review before you forget" sub="8 due now · 21 in 3 days · 36 in 7 days. Forgetting-curve timed, 10 minutes a day keeps the orbit stable.">
          <Scene7RevisionTimeline />
        </Slice>

        <Slice id="teacher" eyebrow="Scene 08 · Teacher cockpit" title="One glance, whole class" sub="124 students · 11 at risk · 27 improved · 82% average. One click assigns the 12-question remedial drill.">
          <Scene8TeacherCockpit />
        </Slice>

        <Slice id="parent" eyebrow="Scene 09 · Parent report" title="Parents need clarity, not anxiety" sub="Algebra 71→83% · readiness 78%. Plain language: what improved, what's next, how to help.">
          <Scene9ParentReport />
        </Slice>

        <Slice id="countdown" eyebrow="Scene 10 · Exam countdown" title="14 days, fully decomposed" sub="9 topics · 4 mocks · 65 revisions. Every day has one focus — pick a day to see its load.">
          <Scene10Countdown />
        </Slice>

        <Slice id="trust" eyebrow="Scene 11 · Trust & boundaries" title="Secure by role, grounded by design" sub="Students see their loop, teachers see their classes, AI cites syllabus nodes — no PII on this page.">
          <Scene11TrustBoundaries />
        </Slice>

        <section id="cta" aria-labelledby="cta-title" className="scroll-mt-20">
          <Scene12FinalCTA />
        </section>

        {/* Proof strip retained under CTA for continuity */}
        <div className="bg-tt-hero px-4 pb-20 sm:px-6">
          <GlassPanel className="mx-auto max-w-4xl p-7 sm:p-9" data-reveal>
            <MetricTicker
              items={[
                { value: 83, suffix: "%", label: "Algebra mastery after repair", caption: "Sample learner · Class 10" },
                { value: 15, suffix: " min", label: "Daily high-impact practice", caption: "Adaptive, not endless" },
                { value: 9, suffix: "", label: "Priority topics this week", caption: "Ranked by exam weight" },
              ]}
            />
            <p className="mt-6 text-xs text-slate-500">Sample data for illustration — your diagnostic replaces it.</p>
          </GlassPanel>
        </div>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </ScrollScene>
  );
}
