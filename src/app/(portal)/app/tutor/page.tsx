import { requireAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { TutorView } from "@/components/today/tutor-view";

export const dynamic = "force-dynamic";

// /app/tutor — Student AI tutor (blueprint #9, #69, #81). Isolated slice.
export default async function TutorPage({
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
          title="AI Tutor"
          description="Ask, get a hint, learn the method — never just the answer."
        />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No student linked yet</EmptyTitle>
          <EmptyDescription>
            Ask your tutor to link your login email to a student record, then reload Tutor.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader
        title="AI Tutor"
        description="Ask, get a hint, learn the method — never just the answer."
      />
      <TutorView
        student={{ id: student.id, name: student.name }}
        students={students.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
