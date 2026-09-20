"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth";
import {
  buildInviteUrl,
  createParentInvite,
  redeemParentInvite,
  type ParentInviteChannel,
} from "@/lib/parent/invites";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GuardianRelationshipType } from "@/lib/db/types";

/**
 * Parent invitation server actions.
 *
 * Authorization is enforced twice on purpose: once here for a clean error
 * message, and once inside the SQL function, which is the boundary that
 * actually matters. A caller who bypasses the UI still hits the database check.
 */

export type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; message: string };

const createInviteSchema = z.object({
  studentId: z.string().uuid("A valid student is required."),
  relationshipType: z.enum(["father", "mother", "guardian", "other"]).default("guardian"),
  invitedEmail: z.string().email("Enter a valid email address.").optional().or(z.literal("")),
  invitedPhone: z.string().max(20).optional().or(z.literal("")),
  expiresInHours: z.coerce.number().int().min(1).max(720).default(168),
  channel: z.enum(["link", "whatsapp", "email", "sms", "qr"]).default("link"),
});

function fieldErrors(error: z.ZodError) {
  return error.issues.map((i) => i.message).join(" ");
}

/** Determine the origin to build an absolute invite URL from. */
async function resolveOrigin(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Staff-facing: create and revoke invitations
// ────────────────────────────────────────────────────────────────────────────

export async function createParentInviteAction(
  formData: FormData,
): Promise<ActionResult<{ inviteUrl: string; expiresAt: string; waLink: string | null }>> {
  const context = await getAuthContext();
  if (!context.user) return { success: false, message: "Please sign in first." };

  const parsed = createInviteSchema.safeParse({
    studentId: formData.get("studentId"),
    relationshipType: formData.get("relationshipType") ?? "guardian",
    invitedEmail: formData.get("invitedEmail") ?? "",
    invitedPhone: formData.get("invitedPhone") ?? "",
    expiresInHours: formData.get("expiresInHours") ?? 168,
    channel: formData.get("channel") ?? "link",
  });
  if (!parsed.success) return { success: false, message: fieldErrors(parsed.error) };

  const input = parsed.data;

  const result = await createParentInvite({
    studentId: input.studentId,
    relationshipType: input.relationshipType as GuardianRelationshipType,
    invitedEmail: input.invitedEmail || null,
    invitedPhone: input.invitedPhone || null,
    expiresInHours: input.expiresInHours,
    channel: input.channel as ParentInviteChannel,
  });

  if (!result.ok) {
    return {
      success: false,
      message:
        result.error === "not_permitted"
          ? "You do not have permission to invite a guardian for this student."
          : result.error === "student_not_found"
            ? "That student could not be found."
            : "Could not create the invitation. Please try again.",
    };
  }

  const origin = await resolveOrigin();
  const inviteUrl = buildInviteUrl(origin, result.invite.token);

  // wa.me is used rather than api.whatsapp.com so the link opens the app on
  // mobile without an intermediate redirect page.
  const waLink = input.invitedPhone
    ? `https://wa.me/${input.invitedPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `You have been invited to the TuitionTrack parent portal for ${context.accessibleStudents.find((s) => s.id === input.studentId)?.name ?? "your child"}. Open this private link to accept (it works once): ${inviteUrl}`,
      )}`
    : input.channel === "whatsapp"
      ? `https://wa.me/?text=${encodeURIComponent(
          `You have been invited to the TuitionTrack parent portal. Open this private link to accept (it works once): ${inviteUrl}`,
        )}`
      : null;

  revalidatePath(`/app/students/${input.studentId}`);
  revalidatePath("/app/students");

  return { success: true, data: { inviteUrl, expiresAt: result.invite.expiresAt, waLink } };
}

export async function revokeParentInviteAction(
  inviteId: string,
  reason?: string,
): Promise<ActionResult> {
  const context = await getAuthContext();
  if (!context.user) return { success: false, message: "Please sign in first." };

  if (!z.string().uuid().safeParse(inviteId).success) {
    return { success: false, message: "Invalid invitation." };
  }

  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("parent_invites")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: context.user.id,
      revoked_reason: reason ?? null,
    })
    .eq("id", inviteId)
    .eq("status", "pending"); // only a pending invite can be revoked

  if (error) return { success: false, message: "Could not revoke the invitation." };

  revalidatePath("/app/students");
  return { success: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Staff-facing: revoke a guardian's access
// ────────────────────────────────────────────────────────────────────────────

export async function revokeGuardianAccessAction(
  relationshipId: string,
  reason?: string,
): Promise<ActionResult> {
  const context = await getAuthContext();
  if (!context.user) return { success: false, message: "Please sign in first." };
  if (!z.string().uuid().safeParse(relationshipId).success) {
    return { success: false, message: "Invalid relationship." };
  }

  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("guardian_student_relationships")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: context.user.id,
      revoked_reason: reason ?? null,
    })
    .eq("id", relationshipId);

  if (error) return { success: false, message: "Could not revoke access." };

  revalidatePath("/app/students");
  return { success: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Parent-facing: accept an invitation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Redeem an invite for the signed-in user. Requires a session: the relationship
 * is bound to an authenticated account, never to an email typed into a form.
 */
export async function acceptParentInviteAction(
  rawToken: string,
): Promise<ActionResult<{ studentId: string }>> {
  const context = await getAuthContext();
  if (!context.user) {
    return { success: false, message: "Please sign in or create an account first." };
  }
  if (!rawToken || rawToken.length < 20) {
    return { success: false, message: "This invitation link is not valid." };
  }

  const result = await redeemParentInvite(rawToken);
  if (!result.ok) {
    const messages: Record<string, string> = {
      already_used: "This invitation has already been used.",
      expired: "This invitation has expired. Ask your tuition teacher for a new one.",
      revoked: "This invitation was withdrawn by your tuition teacher.",
      email_mismatch:
        "This invitation was sent to a different email address. Sign in with that address instead.",
      invalid_token: "This invitation link is not valid.",
      not_authenticated: "Please sign in first.",
    };
    return { success: false, message: messages[result.error] ?? "Could not accept the invitation." };
  }

  // Promote a parent-role account on first successful link, so the portal nav
  // resolves correctly. Only ever moves a user *into* the parent role.
  if (context.role !== "parent") {
    const supabase = createSupabaseServerClient();
    await supabase
      .from("users")
      .update({ role: "parent" })
      .eq("id", context.user.id)
      .neq("role", "teacher"); // never demote a teacher who is also a parent
  }

  revalidatePath("/parent");
  revalidatePath("/parent/homework");

  return { success: true, data: { studentId: result.studentId } };
}
