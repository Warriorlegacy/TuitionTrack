"use client";

// In-app Remotion preview. HyperFrames stays the file render
// (public/videos/<slug>); this is the interactive path.

import { Player } from "@remotion/player";
import { QuadraticExplainer } from "@/remotion/QuadraticExplainer";
import type { LessonScript } from "@/lib/ai/video";

export function RemotionLessonPlayer({ concept, script }: { concept?: string; script?: LessonScript }) {
  return (
    <div className="overflow-hidden rounded-tt-md ring-1 ring-white/20">
      <Player
        component={QuadraticExplainer}
        inputProps={{ concept, script }}
        durationInFrames={540}
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
