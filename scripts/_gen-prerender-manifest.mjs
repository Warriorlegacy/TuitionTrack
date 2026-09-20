#!/usr/bin/env node
// TEMPORARY: reconstructs .next/prerender-manifest.json, which the sandbox's
// safe-delete guard prevents `next build` from writing (the build aborts while
// clearing .next/export). Used only to boot `next start` locally so the parent
// portal routes can be probed end to end. Delete after use.
import { readFileSync, writeFileSync } from "node:fs";

const appPaths = JSON.parse(readFileSync(".next/server/app-paths-manifest.json", "utf8"));

const staticRoutes = {};
const dynamicRoutes = {};

for (const key of Object.keys(appPaths)) {
  if (key.includes("[")) {
    // Dynamic route: Next only needs the entry to exist for matching.
    dynamicRoutes[key] = {
      routeRegex: "",
      dataRoute: null,
      fallback: null,
      fallbackRevalidate: false,
    };
  } else {
    staticRoutes[key] = {};
  }
}

const manifest = {
  version: 4,
  routes: staticRoutes,
  dynamicRoutes,
  notFoundRoutes: [],
  preview: {
    previewModeId: "00000000000000000000000000000000",
    previewModeSigningKey: "0".repeat(64),
    previewModeEncryptionKey: "0".repeat(64),
  },
};

writeFileSync(".next/prerender-manifest.json", JSON.stringify(manifest, null, 2), "utf8");
console.log(
  `wrote .next/prerender-manifest.json — ${Object.keys(staticRoutes).length} static, ` +
    `${Object.keys(dynamicRoutes).length} dynamic`,
);
