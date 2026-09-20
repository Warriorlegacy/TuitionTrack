import Link from "next/link";
import { Brand } from "@/components/brand";
import { getAuthContext } from "@/lib/auth";
import { previewPortalGrant } from "@/lib/portal-access/grants";
import { PortalActivationCard } from "@/components/portal-access/portal-activation-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Student Portal Access · TuitionTrack",
  robots: { index: false, follow: false },
};

export default async function StudentPortalGatewayPage({
  params,
}: {
  params: { token: string };
}) {
  const token = decodeURIComponent(params.token ?? "");
  const preview = await previewPortalGrant(token);

  if (!preview.ok || preview.portal_type !== "student") {
    const errorCopy = {
      invalid_token: {
        title: "Invalid Student Link",
        body: "This invitation link is not valid or incomplete. Please request a new link from your tutor.",
      },
      revoked: {
        title: "Link Revoked",
        body: "Your tuition teacher has revoked this access link. Please ask them for a fresh student link.",
      },
      expired: {
        title: "Link Expired",
        body: "This student link has expired after 30 days. Please ask your tuition teacher to regenerate it.",
      },
      unknown: {
        title: "Unable to Open Student Portal",
        body: "We could not verify this invitation. Please check the URL or ask your tutor for assistance.",
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
  const currentPath = `/portal/student/${encodeURIComponent(token)}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-100 via-emerald-50/20 to-slate-100">
      <Brand className="mb-6" />
      <PortalActivationCard
        token={token}
        portalType="student"
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
