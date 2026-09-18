import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { ParabolaAccent } from "./QuadraticExplainer";
import type { LessonScript } from "@/lib/ai/video";

// 1-hour one-shot lesson player: one Sequence per researched voice segment
// (~5 min each) plus a 6s CTA tail. In-app <Player> plays this directly (no
// Studio registration needed); voice comes from the narration hook in
// remotion-lesson-player.tsx (browser speechSynthesis, zero cost).
// Mirrors scripts/make-extended-videos.ts section timing exactly.

export const EXTENDED_FPS = 30;

export function extendedDurationFrames(script?: Partial<LessonScript>): number {
  const segs = script?.segments?.slice(0, 16) ?? [];
  if (!segs.length) return 540;
  return segs.reduce((n, s) => n + Math.max(1, Math.round((Number(s.minutes) || 5) * 60 * EXTENDED_FPS)), 0) + 180;
}

// ponytail: one helper, inline styles only.
function rise(frame: number, start: number, dist = 28) {
  const opacity = interpolate(frame, [start, start + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [start, start + 15], [dist, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { opacity, transform: `translateY(${y}px)` };
}

const BG = "linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%)";
const LIGHT_BG = "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 60%, #f8fafc 100%)";

function SegmentScene({
  index,
  total,
  segment,
}: {
  index: number;
  total: number;
  segment: NonNullable<LessonScript["segments"]>[number];
}) {
  const frame = useCurrentFrame();
  const dark = index % 2 === 0;
  return (
    <AbsoluteFill style={{ background: dark ? BG : LIGHT_BG, padding: 64, justifyContent: "center" }}>
      {dark ? <ParabolaAccent /> : null}
      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.2em", color: dark ? "#a5b4fc" : "#4f46e5", ...rise(frame, 4) }}>
        PART {index + 1} OF {total} · ~{segment.minutes} MIN
      </div>
      <div style={{ fontSize: 64, fontWeight: 800, color: dark ? "#fff" : "#0f172a", marginTop: 10, maxWidth: 1050, ...rise(frame, 12) }}>
        {segment.heading}
      </div>
      {segment.points.slice(0, 5).map((p, i) => (
        <div
          key={p}
          style={{
            marginTop: 10, padding: "12px 22px", borderRadius: 14, maxWidth: 1050,
            background: dark ? "rgba(165,180,252,0.12)" : "rgba(255,255,255,0.95)",
            fontSize: 26, fontWeight: 600, color: dark ? "#e0e7ff" : "#0f172a",
            ...rise(frame, 30 + i * 45),
          }}
        >
          • {p}
        </div>
      ))}
      <div style={{ fontSize: 21, fontStyle: "italic", color: dark ? "#a5b4fc" : "#4f46e5", marginTop: 18, ...rise(frame, 260) }}>
        🎬 {segment.visual}
      </div>
      <div style={{ position: "absolute", bottom: 28, left: 64, right: 64, height: 6, borderRadius: 3, background: dark ? "rgba(255,255,255,0.15)" : "rgba(15,23,42,0.12)" }}>
        <div style={{ width: `${((index + 1) / total) * 100}%`, height: "100%", borderRadius: 3, background: "#f59e0b" }} />
      </div>
    </AbsoluteFill>
  );
}

function ExtendedCta({ script }: { script: LessonScript }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: BG, padding: 72, justifyContent: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.18em", color: "#a5b4fc", ...rise(frame, 6) }}>
        FULL CHAPTER COMPLETE
      </div>
      <div style={{ fontSize: 68, fontWeight: 800, color: "#fff", marginTop: 12, ...rise(frame, 12) }}>{script.ctaTitle}</div>
      <div style={{ fontSize: 28, color: "#cbd5e1", marginTop: 12, ...rise(frame, 21) }}>{script.ctaBody}</div>
    </AbsoluteFill>
  );
}

export function ExtendedLesson({ script }: { script: LessonScript }) {
  const segments = script.segments?.slice(0, 16) ?? [];
  if (!segments.length) {
    return (
      <AbsoluteFill style={{ background: BG, padding: 72, justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: "#fff" }}>Full 1-hour lesson is being prepared.</div>
        <div style={{ fontSize: 24, color: "#cbd5e1", marginTop: 12 }}>Play the chapter preview meanwhile.</div>
      </AbsoluteFill>
    );
  }
  let from = 0;
  const blocks = segments.map((s) => {
    const dur = Math.max(1, Math.round((Number(s.minutes) || 5) * 60 * EXTENDED_FPS));
    const b = { s, from, dur };
    from += dur;
    return b;
  });
  return (
    <AbsoluteFill>
      {blocks.map((b, i) => (
        <Sequence key={b.s.heading} from={b.from} durationInFrames={b.dur}>
          <SegmentScene index={i} total={blocks.length} segment={b.s} />
        </Sequence>
      ))}
      <Sequence from={from} durationInFrames={180}>
        <ExtendedCta script={script} />
      </Sequence>
    </AbsoluteFill>
  );
}
