/**
 * WebGL scene engine for the HyperFrames `full.html` lesson render.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every generated lesson carried a `visual` field holding a rich scene
 * description ("A 3D glowing number line expanding from a central zero, with
 * integers popping up as bright spheres..."). The renderer printed that text
 * into a `<p>` tag with a film emoji, so the lesson *described* a 3D scene and
 * then showed a paragraph of italic text instead. 4,974 of 5,178 scene
 * descriptions in the corpus begin with "3D". None of it was ever rendered.
 *
 * This module turns that text into an actual GPU-rendered scene.
 *
 * DESIGN CONSTRAINTS (each one is deliberate)
 * -------------------------------------------
 * 1. **Zero network dependency.** The output is a self-contained HTML file that
 *    gets opened directly from disk, screenshotted, and archived. A CDN
 *    <script src> would break offline and in a sandboxed iframe. So the engine
 *    emits raw WebGL2/WebGL1 source inline — no three.js bundle, no import.
 *    three.js stays in the app where a bundler can resolve it.
 * 2. **No `getContext("webgl2")` requirement.** Falls back to WebGL1, then to
 *    a CSS-only scene if both fail. A lesson must never render blank.
 * 3. **Deterministic.** Seeded PRNG keyed off the slug+topic, so re-baking a
 *    lesson produces byte-identical output. Otherwise every rebuild would churn
 *    the diff for 519 files.
 * 4. **Time-driven by the host timeline.** Scenes expose `seek(t)` and are
 *    advanced from the GSAP `onUpdate` callback that already exists, so scenes
 *    scrub correctly with the seek bar instead of drifting out of sync.
 */

/** Scene archetypes, ordered by how often they appear in the corpus. */
export type SceneKind =
  | "numberline" // integers / number systems / real line
  | "graph" // functions, coordinates, curves
  | "molecule" // chemistry: bonds, atoms, reactions
  | "cell" // biology: membrane, organelles, DNA
  | "orbit" // physics: planets, electrons, rotation
  | "wave" // physics: oscillation, signal, sound
  | "grid" // geography / maps / matrices / density
  | "particles" // abstract fallback: philosophy, history, civics
  | "fallback"; // WebGL unavailable

/**
 * Classify a `visual` description into a scene archetype.
 *
 * Ordering matters and is not alphabetical: the corpus is full of descriptions
 * that mention several concepts at once (e.g. "a 3D split-screen showing a
 * molecule entering a cell"). Chemistry and biology are more specific than the
 * generic maths terms, so they are tested first. Scoring rather than
 * first-match-returns avoids the "cell" in "cellular respiration diagram"
 * losing to the "diagram" keyword.
 */
export function classifyScene(visual: string): SceneKind {
  const v = (visual || "").toLowerCase();
  const score: Record<string, number> = {
    numberline: 0,
    graph: 0,
    molecule: 0,
    cell: 0,
    orbit: 0,
    wave: 0,
    grid: 0,
    particles: 0,
  };
  const bump = (k: string, w: number) => {
    score[k] += w;
  };

  // Chemistry — highest specificity.
  for (const k of ["molecule", "molecular", "atom", "chemical", "reaction", "bond", "compound", "acid", "base", "electron cloud"]) {
    if (v.includes(k)) bump("molecule", 3);
  }
  // Biology.
  for (const k of ["cell", "dna", "membrane", "organelle", "nucleus", "tissue", "organ", "blood", "neuron", "chromosome", "mitosis"]) {
    if (v.includes(k)) bump("cell", 3);
  }
  // Astronomy / circular motion.
  for (const k of ["orbit", "planet", "solar", "galaxy", "electron shell", "rotation", "satellite", "gravitational", "kepler"]) {
    if (v.includes(k)) bump("orbit", 3);
  }
  // Waves and oscillation.
  for (const k of ["wave", "oscillat", "frequency", "vibration", "sound", "light ray", "refraction", "interference", "amplitude", "pendulum"]) {
    if (v.includes(k)) bump("wave", 3);
  }
  // Number line — very common in Classes 9-10 maths.
  for (const k of ["number line", "numberline", "real number", "integer", "rational", "irrational", "magnif", "decimal"]) {
    if (v.includes(k)) bump("numberline", 3);
  }
  // Graphs, coordinate geometry, functions.
  for (const k of ["graph", "coordinate", "axis", "curve", "parabola", "function", "plot", "slope", "polynomial", "intersect"]) {
    if (v.includes(k)) bump("graph", 3);
  }
  // Maps, grids, matrices, distribution.
  for (const k of ["map", "geograph", "region", "grid", "matrix", "surface", "terrain", "population", "density", "border"]) {
    if (v.includes(k)) bump("grid", 2);
  }
  // Weaker generic signals.
  for (const k of ["sphere", "cube", "particle", "glow", "floating", "abstract", "timeline", "flowchart"]) {
    if (v.includes(k)) bump("particles", 1);
  }
  // A bare "3D animation" with nothing else should still produce motion.
  if (v.includes("3d") || v.includes("3-d")) bump("particles", 1);

  let best: SceneKind = "particles";
  let bestScore = -1;
  for (const k of Object.keys(score)) {
    if (score[k] > bestScore) {
      bestScore = score[k];
      best = k as SceneKind;
    }
  }
  return bestScore <= 0 ? "particles" : best;
}

