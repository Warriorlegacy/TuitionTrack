import "server-only";

import type { PaymentProofStatus } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PaymentProviderId = "upi_manual";

export interface CreatePaymentInput {
  studentId: string;
  guardianUserId: string;
  relationshipId?: string | null;
  amount: number;
  currency?: string;
  feeId?: string | null;
  utrReference?: string | null;
  screenshotStoragePath?: string | null;
  screenshotFileName?: string | null;
}

export interface CreatePaymentResult {
  ok: true;
  intentId: string;
  instructions: string;
}

export interface PaymentStatus {
  /**
   * `unknown` when no such payment exists. Reporting a missing payment as
   * `cancelled` would invent a state that was never recorded (§111).
   */
  status: PaymentProofStatus | "unknown";
  verifiedAt?: string | null;
  receiptNumber?: string | null;
}

export type VerifyError =
  | "not_found"
  | "already_final"
  | "missing_reference"
  | "duplicate_utr"
  | "already_verified"
  | "not_permitted"
  | "unknown";

export interface PaymentVerificationResult {
  ok: boolean;
  error?: VerifyError;
  receiptId?: string;
}

export interface RefundInput {
  proofId: string;
  reason: string;
  /** Staff user performing the refund — recorded in the audit log. */
  actorId?: string | null;
}

export interface RefundResult {
  ok: boolean;
  error?: VerifyError;
}

export interface ReceiptResult {
  ok: boolean;
  receiptNumber?: string;
  error?: VerifyError;
}

export interface WebhookResult {
  ok: boolean;
  event?: string;
}

/**
 * Payment-provider abstraction (brief §112).
 *
 * The concrete UPI/manual provider is proof-based: the parent pays via their
 * UPI app, takes a screenshot, and submits it with the transaction reference.
 * Verification is an explicit staff action — the provider never auto-approves
 * a payment (§42).
 *
 * A real gateway (Razorpay, Stripe, etc.) could be plugged in later by
 * implementing the same interface.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPaymentStatus(paymentRef: string): Promise<PaymentStatus>;
  verifyPayment(
    proofRef: string,
    verifiedBy: string,
    notes?: string,
  ): Promise<PaymentVerificationResult>;
  createRefund(input: RefundInput): Promise<RefundResult>;
  generateReceipt(proofRef: string): Promise<ReceiptResult>;
  handleWebhook(payload: unknown, signature: string): Promise<WebhookResult>;
}

function normaliseError(raw: unknown): VerifyError {
  const known: VerifyError[] = [
    "not_found",
    "already_final",
    "missing_reference",
    "duplicate_utr",
    "already_verified",
    "not_permitted",
  ];
  return known.includes(raw as VerifyError) ? (raw as VerifyError) : "unknown";
}

class UpiManualProvider implements PaymentProvider {
  readonly id = "upi_manual" as const;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("payment_proofs")
      .insert({
        student_id: input.studentId,
        guardian_user_id: input.guardianUserId,
        relationship_id: input.relationshipId ?? null,
        fee_id: input.feeId ?? null,
        amount: input.amount,
        currency: input.currency ?? "INR",
        utr_reference: input.utrReference ?? null,
        screenshot_storage_path: input.screenshotStoragePath ?? null,
        screenshot_file_name: input.screenshotFileName ?? null,
        status: "proof_submitted",
        submitted_by: input.guardianUserId,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error("Could not create payment proof: " + (error?.message ?? "unknown"));
    }

    return {
      ok: true,
      intentId: data.id,
      instructions:
        "Pay the amount via UPI. After payment, take a screenshot and submit the transaction reference (UTR) on the same page.",
    };
  }

  async getPaymentStatus(paymentRef: string): Promise<PaymentStatus> {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("payment_proofs")
      .select("status, reviewed_at, payment_receipts!payment_proofs_receipt_id_fkey(receipt_number)")
      .eq("id", paymentRef)
      .maybeSingle();

    if (error || !data) {
      return { status: "unknown", verifiedAt: null, receiptNumber: null };
    }

    const receipt = Array.isArray(data.payment_receipts)
      ? data.payment_receipts[0]
      : (data.payment_receipts as { receipt_number?: string } | null);

    return {
      status: data.status as PaymentProofStatus,
      verifiedAt: data.reviewed_at,
      receiptNumber: receipt?.receipt_number ?? null,
    };
  }

  async verifyPayment(
    proofRef: string,
    verifiedBy: string,
    notes?: string,
  ): Promise<PaymentVerificationResult> {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("verify_payment_proof", {
      p_proof_id: proofRef,
      p_reviewer_id: verifiedBy,
      p_notes: notes ?? null,
    });

    if (error) return { ok: false, error: "unknown" };
    const result = data as {
      ok: boolean;
      error?: string;
      receipt_id?: string;
    };
    if (!result?.ok) return { ok: false, error: normaliseError(result?.error) };
    return { ok: true, receiptId: result.receipt_id };
  }

  async createRefund(input: RefundInput): Promise<RefundResult> {
    const supabase = createSupabaseServerClient();
    const { data: proof, error: readErr } = await supabase
      .from("payment_proofs")
      .select("id, status, fee_id")
      .eq("id", input.proofId)
      .maybeSingle();

    if (readErr || !proof) return { ok: false, error: "not_found" };
    if (proof.status !== "verified") return { ok: false, error: "already_final" };

    const { error } = await supabase
      .from("payment_proofs")
      .update({ status: "refunded", updated_at: new Date().toISOString() })
      .eq("id", input.proofId);

    if (error) return { ok: false, error: "unknown" };

    // Reversing the payment must reverse the fee too, otherwise the fee stays
    // marked paid against a refunded payment.
    if (proof.fee_id) {
      await supabase
        .from("fees")
        .update({ status: "unpaid" })
        .eq("id", proof.fee_id)
        .eq("status", "paid");
    }

    // §67: payment events are auditable.
    await supabase.from("audit_logs").insert({
      actor_id: input.actorId ?? null,
      action: "payment_proof_refunded",
      entity: "payment_proof",
      entity_id: input.proofId,
      metadata: { reason: input.reason, fee_id: proof.fee_id ?? null },
    });

    return { ok: true };
  }

  async generateReceipt(proofRef: string): Promise<ReceiptResult> {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("payment_receipts")
      .select("receipt_number")
      .eq("payment_proof_id", proofRef)
      .maybeSingle();

    if (error || !data) return { ok: false, error: "not_found" };
    return { ok: true, receiptNumber: data.receipt_number };
  }

  async handleWebhook(): Promise<WebhookResult> {
    return { ok: false, event: "unsupported" };
  }
}

/**
 * Provider registry. Only the manual/UPI provider exists today; a gateway
 * integration (Razorpay, Stripe) slots in here by adding an implementation of
 * `PaymentProvider` — no caller has to change.
 */
const providers: Record<PaymentProviderId, PaymentProvider> = {
  upi_manual: new UpiManualProvider(),
};

export function getPaymentProvider(id: PaymentProviderId = "upi_manual"): PaymentProvider {
  return providers[id] ?? providers.upi_manual;
}
