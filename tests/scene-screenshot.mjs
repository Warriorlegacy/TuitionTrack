/**
 * Captures a PNG of a baked lesson so the WebGL scene can be inspected by eye.
 * Writes to .scene-preview/<slug>.png
 *
 * Run: NODE_OPTIONS="" npx tsx tests/scene-screenshot.mjs [slug]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { cleanupTemp } from "./temp-cleanup.mjs";
import { join, resolve } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const slug = process.argv[2] || "c9-maths-01";
const TARGET = resolve(`public/videos/${slug}/full.html`);

if (!existsSync(CHROME)) { console.log("SKIP — no chrome"); process.exit(0); }
if (!existsSync(TARGET)) { console.error(`missing ${TARGET}`); process.exit(1); }

const outDir = resolve(".scene-preview");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${slug}.png`);

const work = mkdtempSync(join(tmpdir(), "scene-shot-"));
copyFileSync(TARGET, join(work, "lesson.html"));

// Hide the player chrome so the capture shows the lesson frame itself.
const harness = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#0b0f14}
#f{border:0;display:block;width:1280px;height:720px}
</style></head><body>
<iframe id="f" src="lesson.html" width="1280" height="720"></iframe>
<script>
window.addEventListener("load", function () {
  var d = document.getElementById("f").contentDocument;
  var w = document.getElementById("f").contentWindow;
  // Reveal part 1 and hide everything else, so we capture one clean frame.
  var clips = d.querySelectorAll(".clip");
  for (var i = 0; i < clips.length; i++) {
    clips[i].style.visibility = i === 0 ? "visible" : "hidden";
  }
  // Kill the player bar and menu from the capture.
  var bar = d.getElementById("bar"), menu = d.getElementById("menu");
  if (bar) bar.style.display = "none";
  if (menu) menu.style.display = "none";
  // Force a scene repaint now that the clip is visible.
  try { if (w.__scenes) w.__scenes.seek(6); } catch (e) {}
});
<\/script></body></html>`;

const wrapper = join(work, "shot.html");
writeFileSync(wrapper, harness);

try {
  execFileSync(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu-sandbox",
    "--allow-file-access-from-files",
    "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
    "--hide-scrollbars",
    "--virtual-time-budget=8000",
    "--window-size=1280,720",
    `--screenshot=${out}`,
    `--user-data-dir=${join(work, "profile")}`,
    wrapper,
  ], { encoding: "utf8", timeout: 120000, stdio: "pipe" });
} catch (e) {
  // Chrome exits non-zero on some screenshot runs even when the file is written.
  if (!existsSync(out)) {
    console.error("screenshot failed:", String(e).slice(0, 200));
    cleanupTemp(work);
    process.exit(1);
  }
}

cleanupTemp(work);
console.log(existsSync(out) ? `wrote ${out}` : "no screenshot produced");
