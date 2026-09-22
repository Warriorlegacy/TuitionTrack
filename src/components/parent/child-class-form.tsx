"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateLinkedChildClassAction } from "@/actions/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Inline class & grade editor for one linked child on the parent profile. */
export function ChildClassForm({
  studentId,
  studentName,
  initialClass,
}: {
  studentId: string;
  studentName: string;
  initialClass: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [studentClass, setStudentClass] = useState(initialClass);

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateLinkedChildClassAction({ studentId, class: studentClass });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`class-${studentId}`} className="text-xs text-slate-500">
            Class & Grade for {studentName}
          </Label>
          <Input
            id={`class-${studentId}`}
            value={studentClass}
            onChange={(e) => setStudentClass(e.target.value)}
            placeholder="e.g. 9 or Class 9"
            autoComplete="off"
            className="h-9 text-xs"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={isPending || !studentClass.trim() || studentClass.trim() === initialClass.trim()}
          className="shrink-0 text-xs"
        >
          Save class
        </Button>
      </div>
    </div>
  );
}
