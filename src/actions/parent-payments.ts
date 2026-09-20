"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth";
import { getParentContext } from "@/lib/parent/auth";
import { getPaymentProvider } from "@/lib/payments/provider";
import { uploadProofScreenshot } from "@/lib/parent/payments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const submitProofSchema = z.object({
  studentId: z.string().uuid(),
  feeId: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().positive(),
  utrReference: z.string().min(1, "Enter the transaction reference (UTR)."),
});

export type SubmitProofResult =
  | { success: true; proofId: string }
  | { success: false; message: string };

/**
 * Submit a payment proof (screenshot + UTR) for a student's fee.
 *
 * The caller must be a verified guardian of the student. The screenshot is
 * uploaded to the private bucket via the admin client; the path is stored on
 * the proof row. No auto-verification happens (§42).
 */
export async function submitPaymentProofAction(
  formData: FormData,
): Promise<SubmitProofResult> {
  const auth = await getAuthContext();
  if (!auth.user) return { success: false, message: "Please sign in first." };

  const parsed = submitProofSchema.safeParse({
    studentId: formData.get("studentId"),
    feeId: formData.get("feeId") || "",
    amount: formData.get("amount"),
    utrReference: formData.get("utrReference"),
  });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const input = parsed.data;

  // Resolve parent context and verify the requested student is theirs.
  const parentCtx = await getParentContext(input.studentId);
  if (!parentCtx.activeChild) {
    return { success: false, message: "You do not have access to this student." };
  }
  const relationshipId = parentCtx.activeChild.relationshipId;

  // Upload screenshot if present.
  let screenshotPath: string | null = null;
  let screenshotName: string | null = null;
  const file = formData.get("screenshot") as File | null;
  if (file && file.size > 0) {
    try {
      const up = await uploadProofScreenshot(file);
      screenshotPath = up.path;
      screenshotName = up.fileName;
    } catch (e) {
      return { success: false, message: (e as Error).message };
    }
  }

  // Create the proof via the provider (inserts the row, RLS-guarded).
  const provider = getPaymentProvider();
  try {
    const result = await provider.createPayment({
      studentId: input.studentId,
      guardianUserId: auth.user.id,
      relationshipId,
      amount: input.amount,
      feeId: input.feeId || null,
      utrReference: input.utrReference,
      screenshotStoragePath: screenshotPath,
      screenshotFileName: screenshotName,
    });

    // Audit log (parent-side)
    const supabase = createSupabaseServerClient();
    await supabase.from("audit_logs").insert({
      actor_id: auth.user.id,
      action: "payment_proof_submitted",
      entity: "payment_proof",
      entity_id: result.intentId,
      metadata: {
        student_id: input.studentId,
        amount: input.amount,
        utr_reference: input.utrReference,
        actor_email: auth.user.email,
        result: "success",
      },
    });

    revalidatePath("/parent/fees");
    return { success: true, proofId: result.intentId };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}
