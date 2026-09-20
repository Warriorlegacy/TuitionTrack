"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth";
import {
  adminListProofs,
  adminVerifyProof,
  adminRejectProof,
  adminUpdatePaymentSettings,
  getProofScreenshotSignedUrl,
} from "@/lib/parent/payments";
import type { PaymentSettingsRow } from "@/lib/db/types";

export type AdminActionResult =
  | { success: true }
  | { success: false; message: string };

export async function listPendingProofsAction() {
  const auth = await getAuthContext();
  if (!auth.user || auth.role !== "teacher") {
    return { success: false, message: "Not permitted." };
  }
  try {
    const proofs = await adminListProofs(["proof_submitted", "under_review"]);
    return { success: true, data: proofs };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

export async function verifyProofAction(
  proofId: string,
  notes?: string,
): Promise<AdminActionResult> {
  const auth = await getAuthContext();
  if (!auth.user || auth.role !== "teacher") {
    return { success: false, message: "Not permitted." };
  }
  const result = await adminVerifyProof(proofId, auth.user.id, notes);
  if (!result.ok) return { success: false, message: result.error ?? "Could not verify." };
  revalidatePath("/app/payments");
  return { success: true };
}

export async function rejectProofAction(
  proofId: string,
  reason: string,
): Promise<AdminActionResult> {
  const auth = await getAuthContext();
  if (!auth.user || auth.role !== "teacher") {
    return { success: false, message: "Not permitted." };
  }
  const result = await adminRejectProof(proofId, auth.user.id, reason);
  if (!result.ok) return { success: false, message: result.error ?? "Could not reject." };
  revalidatePath("/app/payments");
  return { success: true };
}

export async function getProofScreenshotAction(storagePath: string) {
  const auth = await getAuthContext();
  if (!auth.user || auth.role !== "teacher") return null;
  return getProofScreenshotSignedUrl(storagePath, 120);
}

const settingsSchema = z.object({
  upi_id: z.string().min(1),
  upi_display_name: z.string().min(1),
  upi_qr_url: z.string().url().optional().or(z.literal("")),
  payment_whatsapp_number: z.string().min(1),
  currency: z.string().min(1),
  instructions: z.string().optional(),
});

export async function updatePaymentSettingsAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const auth = await getAuthContext();
  if (!auth.user || auth.role !== "teacher") {
    return { success: false, message: "Not permitted." };
  }

  const parsed = settingsSchema.safeParse({
    upi_id: formData.get("upi_id"),
    upi_display_name: formData.get("upi_display_name"),
    upi_qr_url: formData.get("upi_qr_url") || "",
    payment_whatsapp_number: formData.get("payment_whatsapp_number"),
    currency: formData.get("currency"),
    instructions: formData.get("instructions") || "",
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  try {
    await adminUpdatePaymentSettings(parsed.data as Partial<PaymentSettingsRow>);
    revalidatePath("/app/payments");
    revalidatePath("/parent/fees");
    return { success: true };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}
