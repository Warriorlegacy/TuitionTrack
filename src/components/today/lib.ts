"use client";

// Shared client helpers for the student Today + Progress slice (Blueprint #8, #28–29).
// ponytail: one fetch hook + one tracker + pure formatters. No new deps.

import { useCallback, useEffect, useState } from "react";
import type { LoadState } from "@/components/marketing/ui";

export type Readiness = {
  readiness: number;
  breakdown: Record<string, number>;
  disclaimer?: string;
};

export type MasteryRow = {
  mastery: number;
  attempt_count?: number;
  correct_count?: number;
  streak?: number;
  last_practiced_at?: string | null;
  next_review_at?: string | null;
  concept_id?: string;
  syllabus_nodes?:
    | { title?: string; level?: string }
    | { title?: string; level?: string }[]
    | null;
};

export type Mistake = {
  id: string;
  category?: string;
  status?: string;
  question_text?: string;
  question?: string;
  prompt?: string;
  recurrence_count?: number;
  created_at?: string;
  concept_id?: string | null;
};

export type DueCard = {
  id: string;
  front?: string;
  back?: string;
  due_at?: string;
  concept_id?: string | null;
};

// Fire-and-forget analytics → POST /api/students/:id/events. Never breaks learning.
export function track(studentId: string, event_type: string, payload: Record<string, unknown> = {}) {
  try {
    void fetch(`/api/students/${studentId}/events`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type, payload }),
    }).catch(() => {});
  } catch {
    /* offline — ignore */
  }
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

// Single fetch hook for the slice: loading / ready / empty / error + retry.
// Keeps stale data when the connection drops (offline banner covers the notice).
export function useApi<T>(url: string | null, isEmpty?: (d: T) => boolean) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LoadState>(url ? "loading" : "empty");
  const [error, setError] = useState("Couldn't load.");
  const [tick, setTick] = useState(0);
  const online = useOnline();
  const retry = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!url) {
      setStatus("empty");
      return;
    }
    let live = true;
    if (!online && !data) {
      setError("You're offline. Check your connection and try again.");
      setStatus("error");
      return;
    }
    if (!data) setStatus("loading");
    void fetch(url, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            r.status === 401 || r.status === 403
              ? "You don't have access to this student."
              : `Request failed (${r.status}).`,
          );
        return (await r.json()) as T;
      })
      .then((j) => {
        if (!live) return;
        setData(j);
        setStatus(isEmpty?.(j) ? "empty" : "ready");
      })
      .catch((e: unknown) => {
        if (!live) return;
        if (data) return; // stale-while-offline
        setError(e instanceof Error ? e.message : "Couldn't load.");
        setStatus("error");
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick, online]);

  return { data, status, error, retry, online };
}

export function greeting(name: string, now = new Date()) {
  const h = now.getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${name.split(" ")[0]}`;
}

// Mastery engine stores 0..1; readiness parts are 0..100 — normalize both.
export function pct(v: number) {
  return Math.round(v <= 1 ? v * 100 : v);
}

export function nodeTitle(r: MasteryRow, fallback = "Untitled concept") {
  const n = r.syllabus_nodes;
  const o = Array.isArray(n) ? n[0] : n;
  return o?.title?.trim() || fallback;
}

export function nodeLevel(r: MasteryRow) {
  const n = r.syllabus_nodes;
  const o = Array.isArray(n) ? n[0] : n;
  return o?.level?.trim() || "";
}

export function mistakeTitle(m: Mistake) {
  return (
    m.question_text?.trim() ||
    m.question?.trim() ||
    m.prompt?.trim() ||
    `${m.category ? m.category.charAt(0).toUpperCase() + m.category.slice(1) : "Concept"} mistake`
  );
}

export function masteryTone(v: number) {
  const p = pct(v);
  if (p < 40) return "bg-red-500";
  if (p < 70) return "bg-amber-500";
  return "bg-emerald-500";
}
