// Guards the narration TTS provider abstraction.
//
// Why this test exists: the pipeline was hard-wired to Gemini, so a single
// exhausted key stalled the entire curriculum with no way to switch. The
// provider selection is config-driven and silent when it breaks — a wrong
// default or a lost env read would only show up after a long failed run.
// These are cheap static + runtime assertions that catch that first.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { narrationProviderReady } from "../src/lib/learn/narration.ts";
let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (e) {
    console.error(`  FAIL - ${name}\n       ${e.message}`);
    process.exitCode = 1;
  }
};

const src = readFileSync("src/lib/learn/narration.ts", "utf8");

console.log("narration provider abstraction");

// 1. Both providers must be reachable from config, and gemini must stay the
//    default so existing deployments keep working unchanged.
check("defaults to gemini when TTS_PROVIDER is unset", () => {
  delete process.env.TTS_PROVIDER;
  const r = narrationProviderReady();
  assert.equal(r.provider, "gemini");
});

check("TTS_PROVIDER=openai selects openai", () => {
  process.env.TTS_PROVIDER = "openai";
  const r = narrationProviderReady();
  assert.equal(r.provider, "openai");
  assert.match(r.reason ?? "", /OPENAI_API_KEY/);
});

check("an unknown TTS_PROVIDER falls back to gemini", () => {
  process.env.TTS_PROVIDER = "nonsense";
  assert.equal(narrationProviderReady().provider, "gemini");
});

check("TTS_PROVIDER=edge selects the free keyless provider", () => {
  process.env.TTS_PROVIDER = "edge";
  const r = narrationProviderReady();
  assert.equal(r.provider, "edge");
  // The whole point of edge is that it needs no credential. If it ever starts
  // reporting a missing key, the "completely free" guarantee is broken.
  assert.ok(
    !/API_KEY/.test(r.reason ?? ""),
    `edge must not require an API key, got: ${r.reason}`,
  );
});

check("edge requires its helper script to exist", () => {
  assert.match(src, /edgeHelperPath\(\)/, "edge path must resolve the helper");
  assert.match(src, /scripts", "tts_edge\.py"/, "helper must point at scripts/tts_edge.py");
});

// 2. Readiness must reflect the credential actually needed, per provider.
check("readiness reports the credential for the selected provider", () => {
  const savedOpenai = process.env.OPENAI_API_KEY;
  const savedGemini = process.env.GEMINI_API_KEY;

  process.env.TTS_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "sk-fake";
  assert.equal(narrationProviderReady().ok, true, "openai key present should be ready");

  delete process.env.OPENAI_API_KEY;
  process.env.GEMINI_API_KEY = "gm-fake";
  assert.equal(narrationProviderReady().ok, false, "openai selected but only gemini key set");

  if (savedOpenai !== undefined) process.env.OPENAI_API_KEY = savedOpenai;
  else delete process.env.OPENAI_API_KEY;
  if (savedGemini !== undefined) process.env.GEMINI_API_KEY = savedGemini;
  else delete process.env.GEMINI_API_KEY;
  delete process.env.TTS_PROVIDER;
});

// 3. The two providers return different containers, and the code must not
//    assume one. Gemini is headerless PCM (needs ffmpeg); OpenAI is MP3.
check("synthesis result carries a container discriminator", () => {
  assert.match(src, /type TtsResult = \{[^}]*container:\s*"pcm"\s*\|\s*"mp3"/, "TtsResult must declare container");
  assert.match(src, /container:\s*"pcm"\s*\}\s*;?\s*\n\}/, "gemini path must mark pcm in its return");
  assert.match(src, /synthesizeChunkOpenai[\s\S]{0,200}container:\s*"mp3"/, "openai helper must mark mp3");
});

check("the dispatcher maps the openai result to an mp3 container", () => {
  // This is the specific wiring that decides whether an OpenAI response is
  // written directly or mangled through the PCM transcode.
  assert.match(
    src,
    /synthesizeChunkWithRetry[\s\S]*?synthesizeChunkOpenai\(text, apiKey\)[\s\S]{0,200}container:\s*"mp3"/,
    "dispatcher must return container mp3 for the openai provider",
  );
});

check("the dispatcher maps the edge result to an mp3 container", () => {
  assert.match(
    src,
    /synthesizeChunkEdge\(text\)[\s\S]{0,140}container:\s*"mp3"/,
    "dispatcher must return container mp3 for the edge provider",
  );
});

check("edge helper writes text via file, not argv", () => {
  // A 3,000-character part must never be passed as a command-line argument.
  assert.match(src, /--text-file", inFile/, "edge helper must receive text via a file");
  const helper = readFileSync("scripts/tts_edge.py", "utf8");
  assert.match(helper, /--text-file/, "helper must accept --text-file");
  assert.match(helper, /edge_tts\.Communicate/, "helper must drive edge_tts.Communicate");
});

check("mp3 responses bypass the PCM->MP3 transcode", () => {
  // The lesson loop must branch on container, not call pcmToMp3 blindly.
  assert.match(src, /if \(container === "mp3"\)/, "lesson loop must branch on container");
  assert.match(src, /writeFileSync\(outPath, audio\)/, "mp3 path must write the buffer directly");
});

// 4. A 429 must carry the server's stated retry window so a batch run can wait
//    it out instead of dying. This was the bug that stalled generation.
check("429 carries retryAfterMs parsed from the response", () => {
  assert.match(src, /retryAfterMs/, "TtsError must carry retryAfterMs");
  assert.match(src, /retry in \(\[0-9\.\]\+\)s/i, "gemini 429 must parse 'retry in Ns'");
});

// 5. Resume correctness. A half-finished lesson must NOT count as complete, or
//    an interrupted run is silently never resumed. The original check only
//    validated the parts PRESENT in the manifest, which 9-of-12 satisfies.
const driver = readFileSync("scripts/narrate-all.ts", "utf8");

check("completeness is judged against required parts, not manifest length", () => {
  assert.match(driver, /function requiredParts\(/, "driver must compute how many parts a lesson needs");
  assert.match(
    driver,
    /usable\.length < want/,
    "covered() must compare present parts against required parts",
  );
  assert.match(
    driver,
    /for \(let i = 1; i <= want; i\+\+\)/,
    "covered() must verify every required part index is present, not merely enough of them",
  );
});

check("a hard interruption cannot leak a compaction temp file", () => {
  assert.match(src, /sweepCompactLeftovers/, "engine must sweep stray .compact.mp3 files");
});

console.log(`\n${passed}/14 checks passed.`);
