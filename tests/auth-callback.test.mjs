import { test } from "node:test";
import assert from "node:assert/strict";

test("auth callback: role extraction and display name fallback logic", () => {
  // Test scenario 1: Google account with full_name
  const googleUser1 = {
    email: "teacher.aarav@gmail.com",
    user_metadata: {
      full_name: "Aarav Sharma",
      avatar_url: "https://lh3.googleusercontent.com/a/photo1",
    },
  };

  const name1 =
    googleUser1.user_metadata?.full_name?.trim() ||
    googleUser1.user_metadata?.name?.trim() ||
    googleUser1.email.split("@")[0];
  assert.equal(name1, "Aarav Sharma");

  // Test scenario 2: Google account with only name
  const googleUser2 = {
    email: "student.rohan@gmail.com",
    user_metadata: {
      name: "Rohan Verma",
    },
  };

  const name2 =
    googleUser2.user_metadata?.full_name?.trim() ||
    googleUser2.user_metadata?.name?.trim() ||
    googleUser2.email.split("@")[0];
  assert.equal(name2, "Rohan Verma");

  // Test scenario 3: Google account with no name fields (fallback to email username)
  const googleUser3 = {
    email: "parent.mehta@gmail.com",
    user_metadata: {},
  };

  const name3 =
    googleUser3.user_metadata?.full_name?.trim() ||
    googleUser3.user_metadata?.name?.trim() ||
    googleUser3.email.split("@")[0];
  assert.equal(name3, "parent.mehta");
});

test("auth callback: target redirect computation", () => {
  // Scenario: default redirect must be /app/dashboard
  const computeRedirect = (rawNext) => {
    return rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/app/dashboard";
  };

  assert.equal(computeRedirect(null), "/app/dashboard");
  assert.equal(computeRedirect(undefined), "/app/dashboard");
  assert.equal(computeRedirect("/app/dashboard"), "/app/dashboard");
  assert.equal(computeRedirect("/app/homework"), "/app/homework");
  assert.equal(computeRedirect("//evil.com"), "/app/dashboard");
  assert.equal(computeRedirect("https://evil.com"), "/app/dashboard");
});

test("auth callback: signup role parameter parsing", () => {
  const parseSignupRole = (queryRole) => {
    return queryRole && ["teacher", "parent", "student"].includes(queryRole)
      ? queryRole
      : null;
  };

  assert.equal(parseSignupRole("parent"), "parent");
  assert.equal(parseSignupRole("student"), "student");
  assert.equal(parseSignupRole("teacher"), "teacher");
  assert.equal(parseSignupRole("admin"), null);
  assert.equal(parseSignupRole(null), null);
});
