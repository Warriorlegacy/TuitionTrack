// Single source of truth — TuitionTrack AI marketing design tokens.
// Blueprint #77. Consume via CSS vars (no magic numbers in components).
// Colors live in globals.css (:root --tt-*); radius/spacing mirrored here for TS use.

export const tokens = {
  radius: {
    sm: "12px",
    md: "18px",
    lg: "28px",
    xl: "40px",
  },
  spacing: {
    section: "clamp(80px, 12vw, 180px)",
  },
  color: {
    hero: "#060B1A",
    heroDeep: "#0B1437",
    ivory: "#FAF7F1",
    ink: "#0A0F22",
    accent: "#6B97FF",
    amber: "#F5A524",
  },
  // Closed learning loop (thesis: "From tuition class to exam readiness")
  loop: [
    "Diagnose",
    "Learn",
    "Practice",
    "Retrieve",
    "Test",
    "Analyze",
    "Repair",
    "Re-test",
    "Master",
    "Maintain",
  ] as const,
} as const;

export const cssVar = {
  radiusSm: "var(--tt-radius-sm)",
  radiusMd: "var(--tt-radius-md)",
  radiusLg: "var(--tt-radius-lg)",
  radiusXl: "var(--tt-radius-xl)",
  sectionGap: "var(--tt-section-gap)",
} as const;

export type LoopStage = (typeof tokens.loop)[number];
