import { CheckCircleIcon, ClockIcon, AlertCircleIcon, ReceiptIcon, IndianRupeeIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SubmitProofForm } from "@/components/parent/submit-proof-form";
import { getParentContext } from "@/lib/parent/auth";
import {
  getPaymentSettings,
  listFeesForStudent,
  listProofsForGuardian,
} from "@/lib/parent/payments";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fees · TuitionTrack",
};

function formatCurrency(amount: number, currency: string) {
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`;
  return `${currency} ${amount.toLocaleString()}`;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: "Paid", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    unpaid: { label: "Due", cls: "text-amber-700 bg-amber-50 border-amber-200" },
    overdue: { label: "Overdue", cls: "text-red-700 bg-red-50 border-red-200" },
    proof_submitted: { label: "Proof submitted", cls: "text-sky-700 bg-sky-50 border-sky-200" },
    under_review: { label: "Under review", cls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
    verified: { label: "Verified", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    rejected: { label: "Rejected", cls: "text-red-700 bg-red-50 border-red-200" },
  };
  const s = map[status] ?? { label: status, cls: "text-slate-700 bg-slate-50 border-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default async function ParentFeesPage({
  searchParams,
}: {
  searchParams?: { child?: string };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  const parentCtx = await getParentContext(requested);
  const activeChild = parentCtx.activeChild;

  if (!parentCtx.user || !activeChild) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Fees</h1>
        <p className="mt-2 text-sm text-slate-600">
          No child is linked to your account yet. Accept an invitation from your tuition teacher
          to see fees here.
        </p>
      </div>
    );
  }

  // `view_fees` defaults to OFF until a teacher grants it (brief §64).
  if (!parentCtx.can("view_fees")) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Fees</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600">
          Fee details are not shared on your account yet. Your tuition teacher controls what a
          guardian can see; ask them to enable fee visibility for you.
        </p>
      </div>
    );
  }

  const [settings, fees, proofs] = await Promise.all([
    getPaymentSettings(),
    listFeesForStudent(activeChild.student.id),
    listProofsForGuardian(parentCtx.user.id),
  ]);

  const childProofs = proofs.filter((p) => p.student_id === activeChild.student.id);

  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Fees</h1>
      <p className="mt-1 text-sm text-slate-600">
        For <strong>{activeChild.student.name}</strong> · Class {activeChild.student.class}
      </p>

      {/* Payment method — read from payment_settings, never hard-coded (§37). */}
      {settings && (
        <Card className="mt-6 rounded-[2rem] border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Payment method
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">UPI ID</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{settings.upi_id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">WhatsApp for verification</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {settings.payment_whatsapp_number}
              </p>
            </div>
            {settings.upi_qr_url && (
              <div>
                <p className="text-xs text-slate-500">QR code</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={settings.upi_qr_url}
                  alt="UPI QR code"
                  className="mt-1 h-32 w-32 rounded-xl border border-slate-200"
                />
              </div>
            )}
            {settings.instructions && (
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">Instructions</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-700">
                  {settings.instructions}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Outstanding fees */}
      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fees</h2>
        {fees.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No fees have been recorded for {activeChild.student.name} yet.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {fees.map((fee) => {
              // Newest first (listProofsForGuardian sorts by created_at desc), so
              // `find` returns the most recent attempt for this fee.
              const linkedProof = childProofs.find((p) => p.fee_id === fee.id);
              const settled = fee.status === "paid" || linkedProof?.status === "verified";
              // A rejected or cancelled proof must not trap the parent: they need
              // to be able to submit a fresh one.
              const canSubmit =
                !settled &&
                (!linkedProof ||
                  linkedProof.status === "rejected" ||
                  linkedProof.status === "cancelled");
              const currency = settings?.currency ?? "INR";
              return (
                <Card key={fee.id} className="rounded-2xl border-slate-200 bg-white p-5 shadow-soft">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {formatCurrency(Number(fee.amount), currency)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Due {new Date(fee.due_date).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="text-right">
                      {statusBadge(linkedProof?.status ?? fee.status)}
                      {linkedProof?.receipt_id && (
                        <p className="mt-1 flex items-center justify-end gap-1 text-xs text-emerald-700">
                          <ReceiptIcon className="size-3" aria-hidden />
                          Receipt issued
                        </p>
                      )}
                    </div>
                  </div>

                  {canSubmit && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <SubmitProofForm
                        studentId={activeChild.student.id}
                        feeId={fee.id}
                        defaultAmount={Number(fee.amount)}
                      />
                    </div>
                  )}

                  {linkedProof &&
                    linkedProof.status !== "verified" &&
                    linkedProof.status !== "rejected" &&
                    linkedProof.status !== "cancelled" && (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                        <ClockIcon className="size-3.5" aria-hidden />
                        Proof submitted {new Date(linkedProof.submitted_at).toLocaleDateString("en-IN")}
                        — awaiting verification.
                      </p>
                    )}

                  {linkedProof?.status === "rejected" && (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-red-700">
                      <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      Rejected: {linkedProof.rejection_reason ?? "no reason recorded"}
                    </p>
                  )}

                  {settled && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
                      <CheckCircleIcon className="size-3.5" aria-hidden />
                      Settled.
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Payment history */}
      {childProofs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Payment history
          </h2>
          <div className="mt-3 space-y-2">
            {childProofs.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <IndianRupeeIcon className="size-4 text-slate-400" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(Number(p.amount), p.currency)}
                    </p>
                    <p className="text-xs text-slate-500">UTR {p.utr_reference ?? "—"}</p>
                  </div>
                </div>
                {statusBadge(p.status)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
