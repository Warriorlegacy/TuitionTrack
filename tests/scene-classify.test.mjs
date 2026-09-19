// Quick check that scene classification tracks subject matter.
// Run: NODE_OPTIONS="" npx tsx tests/scene-classify.test.mjs
import { classifyScene, hashSeed } from "../src/lib/learn/scene-engine";

const cases = [
  ["numberline", "A 3D glowing number line expanding from a central zero, with integers popping up as bright spheres."],
  ["molecule", "A 3D ball-and-stick model of a methane molecule with bonds rotating and electrons orbiting the carbon atom."],
  ["cell", "A 3D medical animation showing a cell membrane with organelles and DNA helix unwinding inside the nucleus."],
  ["wave", "A 3D visualization of a wave oscillating with changing amplitude and frequency along a horizontal axis."],
  ["grid", "A 3D terrain map of India showing monsoon wind patterns and population density across regions."],
  ["graph", "A 3D animated parabola plotted on a coordinate graph with a moving point tracing the curve."],
  ["orbit", "A 3D split-screen animation of a solar eclipse with the moon orbiting between earth and sun."],
  ["particles", "A timeless cinematic sequence about the French Revolution with abstract floating documents."],
];

let pass = 0;
let fail = 0;
for (const [want, visual] of cases) {
  const got = classifyScene(visual);
  if (got === want) {
    pass++;
    console.log(`ok   ${want.padEnd(12)} ${visual.slice(0, 58)}...`);
  } else {
    fail++;
    console.log(`FAIL want=${want} got=${got}  ${visual.slice(0, 58)}...`);
  }
}

// Determinism: the same input must always produce the same seed, or every
// re-bake would churn 519 files.
const a = hashSeed("c9-maths-01:0:Number Systems");
const b = hashSeed("c9-maths-01:0:Number Systems");
const c = hashSeed("c9-maths-01:1:Number Systems");
if (a === b && a !== c) {
  pass++;
  console.log("ok   hashSeed deterministic and content-sensitive");
} else {
  fail++;
  console.log(`FAIL hashSeed a=${a} b=${b} c=${c}`);
}

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail ? 1 : 0);
