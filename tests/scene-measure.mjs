/**
 * Measures where the text elements inside a part actually land relative to the
 * 720px stage. Used to tune the layout so nothing overflows silently.
 *
 * Run: NODE_OPTIONS="" npx tsx tests/scene-measure.mjs [slug]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const slug = process.argv[2] || "c9-maths-01";
const TARGET = resolve(`public/videos/${slug}/full.html`);
if (!existsSync(CHROME) || !existsSync(TARGET)) { console.log("missing inputs"); process.exit(0); }

const work = mkdtempSync(join(tmpdir(), "scene-measure-"));
copyFileSync(TARGET, join(work, "lesson.html"));

const harness = `<!doctype html><body><pre id="R">PENDING</pre>
<iframe id="f" src="lesson.html" width="1280" height="720" style="border:0"></iframe>
<script>
setTimeout(function () {
  var f = document.getElementById("f"), d = f.contentDocument;
  var out = {};
  var clips = d.querySelectorAll(".clip");
  // Measure the part with the most content (bullets + title + scene).
  var worst = null, worstH = 0;
  for (var c = 0; c < clips.length; c++) {
    var fill = clips[c].querySelector(".qe-fill");
    if (!fill) continue;
    var need = 0;
    for (var i = 0; i < fill.children.length; i++) {
      var ch = fill.children[i];
      var cs = getComputedStyle(ch);
      need += ch.getBoundingClientRect().height +
              parseFloat(cs.marginTop || 0) + parseFloat(cs.marginBottom || 0);
    }
    var pad = parseFloat(getComputedStyle(fill).paddingTop) * 2;
    if (need + pad > worstH) { worstH = need + pad; worst = fill; }
  }
  if (!worst) { out.error = "no fill"; }
  else {
    var fr = worst.getBoundingClientRect();
    out.stageH = Math.round(fr.height);
    out.contentNeed = Math.round(worstH);
    out.overflow = Math.round(worstH - fr.height);
    out.reserveForScene = 250;
    var clip = worst.closest(".clip");
    out.part = clip ? clip.id : "?";
    var o = {};
    for (var k = 0; k < worst.children.length; k++) {
      var el = worst.children[k], r = el.getBoundingClientRect();
      var s = getComputedStyle(el);
      o[el.id || el.className] = {
        h: Math.round(r.height),
        mt: s.marginTop,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom)
      };
    }
    out.children = o;
  }
  document.getElementById("R").textContent = "M::" + JSON.stringify(out);
}, 1800);
<\/script></body>`;

const wrapper = join(work, "m.html");
writeFileSync(wrapper, harness);

let raw = "";
try {
  raw = execFileSync(CHROME, [
    "--headless=new", "--no-sandbox", "--allow-file-access-from-files",
    "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
    "--virtual-time-budget=6000", "--dump-dom",
    `--user-data-dir=${join(work, "p")}`, wrapper,
  ], { encoding: "utf8", maxBuffer: 1 << 26, timeout: 90000 });
} catch (e) { raw = String(e?.stdout ?? ""); }

const m = raw.match(/M::(\{.*\})/);
if (!m) {
  console.log("no probe output");
} else {
  try {
    console.log(JSON.stringify(JSON.parse(m[1]), null, 2));
  } catch {
    console.log("raw:", m[1].slice(0, 1200));
  }
}
rmSync(work, { recursive: true, force: true });
