"use client";

import { useState, useTransition } from "react";
import { SparklesIcon, SendIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { askParentAiAction, type ParentAiResponse } from "@/actions/parent-ai";

export function AskAiSection({
  childId,
  studentName,
}: {
  childId: string;
  studentName: string;
}) {
  const [question, setQuestion] = useState("");
  const [isPending, startTransition] = useTransition();
  const [history, setHistory] = useState<
    { q: string; a: string; evidence?: string[]; time: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const sampleQuestions = [
    "What homework is overdue or pending?",
    "Which concepts need revision?",
    "What should I ask the teacher during the PTM?",
    "How has attendance been this month?",
    "Summarize recent test results",
  ];

  function submitQuestion(qText: string) {
    if (!qText.trim() || isPending) return;
    setError(null);
    const userQ = qText.trim();
    setQuestion("");

    startTransition(async () => {
      const res: ParentAiResponse = await askParentAiAction(childId, userQ);
      if (res.ok && res.answer) {
        setHistory((prev) => [
          ...prev,
          {
            q: userQ,
            a: res.answer!,
            evidence: res.evidence,
            time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        setError(res.error ?? "Could not get an answer. Please try again.");
      }
    });
  }

  return (
    <Card className="rounded-2xl border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/30 p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <SparklesIcon className="size-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Ask About {studentName}</h2>
            <p className="text-xs text-slate-500">
              Answers grounded strictly in verified academic records
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
          <ShieldCheckIcon className="size-3" />
          Child Isolated
        </span>
      </div>

      {/* Suggested quick chips */}
      {history.length === 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Popular questions:</p>
          <div className="flex flex-wrap gap-1.5">
            {sampleQuestions.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => submitQuestion(sq)}
                disabled={isPending}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-900 disabled:opacity-50"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation stream */}
      {history.length > 0 && (
        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
          {history.map((msg, idx) => (
            <div key={idx} className="space-y-1.5">
              {/* Parent message */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2 text-xs text-white shadow-sm">
                  {msg.q}
                </div>
              </div>
              {/* AI Answer */}
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-800 shadow-sm">
                  <p className="whitespace-pre-line">{msg.a}</p>
                  {msg.evidence && msg.evidence.length > 0 && (
                    <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-700">Verified Evidence: </span>
                      {msg.evidence.join(" · ")}
                    </div>
                  )}
                  <span className="mt-1 block text-right text-[10px] text-slate-400">
                    {msg.time}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitQuestion(question);
        }}
        className="mt-4 flex items-center gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={`Ask about homework, tests, attendance, or revision...`}
          disabled={isPending}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!question.trim() || isPending}
          className="flex items-center justify-center rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SendIcon className="size-3.5" />
          )}
        </button>
      </form>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </Card>
  );
}
