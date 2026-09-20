import { requireStudentContext } from "@/lib/student/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpenCheckIcon, CheckCircle2Icon, ClockIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentHomeworkPage() {
  const context = await requireStudentContext();
  const student = context.student!;

  const supabase = createSupabaseServerClient();
  const { data: homework } = await supabase
    .from("homework")
    .select("*")
    .eq("student_id", student.id)
    .order("due_date", { ascending: false });

  const list = homework ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Homework & Tasks"
        description={`Track assignments and homework assigned by your tuition teacher for Class ${student.class}.`}
      />

      <div className="space-y-3">
        {list.length === 0 ? (
          <Card className="border-white/90 bg-white/85 shadow-soft p-8 text-center">
            <BookOpenCheckIcon className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No homework assigned yet</p>
            <p className="mt-1 text-xs text-slate-400">
              When your teacher gives you homework, it will appear here.
            </p>
          </Card>
        ) : (
          list.map((hw) => (
            <Card key={hw.id} className="border-white/90 bg-white/85 shadow-soft">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{hw.title}</span>
                  </div>
                  {hw.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">{hw.description}</p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    Due: {hw.due_date ? new Date(hw.due_date).toLocaleDateString() : "No deadline"}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={
                    hw.status === "completed"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 gap-1 text-xs"
                      : "border-amber-200 bg-amber-50 text-amber-700 gap-1 text-xs"
                  }
                >
                  {hw.status === "completed" ? (
                    <CheckCircle2Icon className="size-3.5" />
                  ) : (
                    <ClockIcon className="size-3.5" />
                  )}
                  {hw.status === "completed" ? "Completed" : "Pending"}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
