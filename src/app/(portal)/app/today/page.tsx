import { requireAuthContext } from "@/lib/auth";
import { getTestsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { TodayView } from "@/components/today/today-view";
import { MotionLessonCard } from "@/components/learn/motion-lesson-card";
import { AiVideoCard } from "@/components/learn/ai-video-card";

export const dynamic = "force-dynamic";

// /app/today — Student Today command centre with AI recommendations (blueprint #9, #69).
export default async function TodayPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const context = await requireAuthContext();
  const students = context.accessibleStudents;
  const wanted = typeof searchParams?.student === "string" ? searchParams.student : undefined;
  const student = students.find((s) => s.id === wanted) ?? students[0] ?? null;
  const initialConcept =
    typeof searchParams?.concept === "string" ? searchParams.concept.slice(0, 200) : undefined;

  if (!student) {
    return (
      <div className="space-y-6">
        <PageHeader title="Today" description="One plan, one action — highest exam impact first." />
        <Empty className="border border-slate-200 bg-white">
          <EmptyTitle>No student linked yet</EmptyTitle>
          <EmptyDescription>
            Ask your tutor to link your login email to a student record, then reload Today.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const { tests } = await getTestsPageData(context);
  const recentTests = tests
    .filter((t) => t.student_id === student.id)
    .slice(0, 4)
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      marks: t.marks,
      total: t.total,
      date: t.date,
      percentage: t.percentage,
    }));

  // AI recommendation: highest-impact action based on recent performance
  const weakSubject = recentTests.length > 0
    ? recentTests.reduce((min, t) => (t.percentage < min.percentage ? t : min), recentTests[0])
    : null;

  const aiRecommendation = weakSubject
    ? `Practice ${weakSubject.subject} — recent score ${weakSubject.percentage.toFixed(1)}%. Start with a 15-minute recovery drill.`
    : "Start a quick diagnostic quiz to identify your weakest topic.";

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader
        title="Today"
        description="One plan, one action — highest exam impact first."
      />
      <TodayView
        student={{ id: student.id, name: student.name, class: student.class }}
        students={students.map((s) => ({ id: s.id, name: s.name }))}
        recentTests={recentTests}
        aiRecommendation={aiRecommendation}
      />
      <MotionLessonCard studentId={student.id} />
      <AiVideoCard studentId={student.id} initialConcept={initialConcept} />
    </div>
  );
}
