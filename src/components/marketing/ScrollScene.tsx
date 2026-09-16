"use client";

// ScrollScene: buttery Lenis scroll + GSAP ScrollTrigger reveals for /ai only.
// ponytail: dynamic-imports keep gsap/lenis out of the initial bundle; full skip on reduced motion.

import { useEffect } from "react";
import { useReducedMotion } from "framer-motion";

export function ScrollScene({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let lenis: InstanceType<typeof import("lenis").default> | null = null;
    let cancelled = false;

    (async () => {
      try {
        const [{ default: Lenis }, gsapMod, stMod] = await Promise.all([
          import("lenis"),
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
        if (cancelled) return;
        const gsap = gsapMod.default;
        const { ScrollTrigger } = stMod;
        gsap.registerPlugin(ScrollTrigger);

        lenis = new Lenis({ lerp: 0.11, smoothWheel: true });
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => {
          lenis?.raf(time);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          gsap.fromTo(
            el,
            { y: 28, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.7,
              ease: "power2.out",
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            },
          );
        });
      } catch {
        // Scroll effects are progressive enhancement — content stays fully usable.
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      lenis?.destroy();
      import("gsap/ScrollTrigger")
        .then(({ ScrollTrigger }) => ScrollTrigger.getAll().forEach((t) => t.kill()))
        .catch(() => {});
    };
  }, [reduce]);

  return <>{children}</>;
}
