import { requireAuthContext } from "@/lib/auth";
import { getTestsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { ProgressView } from "@/components/today/progress-view";
import { SparklesIcon } from "lucide-react";

export const dynamic = "force-dynamic";

// /app/progress — mastery heatmap, Mistake Book, readiness trend with AI insights.
export default async function ProgressPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const context = await requireAuthContext();
  const students = context.accessibleStudents;
  const wanted = typeof searchParams?.student === "string" ? searchParams.student : undefined;
  const student = students.find((s) => s.id === wanted) ?? students[0] ?? null;

  if (!student) {
    return (
      <div className="space-y-6">
        <PageHeader title="Progress" description="Mastery, mistakes and readiness — the full picture." />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No student linked yet</EmptyTitle>
          <EmptyDescription>
            Ask your tutor to link your login email to a student record, then reload Progress.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const { tests } = await getTestsPageData(context);
  const recentTests = tests
    .filter((t) => t.student_id === student.id)
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      marks: t.marks,
      total: t.total,
      date: t.date,
      percentage: t.percentage,
    }));

  const weakSubjects = recentTests
    .filter((t) => t.percentage < 70)
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 3);

  const aiInsight = weakSubjects.length > 0
    ? `AI recommends focusing on ${weakSubjects[0].subject} (${weakSubjects[0].percentage.toFixed(1)}%). Use AI Tutor for targeted practice.`
    : "Strong performance across recent tests. Use AI Tutor for advanced topics and exam strategy.";

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader
        title="Progress"
        description={`Mastery, mistakes and readiness for ${student.name} — estimates, never guarantees.`}
      />
      <div className="flex items-start gap-2 rounded-tt-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <SparklesIcon className="size-4 shrink-0" aria-hidden />
        <span>{aiInsight}</span>
      </div>
      <ProgressView
        student={{ id: student.id, name: student.name, class: student.class }}
        recentTests={recentTests}
      />
    </div>
  );
}
