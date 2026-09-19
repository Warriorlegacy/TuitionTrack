// Bakes the 1-hour one-shot HyperFrames file render per extended lesson:
//   public/videos/<slug>/full.html  (1280×720, GSAP, ~60 min, voice via
//   browser speechSynthesis — zero cost, zero keys)
//
// Same section timing + narration as the Remotion ExtendedLesson (one Sequence
// per voice segment + CTA tail), from the same .extended.json that
// scripts/research-extended.ts writes. Run:
//   npx tsx scripts/make-extended-videos.ts [--only c10-maths-04] [--force]
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_LESSONS } from "../src/lib/learn/video-catalog";
import { extendedPath, resolveFullScript, type ExtendedFile } from "../src/lib/learn/lesson-research";
import type { LessonScript } from "../src/lib/ai/video";
import type { VideoLesson } from "../src/lib/learn/video-catalog";
import {
  SCENE_CSS,
  SCENE_RUNTIME,
  hashSeed,
  sceneMarkup,
} from "../src/lib/learn/scene-engine";

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? "";
const only = new Set(onlyArg.split(",").map((s) => s.trim()).filter(Boolean));
const force = args.includes("--force");

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const js = (s: string): string => JSON.stringify(s);

function renderExtended(lessonItem: VideoLesson, script: LessonScript, file: ExtendedFile): string {
  const segs = file.segments.slice(0, 16);
  const starts: number[] = [];
  let acc = 0;
  for (const s of segs) {
    starts.push(acc);
    acc += (Number(s.minutes) || 5) * 60;
  }
  const ctaStart = acc;
  const total = acc + 6;
  const mm = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

  const sections = segs
    .map((s, i) => {
      const theme = i % 2 ? "" : " qe-fill-light";
      const points = s.points
        .slice(0, 5)
        .map((p, j) => `<div id="qx${i}-p${j}" class="qe-bullet">• ${esc(p)}</div>`)
        .join("\n              ");
      // The `visual` field used to be printed as an italic paragraph with a
      // film emoji — the lesson described a 3D scene and showed text. It now
      // renders as an actual GPU scene. The caption stays as a subtle label so
      // the description is not lost, but it no longer stands in for the visual.
      const scene = sceneMarkup({
        partIndex: i,
        visual: s.visual,
        seed: hashSeed(`${lessonItem.slug}:${i}:${s.heading}`),
      });
      return `      <!-- Part ${i + 1} (${mm(starts[i])}–${mm(starts[i] + (Number(s.minutes) || 5) * 60)}): ${esc(s.heading)} -->
      <section id="qx-part${i + 1}" class="clip" data-start="${starts[i]}" data-duration="${(Number(s.minutes) || 5) * 60}" data-track-index="1">
        <div class="qe-fill${theme}">
          <span id="qx${i}-kicker" class="qe-kicker">Part ${i + 1} of ${segs.length} · ~${Number(s.minutes) || 5} min</span>
          <h2 id="qx${i}-title" class="qe-topic">${esc(s.heading)}</h2>
          <div class="qe-steps">
              ${points}
          </div>
${scene}
          <p id="qx${i}-visual" class="qe-example">${esc(s.visual)}</p>
        </div>
      </section>`;
    })
    .join("\n");

  const timelines = segs
    .map((s, i) => {
      const st = starts[i];
      const pts = s.points
        .slice(0, 5)
        .map((_, j) => `      tl.from("#qx${i}-p${j}", { y: 20, opacity: 0, duration: 0.6, ease: "power3.out" }, ${(st + 2.6 + j * 0.9).toFixed(1)});`)
        .join("\n");
      return `      tl.from("#qx${i}-kicker", { y: 24, opacity: 0, duration: 0.6, ease: "power3.out" }, ${(st + 0.3).toFixed(1)});
      tl.from("#qx${i}-title", { y: 36, opacity: 0, duration: 0.8, ease: "power3.out" }, ${(st + 0.8).toFixed(1)});
${pts}
      tl.from("#qx${i}-visual", { opacity: 0, duration: 0.8 }, ${(st + 8.5).toFixed(1)});
      // Animate the scene wrapper's *transform*, never its opacity. A
      // tl.from({opacity:0}) sets opacity to 0 at the part's start and only
      // reaches 1 a second later — so the scene is invisible during the exact
      // moment it should be establishing the visual. Scaling in avoids that
      // and leaves opacity untouched at 1.
      tl.from(".qe-scene[data-scene-part='${i}']", { scale: 0.94, duration: 0.9, ease: "power2.out", transformOrigin: "50% 50%" }, ${(st + 1.5).toFixed(1)});`;
    })
    .join("\n");

  const narration = segs.map((s) => s.narration);
  const menu = segs
    .map((s, i) => `<button type="button" data-seek="${starts[i]}">${i + 1}. ${esc(s.heading)} <small>${mm(starts[i])}</small></button>`)
    .join("\n          ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1280, height=720" />
    <title>${esc(script.title)} — 1-hour full lesson — TuitionTrack</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"><\/script>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b0f14; color: #f8fafc; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      #stage { width: min(1280px, 100vw); }
      #root { position: relative; width: 1280px; max-width: 100%; aspect-ratio: 16/9; overflow: hidden; transform-origin: top left; }
      .clip { position: absolute; inset: 0; visibility: hidden; }
      /* Layout is height-budgeted: 720px stage, and a part can hold a 2-line
         title + 5 bullets + a WebGL scene + a caption. Padding and type sizes
         are tuned so that combination fits without flexbox having to shrink
         the scene to nothing. */
      .qe-fill { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 34px 72px; box-sizing: border-box; overflow: hidden; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%); }
      .qe-fill-light { background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 60%, #f8fafc 100%); color: #0f172a; }
      .qe-kicker { display: block; flex: none; width: fit-content; font-size: 15px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #a5b4fc; }
      .qe-fill-light .qe-kicker { color: #4f46e5; }
      .qe-topic { display: block; flex: none; width: 100%; max-width: 1050px; margin: 8px 0 0; font-size: 38px; line-height: 1.1; font-weight: 800; max-height: 84px; overflow: hidden; }
      .qe-sub { display: block; flex: none; max-width: 980px; margin: 10px 0 0; font-size: 22px; line-height: 1.4; color: #cbd5e1; }
      .qe-fill-light .qe-sub { color: #334155; }
      .qe-steps { display: block; flex: none; width: 100%; margin-top: 12px; margin-bottom: 8px; }
      .qe-bullet { display: block; width: 100%; box-sizing: border-box; margin-top: 6px; padding: 7px 18px; border-radius: 11px; background: rgba(255,255,255,0.92); color: #0f172a; font-size: 18px; font-weight: 600; line-height: 1.3; }
      .qe-example { display: block; flex: none; max-width: 1080px; margin: 10px 0 0; font-size: 15px; font-style: italic; color: #6366f1; opacity: 0.85; }
      .qe-fill-light .qe-example { color: #4f46e5; }
${SCENE_CSS}
      .qe-cta { display: block; width: fit-content; margin-top: 30px; padding: 20px 40px; border-radius: 16px; background: #4f46e5; color: #fff; font-size: 30px; font-weight: 800; }
      #bar { display: flex; align-items: center; gap: 12px; padding: 12px 4px; color: #cbd5e1; font-size: 15px; flex-wrap: wrap; }
      #bar button { cursor: pointer; border: 1px solid #334155; background: #1e293b; color: #f8fafc; border-radius: 999px; padding: 8px 16px; font-size: 14px; font-weight: 700; }
      #bar button.on { background: #4f46e5; border-color: #4f46e5; }
      #seek { flex: 1 1 200px; accent-color: #f59e0b; }
      #menu { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 4px 20px; }
      #menu button { cursor: pointer; border: 1px solid #334155; background: transparent; color: #cbd5e1; border-radius: 10px; padding: 6px 10px; font-size: 13px; }
      #menu button small { color: #f59e0b; }
    </style>
  </head>
  <body>
    <div id="stage">
      <div id="root" data-composition-id="${esc(lessonItem.slug)}-full" data-start="0" data-width="1280" data-height="720" data-duration="${total}">
${sections}
        <!-- CTA (${mm(ctaStart)}–${mm(total)}) -->
        <section id="qx-cta" class="clip" data-start="${ctaStart}" data-duration="6" data-track-index="1">
          <div class="qe-fill">
            <span id="qx-cta-kicker" class="qe-kicker">Full chapter complete</span>
            <h2 id="qx-cta-title" class="qe-topic">${esc(script.ctaTitle)}</h2>
            <p id="qx-cta-sub" class="qe-sub">${esc(script.ctaBody)}</p>
            <span id="qx-cta-btn" class="qe-cta">Revise with Tutor →</span>
          </div>
        </section>
      </div>
      <div id="bar">
        <button id="btn-play" type="button">▶ Play 1-hour lesson</button>
        <button id="btn-voice" type="button" class="on" aria-pressed="true">🔊 Narration on</button>
        <input id="seek" type="range" min="0" max="${total}" step="1" value="0" aria-label="Seek" />
        <span id="clock">0:00 / ${mm(total)}</span>
      </div>
      <div id="menu">
          ${menu}
      </div>
    </div>
    <script>
      var NARRATION = ${JSON.stringify(narration)};
      var STARTS = ${JSON.stringify(starts)};
      var TOTAL = ${total};
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });
      document.querySelectorAll("#root .clip").forEach(function (el) {
        var s = parseFloat(el.dataset.start || "0"), d = parseFloat(el.dataset.duration || "6");
        tl.set(el, { visibility: "visible" }, s);
        tl.set(el, { visibility: "hidden" }, s + d);
      });
${timelines}
      tl.from("#qx-cta-kicker", { y: 24, opacity: 0, duration: 0.6 }, ${ctaStart + 0.3});
      tl.from("#qx-cta-title", { y: 36, opacity: 0, duration: 0.8 }, ${ctaStart + 0.8});
      tl.from("#qx-cta-sub", { y: 24, opacity: 0, duration: 0.6 }, ${ctaStart + 1.4});
      tl.from("#qx-cta-btn", { y: 20, opacity: 0, duration: 0.6 }, ${ctaStart + 2.0});
      window.__timelines[${js(lessonItem.slug + "-full")}] = tl;

      // ── One-shot player + voice ──
      var voiceOn = true, spokenPart = -1, playing = false;
      var btnPlay = document.getElementById("btn-play"), btnVoice = document.getElementById("btn-voice");
      var seek = document.getElementById("seek"), clock = document.getElementById("clock");
      function fmt(s) { return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"); }
      function pickVoice() {
        var vs = speechSynthesis.getVoices();
        return vs.find(function (v) { return v.lang.indexOf("en-IN") === 0; }) || vs.find(function (v) { return v.lang.indexOf("en") === 0; });
      }
      function stopVoice() { try { speechSynthesis.cancel(); } catch (e) {} spokenPart = -1; }
      function speakPart(i) {
        if (!voiceOn || i < 0 || i >= NARRATION.length) return;
        spokenPart = i;
        try {
          speechSynthesis.cancel();
          var chunks = NARRATION[i].match(/[^.!?]+[.!?]+/g) || [NARRATION[i]];
          var v = pickVoice();
          chunks.slice(0, 80).forEach(function (c) {
            var u = new SpeechSynthesisUtterance(c.trim().slice(0, 400));
            if (v) u.voice = v;
            speechSynthesis.speak(u);
          });
        } catch (e) {}
      }
      function partAt(t) { var p = 0; for (var i = 0; i < STARTS.length; i++) if (t >= STARTS[i]) p = i; return p; }
      tl.eventCallback("onUpdate", function () {
        var t = tl.time();
        seek.value = Math.floor(t);
        clock.textContent = fmt(t) + " / " + fmt(TOTAL);
        var p = partAt(t);
        if (playing && voiceOn && p !== spokenPart) speakPart(p);
        // Drive the WebGL scenes from the same clock as the DOM timeline, so
        // scrubbing the seek bar moves the scenes too instead of desyncing.
        try { if (window.__scenes) window.__scenes.seek(t); } catch (e) {}
      });
      tl.eventCallback("onComplete", function () { playing = false; btnPlay.textContent = "▶ Play 1-hour lesson"; stopVoice(); });
      btnPlay.onclick = function () {
        if (playing) { playing = false; tl.pause(); btnPlay.textContent = "▶ Resume lesson"; stopVoice(); }
        else {
          playing = true; btnPlay.textContent = "⏸ Pause lesson";
          if (tl.time() >= TOTAL - 0.5) { tl.restart(); } else { tl.play(); }
          if (voiceOn) speakPart(partAt(tl.time()));
        }
      };
      btnVoice.onclick = function () {
        voiceOn = !voiceOn;
        btnVoice.textContent = voiceOn ? "🔊 Narration on" : "🔇 Narration off";
        btnVoice.classList.toggle("on", voiceOn);
        btnVoice.setAttribute("aria-pressed", String(voiceOn));
        if (voiceOn && playing) speakPart(partAt(tl.time())); else stopVoice();
      };
      seek.oninput = function () { tl.pause(); tl.time(parseFloat(seek.value)); stopVoice(); if (playing && voiceOn) speakPart(partAt(tl.time())); };
      document.querySelectorAll("#menu button").forEach(function (b) {
        b.onclick = function () { tl.pause(); tl.time(parseFloat(b.dataset.seek)); stopVoice(); if (!playing) btnPlay.click(); };
      });
      setInterval(function () { try { if (speechSynthesis.speaking) speechSynthesis.resume(); } catch (e) {} }, 10000);
      if (speechSynthesis.getVoices().length === 0) speechSynthesis.onvoiceschanged = function () {};

      // ── initial paint ──
      // The timeline is built paused at t=0, and GSAP's .from() tweens apply
      // their START values the moment they are created. At t=0 that leaves
      // every element at opacity:0 / the clip at visibility:hidden — so a
      // lesson opened but not played showed a completely empty frame.
      //
      // BOOT_T must be past the LAST intro tween of part 1, not just the
      // first. Part 1 now animates: title (t+0.8), bullets (t+2.6 .. t+6.2),
      // caption (t+8.5), scene scale (t+1.5). Parking at t=10 leaves
      // everything settled; parking earlier shows a title over empty space.
      var BOOT_T = 10.0;
      tl.time(BOOT_T);
      if (window.__scenes) { try { window.__scenes.seek(BOOT_T); } catch (e) {} }
      seek.value = Math.floor(BOOT_T);
      clock.textContent = fmt(BOOT_T) + " / " + fmt(TOTAL);
    <\/script>
    <script>
${SCENE_RUNTIME}
    <\/script>
  </body>
</html>
`;
}

const onlyLessons = ALL_LESSONS.filter((l) => !only.size || only.has(l.slug));
let baked = 0;
let skipped = 0;
for (const lessonItem of onlyLessons) {
  const p = extendedPath(lessonItem.slug);
  if (!existsSync(p)) {
    skipped++;
    continue;
  }
  const out = join(process.cwd(), "public", "videos", lessonItem.slug, "full.html");
  if (existsSync(out) && !force) {
    skipped++;
    continue;
  }
  try {
    const file = JSON.parse(readFileSync(p, "utf8")) as ExtendedFile;
    if (file.segments.length < (file.plan?.length ?? file.segments.length)) {
      skipped++; // still being researched — resume fills it, bake later
      continue;
    }
    const html = renderExtended(lessonItem, { ...resolveFullScript(lessonItem) }, file);
    mkdirSync(join(process.cwd(), "public", "videos", lessonItem.slug), { recursive: true });
    writeFileSync(out, html);
    baked++;
    console.log(`wrote public/videos/${lessonItem.slug}/full.html (~${file.segments.reduce((n, s) => n + (Number(s.minutes) || 5), 0)} min)`);
  } catch (e) {
    console.log(`FAIL ${lessonItem.slug} — ${(e as Error).message.slice(0, 120)}`);
  }
}
console.log(`done: ${baked} baked, ${skipped} skipped (no extended research yet — run research-extended.ts first).`);
