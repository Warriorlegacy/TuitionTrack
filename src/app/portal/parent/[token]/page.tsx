import Link from "next/link";
import { Brand } from "@/components/brand";
import { getAuthContext } from "@/lib/auth";
import { previewPortalGrant } from "@/lib/portal-access/grants";
import { PortalActivationCard } from "@/components/portal-access/portal-activation-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Parent Portal Access · TuitionTrack",
  robots: { index: false, follow: false },
};

export default async function ParentPortalGatewayPage({
  params,
}: {
  params: { token: string };
}) {
  const token = decodeURIComponent(params.token ?? "");
  const preview = await previewPortalGrant(token);

  if (!preview.ok || preview.portal_type !== "parent") {
    const errorCopy = {
      invalid_token: {
        title: "Invalid Portal Link",
        body: "This invitation link is not valid or incomplete. Please request a fresh link from your tuition teacher.",
      },
      revoked: {
        title: "Invitation Withdrawn",
        body: "Your tuition teacher has revoked this invitation link. Please contact them if you think this is an error.",
      },
      expired: {
        title: "Invitation Expired",
        body: "For student privacy and security, portal access links expire after 30 days. Please ask your tuition teacher to generate a fresh link.",
      },
      unknown: {
        title: "Unable to Open Portal",
        body: "We could not verify this invitation link. Please try again or ask your tuition teacher for assistance.",
      },
    }[preview.error ?? "unknown"];

    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-slate-50">
        <Brand className="mb-6" />
        <Card className="max-w-md text-center p-6 border-slate-200 bg-white shadow-soft">
          <CardHeader>
            <CardTitle className="text-xl text-slate-900">{errorCopy.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs text-slate-600">
            <p>{errorCopy.body}</p>
            <div className="flex justify-center gap-3 pt-2">
              <Link href="/login" className={buttonVariants({ variant: "default", size: "sm" })}>
                Go to Sign in
              </Link>
              <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Back to Home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const auth = await getAuthContext();
  const currentPath = `/portal/parent/${encodeURIComponent(token)}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-100 via-sky-50/20 to-slate-100">
      <Brand className="mb-6" />
      <PortalActivationCard
        token={token}
        portalType="parent"
        studentName={preview.student_name ?? "Student"}
        studentClass={preview.student_class ?? ""}
        targetEmail={preview.target_email}
        signedInEmail={auth.user?.email ?? null}
        isSignedIn={Boolean(auth.user)}
        currentPath={currentPath}
      />
    </div>
  );
}
