"use client";

// AI learning-video generator — free video models with an instant 3D fallback.
//
// Flow: type any concept → a programmatic 3D animation plays IMMEDIATELY
// (deterministic local storyboard, zero quota) while /api/ai/video renders
// the AI clip in the background (HuggingFace → Pollinations, both free).
// When the mp4 lands it swaps in; when providers are busy the 3D version
// simply keeps playing. No dead ends, no spinners into the void.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2Icon, PlayIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RemotionLessonPlayer } from "./remotion-lesson-player";
import { deterministicStoryboard, type LessonScript } from "@/lib/ai/video";

type Phase = "idle" | "working" | "video" | "blueprint";

const MAX_POLLS = 4;

export function AiVideoCard({ studentId, initialConcept }: { studentId: string; initialConcept?: string }) {
  const [concept, setConcept] = useState(initialConcept?.slice(0, 200) ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [script, setScript] = useState<LessonScript | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const polls = useRef(0);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRan = useRef(false);

  useEffect(
    () => () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const setVideo = useCallback((url: string | null) => {
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  const fetchVideo = useCallback(
    async (conceptText: string) => {
      const res = await fetch(
        `/api/ai/video?student_id=${encodeURIComponent(studentId)}&concept=${encodeURIComponent(conceptText)}`,
      );
      const ct = res.headers.get("content-type") ?? "";
      if (res.ok && ct.startsWith("video/")) {
        const blob = await res.blob();
        if (!alive.current) return;
        setVideo(URL.createObjectURL(blob));
        setModel(res.headers.get("X-Video-Model"));
        setPhase("video");
        setBusy(false);
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        status?: string;
        script?: LessonScript;
        retryAfter?: number;
        error?: string;
      } | null;
      if (!alive.current) return;
      if (data?.script) setScript(data.script);
      if (res.status === 202 && data?.status === "pending" && polls.current < MAX_POLLS) {
        polls.current += 1;
        timer.current = setTimeout(
          () => void fetchVideo(conceptText).catch(() => setBusy(false)),
          Math.min((data.retryAfter ?? 12) * 1000, 20_000),
        );
        return;
      }
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Video generation is busy — try again in a bit.");
        setPhase(script ? "blueprint" : "idle");
        setBusy(false);
        return;
      }
      // blueprint (or polls exhausted with a script in hand): 3D version stands in.
      setPhase("blueprint");
      setBusy(false);
    },
    [studentId, script, setVideo],
  );

  const generate = useCallback(() => {
    const text = concept.trim().slice(0, 200);
    if (!text || busy) return;
    if (timer.current) clearTimeout(timer.current);
    polls.current = 0;
    setVideo(null);
    setModel(null);
    // Instant 3D preview from the local deterministic storyboard — the
    // server's richer script replaces it the moment the first response lands.
    setScript(deterministicStoryboard(text));
    setPhase("working");
    setBusy(true);
    void fetchVideo(text).catch(() => {
      if (!alive.current) return;
      toast.error("Video generation is busy — 3D preview playing meanwhile.");
      setPhase("blueprint");
      setBusy(false);
    });
  }, [concept, busy, fetchVideo, setVideo]);

  // Deep-link from the Videos catalog (?concept=…): auto-generate once.
  useEffect(() => {
    if (initialConcept?.trim() && !autoRan.current) {
      autoRan.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLine =
    phase === "working"
      ? "Rendering AI clip in the background — 3D preview playing meanwhile."
      : phase === "video"
        ? `AI video ready${model ? ` · ${model}` : ""} · free model, yours to replay.`
        : phase === "blueprint"
          ? "AI video quota is busy right now — the 3D version is playing. Generate again later for the AI clip."
          : "Any concept, Classes 6–12. AI clip when quota allows, 3D animation always.";

  return (
    <section
      aria-labelledby="ai-video-heading"
      className="rounded-tt-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8"
    >
      <div className="grid items-center gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary" className="w-fit">
              <SparklesIcon className="mr-1 size-3" aria-hidden />
              AI learning video
            </Badge>
            <span className="tt-tnum rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
              {phase === "video" ? "AI clip" : "3D animated"}
            </span>
          </div>
          {phase === "video" && videoUrl ? (
            <video
              key={videoUrl}
              controls
              playsInline
              preload="metadata"
              src={videoUrl}
              className="aspect-video w-full overflow-hidden rounded-tt-md bg-black ring-1 ring-white/20"
            />
          ) : script ? (
            <RemotionLessonPlayer script={script} />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-tt-md bg-slate-950 text-center ring-1 ring-white/20">
              <PlayIcon className="size-8 text-slate-500" aria-hidden />
              <p className="max-w-xs text-sm text-slate-400">
                Type a concept on the right — its 3D animation starts instantly.
              </p>
            </div>
          )}
        </div>

        <div>
          <p className="tt-mono-label text-[11px] text-primary">Free video models · HF + Pollinations + Remotion</p>
          <h3 id="ai-video-heading" className="tt-display mt-2 text-xl font-semibold text-slate-950">
            Watch any idea come alive.
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{statusLine}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="e.g. Photosynthesis, Trigonometry, Fractions"
              value={concept}
              maxLength={200}
              onChange={(e) => setConcept(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") generate();
              }}
              aria-label="Concept for the learning video"
              className="h-11"
            />
            <Button className="h-11 shrink-0" disabled={busy || !concept.trim()} onClick={generate}>
              {busy ? <Loader2Icon className="mr-2 size-4 animate-spin" aria-hidden /> : null}
              {busy ? "Rendering…" : "Generate video"}
            </Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            Free tiers only — no card, no credits. Roughly 2 videos/minute, 10/day per student.
          </p>
        </div>
      </div>
    </section>
  );
}
