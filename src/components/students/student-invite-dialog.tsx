"use client";

import { useState, useTransition, useMemo } from "react";
import { CopyIcon, CheckIcon, Share2Icon, MailIcon, MessageCircleIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import type { StudentRow } from "@/lib/db/types";
import { updateStudentAccessAction } from "@/actions/portal";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export function StudentInviteDialog({
  open,
  onOpenChange,
  student,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  student: StudentRow | null;
  onSaved?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [parentEmail, setParentEmail] = useState(student?.parent_email ?? "");
  const [studentEmail, setStudentEmail] = useState(student?.student_email ?? "");

  // Update fields when student changes
  useState(() => {
    if (student) {
      setParentEmail(student.parent_email ?? "");
      setStudentEmail(student.student_email ?? "");
    }
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = useMemo(() => {
    if (!student) return "";
    return `${origin}/join?studentId=${student.id}`;
  }, [student, origin]);

  if (!student) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Portal invite link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy link. Please copy manually.");
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `🎓 *TuitionTrack Portal Access for ${student.name}*\n\n` +
      `Hello! You have been invited to access the TuitionTrack workspace for *${student.name}* (Class ${student.class}).\n\n` +
      `📌 Access homework, attendance, test performance, and learn with 24/7 AI Tutor.\n\n` +
      `🔗 *Open your portal here:* ${inviteUrl}\n\n` +
      `Log in or continue with Google to connect instantly!`
    );

    const cleanPhone = (student.parent_phone || "").replace(/\D/g, "");
    const waUrl = cleanPhone.length >= 10
      ? `https://api.whatsapp.com/send?phone=${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}&text=${text}`
      : `https://api.whatsapp.com/send?text=${text}`;

    window.open(waUrl, "_blank");
  };

  const handleSaveEmails = () => {
    startTransition(async () => {
      const result = await updateStudentAccessAction(
        student.id,
        parentEmail.trim() || undefined,
        studentEmail.trim() || undefined
      );

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onSaved?.();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Share2Icon className="size-5" />
            </div>
            <DialogTitle className="text-xl">Portal Access & Invite</DialogTitle>
          </div>
          <DialogDescription>
            Invite <span className="font-semibold text-slate-800">{student.name}</span> (Class {student.class}) or their parent to access this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">{student.name}</p>
            <p className="text-xs text-slate-500">
              Class {student.class} {student.parent_name ? `· Parent: ${student.parent_name}` : ""}
            </p>
          </div>
          <Badge variant="outline" className="bg-white text-xs">
            Class {student.class}
          </Badge>
        </div>

        <Tabs defaultValue="share" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="share" className="text-xs">
              WhatsApp & Quick Link
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs">
              Link Email Directly
            </TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Direct Portal Invite Link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={inviteUrl}
                  className="font-mono text-xs bg-white text-slate-700"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="size-4 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-4" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                  <MessageCircleIcon className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-emerald-950">
                    Share via WhatsApp
                  </h4>
                  <p className="text-xs text-emerald-800/90 leading-relaxed mt-0.5">
                    Send a pre-formatted invite message directly to the student or parent. When they open the link and sign in with Google or Email, their account connects automatically.
                  </p>
                </div>
              </div>

              <Button
                onClick={handleWhatsAppShare}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 shadow-sm"
              >
                <MessageCircleIcon className="size-4" />
                Share Invite on WhatsApp
              </Button>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary leading-relaxed">
              <SparklesIcon className="size-4 shrink-0 mt-0.5" />
              <span>
                Students can log in to view their assigned homework, test marks, attendance records, and chat with their personalized AI Tutor for doubt solving.
              </span>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 pt-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              If the student or parent already has an account or you know their email address, enter it here to link portal access immediately.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-student-email" className="text-xs">
                  Student Email
                </Label>
                <Input
                  id="edit-student-email"
                  type="email"
                  placeholder="student@example.com"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-parent-email" className="text-xs">
                  Parent Email
                </Label>
                <Input
                  id="edit-parent-email"
                  type="email"
                  placeholder="parent@example.com"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  className="bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEmails}
                disabled={isPending}
                className="gap-1.5"
              >
                <MailIcon className="size-3.5" />
                {isPending ? "Saving..." : "Save Email Mapping"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
