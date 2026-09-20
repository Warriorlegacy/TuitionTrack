import "server-only";

import type { GuardianRelationshipType } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Parent invitation primitives.
 *
 * The raw token is generated inside a Postgres `security definer` function
 * (`create_parent_invite`) and returned exactly once, to the caller, for URL
 * construction. Only the SHA-256 of the token is ever persisted, so a database
 * leak does not yield usable invite links.
 *
 * This module deliberately contains no token-generation code of its own: the
 * CSPRNG must be the database's, so that there is exactly one implementation
 * and no chance of a client-side `Math.random()` creeping in.
 *
 * TOKEN HANDLING RULE — the token must never be passed to a Client Component.
 * It is a bearer credential. A prop becomes an RSC flight-payload entry, which
 * becomes bytes in the served HTML, where any proxy, cache, extension or
 * screenshot can read it. Everything in this module therefore either runs
 * server-side or is bound into a Server Action closure; the acceptance page
 * receives only a redacted `canAccept` boolean plus an action, never the value.
 *
 * See brief sections 3, 62, 65, 104.
 */

export type ParentInviteChannel = "link" | "whatsapp" | "email" | "sms" | "qr";

export type CreatedParentInvite = {
  inviteId: string;
  /** The raw token. Returned once. Never log this. */
  token: string;
  expiresAt: string;
};

export type RedeemResult =
  | { ok: true; studentId: string; relationshipId: string }
  | { ok: false; error: RedeemError };

export type RedeemError =
  | "not_authenticated"
  | "invalid_token"
  | "already_used"
  | "expired"
  | "revoked"
  | "email_mismatch"
  | "not_permitted"
  | "unknown";

/** Human-readable copy for each failure, shown on the acceptance page. */
export const redeemErrorCopy: Record<RedeemError, { title: string; body: string }> = {
  not_authenticated: {
    title: "Please sign in first",
    body: "This invitation is personal. Sign in or create an account, then open the link again.",
  },
  invalid_token: {
    title: "This invitation link is not valid",
    body: "The link may be incomplete, or it may have been copied incorrectly. Ask your tuition teacher for a new invitation.",
  },
  already_used: {
    title: "This invitation has already been used",
    body: "Invitations work only once. If you need access again, ask your tuition teacher to send a new invitation.",
  },
  expired: {
    title: "This invitation has expired",
    body: "For your family's privacy, invitations expire. Ask your tuition teacher to send a fresh one.",
  },
  revoked: {
    title: "This invitation was withdrawn",
    body: "Your tuition teacher cancelled this invitation. Please contact them if you think this is a mistake.",
  },
  email_mismatch: {
    title: "This invitation is for a different email address",
    body: "The invitation was sent to a specific email address. Sign in with that address, or ask your tuition teacher to send a new invitation to this one.",
  },
  not_permitted: {
    title: "Not permitted",
    body: "You do not have permission to perform this action for this student.",
  },
  unknown: {
    title: "Something went wrong",
    body: "We could not complete this invitation. Please try again, or ask your tuition teacher for a new link.",
  },
};

function normaliseError(raw: unknown): RedeemError {
  const known: RedeemError[] = [
    "not_authenticated",
    "invalid_token",
    "already_used",
    "expired",
    "revoked",
    "email_mismatch",
    "not_permitted",
  ];
  return known.includes(raw as RedeemError) ? (raw as RedeemError) : "unknown";
}

/**
 * Shape gate for a token before it reaches the database.
 *
 * Tokens are 32 bytes of base64url with the padding stripped, so exactly 43
 * characters from `[A-Za-z0-9_-]`. Rejecting anything else here keeps obviously
 * malformed input out of the query planner, and makes the "is this a real link"
 * judgement independent of whatever the RPC decides. It is a fast path, not a
 * security boundary — the database still hashes and looks up the value.
 */
export function isWellFormedToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

/**
 * Mint an invite for a student. Staff-only; the database re-checks that the
 * caller is staff for this student, so a UI bypass gains nothing.
 */
