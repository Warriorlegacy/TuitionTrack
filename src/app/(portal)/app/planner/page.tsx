import { requireAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { PlannerView } from "@/components/today/planner-view";

export const dynamic = "force-dynamic";

// /app/planner — the student's weekly plan (blueprint #18, #69).
// The planner has had a write-path since the AI loop landed; this route is the
// missing reader, so a generated plan is finally visible and actionable.
export default async function PlannerPage({
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
        <PageHeader
          title="Planner"
          description="Your week, ranked by exam impact — built from real learning signals."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No student linked yet</EmptyTitle>
          <EmptyDescription>
            Ask your tutor to link your login email to a student record, then reload Planner.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader
        title="Planner"
        description={`Your week for ${student.name}, ranked by expected mark gain — estimates, never guarantees.`}
      />
      <PlannerView
        student={{ id: student.id, name: student.name }}
        students={students.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
