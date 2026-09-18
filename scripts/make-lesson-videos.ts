// Emits one HyperFrames file render per catalog lesson:
//   public/videos/<slug>/index.html  (1280×720, GSAP, 18s hook + 10s per
//   researched topic)
//
// Same story contract as the Remotion composition (title 0–6s → steps
// 6–12s → topics 10s each → CTA 6s) from the same full-topic LessonScript
// object (researched JSON when present, deterministic hook otherwise) — both
// engines stay in sync by construction. Run:  npx tsx scripts/make-lesson-videos.ts
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_LESSONS } from "../src/lib/learn/video-catalog";
import { resolveFullScript } from "../src/lib/learn/lesson-research";
import type { LessonScript } from "../src/lib/ai/video";

// Slugs with a MoneyPrinterTurbo narrated mp4 (see docs/MONEYPRINTER_SETUP.md)
// get a watch link baked into the file render.
function narratedSlugs(): Set<string> {
  try {
    const p = join(process.cwd(), "public", "videos", "manifest.json");
    if (!existsSync(p)) return new Set();
    const m = JSON.parse(readFileSync(p, "utf8")) as Record<string, { narrated?: boolean }>;
    return new Set(Object.entries(m).filter(([, v]) => v?.narrated).map(([k]) => k));
  } catch {
    return new Set();
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function renderLesson(slug: string, script: LessonScript, hasNarrated: boolean): string {
  const n = script.steps.length;
  const gap = n <= 3 ? 0.9 : 0.7;
  const topics = script.topics?.slice(0, 5) ?? [];
  const total = 18 + topics.length * 10; // title 6 + steps 6 + topics 10 each + CTA 6
  const runtimeLabel = topics.length ? `▶ ${total} seconds · full chapter` : script.durationLabel;
  const stepLines = script.steps
    .map(
      (s, i) =>
        `       tl.from("#qe-step${i + 1}", { y: 28, opacity: 0, duration: 0.5, ease: "power3.out" }, ${(6.5 + i * gap).toFixed(2)});`,
    )
    .join("\n");
  const workedAt = (6.5 + n * gap + 0.4).toFixed(2);
  const stepDivs = script.steps
    .map(
      (s, i) => `<div id="qe-step${i + 1}" class="qe-step"><small>${esc(s.tag)}</small>${esc(s.body)}</div>`,
    )
    .join("\n            ");

  // Topic scenes: title 0–6, steps 6–12, topics 12+10i, CTA last 6s.
  const ctaStart = 12 + topics.length * 10;
  const topicSections = topics
    .map((t, i) => {
      const start = 12 + i * 10;
      const bullets = t.bullets
        .slice(0, 3)
        .map((b, j) => `<div id="qe-t${i}-b${j}" class="qe-bullet">• ${esc(b)}</div>`)
        .join("\n              ");
      const theme = i % 2 ? "" : " qe-fill-light";
      return `      <!-- Topic ${i + 1} (${start}–${start + 10}s): ${esc(t.heading)} -->
      <section id="qe-clip-topic${i + 1}" class="clip" data-start="${start}" data-duration="10" data-track-index="1">
        <div class="qe-fill${theme}">
          <span id="qe-t${i}-kicker" class="qe-kicker">Topic ${i + 1} · ${esc(t.heading)}</span>
          <h2 id="qe-t${i}-title" class="qe-topic">${esc(t.heading)}</h2>
          <p id="qe-t${i}-explain" class="qe-sub">${esc(t.explain)}</p>
          <div class="qe-steps">
              ${bullets}
          </div>
          <p id="qe-t${i}-example" class="qe-example">${esc(t.example)}</p>
        </div>
      </section>`;
    })
    .join("\n");
  const topicTimelines = topics
    .map((t, i) => {
      const start = 12 + i * 10;
      const bulletLines = t.bullets
        .slice(0, 3)
        .map((_, j) => `       tl.from("#qe-t${i}-b${j}", { y: 20, opacity: 0, duration: 0.45, ease: "power3.out" }, ${(start + 2.6 + j * 0.9).toFixed(2)});`)
        .join("\n");
      return `      tl.from("#qe-t${i}-kicker", { y: 24, opacity: 0, duration: 0.5, ease: "power3.out" }, ${(start + 0.2).toFixed(2)});
      tl.from("#qe-t${i}-title", { y: 36, opacity: 0, duration: 0.6, ease: "power3.out" }, ${(start + 0.4).toFixed(2)});
      tl.from("#qe-t${i}-explain", { y: 24, opacity: 0, duration: 0.5, ease: "power3.out" }, ${(start + 0.9).toFixed(2)});
${bulletLines}
      tl.from("#qe-t${i}-example", { y: 20, opacity: 0, duration: 0.5, ease: "power3.out" }, ${(start + 5.8).toFixed(2)});`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1280, height=720" />
    <title>${esc(script.title)} — TuitionTrack Motion Lesson</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0b0f14;
        color: #f8fafc;
        font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      #root {
        position: relative;
        width: 1280px;
        height: 720px;
        overflow: hidden;
      }
      .clip {
        position: absolute;
        inset: 0;
      }
      .qe-fill {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 72px 88px;
        box-sizing: border-box;
        background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%);
      }
      .qe-fill-light {
        background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 60%, #f8fafc 100%);
        color: #0f172a;
      }
      .qe-kicker {
        display: block;
        width: fit-content;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: #a5b4fc;
      }
      .qe-fill-light .qe-kicker { color: #4f46e5; }
      .qe-title {
        display: block;
        width: 100%;
        max-width: 1000px;
        margin: 16px 0 0;
        font-size: 84px;
        line-height: 1.02;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .qe-sub {
        display: block;
        width: 100%;
        max-width: 860px;
        margin: 20px 0 0;
        font-size: 30px;
        line-height: 1.4;
        color: #cbd5e1;
      }
      .qe-fill-light .qe-sub { color: #334155; }
      .qe-chips {
        display: flex;
        gap: 12px;
        margin-top: 28px;
      }
      .qe-chip {
        display: inline-block;
        padding: 10px 18px;
        border-radius: 999px;
        font-size: 20px;
        font-weight: 600;
        background: rgba(165, 180, 252, 0.14);
        border: 1px solid rgba(165, 180, 252, 0.4);
        color: #e0e7ff;
      }
      .qe-steps { display: block; width: 100%; margin-top: 24px; }
      .qe-step {
        display: block;
        width: 100%;
        box-sizing: border-box;
        margin-top: 14px;
        padding: 18px 26px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.92);
        color: #0f172a;
        font-size: 34px;
        font-weight: 700;
      }
      .qe-step small {
        display: block;
        font-size: 19px;
        font-weight: 600;
        color: #4f46e5;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .qe-topic {
        display: block;
        width: 100%;
        max-width: 1000px;
        margin: 12px 0 0;
        font-size: 56px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.01em;
      }
      .qe-bullet {
        display: block;
        width: 100%;
        box-sizing: border-box;
        margin-top: 10px;
        padding: 12px 22px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.92);
        color: #0f172a;
        font-size: 25px;
        font-weight: 600;
      }
      .qe-example {
        display: block;
        width: 100%;
        max-width: 980px;
        margin: 16px 0 0;
        font-size: 24px;
        font-style: italic;
        color: #4f46e5;
      }
      .qe-cta {
        display: block;
        width: fit-content;
        margin-top: 30px;
        padding: 20px 40px;
        border-radius: 16px;
        background: #4f46e5;
        color: #fff;
        font-size: 30px;
        font-weight: 800;
      }
      .qe-badge {
        display: inline-block;
        padding: 8px 16px;
        border-radius: 999px;
        background: #f59e0b;
        color: #0f172a;
        font-size: 20px;
        font-weight: 800;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="${esc(slug)}"
      data-start="0"
      data-width="1280"
      data-height="720"
      data-duration="${total}"
    >
      <!-- Clip 1 (0–6s): title -->
      <section id="qe-clip-title" class="clip" data-start="0" data-duration="6" data-track-index="1">
        <div class="qe-fill">
          <span id="qe-kicker" class="qe-kicker">${esc(script.kicker)}</span>
          <h1 id="qe-title" class="qe-title">${esc(script.title)}</h1>
          <p id="qe-sub" class="qe-sub">${esc(script.subtitle)}</p>
          <div id="qe-chips" class="qe-chips">
            <span class="qe-chip">${esc(script.badge)}</span>
            <span class="qe-chip">${topics.length ? `${topics.length} topics` : "18 seconds"}</span>
            <span id="qe-badge" class="qe-badge">${esc(runtimeLabel)}</span>
          </div>
        </div>
      </section>

      <!-- Clip 2 (6–12s): steps build -->
      <section id="qe-clip-formula" class="clip" data-start="6" data-duration="6" data-track-index="1">
        <div class="qe-fill qe-fill-light">
          <span id="qe-f2-kicker" class="qe-kicker">The method — ${n} steps</span>
          <div id="qe-steps" class="qe-steps">
            ${stepDivs}
          </div>
          <p id="qe-worked" class="qe-sub">${esc(script.example)}</p>
        </div>
      </section>

${topicSections}

      <!-- Final clip (${ctaStart}–${ctaStart + 6}s): mastery CTA -->
      <section id="qe-clip-cta" class="clip" data-start="${ctaStart}" data-duration="6" data-track-index="1">
        <div class="qe-fill">
          <span id="qe-f3-kicker" class="qe-kicker">Mastery moves when you practice</span>
          <h2 id="qe-f3-title" class="qe-title">${esc(script.ctaTitle)}</h2>
          <p id="qe-f3-sub" class="qe-sub">${esc(script.ctaBody)}</p>
          <span id="qe-f3-cta" class="qe-cta">Start highest-impact session →</span>
          ${hasNarrated ? `<a class="qe-cta" style="background:#059669" href="./narrated.mp4">▶ Watch narrated version</a>` : ""}
        </div>
      </section>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });
      // Clip 1: title (0-6s) — inner wrappers only, never .clip
      tl.from("#qe-kicker", { y: 24, opacity: 0, duration: 0.6, ease: "power3.out" }, 0.2);
      tl.from("#qe-title", { y: 40, opacity: 0, duration: 0.7, ease: "power3.out" }, 0.4);
      tl.from("#qe-sub", { y: 28, opacity: 0, duration: 0.6, ease: "power3.out" }, 0.7);
      tl.from("#qe-chips", { y: 20, opacity: 0, duration: 0.5, ease: "power3.out" }, 1.0);
      // Clip 2: steps build (6-12s)
      tl.from("#qe-f2-kicker", { y: 24, opacity: 0, duration: 0.5, ease: "power3.out" }, 6.2);
${stepLines}
      tl.from("#qe-worked", { y: 20, opacity: 0, duration: 0.5, ease: "power3.out" }, ${workedAt});
${topicTimelines ? topicTimelines + "\n" : ""}      // Final clip: mastery CTA (${ctaStart}–${ctaStart + 6}s)
      tl.from("#qe-f3-kicker", { y: 24, opacity: 0, duration: 0.5, ease: "power3.out" }, ${(ctaStart + 0.2).toFixed(2)});
      tl.from("#qe-f3-title", { y: 40, opacity: 0, duration: 0.6, ease: "power3.out" }, ${(ctaStart + 0.4).toFixed(2)});
      tl.from("#qe-f3-sub", { y: 28, opacity: 0, duration: 0.5, ease: "power3.out" }, ${(ctaStart + 0.7).toFixed(2)});
      tl.from("#qe-f3-cta", { y: 20, opacity: 0, duration: 0.5, ease: "power3.out" }, ${(ctaStart + 1.0).toFixed(2)});
${hasNarrated ? `      tl.from(".qe-cta[href]", { y: 20, opacity: 0, duration: 0.5, ease: "power3.out" }, ${(ctaStart + 1.4).toFixed(2)});` : ""}
      window.__timelines["${esc(slug)}"] = tl;
    </script>
  </body>
</html>
`;
}

const outRoot = join(process.cwd(), "public", "videos");
const withNarrated = narratedSlugs();
for (const lessonItem of ALL_LESSONS) {
  const html = renderLesson(lessonItem.slug, resolveFullScript(lessonItem), withNarrated.has(lessonItem.slug));
  const dir = join(outRoot, lessonItem.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
  console.log(`wrote public/videos/${lessonItem.slug}/index.html`);
}
console.log(`done: ${ALL_LESSONS.length} lessons`);
