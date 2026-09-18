import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth";
import { getHomeworkPageData } from "@/lib/queries";
import { TeacherHomeworkStudio } from "@/components/homework/teacher-homework-studio";

export const dynamic = "force-dynamic";

export default async function HomeworkStudioPage() {
  const context = await requireAuthContext();

  if (context.role !== "teacher") {
    redirect("/app/homework");
  }

  const data = await getHomeworkPageData(context);

  return (
    <main className="container py-6 px-4">
      <TeacherHomeworkStudio students={data.students} />
    </main>
  );
}
