import "server-only";

import type {
  FeeRow,
  PaymentProofRow,
  PaymentProofStatus,
  PaymentReceiptRow,
  PaymentSettingsRow,
} from "@/lib/db/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/payments/provider";

/**
 * Parent-facing payment service.
 *
 * Every read is scoped through the authenticated Supabase client (RLS).
 * Every write that needs to bypass RLS (storage upload, admin review)
 * uses the admin client with explicit caller scoping.
 *
 * §42 safety: a payment is NEVER marked verified because a screenshot exists.
 * Verification is an explicit staff action behind the verify_payment_proof RPC.
 */

export type ReconciliationFlag =
  | "amount_mismatch"
  | "duplicate_utr"
  | "used_utr"
  | "missing_reference";

export type ProofWithFlags = PaymentProofRow & {
  student_name?: string;
  fee_amount?: number;
  flags: ReconciliationFlag[];
};

export async function getPaymentSettings(): Promise<PaymentSettingsRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payment_settings")
    .select("*")
    .eq("active", true)
    .maybeSingle<PaymentSettingsRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function listFeesForStudent(studentId: string): Promise<FeeRow[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("fees")
    .select("*")
    .eq("student_id", studentId)
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as FeeRow[] | null) ?? [];
}

export async function listProofsForGuardian(
  guardianUserId: string,
): Promise<PaymentProofRow[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payment_proofs")
    .select("*")
    .eq("guardian_user_id", guardianUserId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as PaymentProofRow[] | null) ?? [];
}

export async function getProof(proofId: string): Promise<PaymentProofRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payment_proofs")
    .select("*")
    .eq("id", proofId)
    .maybeSingle<PaymentProofRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getReceipt(receiptId: string): Promise<PaymentReceiptRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payment_receipts")
    .select("*")
    .eq("id", receiptId)
    .maybeSingle<PaymentReceiptRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getReceiptByProof(proofId: string): Promise<PaymentReceiptRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payment_receipts")
    .select("*")
    .eq("payment_proof_id", proofId)
    .maybeSingle<PaymentReceiptRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

/**
 * Upload a screenshot to the private bucket via the admin client.
 * Returns the storage path (bucket-relative) and the original file name.
 */
export async function uploadProofScreenshot(
  file: File,
): Promise<{ path: string; fileName: string }> {
  const admin = createSupabaseAdminClient();
  const fileId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `proofs/${fileId}/${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from("payment-proofs").upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) throw new Error("Upload failed: " + error.message);
  return { path, fileName: file.name };
}

/**
 * Generate a short-lived signed URL so the admin review page can display the
 * screenshot without exposing the bucket publicly (brief §62).
 */
export async function getProofScreenshotSignedUrl(
  storagePath: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  if (!storagePath) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from("payment-proofs")
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

// ── Admin / staff ───────────────────────────────────────────────────────────

export async function adminListProofs(
  statusFilter?: PaymentProofStatus[],
): Promise<ProofWithFlags[]> {
  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("payment_proofs")
    .select("*, students!inner(name), fees!inner(amount)")
    .order("submitted_at", { ascending: false });

  if (statusFilter && statusFilter.length > 0) {
    q = q.in("status", statusFilter);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data as unknown as Array<PaymentProofRow & { students: { name: string }; fees: { amount: number } }> | null) ?? [];

  // Reconciliation flags (surface to admin UI, never auto-verify).
  const flagsFor = (row: typeof rows[number]): ReconciliationFlag[] => {
    const flags: ReconciliationFlag[] = [];
    if (!row.utr_reference || row.utr_reference.trim().length === 0) {
      flags.push("missing_reference");
    }
    if (row.fee_id && row.fees?.amount != null && Number(row.amount) !== Number(row.fees.amount)) {
      flags.push("amount_mismatch");
    }
    return flags;
  };

  return rows.map((r) => ({
    ...(r as unknown as PaymentProofRow),
    student_name: r.students?.name,
    fee_amount: r.fees?.amount,
    flags: flagsFor(r),
  }));
}

export async function adminVerifyProof(
  proofId: string,
  reviewerId: string,
  notes?: string,
): Promise<{ ok: boolean; error?: string; receiptId?: string }> {
  const provider = getPaymentProvider();
  const result = await provider.verifyPayment(proofId, reviewerId, notes);
  if (!result.ok) return { ok: false, error: result.error ?? "unknown" };
  return { ok: true, receiptId: result.receiptId };
}

export async function adminRejectProof(
  proofId: string,
  reviewerId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("reject_payment_proof", {
    p_proof_id: proofId,
    p_reviewer_id: reviewerId,
    p_reason: reason,
  });
  if (error) return { ok: false, error: "unknown" };
  const result = data as { ok: boolean; error?: string };
  if (!result?.ok) return { ok: false, error: result?.error ?? "unknown" };
  return { ok: true };
}

export async function adminUpdatePaymentSettings(
  values: Partial<PaymentSettingsRow>,
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("payment_settings")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("active", true);
  if (error) throw new Error(error.message);
}
