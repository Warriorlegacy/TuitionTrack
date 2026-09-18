"use client";

// In-app lesson player. Short hook (RemotionLessonPlayer path) or the 1-hour
// one-shot (ExtendedLesson) when the script carries researched voice segments.
// Voice is browser speechSynthesis — zero cost, zero keys. Duration follows
// the script: 18s hook (+10s/topic), or ~60 min extended (see duration fns).

import { useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { QuadraticExplainer, lessonDurationFrames } from "@/remotion/QuadraticExplainer";
import { ExtendedLesson, extendedDurationFrames } from "@/remotion/ExtendedLesson";
import type { LessonScript } from "@/lib/ai/video";

// Sentence-chunked speech (long single utterances get cut by browsers).
function speak(text: string): void {
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const parts = text.match(/[^.!?]+[.!?]+/g) ?? [text];
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang.startsWith("en-IN")) ?? voices.find((v) => v.lang.startsWith("en"));
    for (const part of parts.slice(0, 80)) {
      const u = new SpeechSynthesisUtterance(part.trim().slice(0, 400));
      if (voice) u.voice = voice;
      synth.speak(u);
    }
  } catch { /* voice is best-effort — video plays on */ }
}

function segmentAt(script: LessonScript, frame: number): number {
  const segs = script.segments?.slice(0, 16) ?? [];
  let acc = 0;
  const t = frame / 30;
  for (let i = 0; i < segs.length; i++) {
    acc += (Number(segs[i].minutes) || 5) * 60;
    if (t < acc) return i;
  }
  return Math.max(0, segs.length - 1);
}

function useVoice(script: LessonScript | undefined, active: boolean, playerRef: React.RefObject<PlayerRef | null>): void {
  const spoken = useRef(-1);
  useEffect(() => {
    if (!active || !script?.segments?.length) {
      try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
      spoken.current = -1;
      return;
    }
    const tick = setInterval(() => {
      const frame = playerRef.current?.getCurrentFrame() ?? 0;
      const idx = segmentAt(script, frame);
      if (idx !== spoken.current) {
        spoken.current = idx;
        speak(script.segments![idx].narration);
      }
    }, 1000);
    // Chrome pauses long speech after ~15s unless resumed.
    const keep = setInterval(() => {
      try { if (window.speechSynthesis?.speaking) window.speechSynthesis.resume(); } catch { /* noop */ }
    }, 10000);
    return () => {
      clearInterval(tick);
      clearInterval(keep);
      try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    };
  }, [active, script, playerRef]);
}

export function RemotionLessonPlayer({ concept, script }: { concept?: string; script?: LessonScript }) {
  const extended = (script?.segments?.length ?? 0) >= 2;
  const playerRef = useRef<PlayerRef | null>(null);
  const [voice, setVoice] = useState(false);
  useVoice(script, extended && voice, playerRef);

  if (extended && script) {
    const total = script.totalMinutes ?? script.segments!.reduce((n, s) => n + (Number(s.minutes) || 5), 0);
    return (
      <div className="overflow-hidden rounded-tt-md ring-1 ring-white/20">
        <div className="flex flex-wrap items-center gap-3 bg-slate-950 px-4 py-2.5 text-sm text-slate-200">
          <span className="font-semibold">1-hour lesson · ~{total} min · {script.segments!.length} parts</span>
          <button
            type="button"
            onClick={() => setVoice((v) => !v)}
            aria-pressed={voice}
            className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
          >
            {voice ? "🔊 Narration on" : "🔇 Narration off"}
          </button>
        </div>
        <Player
          ref={playerRef}
          component={ExtendedLesson}
          inputProps={{ script }}
          durationInFrames={extendedDurationFrames(script)}
          fps={30}
          compositionWidth={1280}
          compositionHeight={720}
          controls
          clickToPlay
          acknowledgeRemotionLicense
          style={{ width: "100%", aspectRatio: "16 / 9" }}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-tt-md ring-1 ring-white/20">
      <Player
        component={QuadraticExplainer}
        inputProps={{ concept, script }}
        durationInFrames={lessonDurationFrames(script)}
        fps={30}
        compositionWidth={1280}
        compositionHeight={720}
        controls
        loop
        clickToPlay
        acknowledgeRemotionLicense
        style={{ width: "100%", aspectRatio: "16 / 9" }}
      />
    </div>
  );
}
