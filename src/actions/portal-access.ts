"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth";
import {
  buildPortalUrl,
  createOrRegeneratePortalGrant,
  redeemPortalGrant,
  revokePortalGrant,
} from "@/lib/portal-access/grants";
import type { PortalType } from "@/lib/portal-access/types";

export type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; message: string };

async function resolveOrigin(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const generateSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  portalType: z.enum(["parent", "student"]),
  targetEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
});

export async function generatePortalLinkAction(
  studentId: string,
  portalType: PortalType,
  targetEmail?: string | null,
): Promise<
  ActionResult<{
    grantId: string;
    url: string;
    token: string;
    portalType: PortalType;
    studentName: string;
    expiresAt: string;
    isRegenerated: boolean;
  }>
> {
  const context = await getAuthContext();
  if (!context.user) return { success: false, message: "Please sign in first." };

  const parsed = generateSchema.safeParse({
    studentId,
    portalType,
    targetEmail: targetEmail || "",
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const result = await createOrRegeneratePortalGrant(
    parsed.data.studentId,
    parsed.data.portalType as PortalType,
    parsed.data.targetEmail || null,
  );

  if (!result.ok) {
    return { success: false, message: result.error };
  }

  const origin = await resolveOrigin();
  const url = buildPortalUrl(origin, result.portalType, result.token);

  revalidatePath("/app/portal-access");
  revalidatePath("/app/students");
  revalidatePath(`/app/students/${studentId}`);

  return {
    success: true,
    data: {
      grantId: result.grantId,
      url,
      token: result.token,
      portalType: result.portalType,
      studentName: result.studentName,
      expiresAt: result.expiresAt,
      isRegenerated: result.isRegenerated,
    },
  };
}

export async function revokePortalAccessAction(grantId: string): Promise<ActionResult> {
  const context = await getAuthContext();
  if (!context.user) return { success: false, message: "Please sign in first." };

  const result = await revokePortalGrant(grantId);
  if (!result.ok) {
    return { success: false, message: result.error ?? "Failed to revoke access" };
  }

  revalidatePath("/app/portal-access");
  revalidatePath("/app/students");

  return { success: true };
}

export async function redeemPortalGrantAction(
  token: string,
): Promise<ActionResult<{ portalType: PortalType; redirectUrl: string }>> {
  const context = await getAuthContext();
  if (!context.user) {
    return { success: false, message: "Please sign in to redeem this portal link." };
  }

  const result = await redeemPortalGrant(token);
  if (!result.ok || !result.portal_type) {
    const errMap: Record<string, string> = {
      invalid_token: "This invitation link is invalid or incomplete.",
      revoked: "This invitation link was revoked by the tutor.",
      expired: "This invitation link has expired. Please ask your tutor for a new one.",
      email_mismatch: "This invitation was sent to a different email address.",
      not_authenticated: "Please sign in first.",
    };
    return {
      success: false,
      message: errMap[result.error ?? ""] ?? "Could not activate portal access.",
    };
  }

  const redirectUrl =
    result.portal_type === "parent"
      ? `/parent/dashboard?child=${result.student_id}`
      : `/student/dashboard`;

  revalidatePath("/parent");
  revalidatePath("/student");

  return {
    success: true,
    data: {
      portalType: result.portal_type,
      redirectUrl,
    },
  };
}
