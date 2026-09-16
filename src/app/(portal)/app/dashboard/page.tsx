import { requireAuthContext } from "@/lib/auth";
import { getDashboardPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { DashboardCards } from "@/components/dashboard/dashboard-cards";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { SparklesIcon } from "lucide-react";

export default async function DashboardPage() {
  const context = await requireAuthContext();
  const data = await getDashboardPageData(context);

  const aiInsight = context.role === "teacher"
    ? `${data.stats[0]?.value ?? 0} students · ${data.stats[2]?.value ?? 0} at risk today. Run the AI copilot for a 12-question remedial drill suggestion.`
    : `AI tutor can generate practice questions from your weak topics. Connect a free key in Settings.`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Track student operations, pending work, collections, and activity in one place."
      />
      <div className="flex items-start gap-2 rounded-tt-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <SparklesIcon className="size-4 shrink-0" aria-hidden />
        <span>{aiInsight}</span>
      </div>
      <DashboardCards stats={data.stats} />
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <RecentActivity items={data.recentActivity} />
        <DashboardCharts marksChart={data.marksChart} feeChart={data.feeChart} />
      </div>
    </div>
  );
}
