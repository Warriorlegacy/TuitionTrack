"use client";

import { useState, useTransition } from "react";
import {
  CopyIcon,
  CheckIcon,
  RefreshCwIcon,
  Share2Icon,
  Building2Icon,
  AlertTriangleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { regenerateWorkspaceCodeAction } from "@/actions/workspace-actions";
import { TeacherAddMemberByCodeDialog } from "@/components/workspace/teacher-add-by-code-dialog";
import type { Workspace } from "@/lib/workspace/auth";

export function WorkspaceSettingsCard({
  workspace: initialWorkspace,
  memberCount,
}: {
  workspace: Workspace;
  memberCount: number;
}) {
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const [copied, setCopied] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(workspace.code);
      setCopied(true);
      toast.success("Workspace code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const handleShareCode = async () => {
    const shareText = `Join my TuitionTrack classroom "${workspace.name}" using workspace code: ${workspace.code}\nSign up or join at: ${window.location.origin}/signup?role=student&code=${workspace.code}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join ${workspace.name}`,
          text: shareText,
          url: `${window.location.origin}/signup?role=student&code=${workspace.code}`,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        setCopiedShare(true);
        toast.success("Share invite message copied to clipboard!");
        setTimeout(() => setCopiedShare(false), 2000);
      }
    } catch {
      // User cancelled share
    }
  };

  const handleRegenerate = () => {
    startTransition(async () => {
      const result = await regenerateWorkspaceCodeAction(workspace.id);
      if (result.success && result.newCode) {
        setWorkspace((prev) => ({ ...prev, code: result.newCode! }));
        toast.success(`Workspace code updated to ${result.newCode}`);
        setConfirmOpen(false);
      } else {
        toast.error(result.message || "Failed to regenerate code.");
      }
    });
  };

  return (
    <>
      <Card className="border-slate-200/90 bg-white shadow-soft">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2Icon className="size-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {workspace.name}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Primary Teacher Workspace · {memberCount} active {memberCount === 1 ? "member" : "members"}
                </CardDescription>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              Active Workspace
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Workspace Code Display Box */}
          <div className="rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Unique Workspace Join Code
                </p>
                <p className="mt-1 font-mono text-3xl font-extrabold tracking-wider text-primary">
                  {workspace.code}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Share this code with your students and parents so they can join this workspace directly.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 sm:flex-col">
                <Button
                  onClick={handleCopyCode}
                  className="h-10 gap-1.5 font-medium shadow-sm"
                  variant="default"
                >
                  {copied ? <CheckIcon className="size-4 text-white" /> : <CopyIcon className="size-4" />}
                  <span>{copied ? "Copied!" : "Copy Code"}</span>
                </Button>

                <Button
                  onClick={handleShareCode}
                  variant="outline"
                  className="h-10 gap-1.5 border-slate-200 bg-white font-medium hover:bg-slate-50"
                >
                  {copiedShare ? <CheckIcon className="size-4 text-emerald-600" /> : <Share2Icon className="size-4" />}
                  <span>{copiedShare ? "Message Copied" : "Share Code"}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Add Member by Code Card */}
          <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-900">Add Student or Parent by Code</p>
              <p className="text-xs text-slate-500">
                Have a student&apos;s code (STU-XXXXXX) or parent&apos;s code (PAR-XXXXXX)? Enroll them instantly.
              </p>
            </div>
            <TeacherAddMemberByCodeDialog buttonText="Add by Code" variant="default" className="shrink-0" />
          </div>

          {/* Code Rotation & Security Notice */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-900">Rotate Workspace Code</p>
              <p className="text-xs text-slate-500">
                If your code was shared publicly by mistake, generate a new code. Existing members will remain safe.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              className="gap-1.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-50 shrink-0"
            >
              <RefreshCwIcon className="size-3.5" />
              <span>Regenerate Code</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Rotating Code */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangleIcon className="size-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold">
              Regenerate Workspace Code?
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-600">
              Generating a new code will immediately invalidate the current code (
              <span className="font-mono font-bold text-slate-900">{workspace.code}</span>).
              Any student or parent trying to join with the old code will be rejected.
              <br />
              <br />
              <strong>Existing members will NOT be removed.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRegenerate}
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? <RefreshCwIcon className="size-4 animate-spin" /> : null}
              {isPending ? "Regenerating…" : "Yes, Regenerate Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
