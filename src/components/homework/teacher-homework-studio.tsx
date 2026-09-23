"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  SparklesIcon,
  ArrowLeftIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  SlidersIcon,
  SendIcon,
  FileTextIcon,
  RefreshCwIcon,
} from "lucide-react";
import type { StudentRow } from "@/lib/db/types";
import {
  OFFICIAL_CHAPTERS,
  getOfficialSubjectsForClass,
} from "@/lib/curriculum/official-registry";
import type { GeneratedQuestion, HomeworkMode } from "@/lib/homework/variation-engine";
import { publishAssignmentAction } from "@/actions/homework-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TeacherHomeworkStudio({ students }: { students: StudentRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Selection states
  const [selectedClass, setSelectedClass] = useState<number>(8);
  const subjects = useMemo(() => getOfficialSubjectsForClass(selectedClass), [selectedClass]);
  const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0] || "Maths");
  // ponytail: selectedSubject/selectedChapterSlug go stale when the class
  // changes — derive effective values so payload, chapters, and UI agree.
  const effectiveSubject = subjects.includes(selectedSubject) ? selectedSubject : subjects[0] || "Maths";

  // Filter chapters by selected class and subject
  const availableChapters = useMemo(() => {
    return OFFICIAL_CHAPTERS.filter(
      (c) => c.classLevel === selectedClass && c.subject.toLowerCase() === effectiveSubject.toLowerCase()
    );
  }, [selectedClass, effectiveSubject]);

  const [selectedChapterSlug, setSelectedChapterSlug] = useState<string>(
    availableChapters[0]?.slug || "c8-maths-01"
  );

  const currentChapter = useMemo(
    () => availableChapters.find((c) => c.slug === selectedChapterSlug) || availableChapters[0],
    [availableChapters, selectedChapterSlug]
  );

  // Configuration states
  const [preset, setPreset] = useState<string>("chapter");
  const [mode, setMode] = useState<HomeworkMode>("variant");
  const [questionFormat, setQuestionFormat] = useState<"mixed" | "mcq">("mixed");
  const [submissionMode, setSubmissionMode] = useState<"online" | "handwritten" | "mixed">("mixed");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const difficulty = 3;
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );

  // Filter students by selected class
  const classStudents = useMemo(() => {
    return students.filter((s) => s.class === String(selectedClass));
  }, [students, selectedClass]);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Generated assignment state
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [studentVariants, setStudentVariants] = useState<Record<string, GeneratedQuestion[]> | undefined>(undefined);
  const [assignmentTitle, setAssignmentTitle] = useState<string>("");
  // REAL serving provider/model reported by the generate API — never hardcoded.
  const [genMeta, setGenMeta] = useState<{
    providerLabel: string;
    model: string;
    generatedAt?: string;
    fallbackUsed?: boolean;
    fallbackTrail?: string[];
    validation?: { checked: number; rejected: number; attempts: number };
  } | null>(null);

  const handleGenerate = async () => {
    if (!currentChapter) {
      toast.error("Please select a valid chapter.");
      return;
    }

    setGenerating(true);
    setGenMeta(null);
    try {
      const studentIdsToSend = selectedStudentIds.length > 0 ? selectedStudentIds : classStudents.map((s) => s.id);

      const res = await fetch("/api/ai/homework/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterSlug: currentChapter.slug,
          classLevel: selectedClass,
          subject: effectiveSubject,
          questionCount,
          difficulty,
          mode,
          questionFormat,
          questionTypes: questionFormat === "mcq" ? ["mcq"] : undefined,
          studentIds: studentIdsToSend,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate questions.");
      }

      setGeneratedQuestions(data.assignment.questions);
      setStudentVariants(data.assignment.studentVariants);
      setAssignmentTitle(data.assignment.assignmentTitle);
      setGenMeta({
        providerLabel: data.providerLabel || data.assignment.provider || "AI provider",
        model: data.model || data.assignment.model || "unknown",
        generatedAt: data.assignment.generatedAt,
        fallbackUsed: data.assignment.fallbackUsed ?? false,
        fallbackTrail: data.assignment.fallbackTrail ?? [],
        validation: data.assignment.validation,
      });
      toast.success(`Generated ${data.assignment.questions.length} fresh questions for ${currentChapter.title}!`);
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = () => {
    if (generatedQuestions.length === 0) {
      toast.error("Generate or add questions first before publishing.");
      return;
    }

    startTransition(async () => {
      const targetIds = selectedStudentIds.length > 0 ? selectedStudentIds : classStudents.map((s) => s.id);
      const totalMarks = generatedQuestions.reduce((sum, q) => sum + q.marks, 0);

      const res = await publishAssignmentAction({
        title: assignmentTitle || `${currentChapter?.title || "Chapter"} Practice`,
        classLevel: selectedClass,
        subject: effectiveSubject,
        chapterSlug: currentChapter?.slug || selectedChapterSlug,
        preset,
        mode,
        questionFormat,
        submissionMode,
        aiProvider: genMeta?.providerLabel,
        aiModel: genMeta?.model,
        aiFallbackUsed: genMeta?.fallbackUsed ?? false,
        dueDate,
        totalMarks,
        targetStudentIds: targetIds,
        questions: generatedQuestions,
        studentVariants,
      });

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      router.push("/app/homework");
      router.refresh();
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-24">
      {/* Studio Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl">
        <div className="space-y-1">
          <Link
            href="/app/homework"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white transition-colors mb-2"
          >
            <ArrowLeftIcon className="size-3.5" />
            <span>Back to Homework Tracker</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30">
              <SparklesIcon className="size-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">AI Homework Studio</h1>
              <p className="text-xs sm:text-sm text-slate-300">
                Curriculum-grounded question generator with student-specific parameter variants and verified keys.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {generatedQuestions.length > 0 && (
            <Button
              onClick={handlePublish}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-10 gap-2 shadow-lg shadow-emerald-900/20"
            >
              <SendIcon className="size-4" />
              <span>{isPending ? "Publishing..." : `Publish to Class ${selectedClass}`}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1.9fr]">
        {/* Left Control Panel: Curriculum & Settings */}
        <div className="space-y-6">
          <Card className="border-white/90 bg-white/90 shadow-soft">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpenIcon className="size-4 text-indigo-600" />
                1. Official NCERT Curriculum
              </CardTitle>
              <CardDescription className="text-xs">
                Select Class, Subject and Chapter according to CBSE 2026-27 rationalized textbooks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Class Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Class Level</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[5, 6, 7, 8, 9, 10, 11, 12].map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => {
                        setSelectedClass(cls);
                        const subjs = getOfficialSubjectsForClass(cls);
                        setSelectedSubject(subjs[0] || "Maths");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        selectedClass === cls
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Class {cls}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Subject</Label>
                <div className="flex flex-wrap gap-1.5">
                  {subjects.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubject(sub)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        selectedSubject === sub
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chapter Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Chapter</Label>
                <select
                  value={currentChapter?.slug || ""}
                  onChange={(e) => setSelectedChapterSlug(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white p-2.5 font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
                >
                  {availableChapters.map((ch) => (
                    <option key={ch.slug} value={ch.slug}>
                      Ch {ch.chapterNumber}: {ch.title}
                    </option>
                  ))}
                </select>
                {currentChapter && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Textbook: {currentChapter.bookTitle} ({currentChapter.board} aligned)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preset & Assignment Configuration */}
          <Card className="border-white/90 bg-white/90 shadow-soft">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <SlidersIcon className="size-4 text-indigo-600" />
                2. Assignment Configuration
              </CardTitle>
              <CardDescription className="text-xs">
                Configure question volume, uniqueness mode, and submission rules.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Presets */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Preset</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "quick", label: "Quick (5 Qs)", count: 5 },
                    { id: "daily", label: "Daily Practice (10 Qs)", count: 10 },
                    { id: "chapter", label: "Chapter (15 Qs)", count: 15 },
                    { id: "exam", label: "Exam Prep (20 Qs)", count: 20 },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPreset(p.id);
                        setQuestionCount(p.count);
                      }}
                      className={`p-2 rounded-lg text-xs font-medium border text-left transition-all ${
                        preset === p.id
                          ? "bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignment Mode: Class / Variant / Adaptive */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Uniqueness Mode</Label>
                  <span className="text-[10px] text-indigo-600 font-semibold uppercase">Anti-Cheating</span>
                </div>
                <Tabs value={mode} onValueChange={(v) => setMode(v as HomeworkMode)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="class" className="text-xs">Class Mode</TabsTrigger>
                    <TabsTrigger value="variant" className="text-xs">Variant Mode</TabsTrigger>
                    <TabsTrigger value="adaptive" className="text-xs">Adaptive</TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {mode === "variant"
                    ? "✨ Unique numerical & scenario variants generated per student (same learning goals)."
                    : mode === "adaptive"
                    ? "🎯 Calibrates difficulty automatically to each student's current concept mastery."
                    : "📋 Identical question set for all assigned students."}
                </p>
              </div>

              {/* Question Format: Mixed vs MCQ Only */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Question Format</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["mixed", "mcq"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setQuestionFormat(f)}
                      className={`p-2 rounded-lg text-xs font-medium border text-left transition-all ${
                        questionFormat === f
                          ? "bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {f === "mcq" ? "MCQ Only" : "Mixed Format"}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {questionFormat === "mcq"
                    ? "All generated questions will be MCQs (A/B/C/D with verified keys)."
                    : "Mixed question types (MCQ, numeric, short, assertion-reason)."}
                </p>
              </div>

              {/* Submission Mode */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Submission Format</Label>
                <select
                  value={submissionMode}
                  onChange={(e) => setSubmissionMode(e.target.value as "online" | "handwritten" | "mixed")}
                  className="w-full text-xs rounded-xl border border-slate-200 bg-white p-2.5 font-medium text-slate-900 shadow-sm"
                >
                  <option value="mixed">Mixed (Online Input + Photo/PDF Upload)</option>
                  <option value="online">Online Input Only</option>
                  <option value="handwritten">Handwritten Notebook Upload Only</option>
                </select>
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              {/* Students Targeting */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Target Students</span>
                  <span className="text-slate-400 font-normal">
                    {selectedStudentIds.length === 0
                      ? `All Class ${selectedClass} (${classStudents.length} students)`
                      : `${selectedStudentIds.length} students selected`}
                  </span>
                </div>
                {classStudents.length > 0 && (
                  <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1 bg-slate-50/50">
                    {classStudents.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-1 rounded hover:bg-white">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(s.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds([...selectedStudentIds, s.id]);
                            } else {
                              setSelectedStudentIds(selectedStudentIds.filter((id) => id !== s.id));
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{s.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-2 shadow-md"
              >
                <SparklesIcon className="size-4" />
                <span>{generating ? "Generating Unique Questions..." : "Generate AI Homework"}</span>
              </Button>

              {/* Live generation pipeline status — every line reflects a real stage */}
              {(generating || genMeta) && currentChapter && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 space-y-1.5 text-[11px]">
                  <p className="font-bold text-indigo-900">Generation pipeline</p>
                  <p className="text-indigo-800">
                    <CheckCircle2Icon className="size-3.5 inline mr-1 text-emerald-600" />
                    Curriculum context: Class {selectedClass} {effectiveSubject} · Ch {currentChapter.chapterNumber}: {currentChapter.title}
                  </p>
                  {generating ? (
                    <p className="text-indigo-800">
                      <RefreshCwIcon className="size-3.5 inline mr-1 animate-spin text-indigo-600" />
                      Requesting fresh questions from live AI (unique per run)…
                    </p>
                  ) : genMeta ? (
                    <>
                      <p className="text-indigo-800">
                        <CheckCircle2Icon className="size-3.5 inline mr-1 text-emerald-600" />
                        Generated by {genMeta.providerLabel} · <span className="font-mono">{genMeta.model}</span>
                      </p>
                      {genMeta.fallbackUsed && (genMeta.fallbackTrail ?? []).length > 1 && (
                        <p className="text-indigo-800">
                          <CheckCircle2Icon className="size-3.5 inline mr-1 text-emerald-600" />
                          Fallback activated: <span className="font-mono">{genMeta.fallbackTrail!.join(" → ")}</span>
                        </p>
                      )}
                      {genMeta.validation && (
                        <p className="text-indigo-800">
                          <CheckCircle2Icon className="size-3.5 inline mr-1 text-emerald-600" />
                          Validated {genMeta.validation.checked} questions · {genMeta.validation.rejected} rejected · {genMeta.validation.attempts} attempt{genMeta.validation.attempts === 1 ? "" : "s"}
                        </p>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Live Question Preview & Verification */}
        <div className="space-y-6">
          <Card className="border-white/90 bg-white/90 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileTextIcon className="size-4 text-indigo-600" />
                  Question Preview & Verification
                </CardTitle>
                <CardDescription className="text-xs">
                  {generatedQuestions.length > 0
                    ? `${generatedQuestions.length} questions ready · Verified answer keys & rubrics attached`
                    : "No questions generated yet. Select curriculum on the left and click Generate."}
                </CardDescription>
              </div>

              {generatedQuestions.length > 0 && (
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-indigo-700 bg-indigo-50 border-indigo-200 text-xs">
                    {generatedQuestions.reduce((s, q) => s + q.marks, 0)} Total Marks
                  </Badge>
                  {genMeta && (
                    <Badge variant="secondary" className="text-[10px] font-mono" title={`Generated at ${genMeta.generatedAt || "unknown time"}`}>
                      {genMeta.providerLabel} · {genMeta.model}
                    </Badge>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {generatedQuestions.length === 0 ? (
                <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                  <div className="size-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                    <SparklesIcon className="size-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Ready to Generate Curriculum Questions</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    TuitionTrack will generate unique questions grounded in {currentChapter?.title || "selected chapter"} with step-by-step solutions and scoring rubrics.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {generatedQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                            {idx + 1}
                          </span>
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {q.qtype}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            Difficulty: {q.difficulty}/5
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-700">
                          {q.marks} {q.marks === 1 ? "Mark" : "Marks"}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
                        {q.stem}
                      </p>

                      {/* Options if MCQ */}
                      {q.options?.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {q.options.map((opt) => (
                            <div
                              key={opt.label}
                              className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                                opt.isCorrect
                                  ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 font-semibold"
                                  : "bg-slate-50 border-slate-200 text-slate-700"
                              }`}
                            >
                              <span className="font-bold">{opt.label}.</span>
                              <span>{opt.text}</span>
                              {opt.isCorrect && <CheckCircle2Icon className="size-3.5 text-emerald-600 ml-auto" />}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Verified Answer Key & Derivation */}
                      <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            Verified Answer: <span className="text-emerald-700 font-semibold">{q.correctAnswer}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Fingerprint: {q.fingerprint.slice(0, 10)}</span>
                        </div>
                        {q.solutionSteps?.length > 0 && (
                          <div className="text-slate-600 space-y-0.5 pt-1 border-t border-slate-200 text-[11px]">
                            {q.solutionSteps.map((step, sIdx) => (
                              <p key={sIdx}>{step}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Bottom Action */}
                  <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerate}
                      disabled={generating}
                      className="text-xs gap-1.5"
                    >
                      <RefreshCwIcon className="size-3.5" />
                      <span>Regenerate Questions</span>
                    </Button>

                    <Button
                      onClick={handlePublish}
                      disabled={isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-semibold gap-2"
                    >
                      <SendIcon className="size-3.5" />
                      <span>{isPending ? "Publishing..." : `Publish Homework (${generatedQuestions.length} Qs)`}</span>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
