import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getFeesPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { FeeTable } from "@/components/fees/fee-table";
import { SparklesIcon } from "lucide-react";

export default async function FeesPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/fees")) {
    redirect("/app/dashboard");
  }

  const data = await getFeesPageData(context);

  const overdueCount = data.fees.filter((f) => f.status === "overdue").length;
  const aiInsight = context.canManage
    ? overdueCount > 0
      ? `AI can draft polite fee reminder messages for ${overdueCount} overdue payments.`
      : "No overdue fees. AI can help automate reminder scheduling."
    : "Contact your tutor for fee-related queries.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees"
        description="Track collections, due dates, and reminder-ready fee statuses."
      />
      <div className="flex items-start gap-2 rounded-tt-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <SparklesIcon className="size-4 shrink-0" aria-hidden />
        <span>{aiInsight}</span>
      </div>
      <FeeTable students={data.students} fees={data.fees} canManage={context.canManage} />
    </div>
  );
}
