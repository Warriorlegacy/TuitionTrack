import { requireAuthContext } from "@/lib/auth";
import { getDashboardPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { DashboardCards } from "@/components/dashboard/dashboard-cards";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export default async function DashboardPage() {
  const context = await requireAuthContext();
  const data = await getDashboardPageData(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Track student operations, pending work, collections, and activity in one place."
      />
      <DashboardCards stats={data.stats} />
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <RecentActivity items={data.recentActivity} />
        <DashboardCharts marksChart={data.marksChart} feeChart={data.feeChart} />
      </div>
    </div>
  );
}
