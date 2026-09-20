"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangleIcon,
  CheckIcon,
  CopyIcon,
  LinkIcon,
  LoaderIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import { createParentInviteAction } from "@/actions/parent-invites";
import { ACCEPT_RELATIONSHIP_OPTIONS, INVITE_EXPIRY_OPTIONS } from "@/lib/parent/labels";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StudentRow } from "@/lib/db/types";

/**
 * Guardian invitation dialog.
 *
 * Replaces the previous "Portal Access & Invite" dialog, which built links of
 * the shape `/join?studentId=<uuid>` (leaking the student's database id into
 * every shared message) and wrote `students.parent_email` directly to grant
 * access, with no token, expiry, revocation or audit trail.
 *
 * This version mints a single-use token server-side. The link that leaves this
 * dialog contains only the token. The email field is a *delivery hint* used to
 * bind the invite to an address — it does not itself grant anything.
 */
export function ParentInviteDialog({
  open,
  onOpenChange,
  student,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  student: StudentRow | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [relationship, setRelationship] = useState<string>("guardian");
  const [expiry, setExpiry] = useState<string>("168");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!student) return null;

  function reset() {
    setInviteUrl(null);
    setWaLink(null);
    setError(null);
    setCopied(false);
  }

  function generate() {
    if (!student) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("studentId", student.id);
      fd.set("relationshipType", relationship);
      fd.set("expiresInHours", expiry);
      fd.set("invitedEmail", email.trim());
      fd.set("invitedPhone", phone.trim());
      fd.set("channel", phone.trim() ? "whatsapp" : "link");

      const result = await createParentInviteAction(fd);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setInviteUrl(result.data.inviteUrl);
      setWaLink(result.data.waLink);
      toast.success("Invitation created. It works once and can be revoked.");
    });
  }

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invitation link copied.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy automatically — select the link and copy it manually.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl">Invite a parent or guardian</DialogTitle>
          <DialogDescription>
            Create a private, single-use invitation for{" "}
            <span className="font-semibold text-slate-800">{student.name}</span> (Class{" "}
            {student.class}).
          </DialogDescription>
        </DialogHeader>

        {!inviteUrl ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <p className="text-sm font-semibold text-slate-900">{student.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Class {student.class}
                {student.parent_name ? ` · Parent on file: ${student.parent_name}` : ""}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rel" className="text-xs">
                  Relationship
                </Label>
                <Select value={relationship} onValueChange={(v) => setRelationship(v ?? "guardian")}>
                  <SelectTrigger id="rel" className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCEPT_RELATIONSHIP_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exp" className="text-xs">
                  Link valid for
                </Label>
                <Select value={expiry} onValueChange={(v) => setExpiry(v ?? "168")}>
                  <SelectTrigger id="exp" className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_EXPIRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-email" className="text-xs">
                Parent email <span className="font-normal text-slate-400">(recommended)</span>
              </Label>
              <Input
                id="inv-email"
                type="email"
                placeholder="parent@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white"
              />
              <p className="text-[0.7rem] leading-relaxed text-slate-500">
                If you enter an email, the invitation can only be accepted by that exact address.
                This is what stops a forwarded link from granting access to the wrong person.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-phone" className="text-xs">
                Parent phone <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <Input
                id="inv-phone"
                placeholder="98XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-white"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={generate} disabled={isPending} className="gap-1.5">
                {isPending ? (
                  <>
                    <LoaderIcon className="size-3.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <LinkIcon className="size-3.5" />
                    Generate invitation
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <p className="text-xs leading-relaxed text-amber-900">
                <strong className="font-semibold">Copy this link now.</strong> For security, the
                invitation token is shown only once and is not stored in readable form. If you lose
                it, revoke this invitation and create a new one.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Private invitation link</Label>
              <div className="flex gap-2">
                <Input readOnly value={inviteUrl} className="bg-white font-mono text-xs" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copy}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="size-4 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {waLink && (
              <Button
                render={<a href={waLink} target="_blank" rel="noopener noreferrer" />}
                className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <MessageCircleIcon className="size-4" />
                Share on WhatsApp
              </Button>
            )}

            <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-slate-500" />
              <ul className="space-y-1 text-xs leading-relaxed text-slate-600">
                <li>Works once — it expires automatically after the parent accepts.</li>
                <li>
                  Contains no student ID and no personal details; only a random token is in the
                  link.
                </li>
                <li>
                  You can revoke it at any time before it is accepted, from the student&apos;s
                  page.
                </li>
                <li>Every invite, acceptance and revocation is recorded in the audit log.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={reset}>
                Create another
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
