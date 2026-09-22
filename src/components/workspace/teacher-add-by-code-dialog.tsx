"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlusIcon,
  SparklesIcon,
  Loader2Icon,
  GraduationCapIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { teacherAddMemberByCodeAction } from "@/actions/workspace-actions";

type TeacherAddMemberByCodeDialogProps = {
  buttonText?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
};

export function TeacherAddMemberByCodeDialog({
  buttonText = "Add by Code",
  variant = "default",
  size = "sm",
  className,
}: TeacherAddMemberByCodeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) {
      toast.error("Please enter a student or parent code.");
      return;
    }

    startTransition(async () => {
      const res = await teacherAddMemberByCodeAction(clean);
      if (res.success) {
        toast.success(res.message);
        setCode("");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <UserPlusIcon className="mr-1.5 size-3.5" />
        {buttonText}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
        <form onSubmit={handleAdd}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-bold">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserPlusIcon className="size-4" />
              </div>
              Add Student or Parent by Code
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Enter any student portal code or parent verification code to enroll them directly into your classroom workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs space-y-1.5 text-slate-600">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <GraduationCapIcon className="size-3.5 text-emerald-600" />
                Student Code: <span className="font-mono text-emerald-700">STU-XXXXXX</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <UsersIcon className="size-3.5 text-blue-600" />
                Parent Code: <span className="font-mono text-blue-700">PAR-XXXXXX</span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                Students and parents find their 6-character code directly in their portal header.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="universal-code-input" className="text-xs font-semibold text-slate-700">
                Unique Verification Code
              </Label>
              <Input
                id="universal-code-input"
                placeholder="e.g. STU-8K4X9P or PAR-7K2M9Q"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono uppercase text-sm tracking-wider font-semibold h-10"
                disabled={isPending}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !code.trim()}
              className="bg-primary hover:bg-primary/90 text-white font-semibold"
            >
              {isPending ? (
                <>
                  <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                  Adding to Workspace...
                </>
              ) : (
                <>
                  <SparklesIcon className="mr-1.5 size-3.5" />
                  Enroll in Workspace
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>
);
}
