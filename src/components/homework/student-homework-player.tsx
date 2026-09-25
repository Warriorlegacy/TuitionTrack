"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
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
import { normalizeQuestionOptions, isOptionMatch } from "@/lib/homework/options";

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
  status?: string;
  gradingStatus?: string;
  isGraded?: boolean;
  score: number;
  totalMarks: number;
  percentage: number;
  submittedAt: string;
  answers: Record<string, string>;
  mistakeBreakdown?: { questionPosition: number; stem: string; studentAnswer: string; correctAnswer: string; category: string; qtype?: string }[];
  aiEvaluationNotes?: string;
  teacherFeedback?: string;
  handwrittenFiles?: string[];
};

function isMathsSubject(subject: unknown): boolean {
  const s = String(subject ?? "").toLowerCase();
  return s === "maths" || s === "math" || s === "mathematics";
}

export function StudentHomeworkPlayer({
  assignment,
  questions,
  submission,
  studentId,
  backUrl = "/app/homework",
  backLabel = "Back to Homework",
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
  backUrl?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(submission?.answers || {});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [handwrittenUrl, setHandwrittenUrl] = useState<string>("");
  const [handwrittenFiles, setHandwrittenFiles] = useState<string[]>(submission?.handwrittenFiles || []);

  const currentQ = questions[currentIndex] || questions[0];
  const mathsRequired = isMathsSubject(assignment.subject);
  const graded = Boolean(submission?.isGraded);

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

  const handleRemoveFile = (idx: number) => {
    if (submission) return;
    setHandwrittenFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    const unanswered = questions.filter((q) => !(answers[q.id] || "").trim());
    if (unanswered.length > 0) {
      toast.error(`Please answer all ${questions.length} questions before submitting (${unanswered.length} remaining).`);
      const firstIdx = questions.findIndex((q) => !(answers[q.id] || "").trim());
      if (firstIdx >= 0) setCurrentIndex(firstIdx);
      return;
    }
    // Mathematics: handwritten notebook upload is mandatory (all classes).
    if (mathsRequired && handwrittenFiles.length === 0) {
      toast.error("Mathematics homework requires a handwritten notebook upload. Please attach at least one photo/PDF page.");
      return;
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
          href={backUrl}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          <span>{backLabel}</span>
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

      {/* Submission state — answer key is study material, never a grade */}
      {submission && !graded && (
        <Card className="border-indigo-200 bg-indigo-50/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
                Submitted — Awaiting Teacher Review
              </span>
              <Badge variant="outline" className="text-xs bg-white">Answer Key Available</Badge>
            </div>
            <CardTitle className="text-xl text-slate-900 mt-1">Submission received.</CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Submitted on {new Date(submission.submittedAt).toLocaleString()} · Final score: Pending Teacher Review.
              Your teacher will review every question and publish the result.
            </CardDescription>
          </CardHeader>
          {submission.teacherFeedback && (
            <CardContent>
              <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 leading-relaxed">
                <strong>Teacher feedback: </strong>{submission.teacherFeedback}
              </p>
            </CardContent>
          )}
        </Card>
      )}
      {submission && graded && (
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/70 shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Result Published · Teacher Graded
              </span>
              <Badge className="bg-emerald-600 text-white text-xs">
                Score: {submission.score} / {submission.totalMarks} ({submission.percentage}%)
              </Badge>
            </div>
            <CardTitle className="text-xl text-slate-900 mt-1">
              {submission.percentage >= 80 ? "🎉 Outstanding Work!" : submission.percentage >= 60 ? "👍 Good Effort!" : "📖 Keep Practising!"}
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Submitted on {new Date(submission.submittedAt).toLocaleString()} · Graded by your teacher.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submission.teacherFeedback && (
              <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 leading-relaxed">
                <strong>Teacher feedback: </strong>{submission.teacherFeedback}
              </p>
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
          {(() => {
            const currentOptions =
              currentQ?.options?.length > 0
                ? currentQ.options
                : normalizeQuestionOptions(currentQ?.options, currentQ?.qtype, currentQ?.stem, currentQ?.correctAnswer);
            if (currentOptions.length > 0) {
              return (
                <div className="space-y-2.5">
                  {currentOptions.map((opt) => {
                    const isSelected =
                      answers[currentQ.id] === opt.label || isOptionMatch(answers[currentQ.id], opt);
                    const isCorrect =
                      submission &&
                      (opt.isCorrect === true || isOptionMatch(currentQ.correctAnswer, opt));
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
              );
            }
            return (
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
            );
          })()}

          {/* Answer key (post-submission study material — not a grade) */}
          {submission && currentQ?.solutionSteps?.length && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <span className="font-bold text-slate-900">Answer Key — Step-by-Step Solution:</span>
              {currentQ.correctAnswer && (
                <p className="text-slate-700">Correct answer: <span className="font-semibold text-emerald-700">{currentQ.correctAnswer}</span></p>
              )}
              <div className="space-y-1 text-slate-600">
                {currentQ.solutionSteps.map((s, sIdx) => (
                  <p key={sIdx}>{s}</p>
                ))}
              </div>
              {!graded && (
                <p className="text-[11px] text-indigo-700 pt-1">Final score: Pending Teacher Review.</p>
              )}
            </div>
          )}

          {/* Handwritten Notebook Attachment */}
          <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <CameraIcon className="size-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">
                Handwritten Notebook / Photo Upload {mathsRequired ? "(Required for Maths)" : "(Optional)"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {mathsRequired
                ? "Mathematics homework cannot be submitted without your handwritten notebook pages (photos/PDF links). Your teacher will review the written work manually."
                : "If you solved this in your notebook, attach photo/document links here for your teacher to review."}
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
                  <div key={fIdx} className="flex items-center gap-2 text-xs text-indigo-700 bg-white p-2 rounded-lg border border-slate-200">
                    <span className="truncate flex-1">📎 Page {fIdx + 1}: {file}</span>
                    {!submission && (
                      <button type="button" onClick={() => handleRemoveFile(fIdx)} className="text-rose-600 font-semibold shrink-0">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {mathsRequired && !submission && handwrittenFiles.length === 0 && (
              <p className="text-[11px] text-rose-600 font-medium">At least one notebook page is required to submit.</p>
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
