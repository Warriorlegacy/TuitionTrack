import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getHomeworkPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { HomeworkTable } from "@/components/homework/homework-table";

export default async function HomeworkPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/homework")) {
    redirect("/app/dashboard");
  }

  const data = await getHomeworkPageData(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Homework"
        description="Assign work, track due dates, and monitor completion across students or batches."
      />
      <HomeworkTable
        students={data.students}
        homework={data.homework}
        canManage={context.canManage}
      />
    </div>
  );
}
