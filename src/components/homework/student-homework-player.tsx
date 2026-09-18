"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  CameraIcon,
  FlagIcon,
  SendIcon,
} from "lucide-react";
import { submitAssignmentAction } from "@/actions/homework-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type QuestionData = {
  id: string;
  position: number;
  stem: string;
  qtype: string;
  marks: number;
  options: { label: string; text: string; isCorrect?: boolean }[];
  correctAnswer?: string;
  solutionSteps?: string[];
};

export type SubmissionData = {
  id: string;
  score: number;
  totalMarks: number;
  percentage: number;
  submittedAt: string;
  answers: Record<string, string>;
  mistakeBreakdown?: { questionPosition: number; stem: string; studentAnswer: string; correctAnswer: string; category: string }[];
  aiEvaluationNotes?: string;
  teacherFeedback?: string;
  handwrittenFiles?: string[];
};

export function StudentHomeworkPlayer({
  assignment,
  questions,
  submission,
  studentId,
}: {
  assignment: {
    id: string;
    title: string;
    description: string;
    classLevel: number;
    subject: string;
    chapterSlug: string;
    dueDate: string;
    totalMarks: number;
    submissionMode: string;
  };
  questions: QuestionData[];
  submission: SubmissionData | null;
  studentId: string;
  isTeacher?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(submission?.answers || {});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [handwrittenUrl, setHandwrittenUrl] = useState<string>("");
  const [handwrittenFiles, setHandwrittenFiles] = useState<string[]>(submission?.handwrittenFiles || []);

  const currentQ = questions[currentIndex] || questions[0];

  const handleSelectOption = (qId: string, label: string) => {
    if (submission) return; // read only after submission
    setAnswers((prev) => ({ ...prev, [qId]: label }));
  };

  const handleTextAnswer = (qId: string, val: string) => {
    if (submission) return;
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const toggleFlag = (idx: number) => {
    setFlagged((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleAddFile = () => {
    if (!handwrittenUrl.trim()) return;
    setHandwrittenFiles((prev) => [...prev, handwrittenUrl.trim()]);
    setHandwrittenUrl("");
    toast.success("Attachment added!");
  };

  const handleSubmit = () => {
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length && handwrittenFiles.length === 0) {
      if (!confirm(`You have answered ${answeredCount} of ${questions.length} questions. Are you sure you want to submit now?`)) {
        return;
      }
    }

    startTransition(async () => {
      const res = await submitAssignmentAction({
        assignmentId: assignment.id,
        studentId,
        answers,
        handwrittenFiles,
      });

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      router.refresh();
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <Link
          href="/app/homework"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
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

      {/* If Already Submitted: Detailed Score & Remedial Card */}
      {submission && (
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/70 shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Submission Result · Graded with AI
              </span>
              <Badge className="bg-emerald-600 text-white text-xs">
                Score: {submission.score} / {submission.totalMarks} ({submission.percentage}%)
              </Badge>
            </div>
            <CardTitle className="text-xl text-slate-900 mt-1">
              {submission.percentage >= 80 ? "🎉 Outstanding Work!" : submission.percentage >= 60 ? "👍 Good Effort!" : "📖 Concept Practice Recommended"}
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Submitted on {new Date(submission.submittedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submission.aiEvaluationNotes && (
              <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 leading-relaxed">
                <strong>Feedback: </strong>{submission.aiEvaluationNotes}
              </p>
            )}

            {submission.mistakeBreakdown && submission.mistakeBreakdown.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangleIcon className="size-3.5 text-rose-600" />
                  Areas to Review ({submission.mistakeBreakdown.length} questions missed):
                </h4>
                <div className="space-y-2">
                  {submission.mistakeBreakdown.map((m, mIdx) => (
                    <div key={mIdx} className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-xs space-y-1">
                      <p className="font-semibold text-slate-900">Q{m.questionPosition}. {m.stem}</p>
                      <p className="text-slate-600">Your Answer: <span className="text-rose-700 font-semibold">{m.studentAnswer}</span></p>
                      <p className="text-slate-600">Correct Answer: <span className="text-emerald-700 font-semibold">{m.correctAnswer}</span></p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Question Player */}
      <Card className="border-white/90 bg-white/95 shadow-soft">
        <CardHeader className="pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xs">
                {currentIndex + 1}
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <Badge variant="secondary" className="text-[10px] uppercase">
                {currentQ?.qtype}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                {currentQ?.marks} {currentQ?.marks === 1 ? "Mark" : "Marks"}
              </span>
              {!submission && (
                <button
                  type="button"
                  onClick={() => toggleFlag(currentIndex)}
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                    flagged[currentIndex]
                      ? "bg-amber-100 border-amber-300 text-amber-800"
                      : "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600"
                  }`}
                  title="Flag for review"
                >
                  <FlagIcon className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-950 mt-3 leading-relaxed">
            {currentQ?.stem}
          </h2>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Options for MCQ */}
          {currentQ?.options?.length > 0 ? (
            <div className="space-y-2.5">
              {currentQ.options.map((opt) => {
                const isSelected = answers[currentQ.id] === opt.label;
                const isCorrect = submission && opt.isCorrect;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={Boolean(submission)}
                    onClick={() => handleSelectOption(currentQ.id, opt.label)}
                    className={`w-full p-4 rounded-xl border text-left text-xs sm:text-sm transition-all flex items-center gap-3 ${
                      isCorrect
                        ? "bg-emerald-50 border-emerald-400 text-emerald-950 font-semibold"
                        : isSelected
                        ? "bg-indigo-50 border-indigo-500 text-indigo-950 font-semibold shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-lg font-bold text-xs ${
                        isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="flex-1 leading-relaxed">{opt.text}</span>
                    {isSelected && <CheckCircle2Icon className="size-4 text-indigo-600 ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Numeric / Text input */
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Your Answer / Calculation</Label>
              <Textarea
                placeholder="Type your final answer or solution steps here..."
                disabled={Boolean(submission)}
                value={answers[currentQ?.id] || ""}
                onChange={(e) => handleTextAnswer(currentQ.id, e.target.value)}
                className="text-xs sm:text-sm min-h-[100px]"
              />
            </div>
          )}

          {/* Solution Display (Post-submission) */}
          {submission && currentQ?.solutionSteps?.length && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <span className="font-bold text-slate-900">Step-by-Step Solution:</span>
              <div className="space-y-1 text-slate-600">
                {currentQ.solutionSteps.map((s, sIdx) => (
                  <p key={sIdx}>{s}</p>
                ))}
              </div>
            </div>
          )}

          {/* Handwritten Notebook Attachment Option */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <CameraIcon className="size-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">
                Handwritten Notebook / Photo Upload (Optional)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              If you solved this question in your notebook, paste the photo/document link or upload image URL here. AI will extract and evaluate your handwriting.
            </p>

            {!submission && (
              <div className="flex gap-2">
                <Input
                  placeholder="Paste notebook image or Google Drive/PDF link..."
                  value={handwrittenUrl}
                  onChange={(e) => setHandwrittenUrl(e.target.value)}
                  className="text-xs h-9"
                />
                <Button size="sm" type="button" onClick={handleAddFile} className="text-xs h-9 shrink-0">
                  Attach
                </Button>
              </div>
            )}

            {handwrittenFiles.length > 0 && (
              <div className="space-y-1 pt-1">
                {handwrittenFiles.map((file, fIdx) => (
                  <div key={fIdx} className="text-xs text-indigo-700 bg-white p-2 rounded-lg border border-slate-200 truncate">
                    📎 Attachment {fIdx + 1}: {file}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Question Navigation Matrix */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {questions.map((q, idx) => {
                const isAnswered = Boolean(answers[q.id]);
                const isFlagged = flagged[idx];
                const isCurrent = currentIndex === idx;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`size-8 rounded-lg text-xs font-bold transition-all ${
                      isCurrent
                        ? "ring-2 ring-indigo-600 ring-offset-2 bg-indigo-600 text-white"
                        : isFlagged
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : isAnswered
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(currentIndex - 1)}
                className="text-xs h-9 gap-1"
              >
                <ArrowLeftIcon className="size-3.5" />
                <span>Prev</span>
              </Button>

              {currentIndex < questions.length - 1 ? (
                <Button
                  size="sm"
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                  className="text-xs h-9 gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <span>Next</span>
                  <ArrowRightIcon className="size-3.5" />
                </Button>
              ) : !submission ? (
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={handleSubmit}
                  className="text-xs h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
                >
                  <SendIcon className="size-3.5" />
                  <span>{isPending ? "Submitting..." : "Submit Homework"}</span>
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
