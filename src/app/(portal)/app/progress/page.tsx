import { requireAuthContext } from "@/lib/auth";
import { getTestsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { ProgressView } from "@/components/today/progress-view";

export const dynamic = "force-dynamic";

// /app/progress — mastery heatmap, Mistake Book, readiness trend (isolated slice).
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

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader
        title="Progress"
        description={`Mastery, mistakes and readiness for ${student.name} — estimates, never guarantees.`}
      />
      <ProgressView
        student={{ id: student.id, name: student.name, class: student.class }}
        recentTests={recentTests}
      />
    </div>
  );
}
