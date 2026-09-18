import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import type { LessonScript } from "@/lib/ai/video";

// Remotion parity of public/videos/quadratic-explainer (HyperFrames, 18s GSAP).
// Same story, same copy, same timing: title 0-6s → formula 6-12s → CTA 12-18s.
// HyperFrames stays the deterministic file render; this is the interactive
// in-app preview + programmatic render path. All motion via useCurrentFrame.
//
// Props are a full LessonScript so /api/ai/video can render ANY concept as a
// 3D animation when AI-video providers are unavailable — defaults preserve
// the original quadratics lesson byte-for-byte.

export type QuadraticProps = { concept?: string; script?: Partial<LessonScript> };

const BG = "linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%)";
const LIGHT_BG = "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 60%, #f8fafc 100%)";

const DEFAULT_SCRIPT: LessonScript = {
  kicker: "TUITIONTRACK · MOTION LESSON",
  title: "Quadratics, visualized.",
  subtitle: "One shape. One formula. Full marks on any quadratic equation.",
  badge: "Class 9–10 algebra",
  durationLabel: "▶ 18 seconds",
  steps: [
    { tag: "STEP 1 · STANDARD FORM", body: "ax² + bx + c = 0" },
    { tag: "STEP 2 · DISCRIMINANT", body: "D = b² − 4ac" },
    { tag: "STEP 3 · FORMULA", body: "x = (−b ± √D) / 2a" },
  ],
  example: "Example: 2x² − 8 = 0 → x = ±2. Same three steps, every time.",
  ctaTitle: "Fix quadratics today.",
  ctaBody: "Start your highest-impact session — Tutor guides, Planner schedules.",
  videoPrompt: "",
};

function useScript(props: QuadraticProps): LessonScript {
  const s = props.script ?? {};
  const steps = s.steps?.length ? s.steps.slice(0, 4) : DEFAULT_SCRIPT.steps;
  return {
    kicker: s.kicker || DEFAULT_SCRIPT.kicker,
    title: s.title || DEFAULT_SCRIPT.title,
    subtitle: s.subtitle || DEFAULT_SCRIPT.subtitle,
    badge: props.concept || s.badge || DEFAULT_SCRIPT.badge,
    durationLabel: s.durationLabel || DEFAULT_SCRIPT.durationLabel,
    steps,
    example: s.example || DEFAULT_SCRIPT.example,
    ctaTitle: s.ctaTitle || DEFAULT_SCRIPT.ctaTitle,
    ctaBody: s.ctaBody || DEFAULT_SCRIPT.ctaBody,
    videoPrompt: s.videoPrompt || "",
  };
}

// ponytail: one helper, inline styles only (no animate-*/transition-* classes).
function rise(frame: number, start: number, dist = 28) {
  const opacity = interpolate(frame, [start, start + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [start, start + 15], [dist, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { opacity, transform: `translateY(${y}px)` };
}

function ParabolaAccent() {
  const frame = useCurrentFrame();
  const rotationY = frame * 0.02; // useCurrentFrame-driven (never useFrame)
  const { width, height } = useVideoConfig();
  return (
    <div style={{ position: "absolute", right: 40, top: 60, width: 300, height: 220, opacity: 0.9 }}>
      <ThreeCanvas width={300} height={220} style={{ width: 300, height: 220, background: "transparent" }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Sequence layout="none" from={0} durationInFrames={width + height}>
          <mesh rotation={[0.4, rotationY, 0]}>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="#a5b4fc" />
          </mesh>
        </Sequence>
      </ThreeCanvas>
    </div>
  );
}

function TitleScene({ script }: { script: LessonScript }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: BG, padding: 72, justifyContent: "center" }}>
      <ParabolaAccent />
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.22em", color: "#a5b4fc", ...rise(frame, 6) }}>
        {script.kicker}
      </div>
      <div style={{ fontSize: 84, fontWeight: 800, color: "#f8fafc", marginTop: 16, ...rise(frame, 12) }}>
        {script.title}
      </div>
      <div style={{ fontSize: 30, color: "#cbd5e1", marginTop: 20, maxWidth: 860, ...rise(frame, 21) }}>
        {script.subtitle}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 28, ...rise(frame, 30) }}>
        <span style={{ padding: "10px 18px", borderRadius: 999, fontSize: 20, background: "rgba(165,180,252,0.14)", border: "1px solid rgba(165,180,252,0.4)", color: "#e0e7ff" }}>
          {script.badge}
        </span>
        <span style={{ padding: "10px 18px", borderRadius: 999, fontSize: 20, background: "#f59e0b", color: "#0f172a", fontWeight: 800 }}>{script.durationLabel}</span>
      </div>
    </AbsoluteFill>
  );
}

function FormulaScene({ script }: { script: LessonScript }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: LIGHT_BG, padding: 72, justifyContent: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.18em", color: "#4f46e5", ...rise(frame, 4) }}>
        THE METHOD — {script.steps.length} STEPS
      </div>
      {script.steps.map((s, i) => (
        <div key={s.tag} style={{ marginTop: 14, padding: "18px 26px", borderRadius: 18, background: "rgba(255,255,255,0.95)", ...rise(frame, 12 + i * 27) }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#4f46e5", letterSpacing: "0.08em" }}>{s.tag}</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#0f172a" }}>{s.body}</div>
        </div>
      ))}
      <div style={{ fontSize: 26, color: "#334155", marginTop: 20, ...rise(frame, 100) }}>
        {script.example}
      </div>
    </AbsoluteFill>
  );
}

function CtaScene({ script }: { script: LessonScript }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: BG, padding: 72, justifyContent: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.18em", color: "#a5b4fc", ...rise(frame, 6) }}>
        MASTERY MOVES WHEN YOU PRACTICE
      </div>
      <div style={{ fontSize: 72, fontWeight: 800, color: "#fff", marginTop: 12, ...rise(frame, 12) }}>{script.ctaTitle}</div>
      <div style={{ fontSize: 28, color: "#cbd5e1", marginTop: 12, ...rise(frame, 21) }}>
        {script.ctaBody}
      </div>
      <div style={{ marginTop: 30, padding: "20px 40px", borderRadius: 16, background: "#4f46e5", color: "#fff", fontSize: 30, fontWeight: 800, width: "fit-content", ...rise(frame, 30) }}>
        Start highest-impact session →
      </div>
    </AbsoluteFill>
  );
}

export function QuadraticExplainer(props: QuadraticProps) {
  const script = useScript(props);
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={180}><TitleScene script={script} /></Sequence>
      <Sequence from={180} durationInFrames={180}><FormulaScene script={script} /></Sequence>
      <Sequence from={360} durationInFrames={180}><CtaScene script={script} /></Sequence>
    </AbsoluteFill>
  );
}
