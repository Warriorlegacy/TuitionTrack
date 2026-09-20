"use client";

import { useState, useTransition } from "react";
import { AlertCircleIcon, LoaderIcon, UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitPaymentProofAction } from "@/actions/parent-payments";

/**
 * Submit a UPI payment proof: amount, transaction reference (UTR), screenshot.
 *
 * Submission does NOT mark the fee paid — it creates a `proof_submitted` record
 * that staff verify (brief §42). The screenshot goes to a private bucket.
 */
export function SubmitProofForm({
  studentId,
  feeId,
  defaultAmount,
}: {
  studentId: string;
  feeId: string;
  defaultAmount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function onSubmit(formData: FormData) {
    setMessage(null);
    setOk(false);
    startTransition(async () => {
      const result = await submitPaymentProofAction(formData);
      if (!result.success) {
        setMessage(result.message);
        return;
      }
      setOk(true);
      setMessage("Proof submitted. Your teacher will verify it shortly.");
    });
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="feeId" value={feeId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`amount-${feeId}`} className="text-xs text-slate-600">
            Amount paid (₹)
          </Label>
          <Input
            id={`amount-${feeId}`}
            name="amount"
            type="number"
            step="0.01"
            min="1"
            defaultValue={defaultAmount || ""}
            required
            className="h-10 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`utr-${feeId}`} className="text-xs text-slate-600">
            UPI reference / UTR
          </Label>
          <Input
            id={`utr-${feeId}`}
            name="utrReference"
            placeholder="e.g. 402912345678"
            required
            className="h-10 rounded-xl"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`screenshot-${feeId}`} className="text-xs text-slate-600">
          Payment screenshot
        </Label>
        <Input
          id={`screenshot-${feeId}`}
          name="screenshot"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="h-10 rounded-xl"
        />
        <p className="text-xs text-slate-500">
          PNG, JPG or WebP, up to 5 MB. Stored privately; only your teacher can view it.
        </p>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
            ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {!ok && <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
          <p>{message}</p>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="rounded-xl" size="sm">
        {isPending ? (
          <>
            <LoaderIcon className="mr-2 size-4 animate-spin" aria-hidden />
            Submitting…
          </>
        ) : (
          <>
            <UploadIcon className="mr-2 size-4" aria-hidden />
            Submit payment proof
          </>
        )}
      </Button>
    </form>
  );
}
