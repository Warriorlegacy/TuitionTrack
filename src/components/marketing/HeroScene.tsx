"use client";

// Scene 1 — cinematic hero (Blueprint #73 Scene 1, vertical slice).
// Copy is exact per blueprint. 3D lazy via next/dynamic (ssr:false) + Suspense.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { GlassPanel, MagneticButton, MetricTicker } from "./ui";
import type { ScrollProgressRef } from "./KnowledgeSphere";

const KnowledgeSphere = dynamic(
  () => import("./KnowledgeSphere").then((m) => m.KnowledgeSphere),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto aspect-square w-full max-w-[300px] sm:max-w-[420px] lg:max-w-[520px]" aria-hidden>
        <Skeleton className="h-full w-full rounded-full bg-white/5" />
      </div>
    ),
  },
);

const fade = (reduce: boolean | null, delay: number) =>
  reduce
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.7, delay, ease: "easeOut" as const },
      };

export function HeroScene() {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef: ScrollProgressRef = useRef({ p: 0 });
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    scrollRef.current.p = v;
  });

  return (
    <section ref={sectionRef} aria-labelledby="scene1-title" className="tt-hero-bg relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-32 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-40">
        <div>
          <motion.p
            {...fade(reduce, 0)}
            className="tt-mono-label inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] text-tt-accent"
          >
            TuitionTrack AI · Exam readiness loop
          </motion.p>
          <motion.h1
            {...fade(reduce, 0.08)}
            id="scene1-title"
            className="tt-display mt-6 text-4xl font-semibold leading-[1.05] text-white sm:text-5xl lg:text-6xl"
          >
            Your next exam is not a deadline. It is a system we can prepare for.
          </motion.h1>
          <motion.p {...fade(reduce, 0.16)} className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            TuitionTrack turns tuition, AI tutoring, practice, revision, testing and progress into one adaptive
            learning loop.
          </motion.p>
          <motion.div {...fade(reduce, 0.24)} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <MagneticButton href="/signup">Start preparing</MagneticButton>
            <Link
              href="/ai#how"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "tt-focus h-12 rounded-tt-md border-white/20 bg-transparent px-7 text-base text-white hover:bg-white/10 hover:text-white",
              )}
            >
              See how it works
            </Link>
          </motion.div>
          <motion.p {...fade(reduce, 0.32)} className="tt-mono-label mt-8 text-[11px] text-slate-500">
            CBSE · ICSE · State boards · JEE · NEET
          </motion.p>
        </div>

        <motion.div {...fade(reduce, 0.2)} className="relative">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -z-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tt-accent/15 blur-[90px]" aria-hidden />
          <KnowledgeSphere scrollRef={scrollRef} />
        </motion.div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <GlassPanel className="p-7 sm:p-9" data-reveal>
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
    </section>
  );
}
