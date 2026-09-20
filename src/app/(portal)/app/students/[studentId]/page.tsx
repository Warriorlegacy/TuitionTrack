import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, GraduationCapIcon, PhoneIcon, MailIcon, UserIcon } from "lucide-react";
import { requireAuthContext } from "@/lib/auth";
import { canAccessRoute } from "@/lib/constants";
import { getStudentPortalAccess } from "@/lib/portal-access/grants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudentPortalAccessCard } from "@/components/students/student-portal-access-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: { studentId: string };
}) {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/students") || !context.canManage) {
    redirect("/app/dashboard");
  }

  const supabase = createSupabaseServerClient();
  const { data: student, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", params.studentId)
    .maybeSingle();

  if (error || !student) {
    notFound();
  }

  const portalStatus = await getStudentPortalAccess(params.studentId);
  if (!portalStatus) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/app/students"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "gap-1 text-slate-500 hover:text-slate-900",
          })}
        >
          <ArrowLeftIcon className="size-4" />
          Back to Students
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">{student.name}</h1>
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
              Class {student.class}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Enrolled student record · Manage profile & portal distribution
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/app/homework?studentId=${student.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View Homework
          </Link>
          <Link
            href={`/app/attendance?studentId=${student.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Attendance
          </Link>
        </div>
      </div>

      {/* Student Academic & Contact Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Student Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <GraduationCapIcon className="size-3.5 text-slate-400" />
              <span>Class: <strong>{student.class}</strong></span>
            </div>
            {student.student_email ? (
              <div className="flex items-center gap-2 text-slate-700 truncate">
                <MailIcon className="size-3.5 text-slate-400" />
                <span className="truncate">{student.student_email}</span>
              </div>
            ) : (
              <p className="text-slate-400">No student email linked</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Guardian Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <UserIcon className="size-3.5 text-slate-400" />
              <span>{student.parent_name || "—"}</span>
            </div>
            {student.parent_phone && (
              <div className="flex items-center gap-2 text-slate-700">
                <PhoneIcon className="size-3.5 text-slate-400" />
                <span>{student.parent_phone}</span>
              </div>
            )}
            {student.parent_email && (
              <div className="flex items-center gap-2 text-slate-700 truncate">
                <MailIcon className="size-3.5 text-slate-400" />
                <span className="truncate">{student.parent_email}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Portal Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Parent:</span>
              <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                {portalStatus.parentGrant?.status ?? "not generated"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Student:</span>
              <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                {portalStatus.studentGrant?.status ?? "not generated"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portal Access Control Section */}
      <StudentPortalAccessCard status={portalStatus} />
    </div>
  );
}
