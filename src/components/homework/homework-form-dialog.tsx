"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { StudentRow } from "@/lib/db/types";
import type { HomeworkItem } from "@/lib/queries";
import { saveHomeworkAction } from "@/actions/portal";
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

export function HomeworkFormDialog({
  open,
  onOpenChange,
  students,
  initialData,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  students: StudentRow[];
  initialData?: HomeworkItem | null;
  onSaved?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    setSelectedStudents(initialData ? [initialData.student_id] : []);
    setTitle(initialData?.title ?? "");
    setDescription(initialData?.description ?? "");
    setDueDate(initialData?.due_date ?? "");
  }, [initialData, open]);

  const toggleStudent = (studentId: string) => {
    setSelectedStudents((current) =>
      current.includes(studentId)
        ? current.filter((entry) => entry !== studentId)
        : [...current, studentId],
    );
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await saveHomeworkAction({
        id: initialData?.id,
        title,
        description,
        due_date: dueDate,
        student_ids: selectedStudents,
        status: initialData?.status ?? "pending",
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit homework" : "Assign homework"}</DialogTitle>
          <DialogDescription>
            Teachers can assign a single item to one student or multiple students at once.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="title">Homework title</Label>
              <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="due-date">Due date</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Select students</Label>
            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              {students.map((student) => (
                <label
                  key={student.id}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(student.id)}
                    onChange={() => toggleStudent(student.id)}
                  />
                  <span>
                    {student.name} · {student.class}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || selectedStudents.length === 0}>
            {initialData ? "Save changes" : "Assign homework"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
