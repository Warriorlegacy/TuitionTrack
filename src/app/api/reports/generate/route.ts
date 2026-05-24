import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Database } from "@/lib/db/types";
import { requireTeacherContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const generateSchema = z.object({
  student_id: z.string().uuid(),
  subject: z.string().optional(),
  language: z.enum(["en", "hi"]).optional(),
  tutor_notes: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { student_id, subject, language, tutor_notes } = parsed.data;

    const context = await requireTeacherContext();
    if (!context.configured || !context.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServerClient();

    // 1. Quota Check (using RPC defined in schema.sql)
    const { data: hasQuota, error: quotaError } = await supabase.rpc("check_report_quota", {
      tutor_id: context.user.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plan: (context.profile as any)?.plan ?? "free"
    });

    if (quotaError) {
      console.error("Quota check error:", quotaError);
    } else if (hasQuota === false) {
      return NextResponse.json(
        { error: "Monthly AI report quota exceeded for your plan" },
        { status: 403 }
      );
    }

    // 2. Rate Limiting (Max 10 per minute per tutor)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: recentCount, error: countError } = await supabase
      .from("reports")
      .select("id, student!inner(teacher_id)", { count: "exact", head: true })
      .eq("student.teacher_id", context.user.id)
      .gte("created_at", oneMinuteAgo);

    if (countError) {
      console.error("Rate limit check error:", countError);
    } else if (recentCount && recentCount >= 10) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute before generating another report." },
        { status: 429 }
      );
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, class, teacher_id")
      .eq("id", student_id)
      .maybeSingle<{ id: string; name: string; class: string; teacher_id: string }>();

    if (studentError || !student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    if (student.teacher_id !== context.user.id) {
      return NextResponse.json(
        { error: "Forbidden: student does not belong to this teacher" },
        { status: 403 }
      );
    }

    const subjectLabel = subject ?? "General";
    const { data: performanceRecords } = await supabase
      .from("performance_records")
      .select("*")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: testScores } = await supabase
      .from("tests")
      .select("subject, marks, total, date")
      .eq("student_id", student_id)
      .order("date", { ascending: false })
      .limit(5);

    const scores =
      testScores && testScores.length > 0
        ? testScores
            .map((t) => `${t.subject}: ${t.marks}/${t.total}`)
            .join(", ")
        : "No test scores available";

    const latestRecord = performanceRecords?.[0];
    const attendancePct = latestRecord?.attendance_pct ?? 0;
    const homeworkPct = latestRecord?.homework_pct ?? 0;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 400 }
      );
    }

    const langInstruction = language === "hi" 
      ? "Write the report in Hindi, but keep names and subjects in English where appropriate."
      : "Write in warm professional Indian-English.";

    const prompt = `You are a professional academic progress report writer for Indian CBSE private tutors. Write a 150-200 word parent progress update for: Student: ${student.name}, Class: ${student.class}, Subject: ${subjectLabel}, Attendance: ${attendancePct}%, Test scores: ${scores}, Homework: ${homeworkPct}%, Tutor's notes: ${tutor_notes ?? "None"}. ${langInstruction} One area of strength and one area for improvement. Sound like a real teacher, not a form letter.`;

    let aiContent: string;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 400,
          temperature: 0.7,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", response.status, errorText);
        return NextResponse.json(
          { error: "Failed to generate report via AI", details: errorText },
          { status: 500 }
        );
      }

      const data = await response.json();
      aiContent =
        data.choices?.[0]?.message?.content ??
        "Unable to generate report at this time.";
    } catch (aiErr) {
      console.error("OpenAI API call failed:", aiErr);
      return NextResponse.json(
        { error: "Unable to reach OpenAI API", details: (aiErr as Error).message },
        { status: 500 }
      );
    }

    const periodLabel = `Report ${new Date().toLocaleDateString("en-IN")}`;

    const { error: perfError } = await supabase
      .from("performance_records")
      .insert({
        student_id,
        period_label: periodLabel,
        attendance_pct: attendancePct ?? 0,
        homework_pct: homeworkPct ?? 0,
        score_1: testScores?.[0]?.marks ?? null,
        score_2: testScores?.[1]?.marks ?? null,
        score_3: testScores?.[2]?.marks ?? null,
        tutor_notes: tutor_notes ?? null,
      } as Database["public"]["Tables"]["performance_records"]["Insert"])
      .select("id")
      .single();

    if (perfError) {
      console.error("Failed to insert performance record:", perfError);
    }

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .insert({
        student_id,
        subject: subjectLabel,
        language: language ?? "en",
        content: aiContent,
        status: "draft",
      } as Database["public"]["Tables"]["reports"]["Insert"])
      .select("id, content, status")
      .single();

    if (reportError || !report) {
      console.error("Failed to insert report:", reportError);
      return NextResponse.json(
        { error: "Failed to save report", details: reportError?.message },
        { status: 500 }
      );
    }

    revalidatePath("/app/reports");
    revalidatePath(`/app/students/${student_id}`);

    return NextResponse.json(report, { status: 201 });
  } catch (err) {
    console.error("Unhandled error in report generate:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
