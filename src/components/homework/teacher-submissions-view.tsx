"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircle2Icon, ClockIcon, AlertTriangleIcon, ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type TeacherSubmission = {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  status: string;
  score: number;
  totalMarks: number;
  percentage: number;
  submittedAt: string;
  isLate: boolean;
  answers: Record<string, string>;
  mistakeBreakdown: { questionPosition: number; stem: string; studentAnswer: string; correctAnswer: string; category: string; qtype?: string }[];
  aiEvaluationNotes?: string;
  teacherFeedback?: string;
  handwrittenFiles: string[];
};

export type TeacherQuestion = {
  id: string;
  position: number;
  stem: string;
  qtype: string;
  marks: number;
  correctAnswer: string;
  studentId: string | null;
};

function statusOf(s: TeacherSubmission): string {
  if (s.isLate) return "late";
  return s.status || "submitted";
}

export function TeacherSubmissionsView({
  assignment,
  questions,
  submissions,
  assignedStudents,
  focusStudentId,
}: {
  assignment: { id: string; title: string; classLevel: number; subject: string; chapterSlug: string; dueDate: string; totalMarks: number };
  questions: TeacherQuestion[];
  submissions: TeacherSubmission[];
  assignedStudents: { id: string; name: string; class: string }[];
  focusStudentId?: string;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(focusStudentId ?? null);

  const submittedIds = useMemo(() => new Set(submissions.map((s) => s.studentId)), [submissions]);
  const missing = useMemo(
    () => assignedStudents.filter((s) => !submittedIds.has(s.id)),
    [assignedStudents, submittedIds]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return submissions.filter((s) => {
      if (q && !s.studentName.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && statusOf(s) !== statusFilter) return false;
      return true;
    });
  }, [submissions, query, statusFilter]);

  const questionById = useMemo(() => new Map(questions.map((qt) => [qt.id, qt])), [questions]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <Link href="/app/homework" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeftIcon className="size-3.5" />
          <span>Back to Homework</span>
        </Link>
        <div className="flex items-center gap-2">
          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
            Class {assignment.classLevel} · {assignment.subject}
          </Badge>
          <Badge variant="outline" className="text-xs text-slate-500">
            Due {new Date(assignment.dueDate).toLocaleDateString()}
          </Badge>
        </div>
      </div>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{assignment.title}</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {submissions.length} submitted · {missing.length} missing · {questions.filter((qt) => !qt.studentId).length} base questions
        </p>
      </div>

      {/* Filters */}
      <Card className="border-white/90 bg-white/95 shadow-soft">
        <CardContent className="pt-5 flex flex-wrap gap-3">
          <Input
            placeholder="Filter by student name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-xs h-9 max-w-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 bg-white px-3 h-9 font-medium text-slate-900 shadow-sm"
          >
            <option value="all">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="ai_evaluated">AI evaluated</option>
            <option value="graded">Graded</option>
            <option value="late">Late</option>
          </select>
        </CardContent>
      </Card>

      {/* Submissions list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-xs text-slate-500">
              No submissions match these filters yet.
            </CardContent>
          </Card>
        )}
        {filtered.map((s) => {
          const open = openId === s.id;
          const status = statusOf(s);
          return (
            <Card key={s.id} className="border-white/90 bg-white/95 shadow-soft overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : s.id)}
                className="w-full text-left"
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                        {s.studentName.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="text-sm text-slate-900 truncate">{s.studentName}</CardTitle>
                        <CardDescription className="text-[11px]">
                          Submitted {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "—"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={status === "late" ? "destructive" : "secondary"} className="text-[10px] uppercase">
                        {status === "late" ? (
                          <span className="flex items-center gap-1"><ClockIcon className="size-3" /> Late</span>
                        ) : status.replace(/_/g, " ")}
                      </Badge>
                      <Badge className="bg-emerald-600 text-white text-[11px]">
                        {s.score}/{s.totalMarks} ({s.percentage}%)
                      </Badge>
                      <ChevronDownIcon className={`size-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </CardHeader>
              </button>
              {open && (
                <CardContent className="space-y-4 border-t border-slate-100 pt-4">
                  {s.aiEvaluationNotes && (
                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/80 leading-relaxed">
                      <strong>AI evaluation: </strong>{s.aiEvaluationNotes}
                    </p>
                  )}
                  {s.teacherFeedback && (
                    <p className="text-xs text-slate-700 bg-amber-50 p-3 rounded-xl border border-amber-200 leading-relaxed">
                      <strong>Teacher feedback: </strong>{s.teacherFeedback}
                    </p>
                  )}
                  {s.handwrittenFiles.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold text-slate-700">Handwritten attachments ({s.handwrittenFiles.length})</p>
                      {s.handwrittenFiles.map((f, i) => (
                        <p key={i} className="text-[11px] text-indigo-700 bg-white p-2 rounded-lg border border-slate-200 truncate">📎 {f}</p>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-700">Answers ({Object.keys(s.answers).length} of {questions.length} questions)</p>
                    {Object.entries(s.answers).map(([qid, ans]) => {
                      const qt = questionById.get(qid);
                      return (
                        <div key={qid} className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                          <p className="font-semibold text-slate-900">
                            {qt ? `Q${qt.position}. ${qt.stem}` : `Question ${qid.slice(0, 8)}`}
                            {qt && <span className="ml-2 font-normal text-slate-400">({qt.marks} {qt.marks === 1 ? "mark" : "marks"})</span>}
                          </p>
                          <p className="text-slate-600">Answer: <span className="font-medium text-slate-900">{ans || "—"}</span></p>
                          {qt && <p className="text-slate-500">Key: <span className="text-emerald-700 font-medium">{qt.correctAnswer}</span></p>}
                        </div>
                      );
                    })}
                    {Object.keys(s.answers).length === 0 && (
                      <p className="text-[11px] text-slate-500">No typed answers — see attachments above.</p>
                    )}
                  </div>
                  {s.mistakeBreakdown.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-bold text-rose-900 flex items-center gap-1.5">
                        <AlertTriangleIcon className="size-3.5 text-rose-600" />
                        Missed ({s.mistakeBreakdown.length})
                      </h4>
                      {s.mistakeBreakdown.map((m, i) => (
                        <div key={i} className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-xs space-y-1">
                          <p className="font-semibold text-slate-900">Q{m.questionPosition}. {m.stem}</p>
                          <p className="text-slate-600">Student: <span className="text-rose-700 font-semibold">{m.studentAnswer}</span></p>
                          <p className="text-slate-600">Key: <span className="text-emerald-700 font-semibold">{m.correctAnswer}</span></p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Missing submissions */}
      {missing.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-900 flex items-center gap-1.5">
              <AlertTriangleIcon className="size-4 text-amber-600" />
              Missing ({missing.length})
            </CardTitle>
            <CardDescription className="text-[11px]">Assigned students with no submission yet.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {missing.map((s) => (
              <Badge key={s.id} variant="outline" className="text-[11px] bg-white">
                {s.name} · {s.class ? `Class ${s.class}` : ""}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Question bank */}
      <Card className="border-white/90 bg-white/95 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <CheckCircle2Icon className="size-4 text-indigo-600" />
            Question bank ({questions.length})
          </CardTitle>
          <CardDescription className="text-[11px]">Base + student-specific variants with verified keys.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {questions.slice(0, 50).map((qt) => (
            <div key={qt.id} className="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-1">
              <p className="font-semibold text-slate-900">
                Q{qt.position}. {qt.stem}
                {qt.studentId && <span className="ml-2 font-normal text-indigo-500">(variant)</span>}
              </p>
              <p className="text-slate-500">Key: <span className="text-emerald-700 font-medium">{qt.correctAnswer}</span> · {qt.marks} {qt.marks === 1 ? "mark" : "marks"}</p>
            </div>
          ))}
          {questions.length > 50 && (
            <p className="text-[11px] text-slate-500">Showing 50 of {questions.length} questions.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
