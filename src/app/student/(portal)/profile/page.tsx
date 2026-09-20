import { requireStudentContext } from "@/lib/student/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/actions/portal";
import { ShieldCheckIcon, LogOutIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage() {
  const context = await requireStudentContext();
  const student = context.student!;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Student Profile"
        description="Your academic details and portal authentication settings."
      />

      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 font-bold text-xl">
            {student.name.charAt(0)}
          </div>
          <div>
            <CardTitle className="text-xl">{student.name}</CardTitle>
            <CardDescription className="text-xs">
              Class {student.class} · TuitionTrack Student
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <span className="text-slate-400">Class & Grade</span>
              <p className="font-semibold text-slate-900">Class {student.class}</p>
            </div>

            <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <span className="text-slate-400">Student Email</span>
              <p className="font-semibold text-slate-900">{student.student_email || "Not linked"}</p>
            </div>

            <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <span className="text-slate-400">Parent / Guardian</span>
              <p className="font-semibold text-slate-900">{student.parent_name || "—"}</p>
            </div>

            <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <span className="text-slate-400">Parent Contact</span>
              <p className="font-semibold text-slate-900">{student.parent_phone || "—"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <ShieldCheckIcon className="size-4" />
              <span>Unified Single Authentication</span>
            </div>
            <p className="text-xs text-emerald-700/90 leading-relaxed">
              You are signed in as <strong>{context.user?.email}</strong>. Your account uses TuitionTrack&apos;s unified authentication system, allowing you to access all assigned portals without separate passwords.
            </p>
          </div>

          <div className="pt-2">
            <form action={signOutAction}>
              <Button type="submit" variant="outline" className="gap-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200">
                <LogOutIcon className="size-3.5" />
                Sign out of Student Portal
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
