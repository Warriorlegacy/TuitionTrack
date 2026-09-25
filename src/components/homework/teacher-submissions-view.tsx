"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, CheckCircle2Icon, ClockIcon, AlertTriangleIcon, ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveQuestionReviewAction, finalizeSubmissionGradeAction } from "@/actions/homework-actions";

export type TeacherSubmission = {
  id: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  status: string;
  gradingStatus?: string;
  score: number;
  totalMarks: number;
  percentage: number;
  submittedAt: string;
  gradedAt?: string | null;
  isLate: boolean;
  answers: Record<string, string>;
  mistakeBreakdown: { questionPosition: number; stem: string; studentAnswer: string; correctAnswer: string; category: string; qtype?: string }[];
  aiEvaluationNotes?: string;
  teacherFeedback?: string;
  handwrittenFiles: string[];
  teacherMarks?: Record<string, number>;
  questionFeedback?: Record<string, string>;
  reviewedQuestions?: string[];
};

import {
  type QuestionOption,
  normalizeQuestionOptions,
  cleanAnswerToken,
  isOptionMatch,
} from "@/lib/homework/options";

export type { QuestionOption };

export type TeacherQuestion = {
  id: string;
  position: number;
  stem: string;
  qtype: string;
  marks: number;
  options?: QuestionOption[];
  correctAnswer: string;
  solutionSteps?: string[];
  studentId: string | null;
};

function displayStatus(s: TeacherSubmission): string {
  if (s.status === "graded" || s.status === "returned" || s.status === "teacher_reviewed") return "graded";
  if (s.isLate) return "late";
  if (s.gradingStatus === "in_review") return "in review";
  return "submitted — awaiting review";
}

function statusOf(s: TeacherSubmission): string {
  if (s.isLate) return "late";
  if (s.status === "graded" || s.status === "returned" || s.status === "teacher_reviewed") return "graded";
  return "submitted";
}

function paperFor(questions: TeacherQuestion[], submission: TeacherSubmission): TeacherQuestion[] {
  const answerKeys = Object.keys(submission.answers || {});
  if (answerKeys.length > 0) {
    const answeredQs = questions.filter((q) => answerKeys.includes(q.id));
    if (answeredQs.length > 0) {
      const specific = questions.filter((q) => q.studentId === submission.studentId);
      const pool = specific.length > 0 ? specific : questions.filter((q) => !q.studentId);
      const combined = new Map<string, TeacherQuestion>();
      pool.forEach((q) => combined.set(q.id, q));
      answeredQs.forEach((q) => combined.set(q.id, q));
      return Array.from(combined.values()).sort((a, b) => a.position - b.position);
    }
  }

  const specific = questions.filter((q) => q.studentId === submission.studentId);
  const paper = specific.length > 0 ? specific : questions.filter((q) => !q.studentId);
  return [...paper].sort((a, b) => a.position - b.position);
}

