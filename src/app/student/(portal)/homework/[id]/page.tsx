import Link from "next/link";
import { ArrowLeftIcon, BookOpenCheckIcon } from "lucide-react";
import { requireStudentContext } from "@/lib/student/auth";
import { getStudentAssignmentPlayerDetails } from "@/lib/student/homework";
import { StudentHomeworkPlayer } from "@/components/homework/student-homework-player";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Complete Homework · TuitionTrack Student Portal",
  robots: { index: false, follow: false },
};

export default async function StudentHomeworkDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const context = await requireStudentContext();
  const student = context.student!;

  const data = await getStudentAssignmentPlayerDetails(params.id, student.id);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mb-4">
          <BookOpenCheckIcon className="size-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Homework Not Found</h2>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          This homework assignment could not be loaded or is not targeted to your class.
        </p>
        <Link
          href="/student/homework"
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "mt-4 gap-1.5",
          })}
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to Homework
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StudentHomeworkPlayer
        assignment={data.assignment}
        questions={data.questions}
        submission={data.submission}
        studentId={student.id}
        backUrl="/student/homework"
        backLabel="Back to Homework"
      />
    </div>
  );
}
