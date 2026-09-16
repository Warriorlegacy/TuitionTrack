import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getHomeworkPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { HomeworkTable } from "@/components/homework/homework-table";
import { SparklesIcon } from "lucide-react";

export default async function HomeworkPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/homework")) {
    redirect("/app/dashboard");
  }

  const data = await getHomeworkPageData(context);

  const aiInsight = context.canManage
    ? "Use AI to generate differentiated homework assignments in seconds. Connect a free AI key in Settings."
    : "Submit homework via photo or text. AI can help you understand concepts without giving direct answers.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Homework"
        description="Assign work, track due dates, and monitor completion across students or batches."
      />
      <div className="flex items-start gap-2 rounded-tt-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <SparklesIcon className="size-4 shrink-0" aria-hidden />
        <span>{aiInsight}</span>
      </div>
      <HomeworkTable
        students={data.students}
        homework={data.homework}
        canManage={context.canManage}
      />
    </div>
  );
}
