"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UsersIcon,
  CopyIcon,
  CheckIcon,
  SparklesIcon,
  ArrowRightIcon,
  Loader2Icon,
  GraduationCapIcon,
  Building2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  linkStudentByCodeAction,
  joinWorkspaceAction,
} from "@/actions/workspace-actions";

type ChildLinkingHubProps = {
  parentCode: string;
  parentName?: string | null;
  compact?: boolean;
};

export function ChildLinkingHub({
  parentCode,
  compact = false,
}: ChildLinkingHubProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [studentCodeInput, setStudentCodeInput] = useState("");
  const [workspaceCodeInput, setWorkspaceCodeInput] = useState("");
  const [isPendingStudent, startTransitionStudent] = useTransition();
  const [isPendingWs, startTransitionWs] = useTransition();

  const handleCopy = () => {
    if (!parentCode) return;
    navigator.clipboard.writeText(parentCode);
    setCopied(true);
    toast.success("Parent code copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLinkStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = studentCodeInput.trim();
    if (!clean) {
      toast.error("Please enter your child's student code.");
      return;
    }

    startTransitionStudent(async () => {
      const res = await linkStudentByCodeAction(clean);
      if (res.success) {
        toast.success(res.message);
        setStudentCodeInput("");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleJoinWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = workspaceCodeInput.trim();
    if (!clean) {
      toast.error("Please enter a teacher workspace code.");
      return;
    }

    startTransitionWs(async () => {
      const res = await joinWorkspaceAction({ code: clean, role: "parent" });
      if (res.success) {
        toast.success(res.message);
        setWorkspaceCodeInput("");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-white via-primary/[0.01] to-blue-50/30 shadow-soft">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <UsersIcon className="size-3.5" />
              Direct Family & Teacher Linking
            </div>
            <CardTitle className="text-xl font-bold tracking-tight text-slate-900">
              {compact ? "Link Another Child" : "Connect With Your Child's Studies"}
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Use your parent verification code or enter your child&apos;s student code to sync academic progress instantly.
            </CardDescription>
          </div>

          {/* Parent's Unique Verification Code Display */}
          <div className="flex items-center gap-2 rounded-2xl border-2 border-primary/30 bg-white px-4 py-2.5 shadow-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Your Parent Code
              </span>
              <span className="font-mono text-base font-extrabold tracking-wider text-primary">
                {parentCode || "PAR-..."}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="size-8 p-0 rounded-xl hover:bg-primary/5 hover:text-primary"
              title="Copy parent code"
            >
              {copied ? (
                <CheckIcon className="size-4 text-emerald-600" />
              ) : (
                <CopyIcon className="size-4 text-slate-500" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Form 1: Link Child by Student Code */}
          <form
            onSubmit={handleLinkStudent}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <GraduationCapIcon className="size-4" />
                </div>
                Enter Child&apos;s Student Code
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ask your child for their unique Student Code (e.g. <span className="font-mono font-medium text-slate-700">STU-9K2A4P</span>) displayed on their student dashboard.
              </p>
              <div className="space-y-1 pt-1">
                <Label htmlFor="student-code-input" className="sr-only">
                  Student Code
                </Label>
                <Input
                  id="student-code-input"
                  placeholder="e.g. STU-8K4X9P"
                  value={studentCodeInput}
                  onChange={(e) => setStudentCodeInput(e.target.value.toUpperCase())}
                  className="font-mono uppercase text-sm tracking-wider font-semibold"
                  disabled={isPendingStudent}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isPendingStudent || !studentCodeInput.trim()}
              className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              {isPendingStudent ? (
                <>
                  <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                  Linking Child...
                </>
              ) : (
                <>
                  <SparklesIcon className="mr-1.5 size-3.5" />
                  Link Child Now
                </>
              )}
            </Button>
          </form>

          {/* Form 2: Join Teacher Workspace by Code */}
          <form
            onSubmit={handleJoinWorkspace}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Building2Icon className="size-4" />
                </div>
                Enter Teacher Workspace Code
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Have your tuition teacher&apos;s Classroom Code (e.g. <span className="font-mono font-medium text-slate-700">TT-4X7K2M</span>)? Enter it to connect to their center.
              </p>
              <div className="space-y-1 pt-1">
                <Label htmlFor="workspace-code-input" className="sr-only">
                  Teacher Workspace Code
                </Label>
                <Input
                  id="workspace-code-input"
                  placeholder="e.g. TT-7K4X9P"
                  value={workspaceCodeInput}
                  onChange={(e) => setWorkspaceCodeInput(e.target.value.toUpperCase())}
                  className="font-mono uppercase text-sm tracking-wider font-semibold"
                  disabled={isPendingWs}
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="outline"
              disabled={isPendingWs || !workspaceCodeInput.trim()}
              className="w-full h-9 rounded-xl border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-800 text-xs font-semibold"
            >
              {isPendingWs ? (
                <>
                  <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ArrowRightIcon className="mr-1.5 size-3.5" />
                  Join Teacher Workspace
                </>
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
