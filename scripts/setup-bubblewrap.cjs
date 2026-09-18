#!/usr/bin/env node
// One-time bubblewrap setup: point it at the local Android SDK and an existing
// JDK 17 (avoiding bubblewrap's own multi-hundred-MB JDK download).
const fs = require("fs");
const path = require("path");
const dir = path.join(process.env.LOCALAPPDATA, "bubblewrap");
fs.mkdirSync(dir, { recursive: true });
const sdkPath = path.join(process.env.LOCALAPPDATA, "Android", "Sdk").replace(/\\/g, "/");
// Corretto JDK 17 lives at JAVA_HOME (or detected below).
const javaHome = (process.env.JAVA_HOME || "").replace(/\\/g, "/");
fs.writeFileSync(
  path.join(dir, "config.json"),
  JSON.stringify({ jdkPath: javaHome, androidSdkPath: sdkPath }, null, 2) + "\n",
);
console.log("bubblewrap config written to", dir);
console.log(JSON.stringify({ jdkPath: javaHome, androidSdkPath: sdkPath }, null, 2));
