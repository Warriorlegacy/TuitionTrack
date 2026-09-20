"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangleIcon, ArrowRightIcon, LoaderIcon, UserCheckIcon } from "lucide-react";

import { ACCEPT_RELATIONSHIP_OPTIONS } from "@/lib/parent/labels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const RELATIONSHIP_LABEL: Record<string, string> = {
  father: "Father",
  mother: "Mother",
  guardian: "Guardian",
  other: "Other",
};

type AcceptResult = { success: true } | { success: false; message: string };

/**
 * Invitation acceptance — the interactive step of the brief's 10-step flow.
 *
 * SECURITY: this component never receives the invitation token. The token is
 * the credential that grants access to a child's records; if it were passed as
 * a prop it would be serialised into the RSC flight payload and therefore into
 * the served HTML, where any proxy, cache, browser extension or screenshot
 * could read it. Instead the page passes `acceptInvite`, a Server Action whose
 * token argument was bound server-side and is encrypted in transit — the
 * browser can invoke it but cannot read the value.
 *
 * For the same reason the action is submitted, never a URL. Nothing on this
 * page needs the raw token, so nothing on this page gets it.
 */
export function InviteAcceptCard({
  canAccept,
  acceptInvite,
  studentName,
  studentClass,
  teacherName,
  relationshipType,
  invitedEmail,
  signedInEmail,
  isSignedIn,
  signInHref,
  signUpHref,
}: {
  canAccept: boolean;
  acceptInvite: () => Promise<AcceptResult>;
  studentName: string;
  studentClass: string;
  teacherName: string | null;
  relationshipType: string;
  invitedEmail: string | null;
  signedInEmail: string | null;
  isSignedIn: boolean;
  signInHref: string;
  signUpHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);

  // Address-bound invite: warn before the parent submits with the wrong account.
  const emailMismatch =
    isSignedIn &&
    invitedEmail &&
    signedInEmail &&
    invitedEmail.toLowerCase() !== signedInEmail.toLowerCase();

  function accept() {
    setError(null);
    if (!consented) {
      setError("Please confirm you are this child's parent or guardian.");
      return;
    }
    startTransition(async () => {
      const result = await acceptInvite();
      if (!result.success) {
        setError(result.message);
        return;
      }
      // The relationship is now active; land on the portal's home.
      router.replace("/parent");
      router.refresh();
    });
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        You have been invited
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        Link your child&apos;s account
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {teacherName ? `${teacherName} has invited you` : "You have been invited"} to follow{" "}
        <span className="font-semibold text-slate-900">{studentName}</span>&apos;s progress on
        TuitionTrack.
      </p>

      {/* Child + invite summary. Names only — no identifiers, no academic data. */}
      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Child</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{studentName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Class</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{studentClass || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Relationship on file
          </dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">
            {RELATIONSHIP_LABEL[relationshipType] ?? "Guardian"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Invited teacher
          </dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{teacherName ?? "—"}</dd>
        </div>
      </dl>

      {emailMismatch && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            This invitation was sent to <strong>{invitedEmail}</strong>, but you are signed in as{" "}
            <strong>{signedInEmail}</strong>. Sign in with the invited address to accept.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {/* Step 1: an account is required before the relationship can be created. */}
      {!isSignedIn ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-600">
            Sign in or create an account to accept. We link your child only after you are signed
            in, so access is tied to a real account rather than to an email address typed on a
            form.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button render={<Link href={signUpHref} />} className="rounded-2xl">
              Create an account <ArrowRightIcon className="ml-1.5 size-4" />
            </Button>
            <Button render={<Link href={signInHref} />} variant="outline" className="rounded-2xl">
              I already have an account
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <UserCheckIcon className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
            <p className="text-sm text-slate-700">
              Signed in as <strong>{signedInEmail}</strong>
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="consent"
              checked={consented}
              onCheckedChange={(v) => setConsented(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="consent" className="text-sm font-normal leading-relaxed text-slate-700">
              I confirm that I am {studentName}&apos;s parent or legal guardian, and I agree to
              receive updates about their tuition on TuitionTrack.
            </Label>
          </div>

          <Button
            onClick={accept}
            disabled={isPending || !consented || !canAccept}
            className="w-full rounded-2xl"
          >
            {isPending ? (
              <>
                <LoaderIcon className="mr-2 size-4 animate-spin" aria-hidden />
                Linking…
              </>
            ) : (
              <>Accept invitation and view {studentName}</>
            )}
          </Button>

          <p className="text-center text-xs text-slate-500">
            Not you?{" "}
            <Link
              href={signInHref}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Sign in with a different account
            </Link>
          </p>
        </div>
      )}

      <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
        Accepting this invitation links your account to {studentName} only. It does not give you
        access to any other child&apos;s records, and you can change what you receive from the
        Profile page at any time. Available relationship options:{" "}
        {ACCEPT_RELATIONSHIP_OPTIONS.map((o) => o.label).join(", ")}.
      </p>
    </div>
  );
}
