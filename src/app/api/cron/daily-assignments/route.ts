import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { complete } from "@/lib/ai/provider";
import { classLevelDescriptor, computeQuestionFingerprint, normalizeStem } from "@/lib/homework/variation-engine";
import { notifyHomeworkAssigned } from "@/lib/notifications";

// Daily universal assignment: one AI-generated set per (teacher, class) group.
// Rotates Moral Science / GK / GS / Current Affairs by day-of-year so every
// active student gets fresh, age-appropriate content. Idempotent per
// (teacher, class, category, date) via the assignment config column.
export const dynamic = "force-dynamic";

const CATEGORIES = ["General Knowledge", "Moral Science", "General Studies", "Current Affairs"] as const;
const MAX_GROUPS_PER_RUN = 15;

function authorized(request: Request): { ok: boolean; status: number; error?: string } {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return { ok: false, status: 500, error: "CRON_SECRET is not configured" };
  const good =
    request.headers.get("Authorization") === `Bearer ${cronSecret}` ||
    request.headers.get("x-vercel-cron") === "1";
  return good ? { ok: true, status: 200 } : { ok: false, status: 401, error: "Unauthorized" };
}

function categoryBrief(category: string, today: string): string {
  switch (category) {
    case "Moral Science":
      return "Value education: a short everyday scenario (honesty, kindness, responsibility, respect) followed by questions testing the moral and its application. No preaching tone; concrete situations.";
    case "General Studies":
      return "Foundational awareness: our country, environment, community helpers, basic civics, maps and directions — strictly factual, textbook-grade.";
    case "Current Affairs":
      return `Only widely reported national/international news, sports, science, and awards from the 14 days before ${today}. Each item must be verifiable public fact; when in doubt prefer evergreen civics over a half-remembered headline. Never invent events, scores, or names.`;
    default:
      return "Evergreen general knowledge: science facts, geography, books and authors for the age group, units and measurements — strictly factual.";
  }
}

type DailyQuestion = {
  position: number;
  qtype: string;
  marks: number;
  stem: string;
  options: { label: string; text: string; isCorrect: boolean }[];
  correctAnswer: string;
  solutionSteps: string[];
};

function validDaily(raw: unknown): DailyQuestion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const stem = typeof r.stem === "string" ? r.stem.trim() : "";
  const correctAnswer = typeof r.correctAnswer === "string" ? r.correctAnswer.trim() : "";
  const solutionSteps = Array.isArray(r.solutionSteps) ? r.solutionSteps.map(String).map((s) => s.trim()).filter(Boolean) : [];
  if (stem.length < 20 || !correctAnswer || solutionSteps.length === 0) return null;
  const qtype = typeof r.qtype === "string" ? r.qtype : "mcq";
  const options = Array.isArray(r.options)
    ? r.options.map((o) => {
        const oo = (o ?? {}) as Record<string, unknown>;
        return { label: String(oo.label ?? "?").toUpperCase().slice(0, 2), text: String(oo.text ?? "").trim(), isCorrect: oo.isCorrect === true };
      }).filter((o) => o.text)
    : [];
  if ((qtype === "mcq" || qtype === "assertion_reason") && (options.length < 2 || !options.some((o) => o.isCorrect))) return null;
  const marks = Number(r.marks);
  return { position: 0, qtype, marks: Number.isFinite(marks) ? Math.min(5, Math.max(1, Math.round(marks))) : 1, stem, options, correctAnswer, solutionSteps };
}

