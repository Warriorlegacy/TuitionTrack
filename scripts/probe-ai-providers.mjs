#!/usr/bin/env node
// Probe every configured platform AI key with a real 1-token completion so we
// know exactly which providers work before deploying. Read-only; prints PASS/FAIL.
// Run: node --env-file-if-exists=.env.local scripts/probe-ai-providers.mjs
const PROBE_MODEL = {
  groq: "openai/gpt-oss-20b",
  google: "gemini-2.5-flash",
  openrouter: "nvidia/nemotron-3.5-lightning:free",
  nvidia: "nvidia/nemotron-3.5-lightning-30b-a3b",
  huggingface: "meta-llama/Llama-3.1-8B-Instruct",
};

async function probeOpenAICompat(name, base, key, model) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "Say OK" }], max_tokens: 5 }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
  const j = JSON.parse(body);
  const text = j.choices?.[0]?.message?.content ?? "";
  return `model=${model} reply=${JSON.stringify(String(text).slice(0, 30))}`;
}

async function probeGoogle(key) {
  const model = PROBE_MODEL.google;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Say OK" }] }], generationConfig: { maxOutputTokens: 5 } }),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
  const j = JSON.parse(body);
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return `model=${model} reply=${JSON.stringify(String(text).slice(0, 30))}`;
}

const PROBES = [
  { name: "groq", env: "GROQ_API_KEY", run: (k) => probeOpenAICompat("groq", "https://api.groq.com/openai/v1", k, PROBE_MODEL.groq) },
  { name: "google", env: "GEMINI_API_KEY", run: (k) => probeGoogle(k) },
  { name: "openrouter", env: "OPENROUTER_API_KEY", run: (k) => probeOpenAICompat("openrouter", "https://openrouter.ai/api/v1", k, PROBE_MODEL.openrouter) },
  { name: "nvidia", env: "NVIDIA_NIM_API_KEY", run: (k) => probeOpenAICompat("nvidia", "https://integrate.api.nvidia.com/v1", k, PROBE_MODEL.nvidia) },
  { name: "huggingface", env: "HUGGINGFACE_API_KEY", run: (k) => probeOpenAICompat("huggingface", "https://router.huggingface.co/v1", k, PROBE_MODEL.huggingface) },
];

let failed = 0;
for (const p of PROBES) {
  const key = process.env[p.env];
  if (!key) {
    console.log(`SKIP ${p.name.padEnd(12)} (${p.env} not set)`);
    continue;
  }
  try {
    const detail = await p.run(key);
    console.log(`PASS ${p.name.padEnd(12)} ${detail}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${p.name.padEnd(12)} ${String(e.message).slice(0, 140)}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
