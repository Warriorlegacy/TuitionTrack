// OpenCode inference catalog — live model discovery for the AI router.
//
// Verified live 2026-09-23 (no credentials used):
// - GET https://opencode.ai/inference/v1/models → OpenAI-shaped {object,data[]}
// - POST https://opencode.ai/inference/openai/v1/chat/completions WITHOUT a key
//   → 403 {"type":"FreeTierError","message":"OpenCode's free tier can only be
//   used from within OpenCode"}. Free models are NOT callable from third-party
//   servers, with or without a user key. Paid models require a service-account
//   key and bill the key owner's OpenCode account.
//
// Consequences (do not "fix" without re-verifying):
// - The router NEVER auto-selects keyless OpenCode (it would 403 every time).
// - OPENCODE_KEY (server-only) enables credentialed paid models ONLY when paid
//   usage is explicitly allowed (AI_COST_MODE=paid_allowed + ALLOW_PAID_FALLBACK).
// - In free-only mode, OpenCode models are all treated as unknown/blocked.

export type OpenCodeCatalogEntry = {
  id: string;
  pricing: "free" | "unknown";
};

const CATALOG_URL = "https://opencode.ai/inference/v1/models";
const CACHE_MS = 60 * 60 * 1000;

// Seed: `-free`-suffixed ids observed live on 2026-09-23. Convention (not
// contract): OpenCode marks free chat models with a -free suffix. Anything
// else is pricing-unknown and NEVER auto-used in free-only mode.
const SEED_FREE_IDS = [
  "ling-3.0-flash-fin-free",
  "mimo-v2.5-free",
  "mimo-v2.6-flash-free",
  "muse-spark-1.2-contributor-free",
  "muse-spark-1.3-contributor-free",
  "nemotron-3-ultra-free",
  "nemotron-3.5-lightning-free",
  "jev-1.13-free",
  "space-bunny-free",
];

let freeIds: Set<string> = new Set(SEED_FREE_IDS);
let allIds: string[] = [];
let fetchedAt = 0;
let inFlight: Promise<void> | null = null;

async function refresh(): Promise<void> {
  if (inFlight) {
    await inFlight;
    return;
  }
  inFlight = (async () => {
    try {
      const res = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return;
      const data = (await res.json()) as { data?: { id?: string }[] };
      const ids = ((data.data ?? []) as { id?: string }[])
        .map((m) => m.id ?? "")
        .filter(Boolean);
      if (!ids.length) return;
      allIds = [...ids].sort();
      freeIds = new Set(ids.filter((id) => id.endsWith("-free")));
      fetchedAt = Date.now();
    } catch {
      // Catalog unreachable — seed stands. Unknown stays unknown.
    } finally {
      inFlight = null;
    }
  })();
  await inFlight;
}

/** Live catalog entries with free/unknown pricing labels. Refreshes hourly. */
export async function getOpenCodeCatalog(): Promise<{ entries: OpenCodeCatalogEntry[]; live: boolean }> {
  if (Date.now() - fetchedAt > CACHE_MS) await refresh();
  if (!allIds.length) {
    return { entries: Array.from(freeIds).sort().map((id) => ({ id, pricing: "free" as const })), live: false };
  }
  return {
    entries: allIds.map((id) => ({ id, pricing: (freeIds.has(id) ? "free" : "unknown") as "free" | "unknown" })),
    live: true,
  };
}

/** Sync free check for the router guard. Unknown (or unlisted) → NOT free. */
export function isOpenCodeFreeModel(id: string): boolean {
  return freeIds.has(id);
}

/** Fire-and-forget catalog warmup (never blocks generation). */
export function warmOpenCodeCatalog(): void {
  if (Date.now() - fetchedAt > CACHE_MS) void refresh();
}