export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const started = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const dayOfYear = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86_400_000);
  const category = CATEGORIES[dayOfYear % CATEGORIES.length];

  const supabase = createSupabaseAdminClient();
  const summary: { generated: number; skipped: number; failed: { group: string; error: string }[] } = {
    generated: 0, skipped: 0, failed: [],
  };

  try {
    const { data: students } = await supabase.from("students").select("id, class, teacher_id").limit(2000);
    const groups = new Map<string, { teacherId: string; classLevel: number; ids: string[] }>();
    for (const s of ((students ?? []) as { id: string; class: string | null; teacher_id: string | null }[])) {
      const classLevel = parseInt(String(s.class ?? ""), 10);
      if (!s.teacher_id || !Number.isFinite(classLevel) || classLevel < 5 || classLevel > 12) continue;
      const k = `${s.teacher_id}:${classLevel}`;
      const g = groups.get(k) ?? { teacherId: s.teacher_id, classLevel, ids: [] };
      g.ids.push(s.id);
      groups.set(k, g);
    }

    let processed = 0;
    // ponytail: for-of over the Map needs downlevelIteration on this
    // tsconfig — iterate a plain array instead.
    const groupList = Array.from(groups.entries());
    for (const [key, g] of groupList) {
      if (processed >= MAX_GROUPS_PER_RUN) {
        summary.skipped += groups.size - processed;
        break;
      }
      processed += 1;

      // Idempotency: today's set for this group already published?
      const { data: existing } = await supabase
        .from("assignments")
        .select("id")
        .eq("teacher_id", g.teacherId)
        .eq("class_level", g.classLevel)
        .eq("subject", category)
        .filter("config->>daily_date", "eq", today)
        .limit(1);
      if (existing && existing.length > 0) {
        summary.skipped += 1;
        continue;
      }

      try {
        // Avoidance context: stems from the last 3 daily sets for this class.
        const { data: recent } = await supabase
          .from("assignments")
          .select("id")
          .eq("teacher_id", g.teacherId)
          .eq("class_level", g.classLevel)
          .eq("subject", category)
          .order("created_at", { ascending: false })
          .limit(3);
        const recentIds = ((recent ?? []) as { id: string }[]).map((r) => r.id);
        const seen = new Set<string>();
        if (recentIds.length > 0) {
          const { data: rq } = await supabase.from("assignment_questions").select("stem").in("assignment_id", recentIds).limit(120);
          for (const q of ((rq ?? []) as { stem: string }[])) if (q.stem) seen.add(normalizeStem(q.stem));
        }

        const runToken = `${Date.now().toString(36)}${Math.floor(Math.random() * 0xfffff).toString(36)}`;
        const difficulty = g.classLevel <= 5 ? 2 : g.classLevel <= 8 ? 2 : 3;
        const aiRes = await complete({
          tier: "B",
          system: `You create daily ${category} homework for Class ${g.classLevel} (Indian curriculum). Output ONLY a valid JSON array. No markdown fences.`,
          user: `Generate 5 FRESH ${category} questions for Class ${g.classLevel}.
Level: ${classLevelDescriptor(g.classLevel)}
Difficulty: ${difficulty}/5
Category brief: ${categoryBrief(category, today)}
Variation seed ${runToken}: different items from any previous day.
Schema: [{"position":1,"qtype":"mcq","marks":1,"stem":"...","options":[{"label":"A","text":"...","isCorrect":false},{"label":"B","text":"...","isCorrect":true},{"label":"C","text":"...","isCorrect":false},{"label":"D","text":"...","isCorrect":false}],"correctAnswer":"...","solutionSteps":["..."]}]
Rules: exactly one isCorrect; solutionSteps explains WHY the answer is right.`,
          maxTokens: 2500,
          temperature: 0.8,
        });
        if (aiRes.stubbed) throw new Error("AI is not configured (no provider key).");

        const raw = aiRes.text.trim().replace(/^```json|^```/g, "").replace(/```$/g, "").trim();
        const si = raw.indexOf("[");
        const ei = raw.lastIndexOf("]");
        if (si === -1 || ei <= si) throw new Error(`AI (${aiRes.provider}/${aiRes.model}) returned no question list.`);
        const parsed: unknown = JSON.parse(raw.substring(si, ei + 1));
        if (!Array.isArray(parsed)) throw new Error("AI output was not a list.");

        const questions: DailyQuestion[] = [];
        for (const item of parsed) {
          if (questions.length >= 5) break;
          const q = validDaily(item);
          if (!q) continue;
          const norm = normalizeStem(q.stem);
          if (seen.has(norm)) continue;
          seen.add(norm);
          q.position = questions.length + 1;
          questions.push(q);
        }
        if (questions.length === 0) throw new Error("AI returned no valid questions.");

        const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
        const title = `${category} — ${today}`;
        const { data: assignment, error: aErr } = await supabase
          .from("assignments")
          .insert({
            teacher_id: g.teacherId,
            title,
            description: `Daily ${category} practice auto-generated for Class ${g.classLevel}.`,
            class_level: g.classLevel,
            subject: category,
            chapter_slug: `daily-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            preset: "daily" as never,
            mode: "class" as never,
            submission_mode: "mixed" as never,
            lifecycle: "published" as never,
            due_date: new Date(Date.now() + 24 * 3600_000).toISOString(),
            total_marks: totalMarks,
            passing_marks: Math.round(totalMarks * 0.4),
            target_student_ids: g.ids,
            ai_grading_enabled: false,
            config: { daily: true, daily_date: today, category, provider: aiRes.provider, model: aiRes.model },
          })
          .select("id")
          .single();
        if (aErr || !assignment) throw new Error(aErr?.message || "Assignment insert failed.");

        const rows = questions.map((q) => ({
          assignment_id: (assignment as { id: string }).id,
          position: q.position,
          stem: q.stem,
          qtype: q.qtype,
          marks: q.marks,
          options: q.options,
          correct_answer: q.correctAnswer,
          solution_steps: q.solutionSteps,
          rubric: [],
          fingerprint: computeQuestionFingerprint(`${category}-${today}`, q.stem, q.qtype, { seed: runToken }),
          student_id: null,
        }));
        const { error: qErr } = await supabase.from("assignment_questions").insert(rows as never);
        if (qErr) throw new Error(qErr.message);

        await notifyHomeworkAssigned(supabase, {
          assignmentId: (assignment as { id: string }).id,
          title,
          subject: category,
          classLevel: g.classLevel,
          dueDate: new Date(Date.now() + 24 * 3600_000).toISOString(),
          studentIds: g.ids,
        });

        console.log(JSON.stringify({
          event: "daily_assignment", category, classLevel: g.classLevel,
          provider: aiRes.provider, model: aiRes.model, questions: questions.length,
        }));
        summary.generated += 1;
      } catch (err) {
        summary.failed.push({ group: key, error: (err as Error).message });
      }
    }

    console.log(JSON.stringify({ event: "daily_assignments_run", date: today, category, ...summary, latencyMs: Date.now() - started }));
    return NextResponse.json({ success: true, date: today, category, ...summary });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