function ReviewRow({
  submission,
  question,
}: {
  submission: TeacherSubmission;
  question: TeacherQuestion;
}) {
  const finalized = submission.status === "graded" || submission.status === "returned";
  const [pending, startTransition] = useTransition();
  const [marks, setMarks] = useState<string>(
    submission.teacherMarks?.[question.id] !== undefined ? String(submission.teacherMarks[question.id]) : "",
  );
  const [feedback, setFeedback] = useState<string>(submission.questionFeedback?.[question.id] ?? "");
  const reviewed = (submission.reviewedQuestions ?? []).includes(question.id);
  const rawAnswer = submission.answers[question.id] ?? "";
  const answer = rawAnswer.trim();

  // Normalize options defensively with fallback to stem/qtype/correctAnswer
  const options = useMemo(() => {
    if (question.options && question.options.length > 0) {
      return question.options;
    }
    return normalizeQuestionOptions(question.options, question.qtype, question.stem, question.correctAnswer);
  }, [question]);

  const cleanAnswer = cleanAnswerToken(answer);
  const cleanKey = cleanAnswerToken(question.correctAnswer);

  const studentOpt = options.find((opt) => isOptionMatch(answer, opt));
  const correctOpt = options.find(
    (opt) => opt.isCorrect === true || isOptionMatch(question.correctAnswer, opt)
  );

  const isStudentChoiceCorrect = Boolean(
    (studentOpt && correctOpt && studentOpt.label.toLowerCase() === correctOpt.label.toLowerCase()) ||
    (cleanAnswer.length > 0 && cleanKey.length > 0 && cleanAnswer === cleanKey)
  );

  const handleSave = (customMarks?: number) => {
    const val = customMarks !== undefined ? customMarks : Number(marks);
    if (!Number.isFinite(val) || val < 0 || val > question.marks) {
      toast.error(`Marks must be between 0 and ${question.marks}.`);
      return;
    }
    startTransition(async () => {
      const res = await saveQuestionReviewAction({
        submissionId: submission.id,
        questionId: question.id,
        marksAwarded: val,
        feedback,
      });
      if (!res.success) toast.error(res.message);
      else {
        setMarks(String(val));
        toast.success(`Q${question.position} reviewed: ${val}/${question.marks}.`);
      }
    });
  };

  return (
    <div className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${reviewed ? "bg-emerald-50/60 border-emerald-200" : "bg-white border-slate-200"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-slate-900 leading-snug">
          Q{question.position}. {question.stem}
          <span className="ml-2 font-normal text-slate-400">({question.marks} {question.marks === 1 ? "mark" : "marks"})</span>
        </p>
        <Badge variant={reviewed ? "outline" : "secondary"} className={`text-[10px] shrink-0 ${reviewed ? "border-emerald-300 text-emerald-800 bg-emerald-50" : ""}`}>
          {reviewed ? "Reviewed" : "Not reviewed"}
        </Badge>
      </div>

      {/* MCQ options display */}
      {options.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
            <span>Multiple Choice Options:</span>
            {isStudentChoiceCorrect ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                <CheckCircle2Icon className="size-3.5" /> Correct Answer Selected
              </span>
            ) : studentOpt ? (
              <span className="text-amber-700 font-semibold flex items-center gap-1 text-[11px]">
                <AlertTriangleIcon className="size-3.5" /> Incorrect Option Selected
              </span>
            ) : null}
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            {options.map((opt) => {
              const isSelected =
                isOptionMatch(answer, opt) ||
                (studentOpt !== undefined && studentOpt.label.toUpperCase() === opt.label.toUpperCase());
              const isKey =
                opt.isCorrect === true ||
                isOptionMatch(question.correctAnswer, opt) ||
                (correctOpt !== undefined && correctOpt.label.toUpperCase() === opt.label.toUpperCase());

              let cardStyle = "bg-slate-50/60 border-slate-200 text-slate-700";
              let badgeStyle = "bg-slate-200 text-slate-700 border-slate-300";

              if (isSelected && isKey) {
                cardStyle = "bg-emerald-50 border-emerald-400 text-emerald-950 font-medium shadow-sm ring-1 ring-emerald-400";
                badgeStyle = "bg-emerald-600 text-white border-emerald-600";
              } else if (isKey) {
                cardStyle = "bg-emerald-50/70 border-emerald-300 text-emerald-900 font-medium";
                badgeStyle = "bg-emerald-600 text-white border-emerald-600";
              } else if (isSelected) {
                cardStyle = "bg-amber-50/90 border-amber-300 text-amber-950 font-medium shadow-sm ring-1 ring-amber-400";
                badgeStyle = "bg-amber-600 text-white border-amber-600";
              }

              return (
                <div
                  key={opt.label}
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${cardStyle}`}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-lg font-bold text-xs border ${badgeStyle}`}
                  >
                    {opt.label}
                  </span>
                  <span className="flex-1 leading-snug break-words">{opt.text}</span>
                  {isSelected && isKey && (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] shrink-0 gap-1 h-5 px-1.5 font-semibold">
                      <CheckCircle2Icon className="size-3" /> Correct Choice
                    </Badge>
                  )}
                  {!isSelected && isKey && (
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px] shrink-0 gap-1 h-5 px-1.5 font-semibold">
                      <CheckCircle2Icon className="size-3" /> Key
                    </Badge>
                  )}
                  {isSelected && !isKey && (
                    <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-100 text-[10px] shrink-0 h-5 px-1.5 font-semibold">
                      Student Choice
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {options.length === 0 && (question.qtype === "mcq" || question.qtype === "assertion_reason") && (
        <div className="p-2.5 rounded-lg border border-dashed border-amber-200 bg-amber-50/60 text-[11px] text-amber-800 flex items-center justify-between">
          <span>MCQ options were not recorded in the question bank for this question.</span>
          <span className="font-semibold">Review student answer against key below.</span>
        </div>
      )}

      {/* Answer summary */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-slate-600 pt-0.5">
        <p>
          Student answer:{" "}
          <span className={`font-semibold ${
            studentOpt
              ? isStudentChoiceCorrect
                ? "text-emerald-700"
                : "text-amber-700"
              : "text-slate-900"
          }`}>
            {studentOpt ? `${studentOpt.label}. ${studentOpt.text}` : answer || "—"}
          </span>
        </p>
        <p>
          Answer key:{" "}
          <span className="text-emerald-700 font-semibold">
            {correctOpt ? `${correctOpt.label}. ${correctOpt.text}` : question.correctAnswer}
          </span>
        </p>
      </div>

      {question.solutionSteps && question.solutionSteps.length > 0 && (
        <div className="text-slate-500 space-y-0.5 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
          <p className="font-semibold text-slate-700 text-[11px] mb-0.5">Step-by-step solution:</p>
          {question.solutionSteps.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2 pt-1">
        <label className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Marks awarded (max {question.marks})</span>
            {!finalized && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMarks("0")}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setMarks(String(question.marks))}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium border border-emerald-200"
                >
                  Full ({question.marks})
                </button>
              </div>
            )}
          </div>
          <Input
            type="number"
            min={0}
            max={question.marks}
            step="0.5"
            value={marks}
            disabled={finalized}
            onChange={(e) => setMarks(e.target.value)}
            className="text-xs h-9"
            placeholder={`0 – ${question.marks}`}
          />
        </label>
        <label className="space-y-1">
          <span className="font-semibold text-slate-700">Teacher feedback</span>
          <Textarea
            value={feedback}
            disabled={finalized}
            onChange={(e) => setFeedback(e.target.value)}
            className="text-xs min-h-[36px]"
            placeholder="Feedback for this question…"
          />
        </label>
      </div>

      {!finalized && (
        <div className="flex items-center gap-2 pt-0.5">
          <Button size="sm" onClick={() => handleSave()} disabled={pending} className="text-xs h-8">
            {pending ? "Saving…" : reviewed ? "Update review" : "Save review"}
          </Button>
          {!reviewed && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => handleSave(isStudentChoiceCorrect ? question.marks : 0)}
              className="text-xs h-8 text-slate-700"
            >
              Quick Save ({isStudentChoiceCorrect ? `${question.marks}/${question.marks}` : `0/${question.marks}`})
            </Button>
          )}
        </div>
      )}

      {finalized && submission.teacherMarks?.[question.id] !== undefined && (
        <p className="font-semibold text-emerald-700">
          Awarded: {submission.teacherMarks[question.id]}/{question.marks}
        </p>
      )}
    </div>
  );
}

function SubmissionCard({
  s,
  questions,
  onFinalized,
}: {
  s: TeacherSubmission;
  questions: TeacherQuestion[];
  onFinalized: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [finalizing, startFinalize] = useTransition();
  const paper = useMemo(() => paperFor(questions, s), [questions, s]);
  const reviewedSet = useMemo(() => new Set(s.reviewedQuestions ?? []), [s.reviewedQuestions]);
  const reviewedCount = paper.filter((q) => reviewedSet.has(q.id)).length;
  const allReviewed = paper.length > 0 && reviewedCount === paper.length;
  const finalized = s.status === "graded" || s.status === "returned";
  const status = displayStatus(s);

  const handleFinalize = () => {
    if (!allReviewed) {
      toast.error(`${paper.length - reviewedCount} question(s) still require review.`);
      return;
    }
    if (!confirm(`Finalize grade for ${s.studentName}? Total is computed from your per-question marks only.`)) return;
    startFinalize(async () => {
      const res = await finalizeSubmissionGradeAction(s.id);
      if (!res.success) toast.error(res.message);
      else {
        toast.success(res.message);
        onFinalized();
        router.refresh();
      }
    });
  };

  return (
    <Card className="border-white/90 bg-white/95 shadow-soft overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left">
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
                ) : status}
              </Badge>
              {finalized ? (
                <Badge className="bg-emerald-600 text-white text-[11px]">
                  {s.score}/{s.totalMarks} ({s.percentage}%)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px]">
                  {reviewedCount}/{paper.length} reviewed
                </Badge>
              )}
              <ChevronDownIcon className={`size-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </div>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="space-y-4 border-t border-slate-100 pt-4">
          {s.handwrittenFiles.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-slate-700">Handwritten notebook pages ({s.handwrittenFiles.length}) — review manually</p>
              {s.handwrittenFiles.map((f, i) => (
                <p key={i} className="text-[11px] text-indigo-700 bg-white p-2 rounded-lg border border-slate-200 truncate">📎 Page {i + 1}: {f}</p>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-700">
              Question-by-question review ({reviewedCount} / {paper.length} reviewed)
            </p>
            {!allReviewed && !finalized && (
              <p className="text-[11px] text-amber-700">
                {paper.length - reviewedCount} question(s) still require review — Finalize stays disabled until {paper.length}/{paper.length}.
              </p>
            )}
            {paper.map((q) => (
              <ReviewRow key={q.id} submission={s} question={q} />
            ))}
          </div>
          {!finalized && (
            <Button
              onClick={handleFinalize}
              disabled={!allReviewed || finalizing}
              className="w-full text-xs h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {finalizing ? "Finalizing…" : allReviewed ? "Finalize Grade (publish result)" : `Finalize Grade (${reviewedCount}/${paper.length} reviewed)`}
            </Button>
          )}
          {finalized && (
            <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2Icon className="size-3.5" /> Teacher graded · Result published.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
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
  const [, setTick] = useState(0);

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
      if (focusStudentId && s.studentId !== focusStudentId && q === "") return true;
      return true;
    });
  }, [submissions, query, statusFilter, focusStudentId]);

  const gradedCount = submissions.filter((s) => s.status === "graded" || s.status === "returned").length;

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
            Due {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "—"}
          </Badge>
        </div>
      </div>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{assignment.title}</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {submissions.length} submitted · {gradedCount} graded · {missing.length} missing · {questions.filter((qt) => !qt.studentId).length} base questions
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
            <option value="submitted">Submitted — awaiting review</option>
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
        {filtered.map((s) => (
          <SubmissionCard key={s.id} s={s} questions={questions} onFinalized={() => setTick((t) => t + 1)} />
        ))}
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
          {questions.slice(0, 50).map((qt) => {
            const qtOptions =
              qt.options && qt.options.length > 0
                ? qt.options
                : normalizeQuestionOptions(qt.options, qt.qtype, qt.stem, qt.correctAnswer);
            return (
              <div key={qt.id} className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900 leading-snug">
                    Q{qt.position}. {qt.stem}
                    {qt.studentId && <span className="ml-2 font-normal text-indigo-500">(variant)</span>}
                  </p>
                  <span className="text-slate-400 font-medium shrink-0">
                    {qt.marks} {qt.marks === 1 ? "mark" : "marks"}
                  </span>
                </div>
                {qtOptions.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-1.5 py-1">
                    {qtOptions.map((opt) => {
                      const isKey =
                        opt.isCorrect === true ||
                        isOptionMatch(qt.correctAnswer, opt);
                      return (
                        <div
                          key={opt.label}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-2 ${
                            isKey
                              ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 font-medium"
                              : "bg-slate-50 border-slate-200 text-slate-700"
                          }`}
                        >
                          <span
                            className={`size-5 rounded flex items-center justify-center font-bold text-[10px] ${
                              isKey ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {opt.label}
                          </span>
                          <span className="flex-1 truncate">{opt.text}</span>
                          {isKey && (
                            <span className="text-[10px] text-emerald-700 font-bold shrink-0">Key</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-slate-500">
                  Key: <span className="text-emerald-700 font-medium">{qt.correctAnswer}</span>
                </p>
                {qt.solutionSteps && qt.solutionSteps.length > 0 && (
                  <div className="text-slate-500 space-y-0.5 pt-1 border-t border-slate-100 text-[11px]">
                    {qt.solutionSteps.map((s, i) => (
                      <p key={i}>{s}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {questions.length > 50 && (
            <p className="text-[11px] text-slate-500">Showing 50 of {questions.length} questions.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
