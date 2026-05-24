import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getStudentsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { StudentTable } from "@/components/students/student-table";

export default async function StudentsPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/students")) {
    redirect("/app/dashboard");
  }

  const data = await getStudentsPageData(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage student profiles and portal access mapping for parents and students."
      />
      <StudentTable 
        students={data.students} 
        roleMap={data.roleMap} 
        riskMap={data.riskMap}
        canManage={context.canManage} 
      />
    </div>
  );
}
