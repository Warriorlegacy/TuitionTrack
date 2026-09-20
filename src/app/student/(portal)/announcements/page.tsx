import { requireStudentContext } from "@/lib/student/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { MegaphoneIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentAnnouncementsPage() {
  const context = await requireStudentContext();
  const student = context.student!;

  const supabase = createSupabaseServerClient();
  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  const list = announcements ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Class Announcements"
        description={`Important notices, timetable updates, and holiday messages for Class ${student.class}.`}
      />

      <div className="space-y-3">
        {list.length === 0 ? (
          <Card className="border-white/90 bg-white/85 shadow-soft p-8 text-center">
            <MegaphoneIcon className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No announcements right now</p>
            <p className="mt-1 text-xs text-slate-400">
              When your teacher posts an update or notice, it will be displayed here.
            </p>
          </Card>
        ) : (
          list.map((a) => (
            <Card key={a.id} className="border-white/90 bg-white/85 shadow-soft">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-slate-900">{a.title}</h3>
                  <span className="text-[11px] text-slate-400">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{a.message}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
