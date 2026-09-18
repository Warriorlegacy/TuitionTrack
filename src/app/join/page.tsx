import { redirect } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { getAuthContext } from "@/lib/auth";
import { getStudentInviteDetails, claimStudentInviteAction } from "@/actions/portal";
import { JoinPortalCard } from "@/components/portal/join-portal-card";
import { buttonVariants } from "@/components/ui/button";
import { GraduationCapIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: { studentId?: string; claimRole?: "student" | "parent" };
}) {
  const studentId = searchParams.studentId;
  const claimRole = searchParams.claimRole || "student";

  const context = await getAuthContext();

  // If user is already logged in and claimRole was passed via OAuth callback, claim and redirect
  if (context.user && studentId && searchParams.claimRole) {
    await claimStudentInviteAction(studentId, claimRole);
    redirect("/app/dashboard");
  }

  if (!studentId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full text-center space-y-4 p-8 bg-white rounded-3xl shadow-soft border border-slate-200">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mx-auto">
            <GraduationCapIcon className="size-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Student Portal Access</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            To connect to your student or parent portal, please use the specific invite link shared by your teacher.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className={buttonVariants({ className: "w-full" })}
            >
              Go to Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const details = await getStudentInviteDetails(studentId);

  if (!details.success || !details.student) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full text-center space-y-4 p-8 bg-white rounded-3xl shadow-soft border border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">Invite Not Found</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {details.message || "This student portal invite link is invalid or has expired."}
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              Back to Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const currentUser = context.user
    ? {
        id: context.user.id,
        email: context.user.email || "",
        name: context.profile?.name || null,
        role: context.role,
      }
    : null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-slate-50/60">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex justify-center">
          <Brand />
        </div>
        <JoinPortalCard student={details.student} currentUser={currentUser} />
        <p className="text-center text-xs text-slate-400">
          TuitionTrack · Real-time portal sync for teachers, students, and parents.
        </p>
      </div>
    </main>
  );
}
