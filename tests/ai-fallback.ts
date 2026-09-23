// AI fallback-system tests — pure routing logic, no keys, no network.
// Run: npm run test:ai-fallback  (npx tsx tests/ai-fallback.ts)
// Covers spec §24 cases 2,4,8,9,10 (+ cooldown 16/17, classification 3).
import { strict as assert } from "node:assert";
import {
  classifyAttemptError,
  costMode,
  isCooledDown,
  isFreeModel,
  isPaidUsageAllowed,
  pickModel,
  PROVIDER_FREE_MODELS,
  recordFailure,
  recordSuccess,
  resolveFreeOnly,
  shouldSkipPaidModel,
  supportsCapabilities,
  type ProviderKind,
} from "../src/lib/ai/provider";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

const err429 = new Error("provider 429 (openrouter): rate limited, free quota exhausted");
const err404free = new Error(
  'provider 404 (openrouter): {"error":{"message":"This model is unavailable for free. Use this slug instead: foo"}}',
);
const err404endpoints = new Error("provider 404 (openrouter): No endpoints found for model");
const errGoogleRetired = new Error(
  'provider 404 (google): {"error": {"code": 404, "message": "models/gemini-2.5-flash-lite is no longer available"}}',
);
const errGoogleUnknown = new Error("provider 404 (google): model not found");
const err401 = new Error("provider 401 (openai): invalid api key");
const errTimeout = new Error("fetch failed: timeout");
const errConn = new Error("fetch failed");
const err400 = new Error("provider 400 (google): invalid argument");
const errEmpty = new Error("provider openai gpt-4o returned empty content");

// 2/3. Primary 429 / retired-slug → rotate to next free model.
check("429 on openrouter rotates", () => {
  assert.equal(classifyAttemptError(err429, "openrouter", "google/gemma-4-26b-a4b-it:free"), "rotate");
});
check("404 unavailable-for-free rotates", () => {
  assert.equal(
    classifyAttemptError(err404free, "openrouter", "inclusionai/ling-3.0-flash-vl:free"),
    "rotate",
  );
});
check("404 no-endpoints rotates", () => {
  assert.equal(classifyAttemptError(err404endpoints, "openrouter", "x:free"), "rotate");
});
// 3. Timeouts → one same-model retry.
check("timeout retries same model", () => {
  assert.equal(classifyAttemptError(errTimeout, "groq", "openai/gpt-oss-20b"), "retry-same");
  assert.equal(classifyAttemptError(errConn, "google", "gemini-3.5-flash-lite"), "retry-same");
});
// 4. Invalid key → failover (never retry same), retired Google → successor hop.
check("401 fails over (no same-model retry)", () => {
  assert.equal(classifyAttemptError(err401, "openai", "gpt-4o-mini"), "failover");
});
check("retired google model hops to successor", () => {
  assert.equal(classifyAttemptError(errGoogleRetired, "google", "gemini-2.5-flash-lite"), "successor");
});
check("unknown google 404 fails over", () => {
  assert.equal(classifyAttemptError(errGoogleUnknown, "google", "gemini-3.5-flash-lite"), "failover");
});
check("400 fails over", () => {
  assert.equal(classifyAttemptError(err400, "google", "gemini-3.5-flash-lite"), "failover");
});
check("empty content fails over", () => {
  assert.equal(classifyAttemptError(errEmpty, "openai", "gpt-4o"), "failover");
});

