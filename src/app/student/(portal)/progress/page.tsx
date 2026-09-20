import { requireStudentContext } from "@/lib/student/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BrainIcon } from "lucide-react";

export const dynamic = "force-dynamic";

interface ConceptMasteryItem {
  id: string;
  concept_id: string;
  mastery_score: number;
}

export default async function StudentProgressPage() {
  const context = await requireStudentContext();
  const student = context.student!;

  const supabase = createSupabaseServerClient();
  const { data: mastery } = await supabase
    .from("concept_mastery")
    .select("*")
    .eq("student_id", student.id);

  const { data: attempts } = await supabase
    .from("attempts")
    .select("*")
    .eq("student_id", student.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const concepts = (mastery as ConceptMasteryItem[] | null) ?? [];
  const attemptList = attempts ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Progress & Mastery"
        description={`Concept breakdown, weak topic detection, and practice mastery for Class ${student.class}.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Concepts Tracked</CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900">{concepts.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Curriculum syllabus topics</CardContent>
        </Card>

        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Practice Attempts</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600">{attemptList.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Quizzes & worksheet drills</CardContent>
        </Card>

        <Card className="border-white/90 bg-white/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Academic Standing</CardDescription>
            <CardTitle className="text-2xl font-bold text-primary">On Track</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Consistently meeting goals</CardContent>
        </Card>
      </div>

      <Card className="border-white/90 bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BrainIcon className="size-4 text-emerald-600" />
            <span>Concept Mastery Matrix</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {concepts.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              Complete more homework and test questions to generate your personalized topic mastery breakdown!
            </p>
          ) : (
            <div className="space-y-3">
              {concepts.map((c) => {
                const score = typeof c.mastery_score === "number" ? Math.round(c.mastery_score * 100) : 0;
                return (
                  <div key={c.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{c.concept_id}</span>
                      <span>{score}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
