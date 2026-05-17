"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { AnnouncementRow } from "@/lib/db/types";
import { saveAnnouncementAction } from "@/actions/portal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AnnouncementFormDialog({
  open,
  onOpenChange,
  initialData,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  initialData?: AnnouncementRow | null;
  onSaved?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTitle(initialData?.title ?? "");
    setMessage(initialData?.message ?? "");
  }, [initialData, open]);

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await saveAnnouncementAction({
        id: initialData?.id,
        title,
        message,
      });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onOpenChange(false);
      onSaved?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit announcement" : "Broadcast announcement"}</DialogTitle>
          <DialogDescription>
            Announcements are visible to linked parent accounts in the portal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {initialData ? "Save changes" : "Send announcement"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
