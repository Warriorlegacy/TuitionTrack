/**
 * Best-effort temp-directory cleanup for the headless-Chrome tests.
 *
 * Why this exists: these tests create a `--user-data-dir` Chrome profile and
 * then delete it with `rmSync(dir, { recursive: true })`. The harness wraps
 * rmSync in a bulk-delete guard whose counter is per *conversation request* and
 * does not reset between tool calls (threshold 50 here). A Chrome profile tree
 * is hundreds of loose files, and `countTargets` counts leaves — so a single
 * cleanup can spend the entire budget and cause an unrelated later delete (or a
 * generation run) to fail with SAFE_DELETE_BULK_CONFIRM_REQUIRED.
 *
 * Deleting a temp dir is pure hygiene: it must never be able to fail a test
 * that otherwise passed, and it must never be able to wedge the next command.
 * So this is deliberately best-effort — on refusal it warns and moves on.
 *
 * Note the directories are under the OS temp dir, not the repo, so leaving one
 * behind costs nothing but disk.
 */
import { rmSync } from "node:fs";

export function cleanupTemp(dir) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 2 });
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (msg.includes("SAFE_DELETE_BULK_CONFIRM_REQUIRED")) {
      console.log(
        `note  temp cleanup skipped (harness delete budget spent) — leaving ${dir}`,
      );
    } else {
      console.log(`note  temp cleanup failed for ${dir}: ${msg.slice(0, 120)}`);
    }
  }
}
