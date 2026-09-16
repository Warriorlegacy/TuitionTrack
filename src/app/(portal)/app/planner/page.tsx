import { requireAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { PlannerView } from "@/components/today/planner-view";
import { SparklesIcon } from "lucide-react";

export const dynamic = "force-dynamic";

// /app/planner — the student's weekly plan with AI recommendations (blueprint #18, #69).
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

  const aiRecommendation = "AI can generate a personalized study plan based on your weak topics and exam date. Connect a free AI key in Settings to unlock adaptive planning.";

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader
        title="Planner"
        description={`Your week for ${student.name}, ranked by expected mark gain — estimates, never guarantees.`}
      />
      <div className="flex items-start gap-2 rounded-tt-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <SparklesIcon className="size-4 shrink-0" aria-hidden />
        <span>{aiRecommendation}</span>
      </div>
      <PlannerView
        student={{ id: student.id, name: student.name }}
        students={students.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
