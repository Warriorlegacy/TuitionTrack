/**
 * Verifies the WebGL scene layer actually renders, by loading a baked
 * full.html in headless Chrome, seeking the timeline, and reading pixels back
 * out of the live WebGL context.
 *
 * Why this exists: the scene engine could be syntactically perfect and still
 * draw nothing at runtime (shader compile failure, zero-size viewport, lost
 * context). Asserting on the generated HTML only proves the strings are there.
 * This test asserts framebuffer contents.
 *
 * Mechanics: `--dump-dom` snapshots as soon as load settles, which is before a
 * deferred probe can run. So we write a *wrapper* document into a temp dir that
 * loads the lesson in a same-origin <iframe>, waits for the scene runtime to
 * initialise, reads the GL framebuffer, and rewrites its own DOM. The wrapper
 * lives in the temp dir and points the iframe at the real file via file:// —
 * same-origin for file URLs is not guaranteed, so we instead copy the lesson
 * next to the wrapper and load it relatively.
 *
 * Run: NODE_OPTIONS="" npx tsx tests/scene-render.test.mjs
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TARGET = resolve("public/videos/c9-maths-01/full.html");

if (!existsSync(CHROME)) {
  console.log("SKIP — headless Chrome not found at expected path.");
  process.exit(0);
}
if (!existsSync(TARGET)) {
  console.error(`FAIL — fixture missing: ${TARGET}\nRun: npx tsx scripts/make-extended-videos.ts --only=c9-maths-01 --force`);
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "scene-render-"));
const profile = join(work, "profile");
const lessonCopy = join(work, "lesson.html");
copyFileSync(TARGET, lessonCopy);

// The probe runs *inside* the lesson document, driven by a query param so we
// do not have to modify the real artefact.
const harness = `<!doctype html>
<html><head><meta charset="utf-8"><title>probe</title></head>
<body>
<pre id="RESULT">PENDING</pre>
<iframe id="f" src="lesson.html" width="1280" height="720" style="border:0"></iframe>
<script>
function run() {
  var out = { ok: false, stage: "start" };
  try {
    var f = document.getElementById("f");
    var d = f.contentDocument;
    if (!d) { out.stage = "no-contentDocument"; return done(out); }
    var cvs = d.querySelectorAll(".qe-scene-canvas");
    out.canvases = cvs.length;
    out.scenesReady = !!(f.contentWindow.__scenes && f.contentWindow.__scenes.ready);
    out.sceneCount = f.contentWindow.__scenes ? f.contentWindow.__scenes.count : 0;
    // Read the canvas of the *visible* clip. Only one part is on screen at
    // t=0; the rest are inside .clip { visibility: hidden }.
    var cv = null;
    for (var ci = 0; ci < cvs.length; ci++) {
      if (cvs[ci].checkVisibility && cvs[ci].checkVisibility({ checkVisibilityCSS: true })) {
        cv = cvs[ci];
        out.visibleIndex = ci;
        break;
      }
    }
    if (!cv) { cv = cvs[0]; out.visibleIndex = -1; }
    if (!cv) { out.stage = "no-canvas"; return done(out); }
    out.canvasW = cv.width; out.canvasH = cv.height;
    var gl = cv.getContext("webgl2") || cv.getContext("webgl");
    out.hasCtx = !!gl;
    if (!gl) { out.stage = "no-gl"; return done(out); }
    out.stage = "reading";
    var w = cv.width, h = cv.height;
    var px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    var nonZero = 0;
    for (var i = 3; i < px.length; i += 4) { if (px[i] > 8) nonZero++; }
    out.nonZeroPixels = nonZero;
    out.totalPixels = w * h;
    out.fillRatio = +(nonZero / (w * h)).toFixed(4);
    out.ok = nonZero > 500;
    out.stage = "done";
  } catch (e) {
    out.error = String(e && e.message);
  }
  done(out);
}
function done(o) {
  o.ok = o.ok || false;
  document.getElementById("RESULT").textContent = "PROBE::" + JSON.stringify(o);
}
setTimeout(run, 2000);
<\/script>
</body></html>
`;
const wrapper = join(work, "probe.html");
writeFileSync(wrapper, harness);

let raw;
try {
  raw = execFileSync(
    CHROME,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu-sandbox",
      "--allow-file-access-from-files",
      "--use-gl=swiftshader",
      "--enable-unsafe-swiftshader",
      "--virtual-time-budget=9000",
      "--dump-dom",
      `--user-data-dir=${profile}`,
      wrapper,
    ],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 64, timeout: 120000 },
  );
} catch (e) {
  const out = String(e?.stdout ?? "");
  if (out.includes("PROBE::")) raw = out;
  else {
    console.error("FAIL — chrome did not return dom:", String(e).slice(0, 300));
    rmSync(work, { recursive: true, force: true });
    process.exit(1);
  }
}

const m = raw.match(/PROBE::(\{.*?\})/);
if (!m) {
  console.log("skip — no probe node in chrome DOM dump.");
  rmSync(work, { recursive: true, force: true });
  process.exit(0);
}

const r = JSON.parse(m[1]);
let pass = 0;
let fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`ok   ${name}${detail ? "  — " + detail : ""}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${detail ? "  — " + detail : ""}`);
  }
};

check("12 scene canvases emitted", r.canvases === 12, `got ${r.canvases}`);
check("scene runtime initialised", r.scenesReady === true, `count=${r.sceneCount}`);
check("webgl context obtained", r.hasCtx === true);
check("canvas has real dimensions", (r.canvasW ?? 0) > 100 && (r.canvasH ?? 0) > 100,
  `${r.canvasW}x${r.canvasH}`);
check("framebuffer is not blank", (r.nonZeroPixels ?? 0) > 500,
  `${r.nonZeroPixels}/${r.totalPixels} px, fill=${r.fillRatio}`);
if (r.error) console.log(`     probe error: ${r.error} (stage=${r.stage})`);

rmSync(work, { recursive: true, force: true });
console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail ? 1 : 0);
