import { redirect } from "next/navigation";
import Link from "next/link";

import { getAuthContext } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldCheckIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portal access · TuitionTrack",
  robots: { index: false, follow: false },
};

/**
 * Legacy invitation entry point — retired.
 *
 * This route used to accept `/join?studentId=<uuid>` and, when the visitor had
 * a session, immediately wrote their email onto the student row to grant access.
 * That flow had no token, no expiry, no revocation, no verification and no audit
 * trail, and it published the student's database identifier in every shared link.
 *
 * It is replaced by `/parent/invite/<token>`, which uses a single-use
 * cryptographically random token bound to an authenticated account.
 *
 * Any old `?studentId=` link still in circulation is deliberately NOT honoured:
 * there is no way to distinguish a legitimate old link from a forged one, so the
 * only safe behaviour is to send the visitor somewhere they can get a real one.
 * Student-role self-access is handled by teacher-side account linking, not here.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: { studentId?: string; claimRole?: "student" | "parent" };
}) {
  const context = await getAuthContext();
  const hadLegacyParams = Boolean(searchParams.studentId);

  // A parent arriving with an old-style link is most likely already linked, or
  // about to be re-invited. Send them to the portal rather than a dead end.
  if (context.user && context.role === "parent") {
    redirect("/parent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg rounded-3xl border-slate-200 bg-white p-8 shadow-soft">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <ShieldCheckIcon className="size-6" aria-hidden />
        </div>

        <h1 className="mt-5 text-center text-xl font-semibold text-slate-900">
          {hadLegacyParams ? "This invitation link is out of date" : "Portal access"}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {hadLegacyParams ? (
            <>
              This link uses an older format that we no longer accept, because it exposed your
              child&apos;s internal identifier in the link itself. Nothing has been changed on your
              account.
            </>
          ) : (
            <>Access to the student and parent portals is by invitation only.</>
          )}
        </p>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Ask your tuition teacher to send a fresh invitation. The new link is private, works once,
          expires on its own, and can be cancelled by your teacher at any time.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href="/login" className={buttonVariants({ className: "w-full sm:flex-1" })}>
            Go to sign in
          </Link>
          <Link
            href="/"
            className={buttonVariants({ variant: "outline", className: "w-full sm:flex-1" })}
          >
            Back to home
          </Link>
        </div>
      </Card>
    </main>
  );
}
