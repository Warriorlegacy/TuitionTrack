import { requireStudentContext } from "@/lib/student/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilePenLineIcon, AwardIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentTestsPage() {
  const context = await requireStudentContext();
  const student = context.student!;

  const supabase = createSupabaseServerClient();
  const { data: tests } = await supabase
    .from("tests")
    .select("*")
    .eq("student_id", student.id)
    .order("date", { ascending: false });

  const list = tests ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tests & Marks"
        description={`View recorded test scores and subject performance marks for Class ${student.class}.`}
      />

      <div className="space-y-3">
        {list.length === 0 ? (
          <Card className="border-white/90 bg-white/85 shadow-soft p-8 text-center">
            <FilePenLineLineIconPlaceholder className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No tests recorded yet</p>
            <p className="mt-1 text-xs text-slate-400">
              When your teacher records test scores, they will be visible here.
            </p>
          </Card>
        ) : (
          list.map((t) => {
            const scorePct = t.total > 0 ? Math.round((t.marks / t.total) * 100) : 0;

            return (
              <Card key={t.id} className="border-white/90 bg-white/85 shadow-soft">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{t.subject} Test</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {t.subject}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      Date: {t.date ? new Date(t.date).toLocaleDateString() : "TBD"} · Total Marks: {t.total}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">
                        {t.marks} / {t.total}
                      </p>
                      <p className={`text-[11px] font-semibold ${scorePct >= 75 ? "text-emerald-600" : scorePct >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                        {scorePct}%
                      </p>
                    </div>
                    <Badge className="bg-emerald-500 text-white gap-1 text-xs">
                      <AwardIcon className="size-3.5" />
                      Recorded
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilePenLineLineIconPlaceholder(props: { className?: string }) {
  return <FilePenLineIcon {...props} />;
}
