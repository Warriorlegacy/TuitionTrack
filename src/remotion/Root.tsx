import { Composition, Still } from "remotion";
import { QuadraticExplainer } from "./QuadraticExplainer";
import { ALL_LESSONS, resolveScript } from "../lib/learn/video-catalog";

// Remotion entry: one composition per catalog lesson (class-wise, Classes
// 6–12) plus the original QuadraticExplainer. Every composition renders the
// same LessonScript object that scripts/make-lesson-videos.ts bakes into the
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
