"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2Icon, Loader2Icon, AlertTriangleIcon } from "lucide-react";
import { deleteAccountAction } from "@/actions/portal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Self-service account deletion for any role. Requires typing DELETE to
 * confirm — this is irreversible and removes the login itself.
 */
export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm.trim().toUpperCase() !== "DELETE") return;
    startTransition(async () => {
      const result = await deleteAccountAction();
      // On success the action redirects to /login and never returns.
      toast.error(result.message || "Failed to delete account.");
      setOpen(false);
    });
  };

  return (
    <Card className="border-rose-200 bg-rose-50/40 shadow-soft">
      <CardHeader>
        <CardTitle className="text-rose-700">Delete account</CardTitle>
        <CardDescription>
          Permanently remove your login, workspace memberships and guardian links.
          Your past homework submissions stay with the teacher&apos;s records.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" size="sm" onClick={() => { setConfirm(""); setOpen(true); }}>
          <Trash2Icon className="size-4" />
          Delete my account
        </Button>

        <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertTriangleIcon className="size-6" />
              </div>
              <DialogTitle className="text-center text-lg font-bold">
                Delete your account?
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-slate-600">
                This cannot be undone. You will lose access to every portal immediately.
                Type <strong className="text-slate-900">DELETE</strong> below to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="delete-confirm">Confirmation</Label>
              <Input
                id="delete-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type DELETE"
                autoComplete="off"
              />
            </div>
            <DialogFooter className="flex gap-2 sm:justify-center">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending || confirm.trim().toUpperCase() !== "DELETE"}
                className="gap-1.5"
              >
                {isPending ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2Icon className="size-4" />}
                {isPending ? "Deleting…" : "Yes, delete everything"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
