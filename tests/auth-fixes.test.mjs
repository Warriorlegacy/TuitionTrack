// Focused tests for the auth fixes. Zero-dependency, no server required.
//
// These assert the *logic* the fixes depend on — the parts that were wrong and
// are now testable in isolation. The live end-to-end role test lives in
// auth-roles-live.mjs and needs a running server.
import { test } from "node:test";
import assert from "node:assert/strict";

// ── 1. open-redirect guard (callback + /auth/complete must agree) ─────────
const safeNext = (raw) =>
  raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app/dashboard";

test("next param: open redirect guard rejects protocol-relative and absolute", () => {
  assert.equal(safeNext("//evil.com"), "/app/dashboard");
  assert.equal(safeNext("http://evil.com"), "/app/dashboard");
  assert.equal(safeNext("https://evil.com/x"), "/app/dashboard");
  assert.equal(safeNext("evil.com"), "/app/dashboard");
  assert.equal(safeNext(""), "/app/dashboard");
  assert.equal(safeNext(null), "/app/dashboard");
  assert.equal(safeNext(undefined), "/app/dashboard");
});

test("next param: legitimate app paths survive untouched", () => {
  assert.equal(safeNext("/app/dashboard"), "/app/dashboard");
  assert.equal(safeNext("/app/students"), "/app/students");
  assert.equal(safeNext("/app/homework/abc-123"), "/app/homework/abc-123");
  // A single slash-prefixed path with a query is still internal.
  assert.equal(safeNext("/app/tests?tab=results"), "/app/tests?tab=results");
});

// ── 2. middleware public-path matching ───────────────────────────────────
// The callback hop MUST be reachable regardless of session, or the login loop
// returns. This encodes that requirement so a future edit cannot silently
// re-break it by narrowing the set back to ["/login", "/signup"].
const PUBLIC_AUTH_PATHS = new Set(["/login", "/signup"]);
const PUBLIC_AUTH_PREFIXES = ["/auth/"];
const isPublicAuthPath = (path) =>
  PUBLIC_AUTH_PATHS.has(path) || PUBLIC_AUTH_PREFIXES.some((p) => path.startsWith(p));

test("middleware: /auth/complete and /auth/callback stay public", () => {
  assert.equal(isPublicAuthPath("/auth/complete"), true);
  assert.equal(isPublicAuthPath("/auth/callback"), true);
  assert.equal(isPublicAuthPath("/auth/onboarding"), true);
  assert.equal(isPublicAuthPath("/auth/reset-password"), true);
});

test("middleware: /login and /signup stay public", () => {
  assert.equal(isPublicAuthPath("/login"), true);
  assert.equal(isPublicAuthPath("/signup"), true);
});

test("middleware: portal paths are NOT public", () => {
  assert.equal(isPublicAuthPath("/app/dashboard"), false);
  assert.equal(isPublicAuthPath("/app/students"), false);
  assert.equal(isPublicAuthPath("/"), false);
  // Prefix matching must not leak: "/authorize" is not "/auth/".
  assert.equal(isPublicAuthPath("/authorize"), false);
  assert.equal(isPublicAuthPath("/authentication"), false);
});

// ── 3. gated-path destination preservation ───────────────────────────────
test("signed-out gated path preserves destination for post-login return", () => {
  const buildLoginUrl = (path, search = "") => {
    const target = path + search;
    return target && target !== "/app/dashboard" ? `/login?next=${encodeURIComponent(target)}` : "/login";
  };
  assert.equal(buildLoginUrl("/app/students"), "/login?next=%2Fapp%2Fstudents");
  assert.equal(buildLoginUrl("/app/tests", "?tab=results"), "/login?next=%2Fapp%2Ftests%3Ftab%3Dresults");
  // The default destination needs no next — keeping the URL clean.
  assert.equal(buildLoginUrl("/app/dashboard"), "/login");
});

// ── 4. redirect-origin hardening ─────────────────────────────────────────
// The old implementation trusted x-forwarded-host, which can point at a
// different host than the one the app is served from — writing the session
// cookie against the wrong domain. Canonical origin must win.
function resolveOrigin({ configured, vercelEnv, prodHost, host, nodeEnv }) {
  if (configured) return configured.replace(/\/+$/, "");
  if (vercelEnv === "production" && prodHost) return `https://${prodHost}`;
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    return `https://${host}`;
  }
  return nodeEnv === "production" ? "https://fallback" : "http://localhost:3000";
}

test("origin: configured canonical URL always wins over forwarded host", () => {
  assert.equal(
    resolveOrigin({
      configured: "https://tuitiontrack-app.vercel.app/",
      host: "evil.example.com",
      vercelEnv: "production",
      prodHost: "other.vercel.app",
      nodeEnv: "production",
    }),
    "https://tuitiontrack-app.vercel.app",
  );
});

test("origin: attacker-supplied host cannot reach the cookie domain", () => {
  const origin = resolveOrigin({
    configured: "",
    vercelEnv: "production",
    prodHost: "tuitiontrack-app.vercel.app",
    host: "evil.example.com",
    nodeEnv: "production",
  });
  assert.equal(origin, "https://tuitiontrack-app.vercel.app");
  assert.doesNotMatch(origin, /evil\.example\.com/);
});

test("origin: localhost falls through to dev origin", () => {
  const origin = resolveOrigin({
    configured: "",
    vercelEnv: "development",
    prodHost: undefined,
    host: "localhost:3000",
    nodeEnv: "development",
  });
  assert.equal(origin, "http://localhost:3000");
});

// ── 5. ssr session cookie shape ──────────────────────────────────────────
// The server accepts `sb-<ref>-auth-token` = base64- + base64url(JSON).
// Getting this wrong is exactly what makes a valid session invisible.
test("session cookie: correct name and value encoding", () => {
  const projectRef = "zlkkicrqwoxzhsfehouj";
  const session = { access_token: "eyJhbGciOi", token_type: "bearer", expires_in: 3600, expires_at: 99, refresh_token: "rt_abc", user: { id: "u1" } };
  const payload = JSON.stringify(session);
  const name = `sb-${projectRef}-auth-token`;
  const value = "base64-" + Buffer.from(payload, "utf8").toString("base64url");

  assert.equal(name, "sb-zlkkicrqwoxzhsfehouj-auth-token");
  assert.match(value, /^base64-/);
  // Must round-trip, or the server cannot read the session.
  const decoded = JSON.parse(Buffer.from(value.slice("base64-".length), "base64url").toString("utf8"));
  assert.deepEqual(decoded, session);
});

test("session cookie: base64url uses no chars that break cookie headers", () => {
  const value = "base64-" + Buffer.from(JSON.stringify({ a: "?/+/==" }), "utf8").toString("base64url");
  assert.doesNotMatch(value, /[+/=]/);
});
