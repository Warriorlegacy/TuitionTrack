import { Composition, Still } from "remotion";
import { QuadraticExplainer } from "./QuadraticExplainer";
import { ALL_LESSONS, resolveScript } from "../lib/learn/video-catalog";

// Remotion entry: one composition per catalog lesson (class-wise, Classes
// 6–12) plus the original QuadraticExplainer. Default props stay on the
// deterministic hook (bundle-safe: no node:fs in the Studio bundle); the
// in-app player receives the researched full-topic script as a prop from the
// server page and sizes itself via lessonDurationFrames, and
// scripts/make-lesson-videos.ts bakes the same full script into the
// HyperFrames file render — both engines, one story.
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="QuadraticExplainer"
        component={QuadraticExplainer}
        durationInFrames={540}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{ concept: "Class 9–10 algebra" }}
      />
      {ALL_LESSONS.map((lessonItem) => (
        <Composition
          key={lessonItem.slug}
          id={lessonItem.slug}
          component={QuadraticExplainer}
          durationInFrames={540}
          fps={30}
          width={1280}
          height={720}
          defaultProps={{ script: resolveScript(lessonItem) }}
        />
      ))}
      <Still id="QuadraticThumbnail" component={QuadraticExplainer} width={1280} height={720} defaultProps={{ concept: "Class 9–10 algebra" }} />
    </>
  );
}
