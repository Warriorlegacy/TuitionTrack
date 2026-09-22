import { requireAuthContext } from "@/lib/auth";
import { getDashboardPageData } from "@/lib/queries";
import { getUserUniqueCodeAction } from "@/actions/workspace-actions";
import { DashboardCards } from "@/components/dashboard/dashboard-cards";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TeacherCodeBanner } from "@/components/dashboard/teacher-code-banner";
import { TeacherFeaturesLaunchpad } from "@/components/dashboard/teacher-features-launchpad";
import { SparklesIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await requireAuthContext();
  const [data, codeResult] = await Promise.all([
    getDashboardPageData(context),
    getUserUniqueCodeAction(),
  ]);

  const teacherName = context.profile?.name ?? context.user?.email?.split("@")[0] ?? "Teacher";

  const aiInsight = context.role === "teacher"
    ? `${data.stats[0]?.value ?? 0} students · ${data.stats[2]?.value ?? 0} at risk today. Run the AI copilot for a 12-question remedial drill suggestion.`
    : `AI tutor can generate practice questions from your weak topics. Connect a free key in Settings.`;

  return (
    <div className="space-y-7">
      {/* 1. Master Workspace Code & Instant Actions Header */}
      <TeacherCodeBanner
        workspaceCode={codeResult.code ?? ""}
        teacherName={teacherName}
      />

      {/* 2. Glance Metric Cards */}
      <DashboardCards stats={data.stats} />

      {/* 3. AI Insight Banner */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-indigo-50/50 to-primary/5 px-4 py-3 text-xs text-primary shadow-xs">
        <SparklesIcon className="size-4 shrink-0 mt-0.5 text-primary" aria-hidden />
        <span className="font-medium text-slate-800">{aiInsight}</span>
      </div>

      {/* 4. Complete Workspace Launchpad (All Features Accessible in 1 Click) */}
      <TeacherFeaturesLaunchpad />

      {/* 5. Real-Time Workspace Activity & Performance Analytics */}
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <RecentActivity items={data.recentActivity} />
        <DashboardCharts marksChart={data.marksChart} feeChart={data.feeChart} />
      </div>
    </div>
  );
}

