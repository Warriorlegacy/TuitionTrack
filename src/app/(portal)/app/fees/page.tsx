import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getFeesPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { FeeTable } from "@/components/fees/fee-table";

export default async function FeesPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/fees")) {
    redirect("/app/dashboard");
  }

  const data = await getFeesPageData(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees"
        description="Track collections, due dates, and reminder-ready fee statuses."
      />
      <FeeTable students={data.students} fees={data.fees} canManage={context.canManage} />
    </div>
  );
}
