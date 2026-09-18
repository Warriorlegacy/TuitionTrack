#!/usr/bin/env node
// Probe every configured platform AI key with a real 1-token completion so we
// know exactly which providers work before deploying. Read-only; prints PASS/FAIL.
// Run: node --env-file-if-exists=.env.local scripts/probe-ai-providers.mjs
const PROBE_MODEL = {
  groq: "openai/gpt-oss-20b",
  google: "gemini-2.5-flash",
  openrouter: "google/gemma-4-26b-a4b-it:free",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-haiku-20240307",
  together: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  nvidia: "nvidia/nemotron-3.5-lightning-30b-a3b",
  huggingface: "meta-llama/Llama-3.1-8B-Instruct",
  deepseek: "deepseek-chat",
  github: "openai/gpt-4o-mini",
  ollama: "llama3.1:8b",
};

async function probeOpenAICompat(name, base, key, model) {
  // Ollama serves localhost with no auth — Bearer only when a key is set.
  const headers = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
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

async function probeAnthropic(key) {
  const model = PROBE_MODEL.anthropic;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: "user", content: "Say OK" }] }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
  const j = JSON.parse(body);
  const text = j.content?.[0]?.text ?? "";
  return `model=${model} reply=${JSON.stringify(String(text).slice(0, 30))}`;
}

const PROBES = [
  { name: "groq", env: "GROQ_API_KEY", run: (k) => probeOpenAICompat("groq", "https://api.groq.com/openai/v1", k, PROBE_MODEL.groq) },
  { name: "google", env: "GEMINI_API_KEY", run: (k) => probeGoogle(k) },
  { name: "openrouter", env: "OPENROUTER_API_KEY", run: (k) => probeOpenAICompat("openrouter", "https://openrouter.ai/api/v1", k, PROBE_MODEL.openrouter) },
  { name: "openai", env: "OPENAI_API_KEY", run: (k) => probeOpenAICompat("openai", "https://api.openai.com/v1", k, PROBE_MODEL.openai) },
  { name: "anthropic", env: "ANTHROPIC_API_KEY", run: (k) => probeAnthropic(k) },
  { name: "together", env: "TOGETHER_API_KEY", run: (k) => probeOpenAICompat("together", "https://api.together.xyz/v1", k, PROBE_MODEL.together) },
  { name: "nvidia", env: "NVIDIA_NIM_API_KEY", run: (k) => probeOpenAICompat("nvidia", "https://integrate.api.nvidia.com/v1", k, PROBE_MODEL.nvidia) },
  { name: "huggingface", env: "HUGGINGFACE_API_KEY", run: (k) => probeOpenAICompat("huggingface", "https://router.huggingface.co/v1", k, PROBE_MODEL.huggingface) },
  { name: "deepseek", env: "DEEPSEEK_API_KEY", run: (k) => probeOpenAICompat("deepseek", "https://api.deepseek.com/v1", k, PROBE_MODEL.deepseek) },
  { name: "github", env: "GITHUB_MODELS_TOKEN", run: (k) => probeOpenAICompat("github", "https://models.github.ai/inference", k, PROBE_MODEL.github) },
  // Local-first: tries localhost by default; a refused connection is SKIP, not FAIL.
  { name: "ollama", env: "OLLAMA_BASE_URL", fallback: "http://localhost:11434/v1", local: true, run: (b) => probeOpenAICompat("ollama", b, process.env.OLLAMA_API_KEY, PROBE_MODEL.ollama) },
];

let failed = 0;
for (const p of PROBES) {
  const key = process.env[p.env] ?? p.fallback;
  if (!key) {
    console.log(`SKIP ${p.name.padEnd(12)} (${p.env} not set)`);
    continue;
  }
  try {
    const detail = await p.run(key);
    console.log(`PASS ${p.name.padEnd(12)} ${detail}`);
  } catch (e) {
    const msg = String(e.message ?? e);
    if (p.local && /fetch failed|ECONNREFUSED|ECONNRESET|connect/i.test(msg)) {
      console.log(`SKIP ${p.name.padEnd(12)} (not running at ${key})`);
      continue;
    }
    failed++;
    console.log(`FAIL ${p.name.padEnd(12)} ${msg.slice(0, 140)}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
