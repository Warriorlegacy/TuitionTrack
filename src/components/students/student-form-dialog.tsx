"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { StudentRow } from "@/lib/db/types";
import { saveStudentAction } from "@/actions/portal";
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

export function StudentFormDialog({
  open,
  onOpenChange,
  initialData,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  initialData?: StudentRow | null;
  onSaved?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    class: "",
    parent_name: "",
    parent_phone: "",
    parent_email: "",
    student_email: "",
  });

  useEffect(() => {
    setForm({
      name: initialData?.name ?? "",
      class: initialData?.class ?? "",
      parent_name: initialData?.parent_name ?? "",
      parent_phone: initialData?.parent_phone ?? "",
      parent_email: initialData?.parent_email ?? "",
      student_email: initialData?.student_email ?? "",
    });
  }, [initialData, open]);

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await saveStudentAction({
        id: initialData?.id,
        ...form,
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
          <DialogTitle>{initialData ? "Edit student" : "Add student"}</DialogTitle>
          <DialogDescription>
            Parent and student email fields are used to map read-only portal access.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Student name", "name"],
            ["Class", "class"],
            ["Parent name", "parent_name"],
            ["Parent phone", "parent_phone"],
            ["Parent email", "parent_email"],
            ["Student email", "student_email"],
          ].map(([label, key]) => (
            <div key={key} className="flex flex-col gap-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type={key.includes("email") ? "email" : "text"}
                value={form[key as keyof typeof form]}
                onChange={(event) =>
                  setForm((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {initialData ? "Save changes" : "Create student"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
