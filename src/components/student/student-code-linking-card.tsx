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
  HeartHandshakeIcon,
  Trash2Icon,
  Building2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  linkParentByCodeAction,
  joinWorkspaceAction,
  unlinkParentStudentAction,
} from "@/actions/workspace-actions";

type StudentCodeLinkingCardProps = {
  studentCode: string;
  studentName?: string | null;
  linkedParents?: Array<{
    relationshipId: string;
    relationshipType: string;
    parent: {
      id: string;
      name: string | null;
      email: string;
      link_code: string | null;
    };
  }>;
};

export function StudentCodeLinkingCard({
  studentCode,
  linkedParents = [],
}: StudentCodeLinkingCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [parentCodeInput, setParentCodeInput] = useState("");
  const [workspaceCodeInput, setWorkspaceCodeInput] = useState("");
  const [isPendingParent, startTransitionParent] = useTransition();
  const [isPendingWs, startTransitionWs] = useTransition();
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const handleCopy = () => {
    if (!studentCode) return;
    navigator.clipboard.writeText(studentCode);
    setCopied(true);
    toast.success("Student code copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLinkParent = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = parentCodeInput.trim();
    if (!clean) {
      toast.error("Please enter your parent's verification code.");
      return;
    }

    startTransitionParent(async () => {
      const res = await linkParentByCodeAction(clean);
      if (res.success) {
        toast.success(res.message);
        setParentCodeInput("");
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
      const res = await joinWorkspaceAction({ code: clean, role: "student" });
      if (res.success) {
        toast.success(res.message);
        setWorkspaceCodeInput("");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleUnlink = async (relationshipId: string) => {
    setUnlinkingId(relationshipId);
    const res = await unlinkParentStudentAction(relationshipId);
    setUnlinkingId(null);
    if (res.success) {
      toast.success("Parent unlinked successfully.");
      router.refresh();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <Card className="overflow-hidden border-2 border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/[0.15] to-teal-50/30 shadow-soft">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              <HeartHandshakeIcon className="size-3.5" />
              Portal Linking & Access
            </div>
            <CardTitle className="text-xl font-bold tracking-tight text-slate-900">
              Your Student Code & Parent Linking
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Share your code with your teacher or parent to connect accounts, or enter your parent&apos;s code directly.
            </CardDescription>
          </div>

          {/* Student Unique Code Badge */}
          <div className="flex items-center gap-2 rounded-2xl border-2 border-emerald-300 bg-white px-4 py-2.5 shadow-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Your Student Code
              </span>
              <span className="font-mono text-base font-extrabold tracking-wider text-emerald-700">
                {studentCode || "STU-..."}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="size-8 p-0 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 border-emerald-200"
              title="Copy student code"
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

      <CardContent className="space-y-4 pt-0">
        {/* Linked Parents Display */}
        {linkedParents.length > 0 && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5">
            <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5 mb-2">
              <UsersIcon className="size-3.5 text-emerald-700" />
              Connected Parents / Guardians ({linkedParents.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {linkedParents.map((lp) => (
                <div
                  key={lp.relationshipId}
                  className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs"
                >
                  <span className="font-semibold text-emerald-900">
                    {lp.parent.name || lp.parent.email}
                  </span>
                  {lp.parent.link_code && (
                    <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600">
                      {lp.parent.link_code}
                    </Badge>
                  )}
                  <button
                    type="button"
                    disabled={unlinkingId === lp.relationshipId}
                    onClick={() => handleUnlink(lp.relationshipId)}
                    className="text-slate-400 hover:text-rose-600 transition-colors ml-1 p-0.5"
                    title="Unlink parent"
                  >
                    {unlinkingId === lp.relationshipId ? (
                      <Loader2Icon className="size-3 animate-spin text-rose-500" />
                    ) : (
                      <Trash2Icon className="size-3" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Form 1: Link Parent by Parent Code */}
          <form
            onSubmit={handleLinkParent}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                <div className="flex size-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <UsersIcon className="size-3.5" />
                </div>
                Enter Parent Verification Code
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Paste your parent&apos;s code (e.g. <span className="font-mono font-medium text-slate-700">PAR-7K4X9P</span>) to link them to your portal.
              </p>
              <div className="space-y-1 pt-1">
                <Input
                  placeholder="e.g. PAR-8K4X9P"
                  value={parentCodeInput}
                  onChange={(e) => setParentCodeInput(e.target.value.toUpperCase())}
                  className="font-mono uppercase text-xs tracking-wider font-semibold h-8"
                  disabled={isPendingParent}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isPendingParent || !parentCodeInput.trim()}
              className="w-full h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              {isPendingParent ? (
                <>
                  <Loader2Icon className="mr-1.5 size-3 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <SparklesIcon className="mr-1.5 size-3" />
                  Link Parent
                </>
              )}
            </Button>
          </form>

          {/* Form 2: Join Teacher Workspace */}
          <form
            onSubmit={handleJoinWorkspace}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs">
                <div className="flex size-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Building2Icon className="size-3.5" />
                </div>
                Join Teacher Classroom
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Enter your teacher&apos;s code (e.g. <span className="font-mono font-medium text-slate-700">TT-4X7K2M</span>) to enroll in their workspace.
              </p>
              <div className="space-y-1 pt-1">
                <Input
                  placeholder="e.g. TT-7K4X9P"
                  value={workspaceCodeInput}
                  onChange={(e) => setWorkspaceCodeInput(e.target.value.toUpperCase())}
                  className="font-mono uppercase text-xs tracking-wider font-semibold h-8"
                  disabled={isPendingWs}
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="outline"
              disabled={isPendingWs || !workspaceCodeInput.trim()}
              className="w-full h-8 rounded-xl border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-800 text-xs font-semibold"
            >
              {isPendingWs ? (
                <>
                  <Loader2Icon className="mr-1.5 size-3 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <ArrowRightIcon className="mr-1.5 size-3" />
                  Join Classroom
                </>
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
