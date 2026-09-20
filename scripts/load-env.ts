// Side-effect-only .env loader. MUST be the first import in any script that
// reads AI keys, and MUST come before any import of ../src/lib/ai/provider.
//
// Why this module exists
// ----------------------
// `src/lib/ai/provider.ts` builds PLATFORM_KEYS at MODULE SCOPE:
//     const PLATFORM_KEYS = [{ kind: "groq", key: process.env.GROQ_API_KEY }, ...]
// That snapshots process.env at import time. ES imports are hoisted and
// evaluated before the importing module's own top-level statements, so a
// loader placed *after* the provider import in the same file runs too late —
// every key reads as undefined and `complete()` returns { stubbed: true }.
//
// The failure is silent in an ugly way: the script still walks every lesson and
// logs `FAIL — no AI provider configured (stubbed)`, which looks like a
// per-lesson data problem rather than one import-order bug.
//
// Loading several files in Next.js precedence order (.env, then .env.local
// overriding). Later files win, matching Next.js behaviour where .env.local
// takes precedence over .env.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FILES = [".env", ".env.local"];

for (const name of FILES) {
  try {
    const envPath = join(process.cwd(), name);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const [, key, rawValue] = m;
      // Real environment variables always win over file values.
      if (process.env[key] !== undefined && name === ".env") continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env-only — platform vars still work */
  }
}
