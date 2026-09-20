import { requireStudentContext } from "@/lib/student/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpenIcon } from "lucide-react";
import { listAssignmentsForStudent } from "@/lib/parent/assignments";

export const dynamic = "force-dynamic";

export default async function StudentAssignmentsPage() {
  const context = await requireStudentContext();
  const student = context.student!;

  const assignments = await listAssignmentsForStudent(student.id, student.class);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments & Worksheets"
        description={`Class assignments, worksheets, and study material for Class ${student.class}.`}
      />

      <div className="space-y-3">
        {assignments.length === 0 ? (
          <Card className="border-white/90 bg-white/85 shadow-soft p-8 text-center">
            <BookOpenIcon className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No assignments posted yet</p>
            <p className="mt-1 text-xs text-slate-400">
              When your teacher shares worksheets or assignments, you will see them here.
            </p>
          </Card>
        ) : (
          assignments.map((item) => (
            <Card key={item.id} className="border-white/90 bg-white/85 shadow-soft">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-slate-900">{item.title}</h3>
                  <div className="flex items-center gap-2">
                    {item.subject && (
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {item.subject}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] uppercase text-emerald-600 border-emerald-200">
                      {item.displayStatus}
                    </Badge>
                  </div>
                </div>
                {item.submission?.teacherFeedback && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    Teacher Feedback: {item.submission.teacherFeedback}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  Posted: {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
