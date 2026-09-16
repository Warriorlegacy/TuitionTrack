"use client";

// Student AI tutor chat (blueprint #9 modes, #81 UX). Socratic by default —
// hint-first, never an answer dump. Ten modes map 1:1 to /api/ai/tutor.
// States per blueprint #83: loading, empty, error, offline, success.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BotIcon,
  GraduationCapIcon,
  SendIcon,
  UserIcon,
  WifiOffIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { track, useOnline } from "./lib";

export type TutorStudent = { id: string; name: string };

type Mode = {
  id: string;
  label: string;
  blurb: string;
};

// Blueprint #9 tutor modes, user-facing subset with Hinglish-safe labels.
const MODES: Mode[] = [
  { id: "socratic", label: "Socratic", blurb: "Guiding questions — you solve it" },
  { id: "concept_teacher", label: "Learn", blurb: "Explain from zero to topper depth" },
  { id: "doubt_solver", label: "Doubt", blurb: "Exact doubt, worked steps" },
  { id: "exam_coach", label: "Exam coach", blurb: "Speed, traps, strategy" },
  { id: "mistake_coach", label: "Mistakes", blurb: "Fix your recurring errors" },
  { id: "revision", label: "Revise", blurb: "Quick recall of weak topics" },
  { id: "homework", label: "Homework", blurb: "Hints only — no copy-paste" },
  { id: "viva", label: "Viva", blurb: "Oral practice, one question at a time" },
];

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  citations?: { document_id: string; title: string }[];
  model?: string;
};

const QUICK_PROMPTS: Record<string, string[]> = {
  socratic: [
    "I'm stuck on quadratic equations — where do I start?",
    "Help me with Newton's laws word problems",
    "Explain how to approach this problem: ",
  ],
  concept_teacher: [
    "Explain photosynthesis from zero",
    "What is differentiation in maths?",
    "Teach me trigonometry basics",
  ],
  doubt_solver: ["Solve step by step: 2x² - 8 = 0", "Why is my answer wrong here?", "Check my working for this sum"],
  exam_coach: ["How do I manage 3 hours in JEE mock?", "Which questions should I attempt first?", "How to avoid silly mistakes?"],
  mistake_coach: ["What do I keep getting wrong?", "Why do I repeat sign errors?", "Review my mistake patterns"],
  revision: ["Quiz me on my weak topics", "Quick recall: physics formulas", "What should I revise today?"],
  homework: ["Give me a hint for my homework Q3", "I'm stuck, don't tell me the answer", "Is my approach right?"],
  viva: ["Start my viva practice", "Ask me one question on electricity", "Grade my last answer"],
};

const STARTERS: Record<string, string> = {
  socratic: "What are you working on? Share the question and I'll guide you step by step — you do the solving.",
  concept_teacher: "Name a topic and I'll teach it from zero, then check your understanding.",
  doubt_solver: "Paste the doubt or describe it — I'll work it through with you.",
  exam_coach: "Tell me your exam and I'll sharpen your strategy: timing, selection, traps.",
  mistake_coach: "I'll look at your recurring mistakes and fix the root cause, not the symptom.",
  revision: "Ready for rapid recall on your weak topics? Say go.",
  homework: "Which question? I'll give hints, not answers — your working stays yours.",
  viva: "Viva mode: I ask, you answer out loud, I probe deeper. Ready?",
};

