import { redirect } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";

import { requireAuthContext } from "@/lib/auth";
import { getPaymentSettings, adminListProofs } from "@/lib/parent/payments";
import type { PaymentSettingsRow } from "@/lib/db/types";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PaymentReviewBoard,
  type ProofView,
} from "@/components/payments/payment-review-board";
import {
  PaymentSettingsForm,
  type PaymentSettingsView,
} from "@/components/payments/payment-settings-form";

export const dynamic = "force-dynamic";

/**
 * Staff payment review (brief §36–48, §42).
 *
 * The teacher's workspace already lives at `/app/*`, so payment review sits
 * alongside `/app/fees` rather than in a separate `/admin` tree.
 *
 * Every read here goes through the RLS-scoped server client. Approval is not
 * possible from this page by accident: `verify_payment_proof` is a
 * SECURITY DEFINER function that re-checks `is_app_staff()` server-side and
 * refuses to run for a parent, even if this UI were somehow reached.
 */

export default async function PaymentsPage() {
  const context = await requireAuthContext();
  if (context.role !== "teacher") {
    redirect("/app/dashboard");
  }

  const [pendingResult, historyResult, settingsResult] = await Promise.allSettled([
    adminListProofs(["proof_submitted", "under_review"]),
    adminListProofs(["verified", "rejected"]),
    getPaymentSettings(),
  ]);

  const pending = pendingResult.status === "fulfilled" ? pendingResult.value : [];
  const history = historyResult.status === "fulfilled" ? historyResult.value : [];
  const settings: PaymentSettingsRow | null =
    settingsResult.status === "fulfilled" ? settingsResult.value : null;

  const readError =
    (pendingResult.status === "rejected" && (pendingResult.reason as Error).message) ||
    (historyResult.status === "rejected" && (historyResult.reason as Error).message) ||
    null;

  const settingsView: PaymentSettingsView = {
    upi_id: settings?.upi_id ?? "",
    upi_display_name: settings?.upi_display_name ?? "",
    upi_qr_url: settings?.upi_qr_url ?? null,
    payment_whatsapp_number: settings?.payment_whatsapp_number ?? "",
    currency: settings?.currency ?? "INR",
    instructions: settings?.instructions ?? null,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Review UPI payment proofs, confirm receipts, and manage how parents pay you."
      />

      <div className="flex items-start gap-2 rounded-tt-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Nothing here is automatic. A screenshot, a matching amount, or a parent claiming payment
          never marks a fee paid — only your explicit confirmation does.
        </span>
      </div>

      {readError && (
        <p className="rounded-tt-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load payment proofs: {readError}
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">
          Waiting for review
          {pending.length > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-500">
              {pending.length} item{pending.length === 1 ? "" : "s"}
            </span>
          )}
        </h2>
        <PaymentReviewBoard proofs={pending as unknown as ProofView[]} />
      </section>

      {history.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Recent decisions</h2>
          <Card className="rounded-tt-md border-slate-200">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Student</th>
                      <th className="px-4 py-2 font-medium">Amount</th>
                      <th className="px-4 py-2 font-medium">Reference</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Decided</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.slice(0, 20).map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2">{row.student_name ?? "Student"}</td>
                        <td className="px-4 py-2 tabular-nums">
                          {Number(row.amount).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{row.utr_reference || "—"}</td>
                        <td className="px-4 py-2">
                          <span
                            className={
                              row.status === "verified"
                                ? "text-emerald-700"
                                : "text-red-700"
                            }
                          >
                            {row.status}
                          </span>
                          {row.rejection_reason && (
                            <span className="block text-xs text-slate-500">
                              {row.rejection_reason}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {row.reviewed_at
                            ? new Date(row.reviewed_at).toLocaleDateString("en-IN", {
                                dateStyle: "medium",
                              })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-4">
        <Card className="rounded-tt-md border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Payment settings</CardTitle>
            <CardDescription>
              Parents see these details on their fee screen. Change them here — no redeploy needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settings ? (
              <PaymentSettingsForm settings={settingsView} />
            ) : (
              <p className="text-sm text-slate-500">
                No active payment settings row found. Re-run the fee engine migration to seed one.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
