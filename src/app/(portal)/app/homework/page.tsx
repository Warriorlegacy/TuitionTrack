import { redirect } from "next/navigation";
import Link from "next/link";
import { canAccessRoute } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getHomeworkPageData } from "@/lib/queries";
import { PageHeader } from "@/components/shared/page-header";
import { HomeworkTable } from "@/components/homework/homework-table";
import { AiAssignmentsList } from "@/components/homework/ai-assignments-list";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SparklesIcon, BookOpenIcon } from "lucide-react";

export default async function HomeworkPage() {
  const context = await requireAuthContext();
  if (!canAccessRoute(context.role, "/app/homework")) {
    redirect("/app/dashboard");
  }

  const data = await getHomeworkPageData(context);

  const aiInsight = context.canManage
    ? "AI Homework Studio generates unique, non-repetitive questions for every student from official NCERT chapters."
    : "Complete your assigned homework and upload photos of handwritten workings for instant AI evaluation and step-by-step solutions.";

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Homework & Assignments"
          description="Create AI-powered adaptive assignments, track student completions, and review submissions question by question."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/app/curriculum"
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            <BookOpenIcon className="h-4 w-4 text-primary" />
            NCERT Curriculum
          </Link>

          {context.canManage && (
            <Link
              href="/app/homework/studio"
              className={buttonVariants({ size: "sm", className: "gap-1.5 shadow-md" })}
            >
              <SparklesIcon className="h-4 w-4" />
              AI Homework Studio
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <SparklesIcon className="size-4 shrink-0 mt-0.5" aria-hidden />
        <span>{aiInsight}</span>
      </div>

      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="ai" className="gap-1.5">
            <SparklesIcon className="h-3.5 w-3.5 text-primary" />
            AI Assignments ({data.aiAssignments?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="legacy">
            Quick Logs ({data.homework?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-4">
          <AiAssignmentsList
            assignments={data.aiAssignments ?? []}
            canManage={context.canManage}
          />
        </TabsContent>

        <TabsContent value="legacy" className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Quick Homework Tracker Log
            </h3>
            <HomeworkTable
              students={data.students}
              homework={data.homework}
              canManage={context.canManage}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
