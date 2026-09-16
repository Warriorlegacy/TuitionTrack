"use client";

// Shared low-cost helpers for /ai Scenes 3–12 (Blueprint #75).
// ponytail: one kit file so 10 scenes share IO + WebGL + mobile checks. No new deps.

import { useEffect, useState } from "react";

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function useWebGL(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setOk(!!(c.getContext("webgl2") ?? c.getContext("webgl")));
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

// IntersectionObserver gate: render Canvas only near viewport, pause when hidden.
// ponytail: callback ref (not useRef<T>) so one ref fits <div> and <svg> fallbacks.
export function useSceneActive(margin = "240px") {
  const [el, setEl] = useState<Element | null>(null);
  const [inView, setInView] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [margin, el]);
  return { ref: setEl, running: inView && !hidden, inView };
}
