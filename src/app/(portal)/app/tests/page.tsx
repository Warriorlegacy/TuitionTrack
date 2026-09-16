import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getTestsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { TestsPanel } from "@/components/tests/tests-panel";
import { SparklesIcon } from "lucide-react";

export default async function TestsPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/tests")) {
    redirect("/app/dashboard");
  }

  const data = await getTestsPageData(context);

  const aiInsight = context.role === "teacher"
    ? "Use AI Quiz to generate differentiated practice questions for any student in under a minute."
    : "Try AI Tutor for topic-specific practice questions based on your recent test performance.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tests"
        description="Capture marks, compare performance by subject, and surface progress clearly."
      />
      <div className="flex items-start gap-2 rounded-tt-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <SparklesIcon className="size-4 shrink-0" aria-hidden />
        <span>{aiInsight}</span>
      </div>
      <TestsPanel
        students={data.students}
        tests={data.tests}
        marksChart={data.marksChart}
        canManage={context.canManage}
      />
    </div>
  );
}
