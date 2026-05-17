"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { StudentRow } from "@/lib/db/types";
import type { TestItem } from "@/lib/queries";
import { saveTestAction } from "@/actions/portal";
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

export function TestFormDialog({
  open,
  onOpenChange,
  students,
  initialData,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  students: StudentRow[];
  initialData?: TestItem | null;
  onSaved?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState("");
  const [subject, setSubject] = useState("");
  const [marks, setMarks] = useState("");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    setStudentId(initialData?.student_id ?? students[0]?.id ?? "");
    setSubject(initialData?.subject ?? "");
    setMarks(initialData?.marks?.toString() ?? "");
    setTotal(initialData?.total?.toString() ?? "");
    setDate(initialData?.date ?? "");
  }, [initialData, open, students]);

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await saveTestAction({
        id: initialData?.id,
        student_id: studentId,
        subject,
        marks: Number(marks),
        total: Number(total),
        date,
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
          <DialogTitle>{initialData ? "Edit test marks" : "Add test marks"}</DialogTitle>
          <DialogDescription>
            Capture subject-wise marks to power performance charts and reports.
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
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="marks">Marks</Label>
            <Input id="marks" value={marks} onChange={(event) => setMarks(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="total">Total</Label>
            <Input id="total" value={total} onChange={(event) => setTotal(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {initialData ? "Save changes" : "Add marks"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
