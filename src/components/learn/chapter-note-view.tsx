"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DownloadIcon,
  PrinterIcon,
  ArrowLeftIcon,
  BookOpenIcon,
  SparklesIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  LightbulbIcon,
  HelpCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { ChapterNote } from "@/lib/learn/chapter-notes";
import { generateChapterPdf } from "@/lib/learn/pdf-generator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ChapterNoteView({ note }: { note: ChapterNote }) {
  const [downloading, setDownloading] = useState(false);
  const [openHints, setOpenHints] = useState<Record<number, boolean>>({});

  const handleDownloadPdf = () => {
    try {
      setDownloading(true);
      generateChapterPdf(note);
      toast.success(`PDF downloaded: Chapter ${note.chapterNumber} Notes`);
    } catch (err) {
      toast.error("Failed to generate PDF. You can also use the Print button to Save as PDF.");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleHint = (index: number) => {
    setOpenHints((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 print:p-0 print:max-w-none">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <Link
            href={`/app/videos?class=${note.classLevel}&subject=${encodeURIComponent(note.subject)}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeftIcon className="size-3.5" />
            <span>Back to Class {note.classLevel} {note.subject}</span>
          </Link>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs h-9 gap-1.5 border-slate-200 hover:bg-slate-50"
          >
            <PrinterIcon className="size-3.5 text-slate-600" />
            <span>Print / Save as PDF</span>
          </Button>

          <Button
            size="sm"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="text-xs h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <DownloadIcon className="size-3.5" />
            <span>{downloading ? "Generating PDF..." : "Download PDF Notes"}</span>
          </Button>
        </div>
      </div>

      {/* Main Document Content */}
      <article className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 shadow-soft print:shadow-none print:border-none print:p-0">
        {/* Document Header */}
        <header className="border-b border-slate-200 pb-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 text-xs font-semibold">
                Class {note.classLevel} · {note.subject}
              </Badge>
              <Badge variant="outline" className="text-slate-500 text-xs">
                Chapter {note.chapterNumber}
              </Badge>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {note.syllabusTag}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            {note.title}
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
            {note.overview}
          </p>

          {/* Learning Objectives Box */}
          {note.learningObjectives?.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                <SparklesIcon className="size-3.5 text-indigo-600" />
                Key Learning Outcomes
              </h4>
              <ul className="grid sm:grid-cols-2 gap-2 text-xs text-slate-600">
                {note.learningObjectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle2Icon className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </header>

        {/* Section 1: Core Topics */}
        <section className="py-8 border-b border-slate-200 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpenIcon className="size-5 text-indigo-600" />
            1. Core Conceptual Analysis
          </h2>

          <div className="space-y-6">
            {note.coreTopics.map((topic, i) => (
              <div key={i} className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3 print:bg-transparent print:border-slate-300">
                <h3 className="text-sm font-bold text-slate-900">
                  {topic.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {topic.summary}
                </p>

                {topic.keyPoints?.length > 0 && (
                  <ul className="space-y-1.5 pl-2">
                    {topic.keyPoints.map((pt, j) => (
                      <li key={j} className="text-xs sm:text-sm text-slate-600 flex items-start gap-2">
                        <span className="text-indigo-600 font-bold shrink-0">→</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {topic.exampleOrApplication && (
                  <div className="mt-2 p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 italic">
                    <strong className="text-slate-800 not-italic">Example Application: </strong>
                    {topic.exampleOrApplication}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Formulas & Governing Rules */}
        {note.formulasAndRules?.length > 0 && (
          <section className="py-8 border-b border-slate-200 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                ∑
              </span>
              2. Key Formulas, Laws & Governing Rules
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {note.formulasAndRules.map((rule, i) => (
                <div key={i} className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-2">
                  <span className="text-xs font-bold text-emerald-800">{rule.name}</span>
                  <div className="font-mono text-xs sm:text-sm bg-white p-2.5 rounded-lg border border-emerald-200 text-slate-900 font-semibold overflow-x-auto">
                    {rule.expression}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {rule.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 3: Solved Examples */}
        {note.solvedExamples?.length > 0 && (
          <section className="py-8 border-b border-slate-200 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-orange-500 text-white text-xs font-bold">
                ✓
              </span>
              3. Solved Board-Pattern Examples
            </h2>

            <div className="space-y-4">
              {note.solvedExamples.map((ex, i) => (
                <div key={i} className="p-5 rounded-2xl bg-amber-50/30 border border-amber-200/70 space-y-3">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    {ex.question}
                  </h4>

                  <div className="space-y-1.5 pl-3 border-l-2 border-amber-300">
                    {ex.stepByStepSolution.map((step, j) => (
                      <p key={j} className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {step}
                      </p>
                    ))}
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-amber-200 text-xs font-semibold text-amber-900">
                    <strong>Final Answer: </strong>{ex.finalAnswer}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 4: Common Traps & Pitfalls */}
        {note.commonMistakes?.length > 0 && (
          <section className="py-8 border-b border-slate-200 space-y-6">
            <h2 className="text-lg font-bold text-rose-950 flex items-center gap-2">
              <AlertTriangleIcon className="size-5 text-rose-600" />
              4. Common Traps & Exam Pitfalls (Watch Out)
            </h2>

            <div className="space-y-3">
              {note.commonMistakes.map((cm, i) => (
                <div key={i} className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-rose-700 uppercase tracking-wide">Common Mistake:</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-900">{cm.mistake}</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    <strong>Why students slip: </strong>{cm.whyItHappens}
                  </p>
                  <p className="text-xs text-emerald-700 font-medium pt-1">
                    <strong>Correct Method: </strong>{cm.correctMethod}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 5: High-Yield Exam Tips */}
        {note.highYieldExamTips?.length > 0 && (
          <section className="py-8 border-b border-slate-200 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <LightbulbIcon className="size-5 text-sky-600" />
              5. High-Yield Exam Tips & Scoring Guidelines
            </h2>

            <ul className="grid gap-3 sm:grid-cols-2">
              {note.highYieldExamTips.map((tip, i) => (
                <li key={i} className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-100 flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                  <span className="text-sky-600 font-bold shrink-0">★</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Section 6: Self-Assessment Practice Questions */}
        {note.practiceQuestions?.length > 0 && (
          <section className="pt-8 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <HelpCircleIcon className="size-5 text-purple-600" />
              6. Self-Assessment Practice Questions
            </h2>

            <div className="space-y-3">
              {note.practiceQuestions.map((q, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-purple-700">
                      Question {i + 1}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {q.type}
                    </Badge>
                  </div>

                  <p className="text-xs sm:text-sm font-medium text-slate-900">
                    {q.question}
                  </p>

                  <div>
                    <button
                      type="button"
                      onClick={() => toggleHint(i)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                    >
                      <span>{openHints[i] ? "Hide Hint & Approach" : "Show Hint & Approach"}</span>
                      {openHints[i] ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
                    </button>

                    {openHints[i] && (
                      <div className="mt-2 p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 leading-relaxed">
                        <strong>Approach / Hint: </strong>{q.hintOrGuidance}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Document Footer */}
        <footer className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          <p>TuitionTrack Academic Study Suite · Rationalized Curriculum Notes</p>
          <p className="mt-1">Generated for Class {note.classLevel} {note.subject} · Ready for Print & Revision</p>
        </footer>
      </article>
    </div>
  );
}