/**
 * Deterministic 32-bit hash. Used to seed scene randomness from stable text so
 * a rebuild is byte-identical. `Math.random()` would make every re-bake a diff.
 */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Build the inline <canvas> + WebGL runtime for one scene.
 *
 * Returns a `<div class="qe-scene">` wrapper containing a canvas, plus the
 * per-scene JSON config. All scenes share a single WebGL context created by
 * `SCENE_RUNTIME` (below) because browsers cap live contexts at ~16 and a
 * lesson has up to 16 parts — one context per part would blow the limit and
 * silently kill the later scenes.
 */
export function sceneMarkup(opts: {
  partIndex: number;
  visual: string;
  seed: number;
}): string {
  const kind = classifyScene(opts.visual);
  const cfg = {
    kind,
    seed: opts.seed,
    // Accent colour per archetype so the visual identity tracks the subject.
    hue: SCENE_HUE[kind],
  };
  return `        <div class="qe-scene" data-scene-part="${opts.partIndex}">
          <canvas class="qe-scene-canvas" width="1280" height="560" aria-hidden="true"></canvas>
          <script type="application/json" class="qe-scene-cfg">${JSON.stringify(cfg)}</script>
          <noscript><div class="qe-scene-fallback">${escapeAttr(opts.visual)}</div></noscript>
        </div>`;
}

const SCENE_HUE: Record<SceneKind, number> = {
  numberline: 265, // indigo — matches the existing brand accent
  graph: 265,
  molecule: 160, // teal for chemistry
  cell: 340, // rose for biology
  orbit: 210, // blue for physics/astronomy
  wave: 210,
  grid: 190, // cyan for geography
  particles: 265,
  fallback: 265,
};

