// Guards the import-order bug that made every AI call report
// "no AI provider configured (stubbed)".
//
// src/lib/ai/provider.ts builds PLATFORM_KEYS at module scope, snapshotting
// process.env at import time. A .env loader placed AFTER the provider import
// in the same file runs too late and every key reads as undefined.
//
// Run: NODE_OPTIONS="" npx tsx tests/env-load.test.mjs
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

let pass = 0;
let fail = 0;
const check = (ok, label, detail) => {
  if (ok) {
    console.log("ok  ", label);
    pass++;
  } else {
    console.log("FAIL", label, detail ? `— ${detail}` : "");
    fail++;
  }
};

// 1. Every script that imports the AI provider must load env BEFORE it.
const scripts = [
  "scripts/research-extended.ts",
];
for (const file of scripts) {
  if (!existsSync(file)) continue;
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const envIdx = lines.findIndex((l) => /^import\s+["']\.\/load-env["']/.test(l));
  const providerIdx = lines.findIndex((l) => /from\s+["'].*lib\/ai\/provider["']/.test(l));
  check(
    envIdx >= 0 && providerIdx >= 0 && envIdx < providerIdx,
    `${file}: load-env imported before ai/provider`,
    `envIdx=${envIdx} providerIdx=${providerIdx}`,
  );

  // A late hand-rolled loader is the exact shape of the original bug.
  check(
    !/readFileSync\(envPath/.test(src) || envIdx >= 0,
    `${file}: no stray inline .env loader after imports`,
  );
}

// 2. load-env.ts must itself be side-effect-only (no exports needed).
const loader = readFileSync("scripts/load-env.ts", "utf8");
check(loader.includes("process.env[key]"), "load-env writes into process.env");
check(
  /FILES\s*=\s*\[[^\]]*\.env\.local/.test(loader),
  "load-env reads .env.local (Next.js precedence)",
);

// 3. End-to-end: a child process importing load-env then the provider must
//    resolve at least one platform key.
//    The probe is written INSIDE the repo (not a temp dir) so normal relative
//    specifiers resolve; and it is written to a file rather than passed via
//    `tsx -e`, because on Windows the inline string gets mangled by the shell.
import { writeFileSync, unlinkSync } from "node:fs";

let kinds = "";
const probe = "tests/_env_probe.ts";
try {
  writeFileSync(
    probe,
    [
      'import "../scripts/load-env";',
      'import { getPlatformKeyChain } from "../src/lib/ai/provider";',
      "console.log(getPlatformKeyChain().map((e) => e.kind).join(','));",
    ].join("\n"),
  );
  kinds = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsx", probe],
    {
      encoding: "utf8",
      shell: process.platform === "win32",
      env: { ...process.env, NODE_OPTIONS: "" },
    },
  ).trim();
} catch (e) {
  kinds = "";
} finally {
  try {
    unlinkSync(probe);
  } catch {
    /* already gone */
  }
}
check(kinds.length > 0, "provider chain resolves with env loaded", kinds || "(empty)");

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail ? 1 : 0);