export async function createParentInvite(input: {
  studentId: string;
  relationshipType?: GuardianRelationshipType;
  invitedEmail?: string | null;
  invitedPhone?: string | null;
  expiresInHours?: number;
  channel?: ParentInviteChannel;
}): Promise<{ ok: true; invite: CreatedParentInvite } | { ok: false; error: string }> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("create_parent_invite", {
    p_student_id: input.studentId,
    p_relationship_type: input.relationshipType ?? "guardian",
    p_invited_email: input.invitedEmail ?? null,
    p_invited_phone: input.invitedPhone ?? null,
    p_expires_in_hours: input.expiresInHours ?? 168,
    p_delivery_channel: input.channel ?? "link",
  });

  if (error) return { ok: false, error: error.message };

  const result = data as { ok: boolean; error?: string; invite_id?: string; token?: string; expires_at?: string };
  if (!result?.ok || !result.invite_id || !result.token || !result.expires_at) {
    return { ok: false, error: normaliseError(result?.error) };
  }

  return {
    ok: true,
    invite: {
      inviteId: result.invite_id,
      token: result.token,
      expiresAt: result.expires_at,
    },
  };
}

/**
 * Redeem an invite. Requires an authenticated session — the caller must be
 * signed in before this is called, so that the relationship is bound to a real
 * account rather than to an email typed into a form.
 */
export async function redeemParentInvite(rawToken: string): Promise<RedeemResult> {
  if (!isWellFormedToken(rawToken)) return { ok: false, error: "invalid_token" };

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("redeem_parent_invite", {
    raw_token: rawToken,
  });

  if (error) return { ok: false, error: "unknown" };

  const result = data as {
    ok: boolean;
    error?: string;
    student_id?: string;
    relationship_id?: string;
  };

  if (!result?.ok) return { ok: false, error: normaliseError(result?.error) };
  if (!result.student_id || !result.relationship_id) return { ok: false, error: "unknown" };

  return { ok: true, studentId: result.student_id, relationshipId: result.relationship_id };
}

/**
 * Preview an invite without redeeming it, so the acceptance page can name the
 * child and the teacher before the parent commits.
 *
 * Deliberately narrow: this returns display names only, never the token, never
 * contacts, never academic data. Anyone holding the link can see this much,
 * which is the minimum needed to make the page comprehensible.
 */
export async function previewParentInvite(rawToken: string): Promise<
  | {
      ok: true;
      studentName: string;
      studentClass: string;
      teacherName: string | null;
      relationshipType: GuardianRelationshipType;
      expiresAt: string;
      invitedEmail: string | null;
    }
  | { ok: false; error: RedeemError }
> {
  if (!isWellFormedToken(rawToken)) return { ok: false, error: "invalid_token" };

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("preview_parent_invite", {
    raw_token: rawToken,
  });

  if (error) return { ok: false, error: "unknown" };

  const result = data as {
    ok: boolean;
    error?: string;
    student_name?: string;
    student_class?: string;
    teacher_name?: string | null;
    relationship_type?: GuardianRelationshipType;
    expires_at?: string;
    invited_email?: string | null;
  };

  if (!result?.ok || !result.student_name) {
    return { ok: false, error: normaliseError(result?.error) };
  }

  return {
    ok: true,
    studentName: result.student_name,
    studentClass: result.student_class ?? "",
    teacherName: result.teacher_name ?? null,
    relationshipType: result.relationship_type ?? "guardian",
    expiresAt: result.expires_at ?? "",
    invitedEmail: result.invited_email ?? null,
  };
}

/**
 * Build the shareable invitation URL.
 *
 * The path carries the token and nothing else — no student id, no email, no
 * name. Compare with the previous `/join?studentId=<uuid>` shape, which leaked
 * the student's database identifier into every shared link.
 */
export function buildInviteUrl(origin: string, token: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/parent/invite/${encodeURIComponent(token)}`;
}

/** Expiry label for the UI, in plain language. */
export function describeExpiry(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `expires in ${Math.max(1, Math.floor(ms / 60_000))} minutes`;
  if (hours < 48) return `expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `expires in ${days} day${days === 1 ? "" : "s"}`;
}
