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

console.log(`\n${passed}/8 checks passed.`);
