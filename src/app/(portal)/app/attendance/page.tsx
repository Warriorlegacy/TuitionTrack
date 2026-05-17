import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getAttendancePageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { AttendanceGrid } from "@/components/attendance/attendance-grid";

export default async function AttendancePage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/attendance")) {
    redirect("/app/dashboard");
  }

  const data = await getAttendancePageData(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Mark attendance daily, review history, and share visibility with parents."
      />
      <AttendanceGrid
        students={data.students}
        attendance={data.attendance}
        canManage={context.canManage}
      />
    </div>
  );
}
