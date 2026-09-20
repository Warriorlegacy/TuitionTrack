"use client";

import { useState, useTransition } from "react";
import { LoaderIcon, SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updatePaymentSettingsAction } from "@/actions/admin-payments";

/**
 * Admin Payment Settings editor (brief §36–48).
 *
 * The parent-facing fee screen reads these values from the database at render
 * time. Nothing about the UPI ID or WhatsApp number is hardcoded in the UI, so
 * changing the receiving account never requires a redeploy.
 */

export type PaymentSettingsView = {
  upi_id: string;
  upi_display_name: string;
  upi_qr_url: string | null;
  payment_whatsapp_number: string;
  currency: string;
  instructions: string | null;
};

export function PaymentSettingsForm({ settings }: { settings: PaymentSettingsView }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  function onSubmit(formData: FormData) {
    setMessage(null);
    setFailed(false);
    startTransition(async () => {
      const result = await updatePaymentSettingsAction(formData);
      if (!result.success) {
        setFailed(true);
        setMessage(result.message);
        return;
      }
      setMessage("Saved. Parents see the new details immediately.");
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="upi_id" className="text-xs text-slate-600">
            UPI ID (VPA)
          </Label>
          <Input
            id="upi_id"
            name="upi_id"
            defaultValue={settings.upi_id}
            placeholder="name@bank"
            required
            className="h-10 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="upi_display_name" className="text-xs text-slate-600">
            Display name shown to parents
          </Label>
          <Input
            id="upi_display_name"
            name="upi_display_name"
            defaultValue={settings.upi_display_name}
            required
            className="h-10 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payment_whatsapp_number" className="text-xs text-slate-600">
            WhatsApp number for payment queries
          </Label>
          <Input
            id="payment_whatsapp_number"
            name="payment_whatsapp_number"
            defaultValue={settings.payment_whatsapp_number}
            required
            className="h-10 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency" className="text-xs text-slate-600">
            Currency
          </Label>
          <Input
            id="currency"
            name="currency"
            defaultValue={settings.currency}
            maxLength={3}
            className="h-10 rounded-xl uppercase"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="upi_qr_url" className="text-xs text-slate-600">
          QR code image URL (optional)
        </Label>
        <Input
          id="upi_qr_url"
          name="upi_qr_url"
          type="url"
          defaultValue={settings.upi_qr_url ?? ""}
          placeholder="https://…"
          className="h-10 rounded-xl"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="instructions" className="text-xs text-slate-600">
          Instructions shown on the parent fee screen
        </Label>
        <Textarea
          id="instructions"
          name="instructions"
          defaultValue={settings.instructions ?? ""}
          className="min-h-20 rounded-xl"
        />
      </div>

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

      <Button type="submit" disabled={isPending} size="sm" className="rounded-xl">
        {isPending ? (
          <LoaderIcon className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <SaveIcon className="mr-2 size-4" aria-hidden />
        )}
        Save payment settings
      </Button>
    </form>
  );
}
