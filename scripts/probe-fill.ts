// Measures live fill ratio for every scene archetype present in a baked lesson,
// so the coverage floor in the render test is set from evidence, not a guess.
//
// Run: NODE_OPTIONS="" npx tsx scripts/probe-fill.ts [slug]
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const slug = process.argv[2] || "c9-maths-01";
const work = mkdtempSync(join(tmpdir(), "fill-"));
copyFileSync(resolve(`public/videos/${slug}/full.html`), join(work, "lesson.html"));

const probe = [
  '<!doctype html><body><pre id="R">P</pre>',
  '<iframe id="f" src="lesson.html" width="1280" height="720" style="border:0"></iframe>',
  "<script>",
  "setTimeout(function(){",
  '  var f=document.getElementById("f"), d=f.contentDocument, w=f.contentWindow;',
  "  var out=[]; var sc=w.__scenes;",
  '  var nodes=d.querySelectorAll(".qe-scene");',
  "  for (var i=0;i<nodes.length;i++){",
  '    var cfgEl=nodes[i].querySelector(".qe-scene-cfg");',
  "    var cfg={}; try{cfg=JSON.parse(cfgEl.textContent||'{}');}catch(e){}",
  '    var cv=nodes[i].querySelector("canvas");',
  '    var gl=cv.getContext("webgl2")||cv.getContext("webgl");',
  "    try{ if(sc&&sc.seek) sc.seek(6+i*20); }catch(e){}",
  "    var px=new Uint8Array(cv.width*cv.height*4);",
  "    gl.readPixels(0,0,cv.width,cv.height,gl.RGBA,gl.UNSIGNED_BYTE,px);",
  "    var n=0; for(var k=3;k<px.length;k+=4) if(px[k]>8) n++;",
  "    out.push({kind:cfg.kind||'?', fill:+(n/(cv.width*cv.height)).toFixed(4)});",
  "  }",
  '  document.getElementById("R").textContent="FILL::"+JSON.stringify(out);',
  "},2500);",
  "<" + "/script></body>",
].join("\n");

writeFileSync(join(work, "p.html"), probe);

let raw = "";
try {
  raw = execFileSync(
    CHROME,
    [
      "--headless=new", "--no-sandbox", "--allow-file-access-from-files",
      "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
      "--virtual-time-budget=9000", "--dump-dom",
      `--user-data-dir=${join(work, "pr")}`, join(work, "p.html"),
    ],
    { encoding: "utf8", maxBuffer: 1 << 26, timeout: 120000 },
  );
} catch (e) {
  raw = String((e as { stdout?: string })?.stdout ?? "");
}
const m = raw.match(/FILL::(\[.*?\])/);
console.log(m ? m[1] : "no output");
