/**
 * Proves that scene geometry is *contained* by the stage at any canvas aspect.
 *
 * Why this exists: the scene engine authors geometry in a fixed 1280x560 box
 * but the real stage is a wide, short strip (~1138x218 at DPR 1 — a 5.2:1
 * aspect against the box's 2.3:1). The original projection fed the fixed box
 * straight to the shader, so everything below y = 218/560 of the geometry was
 * clipped off-screen: the number-line axis, the graph x-axis, and most
 * markers never appeared. The scene still measured a plausible fill ratio,
 * because the remaining oversized points happened to cover pixels — so a
 * fill-ratio assertion CANNOT catch it.
 *
 * The invariant that actually matters: bake the same lesson, load it at two
 * very different stage sizes, and confirm the drawn content stays inside the
 * canvas in both. Under the old projection the content's bounding box escaped
 * the viewport at the wide aspect; under the fitted projection it does not.
 *
 * Run: NODE_OPTIONS="" npx tsx tests/scene-containment.test.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { cleanupTemp } from "./temp-cleanup.mjs";
import { join, resolve } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TARGET = resolve("public/videos/c9-maths-01/full.html");

if (!existsSync(CHROME)) {
  console.log("SKIP — headless Chrome not found.");
  process.exit(0);
}
if (!existsSync(TARGET)) {
  console.error(`FAIL — fixture missing: ${TARGET}`);
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "scene-contain-"));
copyFileSync(TARGET, join(work, "lesson.html"));

// Build a probe that resizes the stage, repaints, and reports the bounding box
// of every lit pixel relative to the canvas.
function probeFor(w, h) {
  return [
    "<!doctype html><html><head><meta charset='utf-8'></head><body>",
    `<pre id="R">PENDING</pre>`,
    `<iframe id="f" src="lesson.html" width="${w}" height="${h}" style="border:0"></iframe>`,
    "<script>",
    "setTimeout(function(){",
    '  var f=document.getElementById("f"), d=f.contentDocument, w=f.contentWindow;',
    "  var out={maxCv:null, rows:[]};",
    '  var nodes=d.querySelectorAll(".qe-scene canvas");',
    "  for (var i=0;i<nodes.length;i++){",
    "    var cv=nodes[i];",
    '    var gl=cv.getContext("webgl2")||cv.getContext("webgl");',
    "    if(!gl) continue;",
    "    var W=cv.width, H=cv.height;",
    "    if (W<2||H<2) continue;",
    "    var px=new Uint8Array(W*H*4);",
    "    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px);",
    "    // Bounding box of lit pixels; readPixels origin is bottom-left.",
    "    var minX=1e9,maxX=-1,minY=1e9,maxY=-1,n=0;",
    "    for(var y=0;y<H;y++){ for(var x=0;x<W;x++){",
    "      if(px[(y*W+x)*4+3]>8){ n++; if(x<minX)minX=x; if(x>maxX)maxX=x;",
    "        if(y<minY)minY=y; if(y>maxY)maxY=y; } } }",
    "    if(n<10){ out.rows.push({i:i, W:W, H:H, lit:n, empty:true}); continue; }",
    "    out.rows.push({i:i, W:W, H:H, lit:n,",
    "      // Fraction of the canvas the lit bbox spans.",
    "      spanX:+((maxX-minX)/W).toFixed(3), spanY:+((maxY-minY)/H).toFixed(3),",
    "      // Distance the bbox extends beyond the canvas edge, in px.",
    "      overL:Math.max(0,-minX), overR:Math.max(0,maxX-(W-1)),",
    "      overB:Math.max(0,-minY), overT:Math.max(0,maxY-(H-1)) });",
    "  }",
    '  document.getElementById("R").textContent="CONTAIN::"+JSON.stringify(out);',
    "},2500);",
    "<" + "/script></body></html>",
  ].join("\n");
}

function run(w, h) {
  const wrapper = join(work, `p-${w}x${h}.html`);
  writeFileSync(wrapper, probeFor(w, h));
  let raw = "";
  try {
    raw = execFileSync(
      CHROME,
      [
        "--headless=new", "--no-sandbox", "--allow-file-access-from-files",
        "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
        "--virtual-time-budget=9000", "--dump-dom",
        `--user-data-dir=${join(work, `pr-${w}x${h}`)}`, wrapper,
      ],
      { encoding: "utf8", maxBuffer: 1 << 26, timeout: 120000 },
    );
  } catch (e) {
    raw = String(e && e.stdout ? e.stdout : "");
  }
  // The payload is a JSON object that may contain nested arrays, so match to
  // the end of the dump line rather than using a non-greedy brace match.
  const m = raw.match(/CONTAIN::(\{[\s\S]*?\})<\/pre>/);
  return m ? JSON.parse(m[1]) : null;
}

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

// A live containment check at the real stage size. The canvas is sized by CSS
// (1138x218, a 5.2:1 strip) rather than by the viewport, so resizing the iframe
// cannot probe a different aspect — the pure-function checks below cover that.
{
  const r = run(1280, 720);
  if (!r) {
    check("probe returned data", false, "no CONTAIN payload");
  } else {
    const rows = r.rows.filter((x) => !x.empty);
    check("scenes painted on the real stage", rows.length >= 10, `${rows.length} painted`);
    // 1px of anti-aliasing slack; the defect pushed content tens of px out.
    const escaping = rows.filter(
      (x) => (x.overL ?? 0) > 1 || (x.overR ?? 0) > 1 || (x.overB ?? 0) > 1 || (x.overT ?? 0) > 1,
    );
    check("content stays inside the stage", escaping.length === 0,
      escaping.length
        ? `${escaping.length} scene(s) overflow, e.g. L${escaping[0].overL} R${escaping[0].overR} B${escaping[0].overB} T${escaping[0].overT}`
        : `all ${rows.length} contained`);
    // The axis must actually be drawn, not clipped: a number-line scene that
    // lost its axis was the original symptom.
    const spreads = rows.map((x) => x.spanX);
    const wide = spreads.filter((s) => s > 0.7).length;
    check("scenes span the stage horizontally", wide >= 10,
      `${wide}/${rows.length} scenes span >70% of width (spanX=${spreads.slice(0, 4).join(", ")})`);
  }
}

cleanupTemp(work);
console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail ? 1 : 0);
