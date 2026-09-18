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
    const trimmedName = form.name.trim();
    const trimmedClass = form.class.trim();

    if (!trimmedName) {
      toast.error("Student name is required.");
      return;
    }
    if (!trimmedClass) {
      toast.error("Class is required.");
      return;
    }

    startTransition(async () => {
      const result = await saveStudentAction({
        id: initialData?.id,
        name: trimmedName,
        class: trimmedClass,
        parent_name: form.parent_name.trim(),
        parent_phone: form.parent_phone.trim(),
        parent_email: form.parent_email.trim(),
        student_email: form.student_email.trim(),
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
            Only student name and class are required. Parent and contact details are optional.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Student name", key: "name", required: true, placeholder: "e.g. Udit" },
            { label: "Class", key: "class", required: true, placeholder: "e.g. 9 or Class 9" },
            { label: "Parent name", key: "parent_name", required: false, placeholder: "Optional (e.g. Vijay Shankar)" },
            { label: "Parent phone", key: "parent_phone", required: false, placeholder: "Optional (e.g. 8004422805)" },
            { label: "Parent email", key: "parent_email", required: false, placeholder: "Optional (e.g. parent@gmail.com)" },
            { label: "Student email", key: "student_email", required: false, placeholder: "Optional (e.g. student@gmail.com)" },
          ].map(({ label, key, required, placeholder }) => (
            <div key={key} className="flex flex-col gap-2">
              <Label htmlFor={key} className="flex items-center gap-1.5">
                <span>{label}</span>
                {required ? (
                  <span className="text-destructive font-semibold">*</span>
                ) : (
                  <span className="text-xs font-normal text-slate-400">(optional)</span>
                )}
              </Label>
              <Input
                id={key}
                type={key.includes("email") ? "email" : "text"}
                placeholder={placeholder}
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
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || !form.name.trim() || !form.class.trim()}
          >
            {isPending ? "Saving..." : initialData ? "Save changes" : "Create student"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
