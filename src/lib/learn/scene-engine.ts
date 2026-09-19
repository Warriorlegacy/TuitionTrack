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
    "varying vec3 vColor;",
    "void main() {",
    "  vec2 clip = (aPos / uRes) * 2.0 - 1.0;",
    "  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);",
    "  gl_PointSize = aSize;",
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
        res: g.getUniformLocation(p, "uRes")
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
  var W = 1280, H = 560;

  function buildNumberLine(cfg) {
    var r = rng(cfg.seed);
    var pts = [], cols = [], edges = [];
    var base = H * 0.58;
    // A long axis with integer ticks — the visual anchor for number systems.
    var n = 22;
    for (var i = 0; i <= n; i++) {
      var x = 80 + (i / n) * (W - 160);
      edges.push(x, base, x, base + (i % 5 === 0 ? 30 : 14));
      var c = hsl(cfg.hue, 0.7, i % 5 === 0 ? 0.72 : 0.55);
      pts.push(x, base + (i % 5 === 0 ? 30 : 14));
      cols.push(c[0], c[1], c[2]);
    }
    edges.push(80, base, W - 80, base);
    // Floating markers drifting along the axis — the "numbers as spheres".
    var floats = [];
    for (var k = 0; k < 26; k++) {
      floats.push({
        x: 80 + r() * (W - 160),
        y: base - 60 - r() * 240,
        r: 6 + r() * 14,
        sp: 0.2 + r() * 0.5,
        ph: r() * 6.28
      });
    }
    return {
      points: pts, colors: cols, edges: edges,
      sizes: pts.length / 2,
      tick: function (t) {
        // Rebuild only the floating layer each frame via the shared buffers.
        var fp = [], fc = [], fs = [];
        for (var i = 0; i < floats.length; i++) {
          var f = floats[i];
          var yy = f.y + Math.sin(t * f.sp + f.ph) * 26;
          var xx = f.x + Math.cos(t * f.sp * 0.6 + f.ph) * 12;
          fp.push(xx, base - 30 - ((t * 26 + i * 24) % (H * 0.72)));
          var c = hsl(cfg.hue + f.ph * 12, 0.8, 0.66);
          fc.push(c[0], c[1], c[2]);
          fs.push(f.r);
        }
        this.dynPoints = fp;
        this.dynColors = fc;
        this.dynSizes = fs;
      }
    };
  }

  function buildGraph(cfg) {
    var r = rng(cfg.seed);
    var ox = 140, oy = H - 90, w = W - 300, h = H - 180;
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
    var atoms = [{ x: cx, y: cy, r: 26, main: true }];
    var ring = 3 + Math.floor(r() * 3);
    for (var i = 0; i < ring; i++) {
      var ang = (i / ring) * 6.28318 + r();
      var dist = 120 + r() * 90;
      atoms.push({
        x: cx + Math.cos(ang) * dist,
        y: cy + Math.sin(ang) * dist,
        r: 12 + r() * 10,
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
    // Free electrons orbiting — the "reaction" motion.
    var orbiters = [];
    for (var o = 0; o < 18; o++) {
      orbiters.push({ rad: 150 + r() * 160, sp: 0.3 + r() * 0.8, ph: r() * 6.28, sz: 5 + r() * 6 });
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
    // Membrane: a closed ring drawn as segments.
    var R = 200;
    var SEG = 72;
    for (var i = 0; i < SEG; i++) {
      var a1 = (i / SEG) * 6.28318, a2 = ((i + 1) / SEG) * 6.28318;
      var rr1 = R + Math.sin(a1 * 5) * 8, rr2 = R + Math.sin(a2 * 5) * 8;
      edges.push(cx + Math.cos(a1) * rr1, cy + Math.sin(a1) * rr1 * 0.72,
                 cx + Math.cos(a2) * rr2, cy + Math.sin(a2) * rr2 * 0.72);
    }
    var organs = [{ x: cx, y: cy, r: 44 }];
    for (var k = 0; k < 7; k++) {
      var ang = (k / 7) * 6.28318 + r();
      var d = 70 + r() * 110;
      organs.push({ x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d * 0.72, r: 14 + r() * 20 });
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
    var radii = [];
    for (var i = 0; i < rings; i++) {
      var R = 90 + i * 68;
      radii.push(R);
      var SEG = 64;
      for (var s = 0; s < SEG; s++) {
        var a1 = (s / SEG) * 6.28318, a2 = ((s + 1) / SEG) * 6.28318;
        edges.push(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R * 0.6,
                   cx + Math.cos(a2) * R, cy + Math.sin(a2) * R * 0.6);
      }
    }
    var pts = [cx, cy], cols = [], sizes = [54];
    var c0 = hsl(cfg.hue, 0.9, 0.75);
    cols.push(c0[0], c0[1], c0[2]);
    var planets = [];
    for (var p = 0; p < rings; p++) {
      planets.push({ R: radii[p], sp: 0.5 - p * 0.09, ph: r() * 6.28, sz: 16 + r() * 12 });
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
    var amp = 90 + r() * 60;
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
    var cols = 12, rows = 6, pad = 90;
    var cw = (W - pad * 2) / cols, ch = (H - pad * 2) / rows;
    for (var i = 0; i <= cols; i++) edges.push(pad + i * cw, pad, pad + i * cw, H - pad);
    for (var j = 0; j <= rows; j++) edges.push(pad, pad + j * ch, W - pad, pad + j * ch);
    var pts = [], pcols = [], sizes = [];
    for (var c = 0; c < cols; c++) {
      for (var rw = 0; rw < rows; rw++) {
        if (r() < 0.45) continue;
        pts.push(pad + c * cw + cw / 2, pad + rw * ch + ch / 2);
        var col = hsl(cfg.hue - c * 6 + rw * 3, 0.8, 0.62);
        pcols.push(col[0], col[1], col[2]);
        sizes.push(8 + r() * 16);
      }
    }
    return {
      points: pts, colors: pcols, edges: edges, sizes: sizes,
      tick: function (t) {
        var fp = [], fc = [], fs = [];
        for (var i = 0; i < 12; i++) {
          var prog = (t * 0.1 + i / 12) % 1;
          var xx = pad + prog * (W - pad * 2);
          fp.push(xx, pad + (Math.sin(prog * 6.28 + i) * 0.5 + 0.5) * (H - pad * 2));
          var c = hsl(cfg.hue + i * 8, 0.9, 0.7);
          fc.push(c[0], c[1], c[2]);
          fs.push(12);
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
    var N = 150;
    var seeds = [];
    for (var i = 0; i < N; i++) {
      seeds.push({ x: r() * W, y: r() * H, z: 0.3 + r() * 0.7, sz: 4 + r() * 12, ph: r() * 6.28 });
    }
    return {
      points: pts, colors: cols, edges: edges, sizes: sizes,
      tick: function (t) {
        var fp = [], fc = [], fs = [];
        for (var i = 0; i < seeds.length; i++) {
          var s = seeds[i];
          var x = s.x + Math.sin(t * 0.25 * s.z + s.ph) * 60;
          var y = s.y + Math.cos(t * 0.2 * s.z + s.ph) * 44;
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
    g.uniform2f(L.res, W, H);
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
      gl.uniform2f(rt.L_LINE.res, W, H);
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