// 8/9. Free-only mode: paid models NEVER selected.
check("isFreeModel classification", () => {
  assert.equal(isFreeModel("openrouter", "google/gemma-4-26b-a4b-it:free"), true);
  assert.equal(isFreeModel("openrouter", "openai/gpt-4o"), false);
  assert.equal(isFreeModel("google", "gemini-3.5-flash-lite"), true);
  assert.equal(isFreeModel("groq", "openai/gpt-oss-20b"), true);
  assert.equal(isFreeModel("openai", "gpt-4o-mini"), false);
  assert.equal(isFreeModel("deepseek", "deepseek-chat"), false);
  assert.equal(isFreeModel("custom", "anything"), false);
  assert.equal(isFreeModel("custom", ""), false);
});
check("pickModel ignores paid user pref in free-only mode", () => {
  const freeKinds: ProviderKind[] = ["openrouter", "google", "groq", "nvidia", "github", "ollama"];
  for (const kind of freeKinds) {
    for (const tier of ["A", "B", "C"] as const) {
      const m = pickModel(tier, kind, true, null, "openai/gpt-4o");
      assert.equal(isFreeModel(kind, m), true, `${tier}/${kind} picked paid ${m}`);
    }
  }
});
check("paid-only providers are skipped in free-only mode", () => {
  const paidKinds: ProviderKind[] = ["openai", "anthropic", "deepseek", "together", "custom"];
  for (const kind of paidKinds) {
    // No free model exists here — the router must skip, never bill.
    assert.equal(shouldSkipPaidModel(kind, pickModel("B", kind, true, null, null), true), true, kind);
    assert.equal(shouldSkipPaidModel(kind, "anything", false), false, `${kind} blocked while opted out`);
  }
  assert.equal(shouldSkipPaidModel("openrouter", "google/gemma-4-26b-a4b-it:free", true), false);
  assert.equal(shouldSkipPaidModel("google", "gemini-3.5-flash-lite", true), false);
});
check("pickModel honors paid pref when free-only is off", () => {
  assert.equal(pickModel("B", "openai", false, null, "openai/gpt-4o"), "openai/gpt-4o");
});
check("openrouter picker list is all free", () => {
  for (const m of PROVIDER_FREE_MODELS.openrouter) {
    assert.ok(m.endsWith(":free"), `non-free in picker: ${m}`);
  }
});

// 10. Capability filter.
check("vision requirement filters correctly", () => {
  assert.equal(
    supportsCapabilities("google", "gemini-3.5-flash-lite", { vision: true }),
    true,
  );
  assert.equal(
    supportsCapabilities("openrouter", "google/gemma-4-26b-a4b-it:free", { vision: true }),
    false,
  );
  assert.equal(supportsCapabilities("groq", "openai/gpt-oss-20b", undefined), true);
});

// 16/17. Cooldown parks failures, success clears.
check("429 parks model in cooldown, success clears", () => {
  const kind: ProviderKind = "openrouter";
  const model = `test-model-${Date.now()}:free`;
  assert.equal(isCooledDown(kind, model), false);
  recordFailure(kind, model, err429);
  assert.equal(isCooledDown(kind, model), true);
  recordSuccess(kind, model);
  assert.equal(isCooledDown(kind, model), false);
});

// Cost modes: free_only default forces free; paid needs explicit double opt-in.
check("cost mode defaults to enforced free-only", () => {
  delete process.env.AI_COST_MODE;
  delete process.env.ALLOW_PAID_FALLBACK;
  assert.equal(costMode(), "free_only");
  assert.equal(isPaidUsageAllowed(), false);
  assert.equal(resolveFreeOnly(false), true); // user opt-out ignored
  assert.equal(resolveFreeOnly(true), true);
});
check("paid runs need paid_allowed + explicit fallback opt-in", () => {
  process.env.AI_COST_MODE = "paid_allowed";
  process.env.ALLOW_PAID_FALLBACK = "false";
  assert.equal(resolveFreeOnly(false), true); // fail safe without opt-in
  process.env.ALLOW_PAID_FALLBACK = "true";
  assert.equal(isPaidUsageAllowed(), true);
  assert.equal(resolveFreeOnly(false), false); // explicit user choice honored
  assert.equal(resolveFreeOnly(true), true);
  process.env.AI_COST_MODE = "free_preferred";
  delete process.env.ALLOW_PAID_FALLBACK;
  assert.equal(resolveFreeOnly(false), true); // paid not permitted → still free
  process.env.ALLOW_PAID_FALLBACK = "true";
  assert.equal(resolveFreeOnly(false), false); // …but defaults to free
  delete process.env.AI_COST_MODE;
  delete process.env.ALLOW_PAID_FALLBACK;
});

// OpenCode: only catalog-verified -free ids; unknown pricing is NOT free.
check("opencode pricing is never guessed", () => {
  assert.equal(isFreeModel("opencode", "mimo-v2.6-flash-free"), true);
  assert.equal(isFreeModel("opencode", "claude-opus-4-7"), false);
  assert.equal(isFreeModel("opencode", "some-future-model"), false);
  assert.equal(shouldSkipPaidModel("opencode", "claude-opus-4-7", true), true);
  assert.equal(shouldSkipPaidModel("opencode", "mimo-v2.6-flash-free", true), false);
});

console.log(`\n${passed} fallback tests passed${process.exitCode ? " (WITH FAILURES)" : ""}.`);