function escapeAttr(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The shared WebGL runtime, emitted once per lesson and inlined into the page.
 *
 * Written as an IIFE with no imports. It:
 *  - creates ONE WebGL context and reuses it, drawing each canvas by
 *    re-pointing the viewport (avoids the ~16-context browser cap)
 *  - compiles a small set of programs (points / lines) rather than one per
 *    scene, so startup stays cheap
 *  - exposes `window.__scenes.seek(t)` for the host GSAP timeline to drive
 *  - degrades to the CSS fallback if context creation fails
 */
export const SCENE_RUNTIME = String.raw`
(function () {
  "use strict";

  var FALLBACK_CLASS = "qe-scene-solid";

  function solidFallback(host) {
    host.classList.add(FALLBACK_CLASS);
  }

  // ── context ──────────────────────────────────────────────────────────────
  // One WebGL context PER scene canvas. Browsers cap live contexts at ~16 and
  // a lesson has up to 16 parts, so this is exactly at the limit — but it is
  // the only correct option: a context is permanently bound to the canvas it
  // was created from, and you cannot blit one canvas's framebuffer into
  // another canvas that has no context. An earlier version created a single
  // context on a detached probe canvas and drew into that; every visible
  // canvas stayed blank. If a lesson ever grows past 16 parts, cap it here.
  var ctxOpts = { antialias: true, alpha: true, preserveDrawingBuffer: true };

  function contextFor(cv) {
    try {
      return cv.getContext("webgl2", ctxOpts)
          || cv.getContext("webgl", ctxOpts)
          || cv.getContext("experimental-webgl", ctxOpts);
    } catch (e) {
      return null;
    }
  }

  // ── shaders ──────────────────────────────────────────────────────────────
  var VS = [
    "attribute vec2 aPos;",
    "attribute float aSize;",
    "attribute vec3 aColor;",
    "uniform vec2 uRes;",
    "uniform vec2 uOrigin;",
    "uniform float uScale;",
    "varying vec3 vColor;",
    "void main() {",
    // Map authored coordinates (0..W, 0..H) into the letterboxed region of the
    // real canvas. uScale converts authored units to device pixels so point
    // sizes and stroke weights stay visually consistent at any canvas size.
    "  vec2 p = (aPos - uOrigin) * uScale;",
    "  vec2 clip = (p / uRes) * 2.0 - 1.0;",
    "  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);",
    // Authored sizes are in the W x H box's units; convert to device pixels so
    // a marker keeps its apparent size at any canvas resolution. (Multiplying
    // by 512 here blew the points up to fill the entire stage.)
    "  gl_PointSize = max(1.0, aSize * uScale);",
    "  vColor = aColor;",
    "}"
  ].join("\n");

  var FS_POINT = [
    "precision mediump float;",
    "varying vec3 vColor;",
    "void main() {",
    "  vec2 d = gl_PointCoord - vec2(0.5);",
    "  float r = length(d);",
    "  if (r > 0.5) discard;",
    "  float a = smoothstep(0.5, 0.05, r);",
    "  gl_FragColor = vec4(vColor, a);",
    "}"
  ].join("\n");

  var FS_LINE = [
    "precision mediump float;",
    "varying vec3 vColor;",
    "void main() { gl_FragColor = vec4(vColor, 1.0); }"
  ].join("\n");

  function compile(g, type, src) {
    var s = g.createShader(type);
    g.shaderSource(s, src);
    g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
      return null;
    }
    return s;
  }

  // Programs and buffers are context-bound, so each scene gets its own set.
  function programsFor(g) {
    function program(fsSrc) {
      var vs = compile(g, g.VERTEX_SHADER, VS);
      var fs = compile(g, g.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) return null;
      var p = g.createProgram();
      g.attachShader(p, vs);
      g.attachShader(p, fs);
      g.linkProgram(p);
      if (!g.getProgramParameter(p, g.LINK_STATUS)) return null;
      return p;
    }
    var progPoint = program(FS_POINT);
    var progLine = program(FS_LINE);
    if (!progPoint || !progLine) return null;
    var locs = function (p) {
      return {
        pos: g.getAttribLocation(p, "aPos"),
        size: g.getAttribLocation(p, "aSize"),
        color: g.getAttribLocation(p, "aColor"),
        res: g.getUniformLocation(p, "uRes"),
        origin: g.getUniformLocation(p, "uOrigin"),
        scale: g.getUniformLocation(p, "uScale")
      };
    };
    return {
      g: g,
      progPoint: progPoint,
      progLine: progLine,
      L_POINT: locs(progPoint),
      L_LINE: locs(progLine),
      bufPos: g.createBuffer(),
      bufSize: g.createBuffer(),
      bufColor: g.createBuffer(),
      bufEdge: g.createBuffer()
    };
  }

  // ── deterministic rng ────────────────────────────────────────────────────
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function hsl(h, s, l) {
    // HSL -> RGB, returns 0..1 triple. Keeps scene palettes consistent.
    h = ((h % 360) + 360) % 360 / 360;
    var a = s * Math.min(l, 1 - l);
    function f(n) {
      var k = (n + h * 12) % 12;
      return l - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
    }
    return [f(0), f(8), f(4)];
  }

  // ── scene builders ───────────────────────────────────────────────────────
  // Each returns { points, edges, tick } where tick(t) mutates positions.
  // Geometry is authored in a W x H box. The real stage is a wide, short strip
  // (1138 x 218 at DPR 1 — a 5.22:1 aspect), and the box matches that exactly:
  // 1280 / 245.2 = 5.22. Two earlier bugs both trace to getting this wrong:
  //   1. The original box was 1280x560 (2.29:1). Feeding it straight to the
  //      shader clipped everything below 218/560 of the geometry, so the
  //      number-line axis and most markers were never drawn at all.
  //   2. Fitting a 2.29:1 box *inside* a 5.22:1 canvas made the fit
  //      height-driven at 39% scale, so content spanned under 40% of the width.
  // Matching the aspect makes the fit width-driven at ~0.89 scale, using the
  // full strip. The letterbox in fitProjection still handles any other aspect.
  var W = 1280, H = 245;

  // Geometry is authored in a W x H box, but the canvas is not that shape: the
  // stage is a wide, short strip (~1138x218 at DPR 1, an aspect of 5.2:1
  // against the box's 2.3:1). Feeding the fixed box to the shader clipped every
  // pixel below y = 218/560 of the geometry — the number-line axis, the graph
  // x-axis and most of the animated markers were simply cut off, which is why
  // scenes measured a ~1.9% fill while still passing a "not blank" check.
  //
  // Instead of stretching (which would distort circles into ovals), the
  // authored box is letterboxed to *fit* the real canvas: uniform scale, one
  // axis padded. Uniforms are updated per draw, so the same scene adapts to
  // whatever size the stage happens to be.
  var resW = W, resH = H, projScale = 1, originX = 0, originY = 0;
  function fitProjection(cw, chh) {
    if (!(cw > 0 && chh > 0)) return;
    // Scale so the authored box *fits* inside the real canvas (letterbox),
    // never stretching. Expressed in authored units so scene code is untouched.
    projScale = Math.min(cw / W, chh / H);
    resW = cw;
    resH = chh;
    originX = -(cw / projScale - W) / 2;
    originY = -(chh / projScale - H) / 2;
  }

  function buildNumberLine(cfg) {
    var r = rng(cfg.seed);
    var pts = [], cols = [], edges = [];
    var base = H * 0.78;
    // A long axis with integer ticks — the visual anchor for number systems.
    var n = 22;
    for (var i = 0; i <= n; i++) {
      var x = 80 + (i / n) * (W - 160);
      edges.push(x, base, x, base - (i % 5 === 0 ? 30 : 14));
      var c = hsl(cfg.hue, 0.7, i % 5 === 0 ? 0.72 : 0.55);
      pts.push(x, base - (i % 5 === 0 ? 30 : 14));
      cols.push(c[0], c[1], c[2]);
    }
    edges.push(80, base, W - 80, base);
    // Floating markers drifting along the axis — the "numbers as spheres".
    var floats = [];
    for (var k = 0; k < 34; k++) {
      floats.push({
        x: 80 + r() * (W - 160),
        // Markers live in the column above the axis, which is now near the
        // bottom of the box, so all of the box's height is usable travel.
        r: 10 + r() * 20,
        sp: 0.2 + r() * 0.5,
        ph: r() * 6.28
      });
    }
    // sizes must be a per-vertex array — it was being passed the *count* of
    // points (pts.length / 2), which the renderer uploaded as a single
    // garbage float. Every tick on the axis drew at that bogus size.
    var ticks = [];
    for (var s = 0; s <= n; s++) ticks.push(s % 5 === 0 ? 16 : 10);
    return {
      points: pts, colors: cols, edges: edges,
      sizes: ticks,
      tick: function (t) {
        // Rebuild only the floating layer each frame via the shared buffers.
        //
        // These markers rise from the axis and drift upward, "numbers becoming
        // spheres". Each one carries a phase offset so they are distributed
        // through the whole column rather than moving as a clump, and the
        // position is clamped to the stage so a marker never leaves the canvas
        // (an unclamped sawtooth used to spend most of its cycle off-screen,
        // which is why this scene measured a 1.9% fill).
        var fp = [], fc = [], fs = [];
        var rise = base - 34;
        for (var i = 0; i < floats.length; i++) {
          var f = floats[i];
          var ph = f.ph + t * f.sp;
          // Offsets are spread across the full travel distance, so at any
          // instant the cloud spans the column instead of sitting at one band.
          var yy = base - 24 - (((ph * 40) + (i / floats.length) * rise) % rise);
          var xx = f.x + Math.cos(ph * 0.6) * 14;
          // Fade out toward the top of the travel so markers dissolve rather
          // than vanish abruptly when the modulo wraps.
          var edge = Math.min(1, (base - 24 - yy) / 40);
          var c = hsl(cfg.hue + Math.sin(ph) * 20, 0.8, 0.58 + 0.12 * edge);
          fp.push(xx, yy);
          fc.push(c[0], c[1], c[2]);
          fs.push(f.r * (0.55 + 0.45 * edge));
        }
        this.dynPoints = fp;
        this.dynColors = fc;
        this.dynSizes = fs;
      }
    };
  }

  function buildGraph(cfg) {
    var r = rng(cfg.seed);
    // Proportional margins, not absolute pixel offsets. The earlier fixed
    // values (oy = H-90, h = H-180) were written for a 560-tall box; at the
    // stage's real 245-tall box, h collapsed to 65px and the plot flattened.
    var mL = Math.round(W * 0.11);
    var mR = Math.round(W * 0.09);
    var mB = Math.round(H * 0.16);
    var mT = Math.round(H * 0.14);
    var ox = mL, oy = H - mB, w = W - mL - mR, h = H - mB - mT;
    var edges = [
      ox, oy - h, ox, oy + 40,      // y axis
      ox - 60, oy, ox + w, oy       // x axis
    ];
    // Marching grid lines.
    for (var g = 1; g <= 5; g++) {
      edges.push(ox, oy - (h * g) / 5, ox + w, oy - (h * g) / 5);
    }
    var a = 0.4 + r() * 0.5;
    var curvePts = [];
    var N = 120;
    for (var i = 0; i <= N; i++) {
      var xn = i / N;
      var yn = Math.sin(xn * 6.28318 * a) * 0.5 + 0.5;
      curvePts.push(ox + xn * w, oy - yn * h);
    }
    for (var j = 0; j + 3 < curvePts.length; j += 2) {
      edges.push(curvePts[j], curvePts[j + 1], curvePts[j + 2], curvePts[j + 3]);
    }
    var pts = [], cols = [], sizes = [];
    for (var k = 0; k < 40; k++) {
      var xn2 = r();
      var yn2 = Math.sin(xn2 * 6.28318 * a) * 0.5 + 0.5;
      pts.push(ox + xn2 * w, oy - yn2 * h);
      var c = hsl(cfg.hue, 0.85, 0.68);
      cols.push(c[0], c[1], c[2]);
      sizes.push(7);
    }
    return {
      points: pts, colors: cols, edges: edges, sizes: sizes,
      tick: function (t) {
        // A tracer dot sweeping the curve — the "animation" in the description.
        var prog = (t * 0.12) % 1;
        var x = ox + prog * w;
        var y = oy - (Math.sin(prog * 6.28318 * a) * 0.5 + 0.5) * h;
        var c = hsl(cfg.hue + 30, 0.95, 0.72);
        this.dynPoints = [x, y];
        this.dynColors = [c[0], c[1], c[2]];
        this.dynSizes = [18];
      }
    };
  }

  function buildMolecule(cfg) {
    var r = rng(cfg.seed);
    var cx = W / 2, cy = H / 2;
    // Radial distances scale with the shortest half-axis so the structure fits
    // whatever box it is authored in. Absolute values (dist up to 210px) were
    // written for a 560-tall box and would spill out of the real 245-tall one.
    var reach = Math.min(W / 2, H / 2);
    var atoms = [{ x: cx, y: cy, r: Math.round(reach * 0.21), main: true }];
    var ring = 3 + Math.floor(r() * 3);
    for (var i = 0; i < ring; i++) {
      var ang = (i / ring) * 6.28318 + r();
      var dist = reach * (0.42 + r() * 0.34);
      atoms.push({
        x: cx + Math.cos(ang) * dist,
        y: cy + Math.sin(ang) * dist,
        r: Math.round(reach * (0.1 + r() * 0.08)),
        main: false
      });
    }
    var edges = [];
    for (var a = 1; a < atoms.length; a++) {
      edges.push(cx, cy, atoms[a].x, atoms[a].y);
    }
    // Secondary bonds between outer atoms — makes it read as a real structure.
    for (var b = 1; b < atoms.length; b++) {
      var nx = 1 + (b % (atoms.length - 1));
      if (nx !== b) edges.push(atoms[b].x, atoms[b].y, atoms[nx].x, atoms[nx].y);
    }
    var pts = [], cols = [], sizes = [];
    for (var k = 0; k < atoms.length; k++) {
      pts.push(atoms[k].x, atoms[k].y);
      var c = atoms[k].main ? hsl(cfg.hue, 0.9, 0.7) : hsl(cfg.hue + 40, 0.7, 0.6);
      cols.push(c[0], c[1], c[2]);
      sizes.push(atoms[k].r);
    }
    // Free electrons orbiting — the "reaction" motion. Radii are fractions of
    // the box's reach so they stay inside it at any authored aspect.
    var orbiters = [];
    for (var o = 0; o < 18; o++) {
      orbiters.push({ rad: reach * (0.55 + r() * 0.6), sp: 0.3 + r() * 0.8, ph: r() * 6.28, sz: Math.max(3, reach * 0.04) });
    }
    return {
      points: pts, colors: cols, edges: edges, sizes: sizes,
      tick: function (t) {
        var fp = [], fc = [], fs = [];
        for (var i = 0; i < orbiters.length; i++) {
          var ob = orbiters[i];
          var ang = ob.ph + t * ob.sp;
          fp.push(cx + Math.cos(ang) * ob.rad, cy + Math.sin(ang) * ob.rad * 0.62);
          var c = hsl(cfg.hue + 60 + i * 4, 0.85, 0.7);
          fc.push(c[0], c[1], c[2]);
          fs.push(ob.sz);
        }
        this.dynPoints = fp;
        this.dynColors = fc;
        this.dynSizes = fs;
      }
    };
  }

  function buildCell(cfg) {
    var r = rng(cfg.seed);
    var cx = W / 2, cy = H / 2;
    var edges = [];
    // Membrane: a closed ring drawn as segments. R is a fraction of the box's
    // reach (it was a fixed 200px, sized for a 560-tall box).
    var reach = Math.min(W / 2, H / 2);
    var R = reach * 0.78;
    var SEG = 72;
    for (var i = 0; i < SEG; i++) {
      var a1 = (i / SEG) * 6.28318, a2 = ((i + 1) / SEG) * 6.28318;
      var rr1 = R + Math.sin(a1 * 5) * (R * 0.04), rr2 = R + Math.sin(a2 * 5) * (R * 0.04);
      edges.push(cx + Math.cos(a1) * rr1, cy + Math.sin(a1) * rr1 * 0.72,
                 cx + Math.cos(a2) * rr2, cy + Math.sin(a2) * rr2 * 0.72);
    }
    var organs = [{ x: cx, y: cy, r: Math.round(reach * 0.22) }];
    for (var k = 0; k < 7; k++) {
      var ang = (k / 7) * 6.28318 + r();
      var d = reach * (0.32 + r() * 0.5);
      organs.push({ x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d * 0.72, r: Math.round(reach * (0.07 + r() * 0.1)) });
    }
    var pts = [], cols = [], sizes = [];
    for (var m = 0; m < organs.length; m++) {
      pts.push(organs[m].x, organs[m].y);
      var c = hsl(cfg.hue + m * 6, 0.75, 0.66);
      cols.push(c[0], c[1], c[2]);
      sizes.push(organs[m].r);
    }
    var drift = [];
    for (var q = 0; q < 22; q++) {
      drift.push({ x: cx + (r() - 0.5) * R * 1.6, y: cy + (r() - 0.5) * R * 1.1, sz: 4 + r() * 8, sp: r() * 6.28 });
    }
    return {
      points: pts, colors: cols, edges: edges, sizes: sizes,
      tick: function (t) {
        var fp = [], fc = [], fs = [];
        for (var i = 0; i < drift.length; i++) {
          var d = drift[i];
          fp.push(d.x + Math.sin(t * 0.6 + d.sp) * 14, d.y + Math.cos(t * 0.5 + d.sp) * 12);
          var c = hsl(cfg.hue + 20, 0.8, 0.72);
          fc.push(c[0], c[1], c[2]);
          fs.push(d.sz);
        }
        this.dynPoints = fp;
        this.dynColors = fc;
        this.dynSizes = fs;
      }
    };
  }

  function buildOrbit(cfg) {
    var r = rng(cfg.seed);
    var cx = W / 2, cy = H / 2;
    var edges = [];
    var rings = 3 + Math.floor(r() * 2);
    // Ring radii step out as a fraction of the box's reach (fixed 90 + i*68
    // was sized for a 560-tall box and overflowed the real one).
    var reach = Math.min(W / 2, H / 2);
    var radii = [];
    for (var i = 0; i < rings; i++) {
      var R = reach * (0.34 + i * 0.22);
      radii.push(R);
      var SEG = 64;
      for (var s = 0; s < SEG; s++) {
        var a1 = (s / SEG) * 6.28318, a2 = ((s + 1) / SEG) * 6.28318;
        edges.push(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R * 0.6,
                   cx + Math.cos(a2) * R, cy + Math.sin(a2) * R * 0.6);
      }
    }
    var pts = [cx, cy], cols = [], sizes = [Math.round(reach * 0.2)];
    var c0 = hsl(cfg.hue, 0.9, 0.75);
    cols.push(c0[0], c0[1], c0[2]);
    var planets = [];
    for (var p = 0; p < rings; p++) {
      planets.push({ R: radii[p], sp: 0.5 - p * 0.09, ph: r() * 6.28, sz: Math.round(reach * (0.06 + r() * 0.05)) });
    }
    return {
      points: pts, colors: cols, edges: edges, sizes: sizes,
      tick: function (t) {
        var fp = [], fc = [], fs = [];
        for (var i = 0; i < planets.length; i++) {
          var pl = planets[i];
          var ang = pl.ph + t * pl.sp;
          fp.push(cx + Math.cos(ang) * pl.R, cy + Math.sin(ang) * pl.R * 0.6);
          var c = hsl(cfg.hue + i * 34, 0.8, 0.7);
          fc.push(c[0], c[1], c[2]);
          fs.push(pl.sz);
        }
        this.dynPoints = fp;
        this.dynColors = fc;
        this.dynSizes = fs;
      }
    };
  }

  function buildWave(cfg) {
    var r = rng(cfg.seed);
    var edges = [];
    var mid = H / 2;
    edges.push(60, mid, W - 60, mid);
    var freq = 1.5 + r() * 2;
    // Amplitude as a fraction of the box height. The fixed 90-150px band was
    // sized for a 560-tall box and pushed the wave off the real 245-tall one.
    var amp = H * (0.2 + r() * 0.16);
    for (var k = 0; k < 3; k++) {
      var off = k * 40 - 40;
      var prevX = 60, prevY = mid;
      for (var x = 60; x <= W - 60; x += 10) {
        var y = mid + Math.sin((x / W) * 6.28318 * freq + k * 0.8) * amp + off * 0.3;
        edges.push(prevX, prevY, x, y);
        prevX = x; prevY = y;
      }
    }
    var pts = [], cols = [], sizes = [];
    for (var i = 0; i < 30; i++) {
      var xn = r();
      var yn = mid + Math.sin(xn * 6.28318 * freq) * amp;
      pts.push(60 + xn * (W - 120), yn);
      var c = hsl(cfg.hue + i * 3, 0.85, 0.7);
      cols.push(c[0], c[1], c[2]);
      sizes.push(6);
    }
    return {
      points: pts, colors: cols, edges: edges, sizes: sizes,
      tick: function (t) {
        var fp = [], fc = [], fs = [];
        for (var i = 0; i < 14; i++) {
          var prog = ((t * 0.18 + i / 14) % 1);
          var x = 60 + prog * (W - 120);
          var y = mid + Math.sin(prog * 6.28318 * freq + t * 1.6) * amp;
          fp.push(x, y);
          var c = hsl(cfg.hue + i * 10, 0.95, 0.74);
          fc.push(c[0], c[1], c[2]);
          fs.push(14);
        }
        this.dynPoints = fp;
        this.dynColors = fc;
        this.dynSizes = fs;
      }
    };
  }

  function buildGrid(cfg) {
    var r = rng(cfg.seed);
    var edges = [];
    var cols = 12, rows = 6;
    // Padding as a fraction of the box, not a fixed 90px (which consumed most
    // of a 245-tall box and left almost no grid).
    var padX = W * 0.05, padY = H * 0.1;
    var cw = (W - padX * 2) / cols, ch = (H - padY * 2) / rows;
    for (var i = 0; i <= cols; i++) edges.push(padX + i * cw, padY, padX + i * cw, H - padY);
    for (var j = 0; j <= rows; j++) edges.push(padX, padY + j * ch, W - padX, padY + j * ch);
    var pts = [], pcols = [], sizes = [];
    for (var c = 0; c < cols; c++) {
      for (var rw = 0; rw < rows; rw++) {
        if (r() < 0.45) continue;
        pts.push(padX + c * cw + cw / 2, padY + rw * ch + ch / 2);
        var col = hsl(cfg.hue - c * 6 + rw * 3, 0.8, 0.62);
        pcols.push(col[0], col[1], col[2]);
        sizes.push(Math.max(5, Math.min(cw, ch) * (0.25 + r() * 0.4)));
      }
    }
    return {
      points: pts, colors: pcols, edges: edges, sizes: sizes,
      tick: function (t) {
        var fp = [], fc = [], fs = [];
        for (var i = 0; i < 12; i++) {
          var prog = (t * 0.1 + i / 12) % 1;
          var xx = padX + prog * (W - padX * 2);
          fp.push(xx, padY + (Math.sin(prog * 6.28 + i) * 0.5 + 0.5) * (H - padY * 2));
          var c = hsl(cfg.hue + i * 8, 0.9, 0.7);
          fc.push(c[0], c[1], c[2]);
          fs.push(Math.max(4, Math.min(cw, ch) * 0.35));
        }
        this.dynPoints = fp;
        this.dynColors = fc;
        this.dynSizes = fs;
      }
    };
  }

  function buildParticles(cfg) {
    var r = rng(cfg.seed);
    var edges = [];
    var pts = [], cols = [], sizes = [];
    var seeds = [];
    // A uniform scatter reads as "dust", not as a scene: at the stage's real
    // size it measured well under the coverage floor. Structure it instead —
    // a few gravitational centres that particles clump around, joined by faint
    // filaments, gives the abstract fallback an actual composition. This is the
    // archetype most of the catalog falls back to, so it carries the most weight.
    var centres = [];
    var nc = 4 + Math.floor(r() * 3);
    for (var c = 0; c < nc; c++) {
      centres.push({ x: W * (0.18 + r() * 0.64), y: H * (0.2 + r() * 0.6), w: 0.5 + r() * 0.8 });
    }
    // Faint filaments between centres so the clumps belong to one structure.
    for (var e = 0; e < centres.length; e++) {
      var a2 = centres[e], b2 = centres[(e + 1) % centres.length];
      if (r() < 0.7) edges.push(a2.x, a2.y, b2.x, b2.y);
    }
    var N = 260;
    for (var i = 0; i < N; i++) {
      // Bias each particle toward a random centre: gaussian-ish spread.
      var ct = centres[Math.floor(r() * centres.length)];
      var spread = 70 + (1 - ct.w) * 120;
      var gx = (r() + r() + r() - 1.5) * spread;
      var gy = (r() + r() + r() - 1.5) * spread * 0.6;
      var x0 = ct.x + gx;
      var y0 = ct.y + gy;
      // Keep inside the authored box so nothing is clipped at the edges.
      x0 = Math.max(20, Math.min(W - 20, x0));
      y0 = Math.max(20, Math.min(H - 20, y0));
      seeds.push({ x: x0, y: y0, z: 0.45 + r() * 0.55, sz: 9 + r() * 18, ph: r() * 6.28 });
    }
    return {
      points: pts, colors: cols, edges: edges, sizes: sizes,
      tick: function (t) {
        var fp = [], fc = [], fs = [];
        for (var i = 0; i < seeds.length; i++) {
          var s = seeds[i];
          var x = s.x + Math.sin(t * 0.25 * s.z + s.ph) * 30;
          var y = s.y + Math.cos(t * 0.2 * s.z + s.ph) * 22;
          // Wrap within the authored box, not the raw canvas, so particles
          // stay inside the letterboxed region.
          y = ((y % H) + H) % H;
          x = ((x % W) + W) % W;
          fp.push(x, y);
          var c = hsl(cfg.hue + s.ph * 20, 0.8, 0.42 + s.z * 0.34);
          fc.push(c[0], c[1], c[2]);
          fs.push(s.sz * s.z);
        }
        this.dynPoints = fp;
        this.dynColors = fc;
        this.dynSizes = fs;
      }
    };
  }

  var BUILDERS = {
    numberline: buildNumberLine,
    graph: buildGraph,
    molecule: buildMolecule,
    cell: buildCell,
    orbit: buildOrbit,
    wave: buildWave,
    grid: buildGrid,
    particles: buildParticles
  };

  // ── wire up every scene host ─────────────────────────────────────────────
  var scenes = [];

  document.querySelectorAll(".qe-scene").forEach(function (host) {
    var cv = host.querySelector("canvas");
    var cfgEl = host.querySelector(".qe-scene-cfg");
    if (!cv || !cfgEl) return;
    var cfg;
    try { cfg = JSON.parse(cfgEl.textContent || "{}"); } catch (e) { cfg = {}; }
    cfg.hue = typeof cfg.hue === "number" ? cfg.hue : 265;
    cfg.seed = cfg.seed >>> 0;

    var g = contextFor(cv);
    if (!g) { solidFallback(host); return; }
    var rt = programsFor(g);
    if (!rt) { solidFallback(host); return; }

    var builder = BUILDERS[cfg.kind] || buildParticles;
    var scene;
    try { scene = builder(cfg); } catch (e) { solidFallback(host); return; }
    scene.__hue = cfg.hue;
    // Precompute a static frame so a paused scene is never blank.
    scene.tick(0);
    scenes.push({ host: host, canvas: cv, scene: scene, rt: rt });
  });

  function upload(sc, p, L, bufs, data) {
    var g = sc.rt.g;
    g.useProgram(p);
    g.uniform2f(L.res, resW, resH);
    if (L.origin) g.uniform2f(L.origin, originX, originY);
    if (L.scale) g.uniform1f(L.scale, projScale);
    if (data.pos.length) {
      g.bindBuffer(g.ARRAY_BUFFER, bufs.pos);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array(data.pos), g.DYNAMIC_DRAW);
      g.enableVertexAttribArray(L.pos);
      g.vertexAttribPointer(L.pos, 2, g.FLOAT, false, 0, 0);
    }
    if (L.size >= 0 && data.sizes.length) {
      g.bindBuffer(g.ARRAY_BUFFER, bufs.size);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array(data.sizes), g.DYNAMIC_DRAW);
      g.enableVertexAttribArray(L.size);
      g.vertexAttribPointer(L.size, 1, g.FLOAT, false, 0, 0);
    }
    if (L.color >= 0 && data.colors.length) {
      g.bindBuffer(g.ARRAY_BUFFER, bufs.color);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array(data.colors), g.DYNAMIC_DRAW);
      g.enableVertexAttribArray(L.color);
      g.vertexAttribPointer(L.color, 3, g.FLOAT, false, 0, 0);
    }
  }

  function drawScene(sc, t, force) {
    var host = sc.host;
    var rect = host.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    // Skip scenes that are not on screen — a lesson has up to 16 of them and
    // only one clip is visible at a time. NOTE: visibility:hidden (how .clip
    // works) does NOT null out offsetParent, so that check alone would draw
    // all 16 every frame. checkVisibility() sees through it.
    //
    // The force flag bypasses the gate for the initial paint. At load time the
    // GSAP timeline has not yet applied its visibility sets, so every clip is
    // still hidden and a gated first frame would leave all 16 canvases blank
    // until the user pressed play.
    if (!force) {
      if (typeof host.checkVisibility === "function") {
        if (!host.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return;
      } else if (host.offsetParent === null) {
        return;
      }
    }

    var rt = sc.rt;
    var gl = rt.g;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.max(2, Math.round(rect.width * dpr));
    var chh = Math.max(2, Math.round(rect.height * dpr));
    if (sc.canvas.width !== cw || sc.canvas.height !== chh) {
      sc.canvas.width = cw;
      sc.canvas.height = chh;
    }

    sc.scene.tick(t);

    // Project the authored W x H box into whatever canvas we actually got.
    fitProjection(cw, chh);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, chh);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Static edges (axis, membrane, grid, curve).
    var edges = sc.scene.edges || [];
    if (edges.length) {
      gl.useProgram(rt.progLine);
      gl.uniform2f(rt.L_LINE.res, resW, resH);
      if (rt.L_LINE.origin) gl.uniform2f(rt.L_LINE.origin, originX, originY);
      if (rt.L_LINE.scale) gl.uniform1f(rt.L_LINE.scale, projScale);
      gl.bindBuffer(gl.ARRAY_BUFFER, rt.bufEdge);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edges), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(rt.L_LINE.pos);
      gl.vertexAttribPointer(rt.L_LINE.pos, 2, gl.FLOAT, false, 0, 0);
      var lc = hsl(sc.scene.__hue || 265, 0.45, 0.42);
      if (rt.L_LINE.color >= 0) {
        var cc = new Float32Array(edges.length / 2 * 3);
        for (var q = 0; q < edges.length / 2; q++) {
          cc[q * 3] = lc[0]; cc[q * 3 + 1] = lc[1]; cc[q * 3 + 2] = lc[2];
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, rt.bufColor);
        gl.bufferData(gl.ARRAY_BUFFER, cc, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(rt.L_LINE.color);
        gl.vertexAttribPointer(rt.L_LINE.color, 3, gl.FLOAT, false, 0, 0);
      }
      gl.drawArrays(gl.LINES, 0, edges.length / 2);
    }

    // Base points.
    if (sc.scene.points && sc.scene.points.length) {
      upload(sc, rt.progPoint, rt.L_POINT, { pos: rt.bufPos, size: rt.bufSize, color: rt.bufColor }, {
        pos: sc.scene.points,
        sizes: sc.scene.sizes || [],
        colors: sc.scene.colors || []
      });
      gl.drawArrays(gl.POINTS, 0, sc.scene.points.length / 2);
    }

    // Animated points.
    if (sc.scene.dynPoints && sc.scene.dynPoints.length) {
      upload(sc, rt.progPoint, rt.L_POINT, { pos: rt.bufPos, size: rt.bufSize, color: rt.bufColor }, {
        pos: sc.scene.dynPoints,
        sizes: sc.scene.dynSizes || [],
        colors: sc.scene.dynColors || []
      });
      gl.drawArrays(gl.POINTS, 0, sc.scene.dynPoints.length / 2);
    }
  }

  function frame(t, force) {
    for (var i = 0; i < scenes.length; i++) {
      try { drawScene(scenes[i], t, !!force); } catch (e) { solidFallback(scenes[i].host); }
    }
  }

  // ── public api ───────────────────────────────────────────────────────────
  var rafId = null;
  var currentT = 0;
  window.__scenes = {
    ready: scenes.length > 0,
    count: scenes.length,
    seek: function (t) {
      currentT = t;
      // Coalesce: GSAP's onUpdate can fire many times per frame while
      // scrubbing. One rAF per burst is enough.
      if (rafId === null) {
        rafId = requestAnimationFrame(function () {
          rafId = null;
          frame(currentT);
        });
      }
    },
    // WebGL contexts can be lost when a tab is backgrounded for a long time.
    revive: function () { frame(currentT, true); }
  };

  // Paint every scene once, ungated, so a lesson opened but not yet played
  // still shows its visuals. Then paint again on the next frame, this time
  // honouring visibility, so the compositor has settled sizes to work with.
  frame(0, true);
  requestAnimationFrame(function () {
    frame(currentT, true);
    requestAnimationFrame(function () { frame(currentT, false); });
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) frame(currentT, false);
  });
})();
`;

/**
 * CSS for the scene surface. Injected alongside SCENE_RUNTIME.
 *
 * `flex: none` is load-bearing, not cosmetic. `.qe-fill` is a flex column with
 * `justify-content: center`, and a part's content (title + 5 bullets + scene +
 * caption) routinely overflows the 720px stage. Without `flex: none` the scene
 * is the only shrinkable child, so flexbox collapses it to ~2px and the canvas
 * renders nothing — which is exactly what the headless pixel test caught.
 */
export const SCENE_CSS = `
      .qe-scene { position: relative; flex: none; width: 100%; height: min(30vh, 250px); margin-top: 14px; border-radius: 16px; overflow: hidden; background: radial-gradient(circle at 30% 30%, rgba(99,102,241,0.16), rgba(15,23,42,0.0) 70%); border: 1px solid rgba(148,163,184,0.18); }
      .qe-fill-light .qe-scene { background: radial-gradient(circle at 30% 30%, rgba(99,102,241,0.14), rgba(248,250,252,0.0) 70%); border-color: rgba(100,116,139,0.22); }
      .qe-scene-canvas { display: block; width: 100%; height: 100%; }
      .qe-scene-solid.qe-scene { background: linear-gradient(135deg, rgba(79,70,229,0.28), rgba(15,23,42,0.05) 60%, rgba(79,70,229,0.22)); }
      .qe-scene-fallback { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; font-size: 18px; font-style: italic; opacity: 0.75; text-align: center; }
`;
