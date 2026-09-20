import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { requireParentContext } from "@/lib/parent/auth";
import { AskAiSection } from "@/components/parent/ask-ai-modal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ask About My Child · TuitionTrack",
};

export default async function AskParentAiPage({
  searchParams,
}: {
  searchParams?: { child?: string };
}) {
  const requested = typeof searchParams?.child === "string" ? searchParams.child : undefined;
  const context = await requireParentContext(requested);
  const child = context.activeChild;

  if (!child) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Ask About My Child"
          description="Ask questions about your child's academic journey."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No child selected</EmptyTitle>
          <EmptyDescription>
            Select a child from the top switcher to start asking questions.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <PageHeader
        title="Ask About My Child"
        description={`Instant, fact-checked answers about ${child.student.name}'s learning, homework, tests, and progress.`}
      />

      <AskAiSection
        childId={child.student.id}
        studentName={child.student.name}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600 space-y-3">
        <h3 className="font-semibold text-slate-900 text-sm">How this AI works</h3>
        <ul className="list-disc pl-4 space-y-1 text-slate-500">
          <li>
            <strong>Strict Fact Grounding:</strong> Answers are derived solely from {child.student.name}&apos;s verified attendance, homework submissions, test results, and syllabus records.
          </li>
          <li>
            <strong>Zero Hallucination:</strong> If an assessment or homework item has not been graded yet, the AI will state so clearly rather than guess a score.
          </li>
          <li>
            <strong>Child Privacy Isolation:</strong> Your inquiries only query {child.student.name}&apos;s data. No other student&apos;s or family&apos;s records are ever accessible.
          </li>
        </ul>
      </div>
    </div>
  );
}
