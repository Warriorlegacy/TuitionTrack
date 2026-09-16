import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getAttendancePageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { AttendanceGrid } from "@/components/attendance/attendance-grid";
import { SparklesIcon } from "lucide-react";

export default async function AttendancePage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/attendance")) {
    redirect("/app/dashboard");
  }

  const data = await getAttendancePageData(context);

  const aiInsight = context.canManage
    ? "Low attendance correlates with lower readiness. Use AI Tutor to create catch-up practice plans for absent students."
    : "Regular attendance improves learning outcomes. Your tutor can see your attendance history.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Mark attendance daily, review history, and share visibility with parents."
      />
      <div className="flex items-start gap-2 rounded-tt-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <SparklesIcon className="size-4 shrink-0" aria-hidden />
        <span>{aiInsight}</span>
      </div>
      <AttendanceGrid
        students={data.students}
        attendance={data.attendance}
        canManage={context.canManage}
      />
    </div>
  );
}
