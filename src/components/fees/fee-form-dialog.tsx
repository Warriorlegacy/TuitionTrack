"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { StudentRow } from "@/lib/db/types";
import type { FeeItem } from "@/lib/queries";
import { saveFeeAction } from "@/actions/portal";
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

export function FeeFormDialog({
  open,
  onOpenChange,
  students,
  initialData,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  students: StudentRow[];
  initialData?: FeeItem | null;
  onSaved?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"paid" | "unpaid" | "overdue">("unpaid");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    setStudentId(initialData?.student_id ?? students[0]?.id ?? "");
    setAmount(initialData?.amount?.toString() ?? "");
    setStatus(initialData?.status ?? "unpaid");
    setDueDate(initialData?.due_date ?? "");
  }, [initialData, open, students]);

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await saveFeeAction({
        id: initialData?.id,
        student_id: studentId,
        amount: Number(amount),
        status,
        due_date: dueDate,
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
          <DialogTitle>{initialData ? "Edit fee" : "Add fee"}</DialogTitle>
          <DialogDescription>
            Track due dates and payment status so parents always see the latest fee position.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="student-id">Student</Label>
            <select
              id="student-id"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} · {student.class}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="due-date">Due date</Label>
            <Input id="due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {initialData ? "Save changes" : "Add fee"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
