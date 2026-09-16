import { redirect } from "next/navigation";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getStudentsPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { StudentTable } from "@/components/students/student-table";
import { SparklesIcon } from "lucide-react";

export default async function StudentsPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/students")) {
    redirect("/app/dashboard");
  }

  const data = await getStudentsPageData(context);

  const aiInsight = context.canManage
    ? "AI can generate personalized worksheets and identify at-risk students. Connect a free AI key in Settings."
    : "AI Tutor can help your child with homework and exam prep. Ask your tutor to enable AI features.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage student profiles and portal access mapping for parents and students."
      />
      <div className="flex items-start gap-2 rounded-tt-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <SparklesIcon className="size-4 shrink-0" aria-hidden />
        <span>{aiInsight}</span>
      </div>
      <StudentTable 
        students={data.students} 
        roleMap={data.roleMap} 
        riskMap={data.riskMap}
        canManage={context.canManage} 
      />
    </div>
  );
}
