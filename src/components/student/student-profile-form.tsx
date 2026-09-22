"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateStudentProfileAction } from "@/actions/portal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Self-service edit for a student's own details, including class & grade. */
export function StudentProfileForm({
  initialName,
  initialClass,
  initialParentName,
  initialParentPhone,
}: {
  initialName: string;
  initialClass: string;
  initialParentName: string;
  initialParentPhone: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [studentClass, setStudentClass] = useState(initialClass);
  const [parentName, setParentName] = useState(initialParentName);
  const [parentPhone, setParentPhone] = useState(initialParentPhone);

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateStudentProfileAction({
        name,
        class: studentClass,
        parent_name: parentName,
        parent_phone: parentPhone,
      });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <Card className="border-white/90 bg-white/85 shadow-soft">
      <CardHeader>
        <CardTitle>Edit profile</CardTitle>
        <CardDescription>Update your name and parent contact details.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="student-name">Full name</Label>
          <Input
            id="student-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="student-class">Class & Grade</Label>
          <Input
            id="student-class"
            value={studentClass}
            onChange={(e) => setStudentClass(e.target.value)}
            placeholder="e.g. 9 or Class 9"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="parent-name">Parent / Guardian name</Label>
          <Input
            id="parent-name"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="parent-phone">Parent contact number</Label>
          <Input
            id="parent-phone"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
          />
        </div>
        <div className="flex items-end justify-end">
          <Button onClick={handleSave} disabled={isPending || !name.trim() || !studentClass.trim()}>
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
