import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";

import { InviteAcceptCard } from "@/components/parent/invite-accept-card";
import { getAuthContext } from "@/lib/auth";
import { previewParentInvite, redeemErrorCopy } from "@/lib/parent/invites";
import { acceptParentInviteAction } from "@/actions/parent-invites";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Accept invitation · TuitionTrack",
  robots: { index: false, follow: false },
};

/**
 * Invitation acceptance — `/parent/invite/<token>`.
 *
 * This page is public by design: the parent has no account yet. It therefore
 * lives OUTSIDE the `(portal)` route group, so it does not inherit
 * `(portal)/layout.tsx` — that layout calls `requireParentContext()`, which
 * redirects an unauthenticated visitor to /login and would make the invitation
 * impossible to open.
 *
 * The token is the only credential, and it must never reach the client. The
 * `token` prop passed to `InviteAcceptCard` is therefore redacted to a boolean
 * `canAccept`: passing the real value would serialise it into the RSC flight
 * payload, where it would sit in the served HTML. The value stays server-side
 * and is bound into a Server Action closure instead — Next encrypts Server
 * Action arguments, so the browser can invoke the action without ever holding
 * the credential.
 *
 * Because Server Actions are POST-only and same-origin by construction, this
 * also closes the GET side-channel: a crawler, preview bot or email scanner
 * that fetches this URL receives HTML containing no token.
 */
export default async function ParentInvitePage({
  params,
}: {
  params: { token: string };
}) {
  const token = decodeURIComponent(params.token ?? "");

  const preview = await previewParentInvite(token);

  if (!preview.ok) {
    const copy = redeemErrorCopy[preview.error];

    // An already-used invite when the visitor is signed in is very likely the
    // same parent reloading the page after accepting. Send them to the portal
    // rather than showing them a dead end.
    if (preview.error === "already_used") {
      const auth = await getAuthContext();
      if (auth.user) redirect("/parent");
    }

    return (
      <InviteShell>
        <h1 className="text-xl font-semibold text-slate-950">{copy.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{copy.body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Go to sign in
          </Link>
          <Link
            href="/"
            className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300"
          >
            Back to home
          </Link>
        </div>
      </InviteShell>
    );
  }

  const auth = await getAuthContext();
  const nextPath = `/parent/invite/${encodeURIComponent(token)}`;

  // Bind the token into the action server-side. The client calls this with no
  // arguments, so the credential is never shipped to the browser.
  const acceptInvite = acceptParentInviteAction.bind(null, token);

  return (
    <InviteShell>
      <InviteAcceptCard
        canAccept
        acceptInvite={acceptInvite}
        studentName={preview.studentName}
        studentClass={preview.studentClass}
        teacherName={preview.teacherName}
        relationshipType={preview.relationshipType}
        invitedEmail={preview.invitedEmail}
        signedInEmail={auth.user?.email ?? null}
        isSignedIn={Boolean(auth.user)}
        signInHref={`/login?next=${encodeURIComponent(nextPath)}`}
        signUpHref={`/signup?next=${encodeURIComponent(nextPath)}`}
      />
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg">
        <Card className="rounded-[2rem] border-slate-200 bg-white p-8 shadow-soft">
          <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <ShieldCheckIcon className="size-4" aria-hidden />
            Private invitation
          </div>
          {children}
        </Card>
        <p className="mt-4 px-2 text-center text-xs leading-relaxed text-slate-500">
          TuitionTrack staff will never ask you for this link, your password, or a payment
          screenshot over chat. This invitation is personal and works once.
        </p>
      </div>
    </div>
  );
}
