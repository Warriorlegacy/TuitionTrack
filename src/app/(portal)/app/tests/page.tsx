import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getTestsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { TestsPanel } from "@/components/tests/tests-panel";

export default async function TestsPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/tests")) {
    redirect("/app/dashboard");
  }

  const data = await getTestsPageData(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tests"
        description="Capture marks, compare performance by subject, and surface progress clearly."
      />
      <TestsPanel
        students={data.students}
        tests={data.tests}
        marksChart={data.marksChart}
        canManage={context.canManage}
      />
    </div>
  );
}