export function TutorView({
  student,
  students,
}: {
  student: TutorStudent;
  students: TutorStudent[];
}) {
  const router = useRouter();
  const online = useOnline();

  const [mode, setMode] = useState("socratic");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sourceOnly, setSourceOnly] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Resume latest conversation for this student on mount.
  useEffect(() => {
    let live = true;
    setMessages([]);
    setConversationId(null);
    setError(null);
    void fetch(`/api/ai/tutor?student_id=${student.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((j: { conversations?: { id: string; mode: string; title: string }[] }) => {
        if (!live) return;
        const latest = j.conversations?.[0];
        if (!latest) return;
        setConversationId(latest.id);
        return fetch(`/api/ai/tutor?student_id=${student.id}&conversation_id=${latest.id}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : { messages: [] }))
          .then((h: { messages?: ChatMessage[] }) => {
            if (live && h.messages?.length) setMessages(h.messages.slice(-20));
          });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [student.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const canSend = input.trim().length > 0 && !sending && online;

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || sending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: clean }]);
    setSending(true);
    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.id,
          message: clean,
          mode,
          ...(conversationId ? { conversation_id: conversationId } : {}),
          source_only: sourceOnly,
        }),
      });
      const j = (await res.json()) as {
        reply?: string;
        citations?: { document_id: string; title: string }[];
        error?: string;
        conversation_id?: string;
        model?: string;
      };
      if (!res.ok || j.error) throw new Error(j.error ?? `Request failed (${res.status}).`);
      if (j.conversation_id) setConversationId(j.conversation_id);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: j.reply ?? "(empty reply)", citations: j.citations, model: j.model },
      ]);
      track(student.id, "ai_doubt_asked", { mode, source_only: sourceOnly });
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tutor unavailable — try again.");
    } finally {
      setSending(false);
    }
  };

  const activeMode = useMemo(() => MODES.find((m) => m.id === mode) ?? MODES[0], [mode]);

  return (
    <div className="space-y-4">
      {/* Header row: student switcher + mode picker */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {students.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Student
            <select
              aria-label="Choose student"
              value={student.id}
              onChange={(e) => {
                const v = e.target.value;
                track(student.id, "syllabus_viewed", { to_student: v, from: "tutor" });
                router.push(v === students[0]?.id ? "/app/tutor" : `/app/tutor?student=${v}`);
              }}
              className="tt-focus rounded-tt-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span />
        )}
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={sourceOnly}
            onChange={(e) => setSourceOnly(e.target.checked)}
            className="tt-focus size-4 rounded border-slate-300 text-primary"
          />
          Answer only from my notes (source-grounded)
        </label>
      </div>

      {!online ? (
        <div role="status" className="flex items-center gap-2 rounded-tt-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <WifiOffIcon className="size-4 shrink-0" aria-hidden />
          You&apos;re offline — the AI tutor needs a connection. Your draft is kept.
        </div>
      ) : null}

      {/* Mode picker */}
      <div role="tablist" aria-label="Tutor mode" className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => {
              setMode(m.id);
              track(student.id, "ai_mode_changed", { mode: m.id });
            }}
            className={`tt-focus rounded-tt-sm border px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === m.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
            title={m.blurb}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Conversation panel */}
      <div className="rounded-tt-lg border border-slate-200 bg-white shadow-soft">
        <div
          ref={scrollRef}
          aria-live="polite"
          aria-label="Tutor conversation"
          className="h-[52vh] min-h-72 overflow-y-auto p-4 sm:p-6"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
                <GraduationCapIcon className="size-6" />
              </span>
              <p className="max-w-md text-sm leading-6 text-slate-600">
                {STARTERS[mode] ?? STARTERS.socratic}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {(QUICK_PROMPTS[mode] ?? QUICK_PROMPTS.socratic).map((p) => (
                  <button
                    key={p}
                    onClick={() => void send(p)}
                    className="tt-focus rounded-tt-sm border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:border-primary/40 hover:bg-primary/5"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="space-y-4">
              {messages.map((msg, i) => (
                <li key={msg.id ?? `${msg.role}-${i}`} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[85%] rounded-tt-md px-4 py-3 ${msg.role === "user" ? "bg-primary text-white" : "border border-slate-200 bg-slate-50"}`}>
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-70">
                      {msg.role === "user" ? <UserIcon className="size-3" /> : <BotIcon className="size-3" />}
                      {msg.role === "user" ? "You" : "Tutor"}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6">{msg.content}</p>
                    {msg.citations && msg.citations.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-dashed border-slate-300/50 pt-2">
                        {msg.citations.map((c, ci) => (
                          <Badge key={`${c.document_id}-${ci}`} variant="outline" className="text-[10px]">
                            [{ci + 1}] {c.title}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
              {sending ? (
                <li className="flex justify-start">
                  <div className="rounded-tt-md border border-slate-200 bg-slate-50 px-4 py-3" aria-busy="true">
                    <Skeleton className="h-4 w-40 rounded-tt-sm" />
                    <Skeleton className="mt-2 h-4 w-56 rounded-tt-sm" />
                  </div>
                </li>
              ) : null}
            </ol>
          )}
        </div>

        {error ? (
          <div role="alert" className="mx-4 mb-2 rounded-tt-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 sm:mx-6">
            {error}{" "}
            <button onClick={() => setError(null)} className="tt-focus font-medium underline">
              dismiss
            </button>
          </div>
        ) : null}

        {/* Composer */}
        <form
          className="border-t border-slate-200 p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={2}
              aria-label="Message your AI tutor"
              placeholder={`Ask as ${activeMode.label.toLowerCase()}… (Enter to send, Shift+Enter for a new line)`}
              className="tt-focus min-h-11 flex-1 resize-none rounded-tt-sm border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
            />
            <Button type="submit" size="lg" disabled={!canSend} className="tt-focus rounded-tt-md">
              <SendIcon className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only sm:ml-1">Send</span>
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {activeMode.blurb} · Tutor answers include sources when your notes are used. Readiness estimates are not guarantees.
          </p>
        </form>
      </div>
    </div>
  );
}
