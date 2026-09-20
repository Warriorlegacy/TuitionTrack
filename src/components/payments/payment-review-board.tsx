"use client";

import { useState, useTransition } from "react";
import {
  AlertCircleIcon,
  CheckIcon,
  ImageIcon,
  LoaderIcon,
  ShieldAlertIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getProofScreenshotAction,
  rejectProofAction,
  verifyProofAction,
} from "@/actions/admin-payments";

/**
 * Staff payment-review queue.
 *
 * Deliberately manual. There is no "auto-approve" path here on purpose
 * (brief §42): a screenshot existing, an amount matching, or a parent
 * claiming payment never marks a fee paid. Verification is a human action
 * that goes through the `is_app_staff()`-guarded `verify_payment_proof` RPC.
 */

export type ProofView = {
  id: string;
  student_id: string;
  student_name?: string;
  guardian_user_id: string;
  fee_id?: string | null;
  fee_amount?: number | null;
  amount: number | string;
  currency: string;
  utr_reference?: string | null;
  screenshot_storage_path?: string | null;
  screenshot_file_name?: string | null;
  status: string;
  submitted_at: string;
  reviewed_at?: string | null;
  review_notes?: string | null;
  rejection_reason?: string | null;
  flags: string[];
};

const FLAG_LABEL: Record<string, string> = {
  amount_mismatch: "Amount differs from fee",
  missing_reference: "No UTR / reference",
  duplicate_utr: "Duplicate UTR in this batch",
  used_utr: "UTR already used on a verified payment",
};

function money(value: number | string | null | undefined, currency: string) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
    }).format(n);
  } catch {
    return `${currency || "INR"} ${n}`;
  }
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function ProofCard({ proof }: { proof: ProofView }) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"idle" | "verify" | "reject">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [shotBusy, setShotBusy] = useState(false);

  const amount = Number(proof.amount);
  const feeAmount = proof.fee_amount == null ? null : Number(proof.fee_amount);

  function loadScreenshot() {
    if (!proof.screenshot_storage_path) return;
    setShotBusy(true);
    startTransition(async () => {
      const url = await getProofScreenshotAction(proof.screenshot_storage_path!);
      setShotUrl(url);
      setShotBusy(false);
    });
  }

  function act(kind: "verify" | "reject") {
    setMessage(null);
    setFailed(false);
    startTransition(async () => {
      const result =
        kind === "verify"
          ? await verifyProofAction(proof.id, notes.trim() || undefined)
          : await rejectProofAction(proof.id, reason.trim());
      if (!result.success) {
        setFailed(true);
        setMessage(result.message);
        return;
      }
      setMode("idle");
      setMessage(kind === "verify" ? "Verified. Receipt issued." : "Rejected.");
    });
  }

  return (
    <Card className="rounded-tt-md border-slate-200">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{proof.student_name ?? "Student"}</CardTitle>
            <p className="text-xs text-slate-500">Submitted {fmtDate(proof.submitted_at)}</p>
          </div>
          <Badge variant="outline" className="uppercase tracking-wide">
            {proof.status.replace(/_/g, " ")}
          </Badge>
        </div>

        {proof.flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {proof.flags.map((flag) => (
              <span
                key={flag}
                className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
              >
                <ShieldAlertIcon className="size-3" aria-hidden />
                {FLAG_LABEL[flag] ?? flag}
              </span>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Claimed amount</dt>
            <dd className="font-medium tabular-nums">{money(amount, proof.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Fee on record</dt>
            <dd className="font-medium tabular-nums">{money(feeAmount, proof.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">UPI reference</dt>
            <dd className="font-mono text-xs break-all">{proof.utr_reference || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Screenshot</dt>
            <dd>
              {proof.screenshot_storage_path ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={loadScreenshot}
                  disabled={shotBusy || isPending}
                  className="h-7 px-2 text-xs"
                >
                  {shotBusy ? (
                    <LoaderIcon className="mr-1 size-3 animate-spin" aria-hidden />
                  ) : (
                    <ImageIcon className="mr-1 size-3" aria-hidden />
                  )}
                  {shotUrl ? "Refresh (link expires)" : "View"}
                </Button>
              ) : (
                <span className="text-xs text-slate-400">None attached</span>
              )}
            </dd>
          </div>
        </dl>

        {shotUrl && (
          <figure className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shotUrl}
              alt={`Payment screenshot for ${proof.student_name ?? "student"}`}
              className="max-h-72 w-auto rounded-xl border border-slate-200 bg-white object-contain"
            />
            <figcaption className="text-xs text-slate-500">
              Short-lived signed URL from private storage. It expires in about two minutes.
            </figcaption>
          </figure>
        )}

        {proof.rejection_reason && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            Rejected: {proof.rejection_reason}
          </p>
        )}

        {message && (
          <p
            className={`rounded-xl border px-3 py-2 text-xs ${
              failed
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {message}
          </p>
        )}

        {mode === "reject" && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="space-y-1.5">
              <Label htmlFor={`reason-${proof.id}`} className="text-xs text-slate-600">
                Reason shown to the parent
              </Label>
              <Textarea
                id={`reason-${proof.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Reference number not found in bank statement"
                className="min-h-20 rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={isPending || reason.trim().length === 0}
                onClick={() => act("reject")}
                className="rounded-xl"
              >
                {isPending ? (
                  <LoaderIcon className="mr-1 size-3 animate-spin" aria-hidden />
                ) : (
                  <XIcon className="mr-1 size-3" aria-hidden />
                )}
                Confirm rejection
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setMode("idle")}
                className="rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {mode === "idle" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setMode("verify")}
              disabled={isPending}
              className="rounded-xl"
            >
              <CheckIcon className="mr-1 size-3" aria-hidden />
              Verify &amp; issue receipt
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMode("reject")}
              disabled={isPending}
              className="rounded-xl"
            >
              <XIcon className="mr-1 size-3" aria-hidden />
              Reject
            </Button>
            {proof.flags.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <AlertCircleIcon className="size-3" aria-hidden />
                Check the flags above before approving.
              </span>
            )}
          </div>
        )}

        {mode === "verify" && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-xs text-emerald-900">
              Verifying marks the linked fee paid and issues a numbered receipt. This cannot be
              undone from this screen.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor={`notes-${proof.id}`} className="text-xs text-slate-600">
                Review note (optional, internal)
              </Label>
              <Input
                id={`notes-${proof.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Confirmed against bank statement"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={() => act("verify")}
                className="rounded-xl"
              >
                {isPending ? (
                  <LoaderIcon className="mr-1 size-3 animate-spin" aria-hidden />
                ) : (
                  <CheckIcon className="mr-1 size-3" aria-hidden />
                )}
                Confirm verification
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setMode("idle")}
                className="rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PaymentReviewBoard({ proofs }: { proofs: ProofView[] }) {
  if (proofs.length === 0) {
    return (
      <Card className="rounded-tt-md border-dashed border-slate-300">
        <CardContent className="py-10 text-center text-sm text-slate-500">
          No payment proofs waiting for review. When a parent submits a UPI screenshot it appears
          here for manual confirmation.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {proofs.map((proof) => (
        <ProofCard key={proof.id} proof={proof} />
      ))}
    </div>
  );
}
